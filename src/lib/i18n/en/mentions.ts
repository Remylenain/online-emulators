import type { Dictionnaire } from "../dictionnaires";

export const mentions: Dictionnaire["mentions"] = {
  confidentialite: "Privacy policy",
  conditions: "Terms of use",
  enTete: (jeu: string, date: string) => `Discord Activity “${jeu}” · last updated ${date}`,
  voirAussi: "See also:",
  lienConfidentialite: "the privacy policy",
  lienConditions: "the terms of use",

  proposeePar: (editeur: string) => `The Activity is offered by *${editeur}*.`,
  proposeeParLeServeur: "The Activity is offered by the people who run the Discord server where you launched it.",
  contact: (contact: string) => `For any question or request: *${contact}*.`,
  contactLeServeur:
    "For any question or request, contact the people who run the Discord server where you launched the Activity.",
};
