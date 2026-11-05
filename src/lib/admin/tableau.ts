import fs from "node:fs/promises";
import os from "node:os";
import { desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, playSessions, saveBackups, saveFiles, saveStates, sessions, users } from "@/db/schema";
import { etatCapacite, type EtatCapacite } from "@/lib/link/capacite";
import { salons } from "@/lib/link/registre";
import { paths } from "@/lib/paths";

/**
 * Ce que le tableau de bord de l'administration affiche : ce qui se passe
 * maintenant, puis l'état du site. Tout existe déjà dans la base ou dans la
 * mémoire du serveur ; ce module ne fait que le réunir.
 */

const MINUTE = 60 * 1000;
const JOUR = 24 * 60 * MINUTE;

export type TableauDeBord = {
  maintenant: {
    joueurs: { pseudo: string; jeu: string; console: string }[];
    salons: {
      id: string;
      jeu: string;
      console: string;
      joueurs: string[];
      etat: string;
      prive: boolean;
      spectateurs: number | null;
      depuis: number;
    }[];
    capacite: EtatCapacite;
  };
  comptes: {
    total: number;
    actifs7j: number;
    connexions: { pseudo: string; quand: Date; appareil: string }[];
  };
  jeux: {
    publies: number;
    depublies: number;
    officiels: number;
    sansJaquette: number;
    parConsole: { console: string; total: number }[];
  };
  temps: { aujourdhui: number; septJours: number; total: number };
  stockage: {
    sauvegardes: { nombre: number; octets: number };
    copies: { nombre: number; octets: number };
    etats: { nombre: number; octets: number };
    disque: { libre: number; total: number } | null;
  };
  serveur: { depuis: number; memoire: number; charge: number[]; coeurs: number; node: string };
};

/** Un agent utilisateur ramené à « Chrome sur Windows » : assez pour reconnaître un appareil. */
function appareil(agent: string | null): string {
  if (!agent) return "appareil inconnu";
  const navigateur = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "navigateur";
  const systeme = /Android/.test(agent)
    ? "Android"
    : /iPhone|iPad/.test(agent)
      ? "iOS"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS X/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "";
  return systeme ? `${navigateur} sur ${systeme}` : navigateur;
}

const compte = sql<number>`count(*)`;
const somme = (colonne: unknown) => sql<number>`coalesce(sum(${colonne}), 0)`;

export async function tableauDeBord(): Promise<TableauDeBord> {
  const maintenant = Date.now();

  const joueurs = db
    .select({ pseudo: users.pseudo, jeu: games.title, console: games.consoleSlug })
    .from(playSessions)
    .innerJoin(users, eq(users.id, playSessions.userId))
    .innerJoin(games, eq(games.id, playSessions.gameId))
    .where(gt(playSessions.lastSeenAt, new Date(maintenant - 150 * 1000)))
    .orderBy(desc(playSessions.lastSeenAt))
    .all();

  const connexions = db
    .select({ pseudo: users.pseudo, quand: sessions.createdAt, agent: sessions.userAgent })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .orderBy(desc(sessions.createdAt))
    .limit(8)
    .all();

  const actifs7j = db
    .select({ n: sql<number>`count(distinct ${playSessions.userId})` })
    .from(playSessions)
    .where(gt(playSessions.lastSeenAt, new Date(maintenant - 7 * JOUR)))
    .get();

  const debutDuJour = new Date();
  debutDuJour.setHours(0, 0, 0, 0);
  const duree = (depuis?: Date) =>
    db
      .select({ s: somme(playSessions.durationSec) })
      .from(playSessions)
      .where(depuis ? gt(playSessions.startedAt, depuis) : undefined)
      .get()?.s ?? 0;

  const parConsole = db
    .select({ console: games.consoleSlug, total: compte })
    .from(games)
    .where(eq(games.isPublished, true))
    .groupBy(games.consoleSlug)
    .all();

  let disque: TableauDeBord["stockage"]["disque"] = null;
  try {
    const etat = await fs.statfs(paths.dataRoot);
    disque = { libre: etat.bavail * etat.bsize, total: etat.blocks * etat.bsize };
  } catch {
    // Système de fichiers qui ne se laisse pas interroger : on s'en passe.
  }

  const volume = (table: typeof saveFiles | typeof saveBackups | typeof saveStates) => {
    const ligne = db.select({ nombre: compte, octets: somme(table.size) }).from(table).get();
    return { nombre: ligne?.nombre ?? 0, octets: ligne?.octets ?? 0 };
  };

  return {
    maintenant: {
      // Un seul jeu par personne : le battement le plus récent.
      joueurs: joueurs.filter((j, i) => joueurs.findIndex((autre) => autre.pseudo === j.pseudo) === i),
      salons: [...salons().values()]
        .filter((salon) => salon.etat !== "termine")
        .sort((a, b) => b.creeLe - a.creeLe)
        .map((salon) => ({
          id: salon.id,
          jeu: salon.jeu.titre,
          console: salon.jeu.consoleSlug,
          joueurs: salon.places.filter((place) => place !== null).map((place) => place.pseudo),
          etat: salon.etat,
          prive: salon.prive,
          spectateurs: salon.spectateurs ? salon.nombreSpectateurs : null,
          depuis: salon.creeLe,
        })),
      capacite: etatCapacite(),
    },
    comptes: {
      total: db.select({ n: compte }).from(users).get()?.n ?? 0,
      actifs7j: actifs7j?.n ?? 0,
      connexions: connexions.map((c) => ({ pseudo: c.pseudo, quand: c.quand, appareil: appareil(c.agent) })),
    },
    jeux: {
      publies: db.select({ n: compte }).from(games).where(eq(games.isPublished, true)).get()?.n ?? 0,
      depublies: db.select({ n: compte }).from(games).where(eq(games.isPublished, false)).get()?.n ?? 0,
      officiels: db.select({ n: compte }).from(games).where(eq(games.isOfficial, true)).get()?.n ?? 0,
      sansJaquette:
        db
          .select({ n: compte })
          .from(games)
          .where(sql`${games.isPublished} = 1 and ${games.coverPath} is null`)
          .get()?.n ?? 0,
      parConsole,
    },
    temps: { aujourdhui: duree(debutDuJour), septJours: duree(new Date(maintenant - 7 * JOUR)), total: duree() },
    stockage: { sauvegardes: volume(saveFiles), copies: volume(saveBackups), etats: volume(saveStates), disque },
    serveur: {
      depuis: maintenant - Math.round(process.uptime() * 1000),
      memoire: process.memoryUsage().rss,
      charge: os.loadavg(),
      coeurs: os.availableParallelism(),
      node: process.version,
    },
  };
}
