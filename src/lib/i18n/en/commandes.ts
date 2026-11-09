import type { Dictionnaire } from "../dictionnaires";

/**
 * L'équivalent anglais d'`enumerer` (`src/lib/keymap/disposition.ts`), dont
 * les guillemets et le « et » sont français : « “B” », « “B” and “Start” »,
 * « “A”, “B” and “Start” ».
 */
function enumerer(noms: string[]): string {
  const cites = noms.map((nom) => `“${nom}”`);
  if (cites.length <= 1) return cites.join("");
  return `${cites.slice(0, -1).join(", ")} and ${cites.at(-1)}`;
}

export const commandes: Dictionnaire["commandes"] = {
  boutons: {
    A: "A",
    B: "B",
    START: "Start",
    SELECT: "Select",
    UP: "Up",
    DOWN: "Down",
    LEFT: "Left",
    RIGHT: "Right",
    L: "L",
    R: "R",
    FAST: "Fast-forward (hold)",
  },

  clavier: {
    touches: {
      Enter: "Enter",
      Space: "Space",
      ShiftLeft: "Left Shift",
      ShiftRight: "Right Shift",
      ControlLeft: "Left Ctrl",
      ControlRight: "Right Ctrl",
      AltLeft: "Alt",
      AltRight: "Alt Gr",
      Backspace: "Backspace",
      Tab: "Tab",
      Escape: "Esc",
    },
    pave: (touche: string) => `Numpad ${touche}`,
  },
  entrees: {
    boutons: {
      0: "A / ✕ (bottom)",
      1: "B / ○ (right)",
      2: "X / □ (left)",
      3: "Y / △ (top)",
      4: "LB / L1",
      5: "RB / R1",
      6: "LT / L2",
      7: "RT / R2",
      8: "Select / View",
      9: "Start / Menu",
      10: "L3",
      11: "R3",
      12: "D-pad ↑",
      13: "D-pad ↓",
      14: "D-pad ←",
      15: "D-pad →",
      16: "Home",
    },
    axes: {
      "a0-": "Left stick ←",
      "a0+": "Left stick →",
      "a1-": "Left stick ↑",
      "a1+": "Left stick ↓",
      "a2-": "Right stick ←",
      "a2+": "Right stick →",
      "a3-": "Right stick ↑",
      "a3+": "Right stick ↓",
    },
    bouton: (numero: number) => `Button ${numero}`,
    croix: (fleche: string) => `D-pad ${fleche}`,
    axe: (numero: string, signe: string) => `Axis ${numero} ${signe}`,
  },

  enregistrementRefuse: "Could not save this setting.",
  retablissementRefuse: "Could not restore the defaults.",

  touches: {
    titre: "Keys",
    explication:
      "Click a key, then press the one you want instead. Esc cancels. " +
      "Your keys are saved to your account, for every console.",
    explicationLocale:
      "Click a key, then press the one you want instead. Esc cancels. " +
      "Your keys are kept in this browser.",
    sansTouche: (noms: string[]) =>
      noms.length > 1
        ? `${enumerer(noms)} no longer have a key: their keys went to other buttons. ` +
          "Click them to give them new ones."
        : `${enumerer(noms)} no longer has a key: its key went to another button. ` +
          "Click it to give it a new one.",
    refuseLocal: "The browser refused to save this setting: it will only last for this session.",
    aucune: "none",
    retablir: "Restore default keys",
  },

  manette: {
    titre: "Controller",
    explication: "Choose a button below, then press the input you want on the controller.",
    aBrancher: "Connect a controller (USB or Bluetooth) and press one of its buttons so the browser can see it.",
    sansNom: "Controller",
    standard:
      "known to the browser, standard button numbering. " +
      "The settings below are saved to your account, for every console.",
    numerotationPropre:
      "button numbering specific to this controller on this kind of device: " +
      "the settings below are saved to your account for this controller only, and change nothing for your other controllers.",
    aRegler:
      "The browser does not know this controller: its buttons are not where it expects them. " +
      "Assign them once, one by one — it only takes a minute.",
    sansBouton: (noms: string[]) =>
      noms.length > 1
        ? `${enumerer(noms)} no longer have a button on the controller: the ones they had are now used for something else. ` +
          "Choose them below to give them new ones."
        : `${enumerer(noms)} no longer has a button on the controller: the one it had is now used for something else. ` +
          "Choose it below to give it a new one.",
    aucune: "none",
    stickGauche: "The left stick always works as the D-pad, on top of what is set here.",
    retablir: "Restore default controller buttons",
  },

  tactile: {
    directions: (noms: string[]) => noms.join(" and "),
  },
};
