/**
 * La vibration de la cartouche, rendue par l'appareil du joueur.
 *
 * Certaines cartouches portent un moteur — Pokémon Pinball, par exemple. Le
 * cœur dit, à chaque passe, quelle part du temps ce moteur a tourné
 * (`surVibration`, de 0 à 1) ; ce module en fait trembler ce que le joueur a
 * en main :
 *
 * - **le téléphone**, par `navigator.vibrate`. Android le fait ; iOS ne le
 *   propose dans aucun navigateur, et l'appel n'y existe pas. Le moteur d'un
 *   téléphone n'a pas de réglage de force : on l'allume par courtes impulsions,
 *   plus longues quand la cartouche vibre plus fort ;
 * - **la manette branchée**, par son `vibrationActuator`, qui lui prend une
 *   force.
 *
 * Rien n'est tenu allumé : chaque ordre dure une fraction de seconde et se
 * renouvelle tant que le cœur vibre. Si la page se fige ou se ferme, la
 * vibration s'arrête donc d'elle-même.
 */

/** En dessous, le moteur de la cartouche n'a fait que frémir : on ne bouge pas. */
const SEUIL = 0.04;
/** La fenêtre d'une impulsion, en millisecondes : trois images de console. */
const FENETRE_MS = 50;
/** Une impulsion plus brève ne se sent pas : le moteur n'a pas le temps de partir. */
const IMPULSION_MIN_MS = 12;
/** La durée d'un ordre donné à une manette ; renouvelé avant son terme. */
const ORDRE_MANETTE_MS = 120;

/** Clé du réglage dans le navigateur : il vaut pour cet appareil, comme le volume. */
export const CLE_VIBRATION = "oe_vibration";

/** Le joueur a-t-il coupé la vibration sur cet appareil ? Allumée tant qu'il n'a rien dit. */
export function lireVibrationRetenue(): boolean {
  try {
    return localStorage.getItem(CLE_VIBRATION) !== "0";
  } catch {
    return true;
  }
}

export function retenirVibration(allumee: boolean): void {
  try {
    localStorage.setItem(CLE_VIBRATION, allumee ? "1" : "0");
  } catch {
    // Stockage indisponible : le réglage vaudra pour cette partie seulement.
  }
}

/**
 * Octet 0x147 de l'en-tête d'une cartouche Game Boy : MBC5 avec moteur. Une
 * cartouche GBA ne l'annonce nulle part ; on ne le sait qu'en la sentant vibrer.
 */
export function cartoucheAMoteur(rom: Uint8Array): boolean {
  const type = rom[0x147];
  return type === 0x1c || type === 0x1d || type === 0x1e;
}

type Actionneur = {
  playEffect?: (
    type: string,
    reglages: { duration: number; startDelay?: number; strongMagnitude: number; weakMagnitude: number },
  ) => Promise<unknown>;
  reset?: () => Promise<unknown>;
};

function actionneurs(): Actionneur[] {
  try {
    const manettes = navigator.getGamepads?.() ?? [];
    return manettes.flatMap((manette) => {
      const actionneur = (manette as unknown as { vibrationActuator?: Actionneur } | null)?.vibrationActuator;
      return actionneur?.playEffect ? [actionneur] : [];
    });
  } catch {
    return [];
  }
}

/** Y a-t-il ici de quoi vibrer : un téléphone qui le sait, ou une manette à moteurs ? */
export function appareilVibrant(tactile: boolean): boolean {
  if (typeof navigator === "undefined") return false;
  // Un ordinateur expose `vibrate` aussi, sans rien pour l'exécuter : on ne
  // s'y fie que sur un écran tactile.
  return (tactile && typeof navigator.vibrate === "function") || actionneurs().length > 0;
}

export class Vibreur {
  private allume = true;
  /** L'instant (`performance.now`) où la fenêtre en cours du téléphone se termine. */
  private finTelephone = 0;
  private finManette = 0;
  private enMarche = false;

  /** Coupe ou rétablit la vibration ; coupée, `regler` ne fait plus rien. */
  activer(allume: boolean): void {
    this.allume = allume;
    if (!allume) this.couper();
  }

  /** À appeler à chaque passe du cœur, avec ce qu'il rapporte du moteur : de 0 à 1. */
  regler(intensite: number): void {
    if (!this.allume || !(intensite >= SEUIL)) {
      this.couper();
      return;
    }
    const force = Math.min(1, intensite);
    const maintenant = performance.now();
    this.enMarche = true;

    if (maintenant >= this.finTelephone && typeof navigator.vibrate === "function") {
      // À pleine force, l'impulsion déborde sur la fenêtre suivante : le
      // moteur ne retombe pas entre deux ordres.
      const duree = force > 0.9 ? FENETRE_MS + 20 : Math.max(IMPULSION_MIN_MS, Math.round(force * FENETRE_MS));
      try {
        navigator.vibrate(duree);
      } catch {
        // Refusé (pas encore de geste du joueur dans la page) : sans gravité.
      }
      this.finTelephone = maintenant + FENETRE_MS;
    }

    if (maintenant >= this.finManette) {
      for (const actionneur of actionneurs()) {
        void actionneur.playEffect?.("dual-rumble", {
          duration: ORDRE_MANETTE_MS,
          strongMagnitude: force,
          weakMagnitude: force,
        })?.catch(() => {});
      }
      this.finManette = maintenant + ORDRE_MANETTE_MS / 2;
    }
  }

  /** Arrête tout de suite ce qui vibre encore : pause, fin de partie, réglage coupé. */
  couper(): void {
    if (!this.enMarche) return;
    this.enMarche = false;
    this.finTelephone = 0;
    this.finManette = 0;
    try {
      if (typeof navigator.vibrate === "function") navigator.vibrate(0);
    } catch {
      // Rien à arrêter.
    }
    for (const actionneur of actionneurs()) void actionneur.reset?.()?.catch(() => {});
  }
}
