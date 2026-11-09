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

/**
 * Le nom d'un morceau d'un jeu en plusieurs fichiers, en français : ce que
 * `titreComplet` rend quand on ne lui dit rien.
 *
 * Les autres langues donnent une fonction de même forme, que `titreComplet`
 * reçoit en paramètre (`t.mesJeux.titrePartie`, voir `src/lib/i18n/`). Le
 * français reste ici plutôt que dans son dictionnaire, qui le reprend tel
 * quel, parce que ce module ne doit rien importer : les composants client et
 * les pages hors de « Mes jeux » le chargent tel qu'il est.
 */
export const TITRE_PARTIE = (titre: string, numero: number): string => `${titre} · partie ${numero}`;
export type TitrePartie = typeof TITRE_PARTIE;

/**
 * « Titre · partie 3 » pour un jeu en plusieurs morceaux, le titre sinon. En
 * français sans second paramètre ; dans une autre langue avec la fonction de
 * son dictionnaire.
 */
export function titreComplet(jeu: JeuResume, titrePartie: TitrePartie = TITRE_PARTIE): string {
  return jeu.groupTitle && jeu.partNumber !== null ? titrePartie(jeu.groupTitle, jeu.partNumber) : jeu.title;
}
