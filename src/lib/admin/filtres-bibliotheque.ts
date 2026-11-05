/**
 * Filtres de la page Administration → Bibliothèque.
 *
 * Module neutre, sans rien de serveur ni de client : la page filtre côté
 * serveur et ses contrôles s'affichent côté client, et les deux doivent
 * s'entendre sur les mêmes clés. Une constante exportée d'un fichier
 * `"use client"` arriverait dans la page comme une référence, pas comme une
 * valeur.
 */

/** Ce qu'il reste à faire sur un jeu : un seul état filtré à la fois. */
export const ETATS = {
  "sans-jaquette": "Sans jaquette",
  "sans-description": "Sans description",
  "sans-langue": "Langue à renseigner",
  retires: "Retirés",
  retouches: "Retouchés",
} as const;

export type EtatKey = keyof typeof ETATS;

export function isEtatKey(valeur: string): valeur is EtatKey {
  return valeur in ETATS;
}

export const TYPES_ADMIN = {
  hacks: "Rom hacks et traductions",
  officiels: "Jeux officiels",
} as const;

export type TypeAdmin = keyof typeof TYPES_ADMIN;

export function isTypeAdmin(valeur: string): valeur is TypeAdmin {
  return valeur in TYPES_ADMIN;
}

/** Jeux affichés par page. Assez pour balayer, assez peu pour ne pas défiler sans fin. */
export const PAR_PAGE = 50;

export type FiltresBibliotheque = {
  q: string;
  console: string;
  type: TypeAdmin | "";
  etat: EtatKey | "";
  page: number;
};

/**
 * Les nombres affichés à côté de chaque filtre.
 *
 * Chacun est compté avec les autres filtres appliqués, mais pas le sien :
 * « Game Boy Color (12) » dit combien de jeux on verrait en choisissant cette
 * console sans toucher au reste.
 */
export type ComptesBibliotheque = {
  /** Tous les jeux de la bibliothèque, filtres ignorés. */
  total: number;
  publies: number;
  /** Jeux qui passent tous les filtres. */
  trouves: number;
  pages: number;
  /** Sans filtre de console : le nombre derrière « Toutes les consoles ». */
  toutesConsoles: number;
  consoles: Record<string, number>;
  /** Sans filtre de type : le nombre derrière « Tous les jeux ». */
  tousTypes: number;
  types: Record<TypeAdmin, number>;
  etats: Record<EtatKey, number>;
};
