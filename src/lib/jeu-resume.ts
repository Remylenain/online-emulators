/**
 * Un jeu tel qu'il apparaît dans les listes d'un compte : de quoi le nommer
 * et y aller. Sans dépendance à la base, pour que les composants client
 * puissent l'importer.
 */
export type JeuResume = {
  id: string;
  slug: string;
  consoleSlug: string;
  title: string;
  coverPath: string | null;
  groupTitle: string | null;
  partNumber: number | null;
};

/** « Titre · partie 3 » pour un jeu en plusieurs morceaux, le titre sinon. */
export function titreComplet(jeu: JeuResume): string {
  return jeu.groupTitle && jeu.partNumber !== null
    ? `${jeu.groupTitle} · partie ${jeu.partNumber}`
    : jeu.title;
}
