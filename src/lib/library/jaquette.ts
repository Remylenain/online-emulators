/**
 * Découpe des jaquettes de boîte.
 *
 * Les scans de jaquettes couvrent la boîte entière, mise à plat : dos à
 * gauche, tranche au milieu, face avant à droite. Le site n'affiche que la
 * face avant dans les grilles, et le dos sur la fiche de jeu.
 *
 * La découpe se fait à l'import, pas en CSS. Une page console affiche une
 * trentaine de vignettes : avec un recadrage CSS, le navigateur
 * téléchargerait la jaquette entière — plus de deux fois la surface utile —
 * pour chacune d'elles.
 *
 * Les proportions ont été relevées sur un scan de 3272 × 1370 : dos et face
 * font la même largeur à cinq pixels près, séparés par une tranche de 223 px.
 * Elles sont exprimées en fractions de la largeur pour rester valables si un
 * scan arrive dans une autre définition.
 */

/**
 * Rapport largeur/hauteur du gabarit de jaquette dépliée (3272 / 1370).
 *
 * La reconnaissance se fait sur ce rapport précis, et non sur un simple
 * « plus large que haut » : les proportions des panneaux ci-dessous ne valent
 * que pour ce gabarit. Une image large mais d'un autre format — une étiquette
 * de cartouche, par exemple — serait recadrée n'importe comment. Mieux vaut
 * l'afficher entière, ce qui se voit, que la découper de travers.
 */
export const RATIO_JAQUETTE_DEPLIEE = 3272 / 1370;

/** Tolérance autour de ce rapport, pour accepter un scan recadré de près. */
export const TOLERANCE_RATIO = 0.04;

/** Bornes horizontales de chaque panneau, en fraction de la largeur totale. */
export const PANNEAUX = {
  dos: { debut: 0, fin: 0.4652 },
  face: { debut: 0.5333, fin: 1 },
} as const;

export type Panneau = keyof typeof PANNEAUX;

export type Decoupe = { left: number; top: number; width: number; height: number };

/**
 * Rectangle à extraire pour un panneau donné.
 *
 * Les bornes sont arrondies vers l'intérieur : mieux vaut perdre un pixel que
 * déborder d'un pixel sur la tranche, qui se verrait.
 */
export function decoupePanneau(
  largeur: number,
  hauteur: number,
  panneau: Panneau,
): Decoupe {
  const { debut, fin } = PANNEAUX[panneau];
  const left = Math.ceil(largeur * debut);
  const right = Math.floor(largeur * fin);
  return { left, top: 0, width: right - left, height: hauteur };
}

/** Une image est-elle une jaquette dépliée plutôt qu'une face seule ? */
export function estJaquetteDepliee(largeur: number, hauteur: number): boolean {
  const ecart = Math.abs(largeur / hauteur - RATIO_JAQUETTE_DEPLIEE);
  return ecart / RATIO_JAQUETTE_DEPLIEE <= TOLERANCE_RATIO;
}
