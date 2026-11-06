import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { discordApps, games } from "@/db/schema";
import { newId } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * Quelle Activité sert une requête ?
 *
 * Une Activité est une application Discord, et une application ne présente
 * qu'un jeu. Pour en proposer plusieurs, l'administrateur déclare une
 * application par jeu, chacune avec **son nom d'hôte** : c'est l'hôte de la
 * requête qui dit quelle application répond. Sans ligne pour cet hôte, c'est
 * l'environnement (`DISCORD_*`) qui sert, pour une installation à une seule
 * Activité ou pendant le développement. Sans l'un ni l'autre, pas d'Activité.
 */
export type ConfigActivite = {
  /** `null` pour la configuration de l'environnement. */
  id: string | null;
  clientId: string;
  clientSecret: string;
  gameId: string;
  /** Vides sans verrou. */
  guildId: string;
  botToken: string;
};

/** Le nom d'hôte seul, en minuscules : sans port, ni crochets d'IPv6 superflus. */
export function hoteNormalise(hote: string): string {
  const propre = hote.trim().toLowerCase();
  if (propre.startsWith("[")) return propre.slice(0, propre.indexOf("]") + 1);
  return propre.replace(/:\d+$/, "");
}

/** L'hôte demandé, tel que le proxy inverse le transmet. */
export function hoteDeLaRequete(entetes: { get(nom: string): string | null }): string {
  const transmis = entetes.get("x-forwarded-host")?.split(",")[0];
  return hoteNormalise(transmis || entetes.get("host") || "");
}

function depuisEnvironnement(): ConfigActivite | null {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_JEU) return null;
  return {
    id: null,
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    gameId: env.DISCORD_JEU,
    guildId: env.DISCORD_SERVEUR,
    botToken: env.DISCORD_BOT_TOKEN,
  };
}

/** La configuration qui répond sur cet hôte, ou `null` : pas d'Activité ici. */
export function configPourHote(hote: string): ConfigActivite | null {
  const ligne = db
    .select({
      id: discordApps.id,
      clientId: discordApps.clientId,
      clientSecret: discordApps.clientSecret,
      gameId: discordApps.gameId,
      guildId: discordApps.guildId,
      botToken: discordApps.botToken,
    })
    .from(discordApps)
    .where(eq(discordApps.host, hoteNormalise(hote)))
    .get();
  return ligne ?? depuisEnvironnement();
}

/**
 * Les hôtes réservés à une Activité. Sur l'un d'eux, le site ne sert que
 * l'Activité : ni connexion, ni catalogue (voir `src/proxy.ts`).
 */
export function hotesDesActivites(): string[] {
  return db
    .select({ host: discordApps.host })
    .from(discordApps)
    .all()
    .map((ligne) => ligne.host);
}

// ---------------------------------------------------------------------------
// Pour l'administration
// ---------------------------------------------------------------------------

export type ApplicationDiscord = {
  id: string;
  name: string;
  host: string;
  clientId: string;
  guildId: string;
  /** Le jeton lui-même ne redescend jamais : seulement s'il existe. */
  botTokenDefini: boolean;
  gameId: string;
  jeu: { titre: string; console: string } | null;
};

export function listerApplications(): ApplicationDiscord[] {
  return db
    .select({
      id: discordApps.id,
      name: discordApps.name,
      host: discordApps.host,
      clientId: discordApps.clientId,
      guildId: discordApps.guildId,
      botToken: discordApps.botToken,
      gameId: discordApps.gameId,
      titre: games.title,
      console: games.consoleSlug,
    })
    .from(discordApps)
    .leftJoin(games, eq(games.id, discordApps.gameId))
    .orderBy(asc(discordApps.name))
    .all()
    .map(({ botToken, titre, console: consoleSlug, ...ligne }) => ({
      ...ligne,
      botTokenDefini: botToken.length > 0,
      jeu: titre && consoleSlug ? { titre, console: consoleSlug } : null,
    }));
}

export type ChampsApplication = {
  name: string;
  host: string;
  clientId: string;
  /** Omis à la modification : le secret enregistré est gardé. */
  clientSecret?: string;
  guildId: string;
  /** Omis : le jeton enregistré est gardé. */
  botToken?: string;
  gameId: string;
};

export function hoteDejaPris(host: string, saufId?: string): boolean {
  const ligne = db
    .select({ id: discordApps.id })
    .from(discordApps)
    .where(eq(discordApps.host, hoteNormalise(host)))
    .get();
  return Boolean(ligne && ligne.id !== saufId);
}

export function creerApplication(champs: ChampsApplication & { clientSecret: string }): string {
  const id = newId();
  db.insert(discordApps)
    .values({
      id,
      name: champs.name.trim(),
      host: hoteNormalise(champs.host),
      clientId: champs.clientId.trim(),
      clientSecret: champs.clientSecret,
      guildId: champs.guildId.trim(),
      botToken: champs.botToken ?? "",
      gameId: champs.gameId,
    })
    .run();
  return id;
}

export function modifierApplication(id: string, champs: ChampsApplication): void {
  db.update(discordApps)
    .set({
      name: champs.name.trim(),
      host: hoteNormalise(champs.host),
      clientId: champs.clientId.trim(),
      ...(champs.clientSecret !== undefined ? { clientSecret: champs.clientSecret } : {}),
      guildId: champs.guildId.trim(),
      ...(champs.botToken !== undefined ? { botToken: champs.botToken } : {}),
      gameId: champs.gameId,
      updatedAt: new Date(),
    })
    .where(eq(discordApps.id, id))
    .run();
}

export function supprimerApplication(id: string): void {
  db.delete(discordApps).where(eq(discordApps.id, id)).run();
}

/** Les réglages complets d'une application, pour l'essayer auprès de Discord. */
export function configParId(id: string): ConfigActivite | null {
  return (
    db
      .select({
        id: discordApps.id,
        clientId: discordApps.clientId,
        clientSecret: discordApps.clientSecret,
        gameId: discordApps.gameId,
        guildId: discordApps.guildId,
        botToken: discordApps.botToken,
      })
      .from(discordApps)
      .where(eq(discordApps.id, id))
      .get() ?? null
  );
}
