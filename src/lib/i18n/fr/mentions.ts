/**
 * Les deux pages légales d'une Activité Discord : ce qui les encadre. Les
 * textes eux-mêmes, longs et structurés, sont écrits en entier dans chaque
 * langue, à côté de leur page (`texte-fr.tsx` et `texte-en.tsx`, dans
 * `src/app/discord/confidentialite/` et `conditions/`) : un texte légal se
 * relit d'un bloc.
 */
export const mentions = {
  confidentialite: "Politique de confidentialité",
  conditions: "Conditions d'utilisation",
  /** Sous le titre : de quelle Activité il s'agit, et de quand date le texte. */
  enTete: (jeu: string, date: string) => `Activité Discord « ${jeu} » · mise à jour le ${date}`,
  voirAussi: "Voir aussi :",
  /** Le nom de chaque page dans le lien qui mène à l'autre, en bas. */
  lienConfidentialite: "la politique de confidentialité",
  lienConditions: "les conditions d'utilisation",

  /** Qui propose l'Activité. L'emphase porte sur le nom saisi par l'administrateur. */
  proposeePar: (editeur: string) => `L'Activité est proposée par *${editeur}*.`,
  proposeeParLeServeur: "L'Activité est proposée par les responsables du serveur Discord où tu l'as lancée.",
  contact: (contact: string) => `Pour toute question ou demande : *${contact}*.`,
  contactLeServeur:
    "Pour toute question ou demande, adresse-toi aux responsables du serveur Discord où tu as lancé l'Activité.",
};
