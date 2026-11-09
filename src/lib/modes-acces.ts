/**
 * Les modes d'accès au catalogue, à part de la logique (`acces.ts`) : ce
 * fichier est importé par l'administration, un composant client, qui ne doit
 * pas entraîner la base avec lui.
 *
 * Il est aussi chargé par Node seul, à la suite de `acces.ts` (le serveur du
 * câble link) : il n'importe donc rien, pas même les dictionnaires. Qui veut
 * les libellés dans une autre langue les lui passe (`modesAcces`).
 */
export type ModeAcces = "normal" | "restreint" | "testeur";

/** Le nom d'un mode et ce qu'il donne à voir, pour chaque mode. */
export type LibellesModesAcces = Record<ModeAcces, { libelle: string; detail: string }>;

/** Les valeurs écrites en base (`users.access_mode`), dans l'ordre où on les propose. */
const VALEURS: ModeAcces[] = ["normal", "restreint", "testeur"];

const LIBELLES_FR: LibellesModesAcces = {
  normal: { libelle: "Normal", detail: "tout le catalogue publié" },
  restreint: { libelle: "Restreint", detail: "seulement les jeux cochés" },
  testeur: { libelle: "Testeur", detail: "le catalogue publié, plus les jeux cochés" },
};

/**
 * Les modes avec leurs libellés. Sans argument, en français ; pour une autre
 * langue, passer `t.adminComptes.modes`. Les valeurs, elles, ne se traduisent
 * pas.
 */
export function modesAcces(
  libelles: LibellesModesAcces = LIBELLES_FR,
): { valeur: ModeAcces; libelle: string; detail: string }[] {
  return VALEURS.map((valeur) => ({ valeur, ...libelles[valeur] }));
}

export const MODES_ACCES: { valeur: ModeAcces; libelle: string; detail: string }[] = modesAcces();
