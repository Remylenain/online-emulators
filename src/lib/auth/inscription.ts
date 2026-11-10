/**
 * Réglages du lien d'inscription, à part de la logique : ce fichier est
 * importé par l'interface d'administration, un composant client, qui ne doit
 * pas entraîner la base ni les en-têtes Next avec lui.
 */

/**
 * Les durées de validité proposées à l'administrateur, en jours. Une journée
 * par défaut : le lien est donné de la main à la main, pour être utilisé
 * vite. Une semaine ou un mois pour un lien qu'on laisse à un groupe — en
 * sachant qu'un lien qui vit plus longtemps a plus de temps pour circuler.
 */
export const INSCRIPTION_DUREES_JOURS = [1, 7, 30] as const;
export const INSCRIPTION_DUREE_PAR_DEFAUT = 1;

const JOUR_MS = 24 * 60 * 60 * 1000;

export function dureeValide(jours: unknown): jours is (typeof INSCRIPTION_DUREES_JOURS)[number] {
  return (INSCRIPTION_DUREES_JOURS as readonly unknown[]).includes(jours);
}

export function dureeEnMs(jours: (typeof INSCRIPTION_DUREES_JOURS)[number]): number {
  return jours * JOUR_MS;
}

/** Plafonds proposés à l'administrateur. Au-delà, autant créer deux liens. */
export const INSCRIPTION_PLAFONDS = [1, 5, 10] as const;
