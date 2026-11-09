import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { hoteDuSite, listerApplications } from "@/lib/discord/applications";
import { jeuDeLActivite } from "@/lib/discord/jeu";
import { env } from "@/lib/env";
import { Discord } from "./discord";

export const metadata: Metadata = { title: "Discord" };
export const dynamic = "force-dynamic";

/**
 * Les Activités Discord : une application par jeu, chacune sur son nom
 * d'hôte. La page liste ce qui est déclaré, et dit si l'environnement du
 * serveur configure lui aussi une Activité, en repli.
 */
export default async function DiscordPage() {
  await requireAdmin();

  // Tous les jeux, publiés ou non : un compte né de l'Activité se voit
  // attribuer le jeu, et un jeu attribué se joue même dépublié.
  const jeux = await db
    .select({ id: games.id, titre: games.title, console: games.consoleSlug, publie: games.isPublished })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all();

  const jeuEnvironnement =
    env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_JEU
      ? ((await jeuDeLActivite(env.DISCORD_JEU))?.titre ?? env.DISCORD_JEU)
      : null;

  return (
    <Discord
      applications={listerApplications()}
      jeux={jeux}
      hoteDuSite={hoteDuSite()}
      repli={jeuEnvironnement ? { jeu: jeuEnvironnement, verrou: env.DISCORD_SERVEUR.length > 0 } : null}
    />
  );
}
