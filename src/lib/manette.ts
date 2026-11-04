import type { Touche } from "./consoles";

/**
 * La manette, par l'API Gamepad du navigateur.
 *
 * Une entrée de manette est désignée par un petit identifiant : `b7` pour le
 * bouton 7, `a1-` pour l'axe 1 poussé vers le négatif (stick gauche vers le
 * haut), `a0+` pour l'axe 0 vers le positif (vers la droite). Les numéros
 * sont ceux de la disposition « standard » de l'API, la même pour une Xbox,
 * une PlayStation, une 8BitDo ou une Switch Pro dans tous les navigateurs :
 * 0 à 3 les boutons de face (sud, est, ouest, nord), 4 et 5 les gâchettes
 * hautes, 6 et 7 les basses, 8 Select, 9 Start, 12 à 15 la croix.
 *
 * Partagé par le lecteur et le câble link, sans dépendance au DOM : rien ici
 * ne touche à `navigator`, on ne fait que lire un objet `Gamepad`.
 */

/** Au-delà de cette inclinaison, un stick vaut une direction. */
const SEUIL_AXE = 0.5;

/**
 * Disposition par défaut, par position : le A de la console tombe sur le
 * bouton de droite (est) et le B sur celui du bas (sud), comme sur la
 * Game Boy, où A est à droite de B. L'accéléré est sur la gâchette basse
 * droite, à tenir.
 */
export const MANETTE_PAR_DEFAUT: Record<Touche, string> = {
  A: "b1",
  B: "b0",
  START: "b9",
  SELECT: "b8",
  UP: "b12",
  DOWN: "b13",
  LEFT: "b14",
  RIGHT: "b15",
  L: "b4",
  R: "b5",
  FAST: "b7",
};

const NOMS_BOUTONS: Record<number, string> = {
  0: "A / ✕ (bas)",
  1: "B / ○ (droite)",
  2: "X / □ (gauche)",
  3: "Y / △ (haut)",
  4: "LB / L1",
  5: "RB / R1",
  6: "LT / L2",
  7: "RT / R2",
  8: "Select / View",
  9: "Start / Menu",
  10: "L3",
  11: "R3",
  12: "Croix ↑",
  13: "Croix ↓",
  14: "Croix ←",
  15: "Croix →",
  16: "Logo",
};

const NOMS_AXES: Record<string, string> = {
  "a0-": "Stick gauche ←",
  "a0+": "Stick gauche →",
  "a1-": "Stick gauche ↑",
  "a1+": "Stick gauche ↓",
  "a2-": "Stick droit ←",
  "a2+": "Stick droit →",
  "a3-": "Stick droit ↑",
  "a3+": "Stick droit ↓",
};

/** Libellé lisible d'une entrée, pour l'écran de configuration. */
export function libelleManette(entree: string): string {
  if (entree.startsWith("b")) {
    const n = Number(entree.slice(1));
    return NOMS_BOUTONS[n] ?? `Bouton ${n}`;
  }
  return NOMS_AXES[entree] ?? entree;
}

/** Une entrée est-elle active sur cette manette ? */
export function entreeActive(manette: Gamepad, entree: string): boolean {
  if (entree.startsWith("b")) {
    const bouton = manette.buttons[Number(entree.slice(1))];
    return Boolean(bouton && (bouton.pressed || bouton.value > SEUIL_AXE));
  }
  const axe = manette.axes[Number(entree.slice(1, -1))];
  if (axe === undefined) return false;
  return entree.endsWith("-") ? axe < -SEUIL_AXE : axe > SEUIL_AXE;
}

/** Les entrées actives à l'instant, toutes confondues — pour l'attribution. */
export function entreesActives(manette: Gamepad): string[] {
  const actives: string[] = [];
  manette.buttons.forEach((bouton, i) => {
    if (bouton.pressed || bouton.value > SEUIL_AXE) actives.push(`b${i}`);
  });
  manette.axes.forEach((valeur, i) => {
    if (valeur < -SEUIL_AXE) actives.push(`a${i}-`);
    else if (valeur > SEUIL_AXE) actives.push(`a${i}+`);
  });
  return actives;
}

/**
 * Ce que la manette enfonce, traduit en touches de la console.
 *
 * Le stick gauche vaut toujours la croix, en plus de ce que dit la
 * disposition : personne ne veut avoir à l'attribuer, et il ne gêne rien.
 */
export function lireManette(manette: Gamepad, disposition: Record<Touche, string>): Set<Touche> {
  const tenues = new Set<Touche>();
  for (const [touche, entree] of Object.entries(disposition) as [Touche, string][]) {
    if (entreeActive(manette, entree)) tenues.add(touche);
  }
  const [x = 0, y = 0] = manette.axes;
  if (x < -SEUIL_AXE) tenues.add("LEFT");
  if (x > SEUIL_AXE) tenues.add("RIGHT");
  if (y < -SEUIL_AXE) tenues.add("UP");
  if (y > SEUIL_AXE) tenues.add("DOWN");
  return tenues;
}

/** La première manette branchée, s'il y en a une. */
export function manetteBranchee(): Gamepad | null {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  for (const manette of navigator.getGamepads()) {
    if (manette && manette.connected) return manette;
  }
  return null;
}
