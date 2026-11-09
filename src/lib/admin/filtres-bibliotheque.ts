/**
 * Filtres de la page Administration → Bibliothèque.
 *
 * Module neutre, sans rien de serveur ni de client : la page filtre côté
 * serveur et ses contrôles s'affichent côté client, et les deux doivent
 * s'entendre sur les mêmes clés. Une constante exportée d'un fichier
 * `"use client"` arriverait dans la page comme une référence, pas comme une
 * valeur.
 */

/**
 * Ce qu'il reste à faire sur un jeu : un seul état filtré à la fois.
 *
 * Seulement les clés, dans l'ordre d'affichage : les libellés suivent la
 * langue et sont dans le dictionnaire (`adminBibliotheque.filtres.etats`).
 */
export const ETATS = ["sans-jaquette", "sans-description", "sans-langue", "retires", "retouches"] as const;

export type EtatKey = (typeof ETATS)[number];

export function isEtatKey(valeur: string): valeur is EtatKey {
  return (ETATS as readonly string[]).includes(valeur);
}

/** Les libellés sont dans le dictionnaire (`adminBibliotheque.filtres.types`). */
export const TYPES_ADMIN = ["hacks", "officiels"] as const;

export type TypeAdmin = (typeof TYPES_ADMIN)[number];

export function isTypeAdmin(valeur: string): valeur is TypeAdmin {
  return (TYPES_ADMIN as readonly string[]).includes(valeur);
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
