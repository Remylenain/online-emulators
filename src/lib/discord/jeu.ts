import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

/**
 * Le jeu servi par une Activité : un seul, celui de sa configuration.
 *
 * Une Activité est une application Discord, et une application ne présente
 * qu'une chose. Qui veut proposer un autre jeu déclare une autre application,
 * avec son propre nom d'hôte (voir `./applications.ts`).
 */
export type JeuDiscord = {
  id: string;
  titre: string;
  console: string;
  taille: number;
  empreinte: string;
  cheminRom: string;
};

export async function jeuDeLActivite(gameId: string): Promise<JeuDiscord | null> {
  if (!gameId) return null;
  const ligne = await db
    .select({
      id: games.id,
      titre: games.title,
      console: games.consoleSlug,
      taille: games.romSize,
      empreinte: games.romSha1,
      cheminRom: games.romPath,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  return ligne ?? null;
}
