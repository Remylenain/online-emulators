/**
 * Les bornes de la vitrine, dans un module neutre : le formulaire de
 * l'administration (navigateur) et `src/lib/vitrine.ts` (serveur, base de
 * données) les lisent tous les deux.
 */

/** Au-delà, ce n'est plus une vitrine mais un catalogue. */
export const ENTREES_MAX = 4;
export const LIBELLE_MAX = 40;

/** Un bouton de la page d'accueil : ce qu'il dit, et le jeu qu'il lance. */
export type EntreeVitrine = { libelle: string; jeu: string };

export type Vitrine = { active: boolean; entrees: EntreeVitrine[] };
