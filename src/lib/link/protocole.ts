import { BOUTONS_LIBRETRO } from "@/lib/emulator/libretro";
import type { Bouton } from "@/lib/emulator/adapter";

/**
 * Ce qui circule entre le serveur du câble link et les deux navigateurs.
 *
 * Partagé par les deux côtés, donc sans dépendance à Node ni au DOM.
 *
 * Le serveur fait tourner les deux consoles ; chaque navigateur n'envoie que
 * ses boutons et ne reçoit que son écran et le son. Les trames lourdes —
 * image, son — sont binaires ; tout le reste est du JSON.
 */

/** Premier octet d'une trame binaire. */
export const TRAME = { IMAGE: 1, AUDIO: 2 } as const;

/**
 * Trame IMAGE : [1][joueur u8][largeur u16][hauteur u16][RGB565 compressé
 * en deflate brut]. Entiers en petit-boutiste.
 */
export const ENTETE_IMAGE = 6;

/**
 * Trame AUDIO : [2][0][0][0][fréquence u32][échantillons Int16 mono].
 *
 * Huit octets d'en-tête, et non cinq : les échantillons sont lus en place
 * par un `Int16Array` posé sur la trame, qui exige un décalage pair. À cinq,
 * chaque trame levait une exception et le son restait muet.
 */
export const ENTETE_AUDIO = 8;

/** Masque de boutons tel que le cœur libretro le lit. */
export const BITS: Record<Bouton, number> = BOUTONS_LIBRETRO;

export type EtatSalon = "attente" | "en-jeu" | "termine";

/**
 * Les textes que le serveur adresse au joueur.
 *
 * Le serveur ne connaît pas la langue de celui qui lira : il envoie donc un
 * **code** stable, et à part les **valeurs** que le texte cite — un pseudo, un
 * code de salon, un nombre. C'est le navigateur qui choisit le texte dans son
 * dictionnaire (`./textes.ts`, que le serveur ne charge pas).
 *
 * Le texte français voyage à côté du code, en repli : une page chargée avant
 * que les codes existent affiche encore quelque chose, et un code que le
 * navigateur ne connaît pas — ou une erreur que personne n'a prévue, qui n'en
 * porte pas — se lit quand même.
 *
 * Un code ne change plus de sens une fois publié ; un texte nouveau prend un
 * code nouveau.
 */
export type Valeurs = Record<string, string | number>;

/**
 * Un refus ou une erreur. En commentaire, les valeurs qui l'accompagnent.
 *
 * Les quatre premiers ne viennent que des routes `/link/salons`, les
 * suivants de l'ouverture d'un salon, puis de l'entrée par la WebSocket, puis
 * du fil de travail qui fait tourner les deux consoles.
 */
export type CodeErreur =
  | "non-connecte"
  | "requete-illisible"
  | "methode-non-permise"
  | "erreur-interne"
  /** `salon` : le code du salon où le compte est déjà. */
  | "deja-dans-le-salon"
  | "jeu-introuvable"
  | "console-sans-link"
  /** Le jeu est marqué « solo » dans la bibliothèque. */
  | "jeu-solo"
  | "marge-insuffisante"
  /** `salons` : le nombre de salons en cours. */
  | "serveur-complet"
  | "file-d-attente"
  | "salon-complet"
  | "deja-dans-un-autre-salon"
  | "joueur-du-salon"
  | "spectateurs-fermes"
  | "partie-pas-commencee"
  /** `max` : le nombre de spectateurs admis. */
  | "spectateurs-au-complet"
  | "salon-non-demarre"
  | "demarrage-impossible"
  | "coeur-jeu-refuse"
  /** `code` : ce que le cœur a répondu. */
  | "coeur-rom-refusee"
  /** `joueur` : 1 ou 2. */
  | "coeur-sans-memoire"
  /** `joueur` : 1 ou 2 ; `code` : ce que le cœur a répondu. */
  | "coeur-sauvegarde-refusee";

/** Pourquoi une session s'est terminée. */
export type CodeFin =
  /** `pseudo` : le joueur qui a terminé la session. */
  | "demande"
  | "coeur-echoue"
  | "fil-plante"
  /** `pseudo` : l'hôte, parti depuis cinq minutes. */
  | "hote-absent"
  | "abandon";

/** Une erreur dite sur la WebSocket : `message` est le texte français, en repli. */
export type ErreurLink = { message: string; code?: CodeErreur; valeurs?: Valeurs };

/** La fin d'une session : `raison` est le texte français, en repli. */
export type Fin = { raison: string; code?: CodeFin; valeurs?: Valeurs };

/**
 * Le corps d'une réponse de refus des routes `/link/salons` : la même chose
 * qu'`ErreurLink`, sous le nom que ces routes ont toujours donné au texte.
 */
export type Refus = { erreur: string; code?: CodeErreur; valeurs?: Valeurs };

export type Participant = { pseudo: string; present: boolean };

export type MessageServeur =
  | {
      t: "etat";
      etat: EtatSalon;
      prive: boolean;
      /** Place du destinataire : 0 ou 1. Sans valeur pour un spectateur. */
      joueur: 0 | 1;
      /** Le destinataire regarde sans jouer : il reçoit les deux écrans. */
      spectateur: boolean;
      joueurs: [Participant, Participant | null];
      spectateurs: { ouverts: boolean; nombre: number; max: number };
      jeu: { titre: string; largeur: number; hauteur: number; gachettes: boolean };
    }
  | ({ t: "termine"; enregistre: boolean } & Fin)
  | ({ t: "erreur" } & ErreurLink);

export type MessageClient = { t: "boutons"; masque: number } | { t: "terminer" };
