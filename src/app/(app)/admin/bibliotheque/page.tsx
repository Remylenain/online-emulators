import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { lireRetouche, retouchesPossibles } from "@/lib/library/retouches";
import { Bibliotheque } from "./bibliotheque";

export const metadata: Metadata = { title: "Bibliothèque" };

export default async function BibliothequePage() {
  await requireAdmin();

  const lignes = await db
    .select({
      id: games.id,
      title: games.title,
      consoleSlug: games.consoleSlug,
      slug: games.slug,
      description: games.description,
      author: games.author,
      version: games.version,
      language: games.language,
      baseGame: games.baseGame,
      year: games.year,
      isPublished: games.isPublished,
      coverPath: games.coverPath,
      romSize: games.romSize,
      updatedAt: games.updatedAt,
    })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all();

  /**
   * Chaque jeu est accompagné de la liste des champs qu'il retouche.
   *
   * L'interface marque ces champs : sans cela, rien ne distinguerait une
   * valeur qui vient du `game.json` d'une valeur saisie ici, et on
   * corrigerait le manifeste sans comprendre pourquoi l'affichage ne bouge
   * pas.
   */
  const jeux = await Promise.all(
    lignes.map(async (jeu) => ({
      ...jeu,
      retouches: Object.keys(await lireRetouche(jeu.consoleSlug, jeu.slug)),
    })),
  );

  return <Bibliotheque jeux={jeux} inscriptible={await retouchesPossibles()} />;
}
