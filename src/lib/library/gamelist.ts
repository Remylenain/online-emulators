/**
 * Le format `gamelist.xml` d'EmulationStation — celui de Recalbox, Batocera,
 * RetroPie et ES-DE. Un fichier par système, posé dans le dossier des ROMs :
 *
 *   <gameList>
 *     <game>
 *       <path>./Pokemon Prism.gbc</path>
 *       <name>Pokémon Prism</name>
 *       <desc>…</desc>
 *       <image>./images/Pokemon Prism.jpg</image>
 *       <releasedate>20230824T000000</releasedate>
 *       <developer>RainbowDevs</developer>
 *       <lang>fr</lang>
 *     </game>
 *   </gameList>
 *
 * Le site le parle dans les deux sens : l'administration exporte ses fiches
 * pour qu'un autre appareil les reprenne (voir `api/admin/gamelist`), et
 * `scripts/importer-roms.ts` lit celui d'une installation existante pour ne
 * pas avoir à tout ressaisir.
 *
 * Module sans aucune dépendance : il est chargé par Next comme par les
 * scripts que Node exécute directement.
 */

export type FicheGamelist = {
  /** Nom du fichier ROM, sans dossier : c'est lui qui relie la fiche au jeu. */
  fichier: string;
  nom?: string;
  description?: string;
  /** Chemin de l'image tel qu'il est écrit dans le fichier, relatif au `gamelist.xml`. */
  image?: string;
  annee?: number;
  developpeur?: string;
  /** Code court : « fr », « en »… */
  langue?: string;
};

const echapper = (texte: string) =>
  texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Les caractères de contrôle sont interdits en XML 1.0, tabulation et saut de ligne exceptés.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decoder(texte: string): string {
  return texte
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, contenu: string) => echapper(contenu))
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entite, corps: string) => {
      if (corps[0] === "#") {
        const code = corps[1]?.toLowerCase() === "x" ? parseInt(corps.slice(2), 16) : parseInt(corps.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }
      return ENTITES[corps.toLowerCase()] ?? entite;
    })
    .trim();
}

export function ecrireGamelist(fiches: FicheGamelist[]): string {
  const lignes = ['<?xml version="1.0" encoding="UTF-8"?>', "<gameList>"];
  for (const fiche of fiches) {
    lignes.push("  <game>");
    const balise = (nom: string, valeur: string | undefined) => {
      if (valeur) lignes.push(`    <${nom}>${echapper(valeur)}</${nom}>`);
    };
    balise("path", `./${fiche.fichier}`);
    balise("name", fiche.nom);
    balise("desc", fiche.description);
    balise("image", fiche.image);
    balise("releasedate", fiche.annee ? `${fiche.annee}0101T000000` : undefined);
    balise("developer", fiche.developpeur);
    balise("lang", fiche.langue);
    lignes.push("  </game>");
  }
  lignes.push("</gameList>", "");
  return lignes.join("\n");
}

/**
 * Les fiches d'un `gamelist.xml`. Lecture tolérante : les balises inconnues
 * sont ignorées, une fiche sans `<path>` aussi, et un fichier abîmé rend ce
 * qui a pu être lu plutôt que d'échouer.
 *
 * Pour la jaquette, `<thumbnail>` passe avant `<image>` : Batocera y range la
 * boîte du jeu et garde `<image>` pour une capture d'écran. Les autres
 * distributions n'écrivent que `<image>`.
 */
export function lireGamelist(xml: string): FicheGamelist[] {
  const fiches: FicheGamelist[] = [];
  for (const [, corps] of xml.matchAll(/<game\b[^>]*>([\s\S]*?)<\/game>/g)) {
    const lire = (nom: string): string | undefined => {
      const trouve = new RegExp(`<${nom}\\b[^>]*>([\\s\\S]*?)</${nom}>`).exec(corps!);
      const valeur = trouve ? decoder(trouve[1]!) : "";
      return valeur || undefined;
    };
    const chemin = lire("path");
    if (!chemin) continue;
    const fichier = chemin.split(/[\\/]/).pop();
    if (!fichier) continue;

    const fiche: FicheGamelist = { fichier };
    fiche.nom = lire("name");
    fiche.description = lire("desc");
    fiche.image = lire("thumbnail") ?? lire("image");
    fiche.developpeur = lire("developer");
    const annee = Number(lire("releasedate")?.slice(0, 4));
    if (Number.isInteger(annee) && annee >= 1989 && annee <= 2100) fiche.annee = annee;
    // « fr », ou une liste « en,fr,de » : le français d'abord, sinon la première.
    const langues = (lire("lang") ?? "")
      .toLowerCase()
      .split(/[,;\s]+/)
      .filter((code) => /^[a-z]{2}$/.test(code));
    fiche.langue = langues.includes("fr") ? "fr" : langues[0];
    fiches.push(fiche);
  }
  return fiches;
}
