import type { Touche } from "./consoles";

/**
 * La manette, par l'API Gamepad du navigateur.
 *
 * Une entrée de manette est désignée par un petit identifiant : `b7` pour le
 * bouton 7, `a1-` pour l'axe 1 poussé vers le négatif (stick gauche vers le
 * haut), `a0+` pour l'axe 0 vers le positif, `h9u` pour le chapeau porté par
 * l'axe 9 poussé vers le haut.
 *
 * Quand le navigateur reconnaît la manette, il annonce une disposition
 * « standard » et les numéros sont les mêmes pour toutes : 0 à 3 les boutons
 * de face (sud, est, ouest, nord), 4 et 5 les gâchettes hautes, 6 et 7 les
 * basses, 8 Select, 9 Start, 12 à 15 la croix. **Quand il ne la reconnaît
 * pas** — la même 8BitDo vue « standard » sur un PC peut ne pas l'être sur
 * un téléphone — les numéros sont ceux du constructeur, la croix arrive
 * souvent par un axe « chapeau » et les gâchettes basses par des axes. La
 * disposition par défaut ne vaut alors rien : c'est au joueur d'attribuer
 * ses boutons, une fois, sur cet appareil-là (voir `use-manette.ts`).
 *
 * Partagé par le lecteur et le câble link, sans dépendance au DOM : rien ici
 * ne touche à `navigator`, sauf `manetteBranchee`.
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

/** Ce qu'une entrée valide peut être : bouton, demi-axe, direction d'un chapeau. */
export const MOTIF_ENTREE = /^(b\d{1,2}|a\d{1,2}[+-]|h\d{1,2}[urdl])$/;

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

const FLECHES: Record<string, string> = { u: "↑", r: "→", d: "↓", l: "←" };

/**
 * Libellé lisible d'une entrée, pour l'écran de configuration. Les noms
 * (« RB / R1 ») ne valent que pour une disposition standard ; sinon on ne
 * connaît que le numéro.
 */
export function libelleManette(entree: string, standard = true): string {
  if (entree.startsWith("b")) {
    const n = Number(entree.slice(1));
    return (standard ? NOMS_BOUTONS[n] : undefined) ?? `Bouton ${n}`;
  }
  if (entree.startsWith("h")) return `Croix ${FLECHES[entree.slice(-1)] ?? "?"}`;
  return (standard ? NOMS_AXES[entree] : undefined) ?? `Axe ${entree.slice(1, -1)} ${entree.endsWith("-") ? "−" : "+"}`;
}

/**
 * Les axes « chapeau » connus, par manette.
 *
 * Un chapeau code les huit directions de la croix sur un seul axe, par pas
 * de 2/7 : −1 en haut, puis dans le sens des aiguilles jusqu'à 1 en haut à
 * gauche, et une valeur **hors de [−1, 1]** au repos. C'est à ce repos qu'on
 * le reconnaît : un stick ne dépasse jamais 1.
 */
const chapeaux = new Map<string, Set<number>>();

function axesChapeau(manette: Gamepad): Set<number> {
  const cle = `${manette.index}:${manette.id}`;
  let connus = chapeaux.get(cle);
  if (!connus) chapeaux.set(cle, (connus = new Set()));
  manette.axes.forEach((valeur, i) => {
    if (Math.abs(valeur) > 1.05) connus!.add(i);
  });
  return connus;
}

/** Directions tenues sur un chapeau : aucune, une, ou deux pour une diagonale. */
function directionsChapeau(valeur: number): string[] {
  if (Math.abs(valeur) > 1.05) return [];
  const pas = Math.round(((valeur + 1) * 7) / 2); // 0 = haut, 1 = haut-droite, … 7 = haut-gauche
  return [
    ["u"], ["u", "r"], ["r"], ["r", "d"], ["d"], ["d", "l"], ["l"], ["l", "u"],
  ][((pas % 8) + 8) % 8]!;
}

/** Les entrées actives à l'instant, toutes confondues — pour l'attribution et le diagnostic. */
export function entreesActives(manette: Gamepad): string[] {
  const actives: string[] = [];
  manette.buttons.forEach((bouton, i) => {
    if (bouton.pressed || bouton.value > SEUIL_AXE) actives.push(`b${i}`);
  });
  const chapeau = axesChapeau(manette);
  manette.axes.forEach((valeur, i) => {
    if (chapeau.has(i)) {
      for (const direction of directionsChapeau(valeur)) actives.push(`h${i}${direction}`);
    } else if (valeur < -SEUIL_AXE) actives.push(`a${i}-`);
    else if (valeur > SEUIL_AXE) actives.push(`a${i}+`);
  });
  return actives;
}

/**
 * Ce que la manette enfonce, traduit en touches de la console.
 *
 * Les deux premiers axes valent toujours la croix, en plus de ce que dit la
 * disposition : c'est le stick gauche sur une manette standard, et presque
 * toujours le stick ou la croix ailleurs. Personne ne veut avoir à les
 * attribuer. Seule exception, un axe reconnu comme chapeau, déjà traité.
 */
export function lireManette(manette: Gamepad, disposition: Record<Touche, string>): Set<Touche> {
  const actives = new Set(entreesActives(manette));
  const tenues = new Set<Touche>();
  for (const [touche, entree] of Object.entries(disposition) as [Touche, string][]) {
    if (actives.has(entree)) tenues.add(touche);
  }
  const chapeau = axesChapeau(manette);
  const [x = 0, y = 0] = manette.axes;
  if (!chapeau.has(0)) {
    if (x < -SEUIL_AXE) tenues.add("LEFT");
    if (x > SEUIL_AXE) tenues.add("RIGHT");
  }
  if (!chapeau.has(1)) {
    if (y < -SEUIL_AXE) tenues.add("UP");
    if (y > SEUIL_AXE) tenues.add("DOWN");
  }
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

export type IdentiteManette = {
  /** Nom annoncé par le navigateur, tel quel. */
  id: string;
  /** Le navigateur reconnaît la manette et numérote ses boutons de façon standard. */
  standard: boolean;
};

export function identiteManette(manette: Gamepad): IdentiteManette {
  return { id: manette.id || "Manette", standard: manette.mapping === "standard" };
}
