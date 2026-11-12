import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { discordApps, discordAppServers, discordTips, games } from "@/db/schema";
import { newId } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { lireRoles } from "./roles";

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

/**
 * Un serveur Discord où l'Activité se joue, et qui a le droit d'y jouer : les
 * rôles de **ce** serveur qui l'ouvrent, ou aucun pour tous ses membres.
 */
export type ServeurPermis = { id: string; roles: string[] };

export type ConfigActivite = {
  /** `null` pour la configuration de l'environnement. */
  id: string | null;
  clientId: string;
  clientSecret: string;
  gameId: string;
  /** Le verrou : les serveurs où l'Activité se joue. Aucun : partout où Discord la lance. */
  serveurs: ServeurPermis[];
  /** Vide sans verrou ni commande tapée. */
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
    // L'environnement ne désigne qu'un serveur : pour plusieurs, l'administration.
    serveurs: env.DISCORD_SERVEUR ? [{ id: env.DISCORD_SERVEUR, roles: lireRoles(env.DISCORD_ROLES) }] : [],
    botToken: env.DISCORD_BOT_TOKEN,
    welcome: "",
  };
}

/** Les serveurs du verrou d'une application, dans l'ordre où l'administrateur les a saisis. */
function serveursDe(appId: string): ServeurPermis[] {
  return db
    .select({ id: discordAppServers.guildId, roles: discordAppServers.roles })
    .from(discordAppServers)
    .where(eq(discordAppServers.appId, appId))
    .orderBy(asc(discordAppServers.position), asc(discordAppServers.guildId))
    .all()
    .map((ligne) => ({ id: ligne.id, roles: lireRoles(ligne.roles) }));
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
  /** Avec des rôles réservés, dans un serveur au moins, il l'interroge aussi sur les rôles du joueur. */
  roles: boolean;
  /** La commande se tape dans un salon : Discord prévient alors le site de qui la tape, et où. */
  commande: boolean;
};

export function mentionsPourHote(hote: string): MentionsActivite | null {
  const ligne = db
    .select({
      id: discordApps.id,
      gameId: discordApps.gameId,
      editeur: discordApps.publisher,
      contact: discordApps.contact,
      clePublique: discordApps.publicKey,
    })
    .from(discordApps)
    .where(eq(discordApps.host, hoteNormalise(hote)))
    .get();
  if (ligne) {
    const serveurs = serveursDe(ligne.id);
    return {
      gameId: ligne.gameId,
      editeur: ligne.editeur,
      contact: ligne.contact,
      verrou: serveurs.length > 0,
      roles: serveurs.some((serveur) => serveur.roles.length > 0),
      commande: ligne.clePublique !== "",
    };
  }
  const repli = depuisEnvironnement();
  return repli
    ? {
        gameId: repli.gameId,
        editeur: "",
        contact: "",
        verrou: repli.serveurs.length > 0,
        roles: repli.serveurs.some((serveur) => serveur.roles.length > 0),
        commande: env.DISCORD_CLE_PUBLIQUE !== "",
      }
    : null;
}

/** La configuration qui répond sur cet hôte, ou `null` : pas d'Activité ici. */
export function configPourHote(hote: string): ConfigActivite | null {
  const ligne = db
    .select({
      id: discordApps.id,
      clientId: discordApps.clientId,
      clientSecret: discordApps.clientSecret,
      gameId: discordApps.gameId,
      botToken: discordApps.botToken,
      welcome: discordApps.welcome,
    })
    .from(discordApps)
    .where(eq(discordApps.host, hoteNormalise(hote)))
    .get();
  return ligne ? { ...ligne, serveurs: serveursDe(ligne.id) } : depuisEnvironnement();
}

/** L'hôte du site lui-même, tel que l'installation le déclare (`PUBLIC_URL`). */
export function hoteDuSite(): string {
  return hoteNormalise(new URL(env.PUBLIC_URL).host);
}

/**
 * Où le site est installé, quand c'est par `deploiement/scripts/installation.sh` :
 * l'arbre de travail (`/opt/online-emulators`, ou `/opt/online-emulators-<nom>`
 * pour une instance nommée) et le nom de l'instance, vide pour celle par défaut.
 * `null` ailleurs — en développement, ou installé à la main.
 *
 * Sert à écrire la commande du vhost d'une Activité telle qu'il faut la taper
 * sur ce serveur-là, instance comprise : l'oublier relaierait l'hôte vers
 * l'instance d'à côté.
 */
export function installationDuSite(): { dossier: string; instance: string } | null {
  const dossier = process.cwd();
  const trouve = /^\/opt\/online-emulators(?:-([a-z0-9][a-z0-9-]*))?$/.exec(dossier);
  return trouve ? { dossier, instance: trouve[1] ?? "" } : null;
}

/**
 * Les hôtes réservés à une Activité. Sur l'un d'eux, le site ne sert que
 * l'Activité : ni connexion, ni catalogue (voir `src/proxy.ts`).
 *
 * L'hôte du site n'en fait jamais partie, même quand une Activité y est
 * déclarée : elle s'y **ajoute**. Le site continue d'y répondre, et c'est
 * Discord, en ouvrant la racine avec `frame_id`, qui tombe sur l'Activité.
 * C'est le cas d'un site public consacré au jeu que l'Activité sert — une
 * seule adresse pour les deux. Le réserver fermerait le site entier, avec
 * l'administration qui permettrait d'y revenir.
 */
export function hotesDesActivites(): string[] {
  const site = hoteDuSite();
  return db
    .select({ host: discordApps.host })
    .from(discordApps)
    .all()
    .map((ligne) => ligne.host)
    .filter((hote) => hote !== site);
}

// ---------------------------------------------------------------------------
// Pour l'administration
// ---------------------------------------------------------------------------

export type ApplicationDiscord = {
  id: string;
  name: string;
  host: string;
  clientId: string;
  /**
   * Les serveurs du verrou, chacun avec les identifiants de ses rôles
   * réservés ; leurs noms se demandent à Discord.
   */
  serveurs: ServeurPermis[];
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
      serveurs: serveursDe(ligne.id),
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
  /** Les identifiants des serveurs du verrou, dans l'ordre ; aucun : pas de verrou. */
  serveurs: string[];
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

/**
 * Fait de cette liste le verrou de l'application.
 *
 * Un serveur qui reste garde ses rôles réservés ; un serveur retiré les
 * emporte — ils n'existent que chez lui, les garder ne réserverait
 * l'Activité à personne. Un serveur ajouté s'ouvre à tous ses membres, en
 * attendant qu'on lui choisisse des rôles.
 */
function definirServeurs(appId: string, serveurs: readonly string[]): void {
  const voulus = [...new Set(serveurs)];
  db.delete(discordAppServers)
    .where(
      voulus.length > 0
        ? and(eq(discordAppServers.appId, appId), notInArray(discordAppServers.guildId, voulus))
        : eq(discordAppServers.appId, appId),
    )
    .run();
  voulus.forEach((guildId, position) => {
    db.insert(discordAppServers)
      .values({ appId, guildId, position })
      .onConflictDoUpdate({ target: [discordAppServers.appId, discordAppServers.guildId], set: { position } })
      .run();
  });
}

export function creerApplication(champs: ChampsApplication & { clientSecret: string }): string {
  const id = newId();
  db.transaction(() => {
    db.insert(discordApps)
      .values({
        id,
        name: champs.name.trim(),
        host: hoteNormalise(champs.host),
        clientId: champs.clientId.trim(),
        clientSecret: champs.clientSecret,
        botToken: champs.botToken ?? "",
        gameId: champs.gameId,
        welcome: champs.welcome.trim(),
        publisher: champs.publisher.trim(),
        contact: champs.contact.trim(),
      })
      .run();
    definirServeurs(id, champs.serveurs);
  });
  return id;
}

export function modifierApplication(id: string, champs: ChampsApplication): void {
  const avant = db.select({ clientId: discordApps.clientId }).from(discordApps).where(eq(discordApps.id, id)).get();
  // La clé publique est celle d'une application Discord : en désigner une
  // autre l'oublie, plutôt que de vérifier ses interactions avec la clé d'avant.
  const applicationChange = avant !== undefined && avant.clientId !== champs.clientId.trim();
  db.transaction(() => {
    db.update(discordApps)
      .set({
        ...(applicationChange ? { publicKey: "" } : {}),
        name: champs.name.trim(),
        host: hoteNormalise(champs.host),
        clientId: champs.clientId.trim(),
        ...(champs.clientSecret !== undefined ? { clientSecret: champs.clientSecret } : {}),
        ...(champs.botToken !== undefined ? { botToken: champs.botToken } : {}),
        gameId: champs.gameId,
        welcome: champs.welcome.trim(),
        publisher: champs.publisher.trim(),
        contact: champs.contact.trim(),
        updatedAt: new Date(),
      })
      .where(eq(discordApps.id, id))
      .run();
    if (avant !== undefined) definirServeurs(id, champs.serveurs);
  });
}

/**
 * Les rôles qui donnent le droit de jouer dans ce serveur ; aucun : tous ses
 * membres. Sans effet si le serveur n'est pas — ou plus — dans le verrou.
 */
export function definirRoles(id: string, serveur: string, roles: string[]): void {
  db.update(discordAppServers)
    .set({ roles: roles.length > 0 ? JSON.stringify(roles) : "" })
    .where(and(eq(discordAppServers.appId, id), eq(discordAppServers.guildId, serveur)))
    .run();
}

/**
 * Ce qu'il faut pour brancher la commande tapée d'une application : l'hôte où
 * Discord enverra ses interactions, et la clé déjà enregistrée, s'il y en a une.
 */
export function interactionsParId(id: string): { hote: string; clePublique: string } | null {
  const ligne = db
    .select({ hote: discordApps.host, clePublique: discordApps.publicKey })
    .from(discordApps)
    .where(eq(discordApps.id, id))
    .get();
  return ligne ?? null;
}

/** La clé avec laquelle Discord signe ses interactions ; vide : le site n'en attend plus. */
export function definirClePublique(id: string, cle: string): void {
  db.update(discordApps).set({ publicKey: cle.toLowerCase(), updatedAt: new Date() }).where(eq(discordApps.id, id)).run();
}

/**
 * Les clés avec lesquelles vérifier une interaction reçue de Discord : celle
 * de l'application qu'il dit viser, et à défaut toutes celles qu'on connaît.
 * L'identifiant vient d'un corps pas encore vérifié : il ne fait que choisir
 * quelle clé essayer, et c'est la signature qui décide.
 */
export function clesPubliques(application: string | null): string[] {
  const lignes = db
    .select({ clientId: discordApps.clientId, cle: discordApps.publicKey })
    .from(discordApps)
    .all()
    .filter((ligne) => ligne.cle !== "");
  if (env.DISCORD_CLE_PUBLIQUE && env.DISCORD_CLIENT_ID) {
    lignes.push({ clientId: env.DISCORD_CLIENT_ID, cle: env.DISCORD_CLE_PUBLIQUE });
  }
  const visees = lignes.filter((ligne) => ligne.clientId === application);
  return [...new Set((visees.length > 0 ? visees : lignes).map((ligne) => ligne.cle))];
}

export function supprimerApplication(id: string): void {
  db.delete(discordApps).where(eq(discordApps.id, id)).run();
}

/** Les réglages complets d'une application, pour l'essayer auprès de Discord. */
export function configParId(id: string): ConfigActivite | null {
  const ligne = db
    .select({
      id: discordApps.id,
      clientId: discordApps.clientId,
      clientSecret: discordApps.clientSecret,
      gameId: discordApps.gameId,
      botToken: discordApps.botToken,
      welcome: discordApps.welcome,
    })
    .from(discordApps)
    .where(eq(discordApps.id, id))
    .get();
  return ligne ? { ...ligne, serveurs: serveursDe(ligne.id) } : null;
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
