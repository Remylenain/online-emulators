import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Le jeu servi par l'Activité : un seul, choisi par `DISCORD_JEU`.
 *
 * Une Activité est une application Discord, et une application ne présente
 * qu'une chose. Qui veut proposer un autre jeu installe une autre instance,
 * avec sa propre application.
 */
export type JeuDiscord = {
  id: string;
  titre: string;
  console: string;
  taille: number;
  empreinte: string;
  cheminRom: string;
};

export async function jeuConfigure(): Promise<JeuDiscord | null> {
  if (!env.DISCORD_JEU) return null;
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
    .where(eq(games.id, env.DISCORD_JEU))
    .get();
  return ligne ?? null;
}
