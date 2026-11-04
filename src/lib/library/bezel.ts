/**
 * Mesure de la zone d'écran d'un habillage.
 *
 * Un habillage est une image pleine — la console dessinée — percée d'une zone
 * transparente où doit apparaître le jeu. Cette zone n'a ni la même taille ni
 * la même place d'un fichier à l'autre : on la mesure donc sur l'image.
 *
 * On part du centre et on suit les pixels transparents de proche en proche.
 * Prendre simplement tous les pixels transparents de l'image serait faux dès
 * qu'un coin arrondi ou une découpe décorative l'est aussi : la zone
 * engloberait alors l'image entière.
 */

/**
 * En dessous de cette opacité, un pixel appartient à l'écran.
 *
 * La moitié, et non zéro : beaucoup d'habillages dessinent une ombre
 * intérieure semi-transparente sur le pourtour de l'écran. Elle doit rester
 * par-dessus le jeu, pas repousser la zone vers l'intérieur.
 */
const SEUIL_OPACITE = 128;

export type ZoneEcran = { x: number; y: number; largeur: number; hauteur: number };

/**
 * `alpha` : un octet d'opacité par pixel, ligne après ligne.
 * Rend la zone en pixels, ou `null` si le centre de l'image n'est pas
 * transparent — l'image n'est alors pas un habillage utilisable.
 */
export function mesurerZoneEcran(
  alpha: Uint8Array,
  largeur: number,
  hauteur: number,
): ZoneEcran | null {
  const transparent = (i: number) => alpha[i]! < SEUIL_OPACITE;

  const depart = Math.floor(hauteur / 2) * largeur + Math.floor(largeur / 2);
  if (!transparent(depart)) return null;

  const vu = new Uint8Array(largeur * hauteur);
  // Pile explicite : une récursion déborderait sur deux millions de pixels.
  const pile = new Int32Array(largeur * hauteur);
  let sommet = 0;
  pile[sommet++] = depart;
  vu[depart] = 1;

  let minX = largeur;
  let minY = hauteur;
  let maxX = -1;
  let maxY = -1;

  while (sommet > 0) {
    const i = pile[--sommet]!;
    const x = i % largeur;
    const y = (i - x) / largeur;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    const voisins = [
      x > 0 ? i - 1 : -1,
      x < largeur - 1 ? i + 1 : -1,
      y > 0 ? i - largeur : -1,
      y < hauteur - 1 ? i + largeur : -1,
    ];
    for (const v of voisins) {
      if (v >= 0 && !vu[v] && transparent(v)) {
        vu[v] = 1;
        pile[sommet++] = v;
      }
    }
  }

  return { x: minX, y: minY, largeur: maxX - minX + 1, hauteur: maxY - minY + 1 };
}
