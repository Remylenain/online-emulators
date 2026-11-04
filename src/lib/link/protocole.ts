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

export type Participant = { pseudo: string; present: boolean };

export type MessageServeur =
  | {
      t: "etat";
      etat: EtatSalon;
      prive: boolean;
      /** Place du destinataire : 0 ou 1. */
      joueur: 0 | 1;
      joueurs: [Participant, Participant | null];
      jeu: { titre: string; largeur: number; hauteur: number; gachettes: boolean };
    }
  | { t: "termine"; enregistre: boolean; raison: string }
  | { t: "erreur"; message: string };

export type MessageClient = { t: "boutons"; masque: number } | { t: "terminer" };
