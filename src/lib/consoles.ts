/**
 * Les trois consoles du site.
 *
 * Le cœur mGBA couvre les trois ; la distinction sert à l'organisation du
 * catalogue, au dimensionnement du canvas et au gamepad tactile — seule la GBA
 * a des gâchettes.
 */

export type ConsoleDefinition = {
  slug: string;
  name: string;
  shortName: string;
  hasShoulderButtons: boolean;
  screenWidth: number;
  screenHeight: number;
  sortOrder: number;
  /** Extensions acceptées par le scanner de bibliothèque. */
  romExtensions: string[];
};

export const CONSOLES: readonly ConsoleDefinition[] = [
  {
    slug: "gb",
    name: "Game Boy",
    shortName: "GB",
    hasShoulderButtons: false,
    screenWidth: 160,
    screenHeight: 144,
    sortOrder: 1,
    romExtensions: [".gb"],
  },
  {
    slug: "gbc",
    name: "Game Boy Color",
    shortName: "GBC",
    hasShoulderButtons: false,
    screenWidth: 160,
    screenHeight: 144,
    sortOrder: 2,
    romExtensions: [".gbc", ".gb"],
  },
  {
    slug: "gba",
    name: "Game Boy Advance",
    shortName: "GBA",
    hasShoulderButtons: true,
    screenWidth: 240,
    screenHeight: 160,
    sortOrder: 3,
    romExtensions: [".gba"],
  },
] as const;

export const CONSOLE_SLUGS = CONSOLES.map((console) => console.slug);

export function findConsole(slug: string): ConsoleDefinition | undefined {
  return CONSOLES.find((console) => console.slug === slug);
}

/**
 * Boutons de chaque console, dans l'ordre où le gamepad tactile les dispose.
 * Les noms correspondent aux entrées attendues par le cœur mGBA.
 */
export const BUTTONS = {
  common: ["A", "B", "START", "SELECT", "UP", "DOWN", "LEFT", "RIGHT"],
  shoulder: ["L", "R"],
} as const;

export type ButtonName = (typeof BUTTONS.common)[number] | (typeof BUTTONS.shoulder)[number];

/**
 * Les actions du lecteur qui ont une touche sans être des boutons de la
 * console : elles se configurent avec les boutons, mais la manette tactile
 * et le cœur ne les connaissent pas. `FAST` accélère tant qu'on la tient.
 */
export const ACTIONS = ["FAST"] as const;
export type ActionName = (typeof ACTIONS)[number];
/** Tout ce qui se voit attribuer une touche. */
export type Touche = ButtonName | ActionName;

export function buttonsFor(definition: ConsoleDefinition): ButtonName[] {
  return definition.hasShoulderButtons
    ? [...BUTTONS.common, ...BUTTONS.shoulder]
    : [...BUTTONS.common];
}

/**
 * Identifiant d'une touche, tel que le site le retient.
 *
 * **Une lettre ou un chiffre est retenu par le caractère qu'il produit**, et
 * non par sa position physique. C'est contre-intuitif pour qui connaît
 * `event.code`, alors voici le raisonnement.
 *
 * `event.code` décrit la touche physique en se référant au clavier **QWERTY**.
 * « KeyA » désigne donc la touche qui porte un A sur QWERTY — mais c'est le
 * **Q** d'un clavier AZERTY. Associer A du Game Boy à « KeyA » revient à
 * demander à un joueur français d'appuyer sur Q. Le code ne garantit pas la
 * même lettre partout, il garantit la même *place*.
 *
 * Les touches sans caractère — flèches, Entrée, Espace, modificateurs — n'ont
 * pas ce problème : leur `code` est le même partout, et il est plus fiable que
 * leur `key`, qui varie avec les modificateurs. On garde donc `code` pour
 * celles-là.
 */
export function toucheDeEvenement(evenement: {
  key: string;
  code: string;
}): string {
  if (evenement.key.length === 1 && /[a-z0-9]/i.test(evenement.key)) {
    return evenement.key.toLowerCase();
  }
  return evenement.code;
}

/**
 * Disposition clavier par défaut, telle que demandée : A sur A, B sur Z,
 * Start sur Entrée, Select sur Espace, L sur Q, R sur S, et les flèches pour
 * la croix directionnelle.
 *
 * Les lettres sont celles imprimées sur le clavier du joueur, quelle que soit
 * sa disposition — voir `toucheDeEvenement`.
 */
export const DEFAULT_KEYMAP: Record<Touche, string> = {
  A: "a",
  B: "z",
  START: "Enter",
  SELECT: "Space",
  UP: "ArrowUp",
  DOWN: "ArrowDown",
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  L: "q",
  R: "s",
  FAST: "ShiftLeft",
};

/** Les flèches se dessinent : elles se lisent pareil dans toutes les langues. */
const FLECHES_CLAVIER: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/**
 * Les noms des touches sans caractère, en français : ce que `keyLabel` rend
 * quand on ne lui dit rien.
 *
 * Les autres langues donnent une table de même forme, que `keyLabel` reçoit en
 * paramètre (`t.commandes.clavier`, voir `src/lib/i18n/`). Le français reste
 * ici plutôt que dans son dictionnaire, qui le reprend tel quel, parce que ce
 * module **ne doit rien importer** : `scripts/seed.ts` et
 * `scripts/scan-library.ts` le chargent par Node seul, sans le résolveur du
 * projet, et un import sans extension — celui des dictionnaires — les ferait
 * échouer au lancement, sans que le compilateur le voie.
 */
export const LIBELLES_CLAVIER = {
  touches: {
    Enter: "Entrée",
    Space: "Espace",
    ShiftLeft: "Maj gauche",
    ShiftRight: "Maj droite",
    ControlLeft: "Ctrl gauche",
    ControlRight: "Ctrl droite",
    AltLeft: "Alt",
    AltRight: "Alt Gr",
    Backspace: "Retour arrière",
    Tab: "Tab",
    Escape: "Échap",
  },
  /** Une touche du pavé numérique, par ce qui suit « Numpad » dans son code : « Pavé 7 ». */
  pave: (touche: string) => `Pavé ${touche}`,
};
export type LibellesClavier = typeof LIBELLES_CLAVIER;

/**
 * Libellé lisible d'une touche, pour l'écran de configuration. En français
 * sans second paramètre ; dans une autre langue avec les libellés de son
 * dictionnaire.
 */
export function keyLabel(touche: string, libelles: LibellesClavier = LIBELLES_CLAVIER): string {
  if (touche.length === 1) return touche.toUpperCase();
  if (touche.startsWith("Numpad")) return libelles.pave(touche.slice(6));
  const nommees: Record<string, string | undefined> = libelles.touches;
  return FLECHES_CLAVIER[touche] ?? nommees[touche] ?? touche;
}
