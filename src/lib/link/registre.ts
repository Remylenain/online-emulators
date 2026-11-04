import type { EtatSalon } from "./protocole";

/**
 * Les salons, en mémoire, partagés entre le serveur du câble link et les
 * pages du site.
 *
 * Les deux vivent dans le même processus Node mais pas dans le même module :
 * Next empaquette sa copie de ce fichier, le serveur charge la sienne. Pour
 * que les deux voient les mêmes salons, l'état est accroché à `globalThis` —
 * la même astuce que la connexion à la base dans `src/db/index.ts`.
 *
 * Ce module ne contient que des données et des lectures. Les actions — créer,
 * démarrer, terminer — sont dans `salons.ts`, qui n'est chargé que par le
 * serveur : les pages n'ont pas à savoir lancer un fil de travail.
 */

export type Place = {
  userId: string;
  pseudo: string;
  /** Nombre d'onglets connectés : zéro, le joueur est parti. */
  connexions: number;
  /** Depuis quand il est parti, tant qu'il n'est pas revenu. */
  absentDepuis: number | null;
};

export type Salon = {
  id: string;
  jeu: { id: string; titre: string; slug: string; consoleSlug: string; romPath: string };
  places: [Place, Place | null];
  etat: EtatSalon;
  /**
   * Un salon privé n'apparaît pas dans la liste de la fiche du jeu : seul qui
   * en connaît le code peut y entrer. Le code fait office de clé — six
   * caractères tirés au sort, trop pour être devinés en essayant.
   */
  prive: boolean;
  creeLe: number;
  /** Dernier moment où quelqu'un était là, pour clore les salons abandonnés. */
  derniereActivite: number;
  /**
   * Ce que le serveur y accroche — fil de travail, prises — sans que les pages
   * aient à en connaître la forme.
   */
  interne?: unknown;
};

const global = globalThis as unknown as { __salonsLink?: Map<string, Salon> };

export function salons(): Map<string, Salon> {
  global.__salonsLink ??= new Map();
  return global.__salonsLink;
}

/** Salons publics d'un jeu qui attendent un second joueur, le plus récent en premier. */
export function salonsEnAttente(jeuId: string): Salon[] {
  return [...salons().values()]
    .filter((salon) => salon.jeu.id === jeuId && salon.etat === "attente" && !salon.prive)
    .sort((a, b) => b.creeLe - a.creeLe);
}

/** Le salon en cours auquel ce compte participe, s'il y en a un. */
export function salonDuCompte(userId: string, jeuId?: string): Salon | undefined {
  return [...salons().values()].find(
    (salon) =>
      salon.etat !== "termine" &&
      (jeuId === undefined || salon.jeu.id === jeuId) &&
      salon.places.some((place) => place?.userId === userId),
  );
}
