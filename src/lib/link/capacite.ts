import os from "node:os";
import { ecrireParametre, lireParametre } from "@/lib/parametres";
import { salons } from "./registre";

/**
 * Combien de salons le serveur peut tenir à la fois.
 *
 * Chaque salon fait tourner deux consoles dans un fil de travail, à 60 images
 * par seconde : c'est du processeur, et un serveur qui en manque ralentit
 * tous les salons en même temps. On mesure donc une fois, sur le serveur, ce
 * que coûte un salon de chaque famille (`npm run link:capacite`), on garde
 * une marge, et on refuse d'ouvrir un salon de plus quand le budget est pris.
 *
 * Les coûts mesurés et la marge vivent dans la table `settings` ; le nombre
 * de cœurs est lu sur la machine. Tant que rien n'a été mesuré, il n'y a pas
 * de limite : mieux vaut un serveur qui rame qu'un câble link qui refuse sans
 * raison.
 */

/** Deux familles de coût : GB et GBC partagent TGB Dual, la GBA a mGBA. */
export type Famille = "gb" | "gba";

const CLE_CHARGE: Record<Famille, string> = { gb: "link_charge_gb", gba: "link_charge_gba" };
const CLE_MARGE = "link_marge";

/** Part du processeur que le câble link a le droit d'occuper, en pour cent. */
export const MARGE_PAR_DEFAUT = 65;
export const MARGE_MIN = 10;
export const MARGE_MAX = 100;

export function famille(consoleSlug: string): Famille {
  return consoleSlug === "gba" ? "gba" : "gb";
}

/** Coût d'un salon de cette famille, en cœurs ; `null` tant que ce n'est pas mesuré. */
export function chargeSalon(f: Famille): number | null {
  const valeur = Number(lireParametre(CLE_CHARGE[f]));
  return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
}

export function definirCharges(charges: Partial<Record<Famille, number>>): void {
  for (const [f, charge] of Object.entries(charges) as [Famille, number][]) {
    ecrireParametre(CLE_CHARGE[f], charge.toFixed(3));
  }
}

export function margeLink(): number {
  const valeur = Number(lireParametre(CLE_MARGE));
  return Number.isInteger(valeur) && valeur >= MARGE_MIN && valeur <= MARGE_MAX ? valeur : MARGE_PAR_DEFAUT;
}

export function definirMargeLink(pourcent: number): void {
  ecrireParametre(CLE_MARGE, String(pourcent));
}

export function coeursMachine(): number {
  return os.availableParallelism();
}

/** Budget en cœurs : la machine, moins la marge. */
export function budgetLink(): number {
  return (coeursMachine() * margeLink()) / 100;
}

/**
 * Ce que les salons ouverts coûtent déjà. Un salon qui attend son second
 * joueur compte aussi : il va démarrer, et il vaut mieux refuser le suivant
 * que de lancer deux parties sur un budget d'une seule.
 */
export function chargeEnCours(): number {
  let total = 0;
  for (const salon of salons().values()) {
    if (salon.etat === "termine") continue;
    total += chargeSalon(famille(salon.jeu.consoleSlug)) ?? 0;
  }
  return total;
}

/** Salons de cette famille qu'on peut encore ouvrir ; `null` sans mesure (pas de limite). */
export function placesLibres(f: Famille): number | null {
  const charge = chargeSalon(f);
  if (charge === null) return null;
  return Math.max(0, Math.floor((budgetLink() - chargeEnCours()) / charge + 1e-9));
}

/** Le message de refus s'il n'y a plus de place pour un salon de cette console, sinon `null`. */
export function refusCapacite(consoleSlug: string): string | null {
  const libres = placesLibres(famille(consoleSlug));
  if (libres === null || libres > 0) return null;
  const ouverts = [...salons().values()].filter((salon) => salon.etat !== "termine").length;
  if (ouverts === 0) {
    // Le budget ne tient même pas un salon : la marge est trop basse pour cette console.
    return "Le câble link n'a pas assez de processeur réservé pour cette console. L'administrateur peut relever la marge dans les réglages.";
  }
  return `Le serveur est au complet : ${ouverts} salon${ouverts > 1 ? "s" : ""} en cours. Réessaie dans quelques minutes.`;
}

export type EtatCapacite = {
  coeurs: number;
  marge: number;
  budget: number;
  charges: Record<Famille, number | null>;
  enCours: number;
  salonsOuverts: number;
  libres: Record<Famille, number | null>;
};

/** Tout ce que la page de réglages affiche. */
export function etatCapacite(): EtatCapacite {
  return {
    coeurs: coeursMachine(),
    marge: margeLink(),
    budget: budgetLink(),
    charges: { gb: chargeSalon("gb"), gba: chargeSalon("gba") },
    enCours: chargeEnCours(),
    salonsOuverts: [...salons().values()].filter((salon) => salon.etat !== "termine").length,
    libres: { gb: placesLibres("gb"), gba: placesLibres("gba") },
  };
}
