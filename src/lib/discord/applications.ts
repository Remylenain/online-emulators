import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { discordApps, discordTips, games } from "@/db/schema";
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
  /** Mot d'accueil ; vide : rien. L'environnement n'en a pas. */
  welcome: string;
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
    welcome: "",
  };
}

/**
 * Ce que les pages de confidentialité et de conditions d'utilisation disent
 * d'une Activité : son jeu, qui la propose, comment le joindre. Rien de
 * secret, et rien qui nomme le site qui l'héberge.
 */
export type MentionsActivite = {
  gameId: string;
  /** Vides tant que l'administrateur ne les a pas saisis. L'environnement n'en a pas. */
  editeur: string;
  contact: string;
  /** Avec le verrou, le site interroge Discord sur le lieu de l'Activité : la page le dit. */
  verrou: boolean;
};

export function mentionsPourHote(hote: string): MentionsActivite | null {
  const ligne = db
    .select({
      gameId: discordApps.gameId,
      editeur: discordApps.publisher,
      contact: discordApps.contact,
      guildId: discordApps.guildId,
    })
    .from(discordApps)
    .where(eq(discordApps.host, hoteNormalise(hote)))
    .get();
  if (ligne) return { gameId: ligne.gameId, editeur: ligne.editeur, contact: ligne.contact, verrou: ligne.guildId !== "" };
  const repli = depuisEnvironnement();
  return repli ? { gameId: repli.gameId, editeur: "", contact: "", verrou: repli.guildId !== "" } : null;
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
      welcome: discordApps.welcome,
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
  welcome: string;
  /** Qui propose l'Activité et comment le joindre, pour ses pages légales. */
  publisher: string;
  contact: string;
  /** Les astuces, dans l'ordre d'ajout. */
  astuces: Astuce[];
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
      welcome: discordApps.welcome,
      publisher: discordApps.publisher,
      contact: discordApps.contact,
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
      astuces: listerAstuces(ligne.id),
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
  welcome: string;
  publisher: string;
  contact: string;
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
      welcome: champs.welcome.trim(),
      publisher: champs.publisher.trim(),
      contact: champs.contact.trim(),
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
      welcome: champs.welcome.trim(),
      publisher: champs.publisher.trim(),
      contact: champs.contact.trim(),
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
        welcome: discordApps.welcome,
      })
      .from(discordApps)
      .where(eq(discordApps.id, id))
      .get() ?? null
  );
}

// ---------------------------------------------------------------------------
// Les astuces : mot du jour, conseil, rappel — une au hasard par lancement
// ---------------------------------------------------------------------------

export type Astuce = { id: string; texte: string };

export function listerAstuces(appId: string): Astuce[] {
  return db
    .select({ id: discordTips.id, texte: discordTips.text })
    .from(discordTips)
    .where(eq(discordTips.appId, appId))
    .orderBy(asc(discordTips.createdAt), asc(discordTips.id))
    .all();
}

export function ajouterAstuce(appId: string, texte: string): string {
  const id = newId();
  db.insert(discordTips).values({ id, appId, text: texte.trim() }).run();
  return id;
}

/** Rend l'application de l'astuce supprimée, pour rafraîchir sa carte ; `null` si elle n'existait plus. */
export function supprimerAstuce(id: string): string | null {
  const ligne = db.select({ appId: discordTips.appId }).from(discordTips).where(eq(discordTips.id, id)).get();
  if (!ligne) return null;
  db.delete(discordTips).where(eq(discordTips.id, id)).run();
  return ligne.appId;
}

/**
 * Toutes les astuces, mélangées : la première s'affiche à l'accueil, les
 * autres défilent sur le menu de pause. L'environnement n'en a jamais.
 */
export function astucesMelangees(appId: string | null): string[] {
  if (!appId) return [];
  return db
    .select({ texte: discordTips.text })
    .from(discordTips)
    .where(eq(discordTips.appId, appId))
    .orderBy(sql`random()`)
    .all()
    .map((ligne) => ligne.texte);
}
