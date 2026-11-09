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

const FLECHES: Record<string, string> = { u: "↑", r: "→", d: "↓", l: "←" };

/**
 * Les noms des entrées d'une manette, en français : ce que `libelleManette`
 * rend quand on ne lui dit rien.
 *
 * Les autres langues donnent une table de même forme, que `libelleManette`
 * reçoit en paramètre (`t.commandes.entrees`, voir `src/lib/i18n/`). Le
 * français reste ici, et son dictionnaire le reprend tel quel, pour la même
 * raison que dans `./consoles.ts` : ce module se charge sans rien importer, et
 * les dictionnaires ne se chargent pas hors de Next ou du résolveur du projet.
 */
export const LIBELLES_MANETTE = {
  /** Numérotation standard : les boutons, par numéro. */
  boutons: {
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
  },
  /** Numérotation standard : les sticks, par demi-axe. */
  axes: {
    "a0-": "Stick gauche ←",
    "a0+": "Stick gauche →",
    "a1-": "Stick gauche ↑",
    "a1+": "Stick gauche ↓",
    "a2-": "Stick droit ←",
    "a2+": "Stick droit →",
    "a3-": "Stick droit ↑",
    "a3+": "Stick droit ↓",
  },
  /** Un bouton dont on ne connaît que le numéro. */
  bouton: (numero: number) => `Bouton ${numero}`,
  /** Une direction de la croix portée par un chapeau. */
  croix: (fleche: string) => `Croix ${fleche}`,
  /** Un demi-axe dont on ne connaît que le numéro : « Axe 4 + ». */
  axe: (numero: string, signe: string) => `Axe ${numero} ${signe}`,
};
export type LibellesManette = typeof LIBELLES_MANETTE;

/**
 * Libellé lisible d'une entrée, pour l'écran de configuration. Les noms
 * (« RB / R1 ») ne valent que pour une disposition standard ; sinon on ne
 * connaît que le numéro. En français sans troisième paramètre ; dans une
 * autre langue avec les libellés de son dictionnaire.
 */
export function libelleManette(
  entree: string,
  standard = true,
  libelles: LibellesManette = LIBELLES_MANETTE,
): string {
  if (entree.startsWith("b")) {
    const n = Number(entree.slice(1));
    const boutons: Record<number, string | undefined> = libelles.boutons;
    return (standard ? boutons[n] : undefined) ?? libelles.bouton(n);
  }
  if (entree.startsWith("h")) return libelles.croix(FLECHES[entree.slice(-1)] ?? "?");
  const axes: Record<string, string | undefined> = libelles.axes;
  return (standard ? axes[entree] : undefined) ?? libelles.axe(entree.slice(1, -1), entree.endsWith("-") ? "−" : "+");
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

/**
 * Le nom tenu pour celui d'une manette qui n'en annonce aucun.
 *
 * Ce n'est pas un libellé mais un identifiant : il entre dans `cleManette`,
 * sous laquelle le compte range la disposition. Il reste donc le même dans
 * toutes les langues — le traduire ferait perdre son réglage à qui change de
 * langue — et c'est l'écran de configuration qui l'affiche traduit.
 */
export const MANETTE_SANS_NOM = "Manette";

export function identiteManette(manette: Gamepad): IdentiteManette {
  return { id: manette.id || MANETTE_SANS_NOM, standard: manette.mapping === "standard" };
}

/**
 * Le type d'appareil, pour ranger la disposition d'une manette non reconnue.
 *
 * Une telle manette n'a pas la même numérotation sous Android et sous
 * Windows : chaque système lit ses boutons à sa façon. Sa disposition est
 * donc enregistrée par système, pas seulement par manette — sans quoi la
 * régler sur le téléphone la déréglerait sur le PC.
 */
export function typeAppareil(): string {
  if (typeof navigator === "undefined") return "autre";
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  // Un iPad se présente comme un Mac ; l'écran tactile le trahit.
  if (/iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Windows/i.test(agent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(agent)) return "mac";
  if (/CrOS/i.test(agent)) return "chromeos";
  if (/Linux/i.test(agent)) return "linux";
  return "autre";
}

/** La clé sous laquelle le compte retient une manette non reconnue. */
export function cleManette(identite: IdentiteManette): string {
  return `${typeAppareil()}|${identite.id}`.slice(0, 300);
}
