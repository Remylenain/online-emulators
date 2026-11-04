/**
 * Les modes d'accès au catalogue, à part de la logique (`acces.ts`) : ce
 * fichier est importé par l'administration, un composant client, qui ne doit
 * pas entraîner la base avec lui.
 */
export type ModeAcces = "normal" | "restreint" | "testeur";

export const MODES_ACCES: { valeur: ModeAcces; libelle: string; detail: string }[] = [
  { valeur: "normal", libelle: "Normal", detail: "tout le catalogue publié" },
  { valeur: "restreint", libelle: "Restreint", detail: "seulement les jeux cochés" },
  { valeur: "testeur", libelle: "Testeur", detail: "le catalogue publié, plus les jeux cochés" },
];
