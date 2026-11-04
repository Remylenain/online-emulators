/**
 * Réglages du lien d'inscription, à part de la logique : ce fichier est
 * importé par l'interface d'administration, un composant client, qui ne doit
 * pas entraîner la base ni les en-têtes Next avec lui.
 */

/** Une journée : le lien est donné de la main à la main, pour être utilisé vite. */
export const INSCRIPTION_DUREE_MS = 24 * 60 * 60 * 1000;

/** Plafonds proposés à l'administrateur. Au-delà, autant créer deux liens. */
export const INSCRIPTION_PLAFONDS = [1, 5, 10] as const;
