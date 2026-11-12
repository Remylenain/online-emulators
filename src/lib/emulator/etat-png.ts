/**
 * Un point de reprise rangé dans un PNG, au format de mGBA.
 *
 * Le cœur ordinaire du lecteur rend ses états sous cette forme : l'image de
 * l'écran, et dans un bloc privé `gbAs` l'état de la console, compressé par
 * zlib. Le fichier est sa propre vignette, et tout le site compte dessus —
 * les routes, la liste des reprises, le stockage de l'invité.
 *
 * Le cœur « une console » (`./mgs.ts`), lui, rend et reprend un état brut.
 * Quand le lecteur du site s'en sert, ce module fait la jointure dans les
 * deux sens : il range l'état brut dans un PNG de l'écran, et retrouve l'état
 * brut dans un PNG — le sien comme celui que l'autre cœur a écrit avant lui.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BLOC_ETAT = "gbAs";

export function estPng(octets: Uint8Array): boolean {
  return octets.length > SIGNATURE.length && SIGNATURE.every((octet, i) => octets[i] === octet);
}

let table: Uint32Array | null = null;

/** Le contrôle que le format PNG pose sur chaque bloc. */
function crc32(octets: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < octets.length; i++) crc = table[(crc ^ octets[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(octets: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < octets.length; i++) {
    a = (a + octets[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Un flux zlib qui ne compresse pas : des blocs « tels quels », de 65 535
 * octets au plus. N'importe quel zlib le relit, et il s'écrit sans attendre —
 * un point de reprise se capture dans l'instant, pas après une promesse.
 */
function zlibSansCompression(donnees: Uint8Array): Uint8Array {
  const BLOC = 65535;
  const blocs = Math.max(1, Math.ceil(donnees.length / BLOC));
  const sortie = new Uint8Array(2 + blocs * 5 + donnees.length + 4);
  const vue = new DataView(sortie.buffer);
  sortie[0] = 0x78;
  sortie[1] = 0x01;
  let p = 2;
  for (let i = 0; i < blocs; i++) {
    const morceau = donnees.subarray(i * BLOC, (i + 1) * BLOC);
    sortie[p] = i === blocs - 1 ? 1 : 0;
    vue.setUint16(p + 1, morceau.length, true);
    vue.setUint16(p + 3, ~morceau.length & 0xffff, true);
    sortie.set(morceau, p + 5);
    p += 5 + morceau.length;
  }
  vue.setUint32(p, adler32(donnees));
  return sortie;
}

/**
 * Range un état brut dans un PNG de ce que montre le canvas. `null` si le
 * navigateur n'a pas su rendre l'image : mieux vaut ne rien enregistrer qu'un
 * fichier que le site ne saurait pas afficher.
 */
export function emballerEtat(canvas: HTMLCanvasElement, etat: Uint8Array): Uint8Array | null {
  let image: Uint8Array;
  try {
    const adresse = canvas.toDataURL("image/png");
    const binaire = atob(adresse.slice(adresse.indexOf(",") + 1));
    image = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) image[i] = binaire.charCodeAt(i);
  } catch {
    return null;
  }
  // Le bloc de fin (`IEND`, douze octets) clôt le fichier : le nôtre le précède.
  if (!estPng(image) || image.length < 20) return null;
  const fin = image.length - 12;

  const contenu = zlibSansCompression(etat);
  const bloc = new Uint8Array(12 + contenu.length);
  const vue = new DataView(bloc.buffer);
  vue.setUint32(0, contenu.length);
  for (let i = 0; i < 4; i++) bloc[4 + i] = BLOC_ETAT.charCodeAt(i);
  bloc.set(contenu, 8);
  vue.setUint32(8 + contenu.length, crc32(bloc.subarray(4, 8 + contenu.length)));

  const sortie = new Uint8Array(image.length + bloc.length);
  sortie.set(image.subarray(0, fin));
  sortie.set(bloc, fin);
  sortie.set(image.subarray(fin), fin + bloc.length);
  return sortie;
}

/**
 * Retrouve l'état brut dans un PNG de mGBA. `null` s'il n'y est pas, ou si le
 * navigateur ne sait pas décompresser (`DecompressionStream`, absent des
 * navigateurs d'avant 2023).
 */
export async function deballerEtat(png: Uint8Array): Promise<Uint8Array | null> {
  if (!estPng(png)) return null;
  const vue = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = SIGNATURE.length;
  while (p + 12 <= png.length) {
    const taille = vue.getUint32(p);
    const nom = String.fromCharCode(png[p + 4]!, png[p + 5]!, png[p + 6]!, png[p + 7]!);
    if (p + 12 + taille > png.length) return null;
    if (nom === BLOC_ETAT) {
      try {
        const flux = new Blob([png.slice(p + 8, p + 8 + taille)]).stream().pipeThrough(new DecompressionStream("deflate"));
        return new Uint8Array(await new Response(flux).arrayBuffer());
      } catch {
        return null;
      }
    }
    p += 12 + taille;
  }
  return null;
}
