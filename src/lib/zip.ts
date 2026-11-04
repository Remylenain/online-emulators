import { crc32, deflateRawSync } from "node:zlib";

/**
 * Écriture d'archives zip, sans dépendance.
 *
 * Le format est simple quand on se limite à ce qu'il nous faut : des fichiers
 * de quelques centaines de kilo-octets au plus, une archive loin des 4 Gio où
 * commence le zip64, des noms en UTF-8. Chaque entrée est dégonflée avec zlib,
 * qui est dans Node ; le CRC aussi, depuis Node 22.
 *
 * L'archive se produit par morceaux : les fichiers sont lus un par un, et rien
 * n'oblige à les tenir tous en mémoire en même temps.
 */

export type EntreeZip = { nom: string; donnees: Uint8Array; modifie: Date };

type Centrale = {
  nom: Uint8Array;
  crc: number;
  compresse: number;
  taille: number;
  dosHeure: number;
  dosDate: number;
  position: number;
};

const VERSION = 20;
const DRAPEAU_UTF8 = 0x0800;
const METHODE_DEFLATE = 8;

/**
 * Produit l'archive entrée par entrée. `entrees` est une source asynchrone :
 * le lecteur de fichiers n'a besoin de lire le suivant que lorsque le
 * précédent est parti.
 */
export async function* ecrireZip(entrees: AsyncIterable<EntreeZip>): AsyncGenerator<Uint8Array> {
  const centrale: Centrale[] = [];
  let position = 0;

  for await (const entree of entrees) {
    const nom = new TextEncoder().encode(entree.nom);
    const compresse = deflateRawSync(entree.donnees);
    const { dosHeure, dosDate } = horodatageDos(entree.modifie);
    const crc = crc32(entree.donnees);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, VERSION, true);
    local.setUint16(6, DRAPEAU_UTF8, true);
    local.setUint16(8, METHODE_DEFLATE, true);
    local.setUint16(10, dosHeure, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, compresse.length, true);
    local.setUint32(22, entree.donnees.length, true);
    local.setUint16(26, nom.length, true);
    local.setUint16(28, 0, true);

    centrale.push({
      nom,
      crc,
      compresse: compresse.length,
      taille: entree.donnees.length,
      dosHeure,
      dosDate,
      position,
    });

    yield new Uint8Array(local.buffer);
    yield nom;
    yield new Uint8Array(compresse);
    position += 30 + nom.length + compresse.length;
  }

  const debutCentrale = position;
  for (const e of centrale) {
    const entete = new DataView(new ArrayBuffer(46));
    entete.setUint32(0, 0x02014b50, true);
    entete.setUint16(4, VERSION, true);
    entete.setUint16(6, VERSION, true);
    entete.setUint16(8, DRAPEAU_UTF8, true);
    entete.setUint16(10, METHODE_DEFLATE, true);
    entete.setUint16(12, e.dosHeure, true);
    entete.setUint16(14, e.dosDate, true);
    entete.setUint32(16, e.crc, true);
    entete.setUint32(20, e.compresse, true);
    entete.setUint32(24, e.taille, true);
    entete.setUint16(28, e.nom.length, true);
    entete.setUint16(30, 0, true); // extra
    entete.setUint16(32, 0, true); // commentaire
    entete.setUint16(34, 0, true); // disque
    entete.setUint16(36, 0, true); // attributs internes
    entete.setUint32(38, 0, true); // attributs externes
    entete.setUint32(42, e.position, true);
    yield new Uint8Array(entete.buffer);
    yield e.nom;
    position += 46 + e.nom.length;
  }

  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(4, 0, true);
  fin.setUint16(6, 0, true);
  fin.setUint16(8, centrale.length, true);
  fin.setUint16(10, centrale.length, true);
  fin.setUint32(12, position - debutCentrale, true);
  fin.setUint32(16, debutCentrale, true);
  fin.setUint16(20, 0, true);
  yield new Uint8Array(fin.buffer);
}

/** Le zip date ses fichiers à la seconde paire, en heure locale, depuis 1980. */
function horodatageDos(date: Date): { dosHeure: number; dosDate: number } {
  const annee = Math.max(1980, date.getFullYear());
  return {
    dosHeure: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    dosDate: ((annee - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** L'archive sous forme de flux, pour une réponse HTTP. */
export function fluxZip(entrees: AsyncIterable<EntreeZip>): ReadableStream<Uint8Array> {
  const generateur = ecrireZip(entrees);
  return new ReadableStream<Uint8Array>({
    async pull(controleur) {
      const { value, done } = await generateur.next();
      if (done) controleur.close();
      else controleur.enqueue(value);
    },
    cancel() {
      void generateur.return(undefined);
    },
  });
}
