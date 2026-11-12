/**
 * Ce que le lecteur attend d'un cœur d'émulation.
 *
 * Toute l'interface du lecteur est écrite contre ce contrat, et jamais contre
 * mGBA directement. Changer de cœur reviendrait à écrire une autre
 * implémentation de `Emulateur` — les pages, le gamepad tactile, le menu et la
 * synchronisation des sauvegardes ne bougeraient pas.
 *
 * Ce n'est pas une précaution théorique : le choix du cœur s'est joué sur des
 * fonctions annoncées mais non vérifiées (voir `docs/decisions.md`), et un
 * cœur de remplacement reste une possibilité.
 */

/** Boutons de la console, tels que le cœur les nomme. */
export type Bouton =
  | "A"
  | "B"
  | "START"
  | "SELECT"
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "L"
  | "R";

export type EtatLecteur = "chargement" | "en-jeu" | "en-pause" | "erreur";

export type OptionsDemarrage = {
  /** Le canvas où le cœur dessine. */
  canvas: HTMLCanvasElement;
  /** La ROM, déjà téléchargée. */
  rom: { nom: string; donnees: Uint8Array };
  /** La sauvegarde du compte, si une partie existe déjà. */
  sauvegarde?: Uint8Array | null;
  /** Prévient quand le cœur a modifié la sauvegarde. */
  surSauvegardeModifiee?: () => void;
  /** Prévient si le cœur s'arrête brutalement. */
  surPlantage?: () => void;
  /**
   * Le moteur de vibration de la cartouche, pour les cœurs qui le rapportent :
   * appelé à chaque passe avec la part du temps où il a tourné, de 0 à 1, et
   * avec 0 quand le jeu s'arrête (pause, fin). Voir `./vibration.ts`.
   */
  surVibration?: (intensite: number) => void;
};

export interface Emulateur {
  demarrer(options: OptionsDemarrage): Promise<void>;

  /** Libère le cœur et ses ressources. À appeler en quittant la page. */
  arreter(): void;

  pause(): void;
  reprendre(): void;
  reinitialiser(): void;

  /**
   * Un bouton pressé ou relâché.
   *
   * Seule entrée du cœur : le clavier comme le gamepad tactile passent par
   * là. Le lecteur traduit lui-même les touches en boutons, plutôt que de
   * confier la disposition au cœur — il garde ainsi la main sur les touches
   * qu'il intercepte, et le remappage ne dépend d'aucune implémentation.
   */
  bouton(nom: Bouton, enfonce: boolean): void;

  /** 1 = vitesse normale. Le lecteur masque l'option si elle n'est pas gérée. */
  vitesse(multiplicateur: number): void;
  vitesseActuelle(): number;

  /** Contenu de la sauvegarde, à envoyer au serveur. */
  lireSauvegarde(): Uint8Array | null;

  /**
   * Savestates, numérotés de 1 à 5.
   *
   * L'écriture rend le contenu de l'état, pour l'envoyer au serveur : un
   * savestate doit suivre le joueur d'un appareil à l'autre, pas rester dans
   * le navigateur qui l'a pris. La lecture reçoit symétriquement les octets
   * rapportés du serveur.
   */
  ecrireEtat(emplacement: number): Uint8Array | null;
  lireEtat(emplacement: number, donnees: Uint8Array): boolean;

  volume(pourcentage: number): void;

  /** Ce que ce cœur sait faire, pour n'afficher que les options utilisables. */
  capacites: {
    vitesse: boolean;
    etats: boolean;
    capture: boolean;
    cableLink: boolean;
  };
}
