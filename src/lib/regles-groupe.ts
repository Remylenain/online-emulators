/**
 * Les règles d'un groupe d'accès, dans l'ordre où on les propose. À part de
 * `./acces.ts`, qui parle à la base : ce fichier-ci se charge aussi dans le
 * navigateur.
 */
export const REGLES_GROUPE = ["liste", "romhacks", "tout"] as const;
export type RegleGroupe = (typeof REGLES_GROUPE)[number];
