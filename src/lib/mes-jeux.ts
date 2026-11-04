import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, playSessions, ratings, saveBackups, saveFiles, saveStates, users } from "@/db/schema";
import { conditionAcces, type Visiteur } from "@/lib/acces";
import { titreComplet, type JeuResume } from "@/lib/jeu-resume";
import type { Copie } from "@/lib/saves";

export { titreComplet, type JeuResume };

/**
 * Ce qu'un compte a fait sur le site : son temps de jeu, ses notes, ses
 * sauvegardes. Tout est déjà en base — le suivi des parties compte les
 * minutes depuis le début — il ne manquait que de le montrer.
 *
 * Les mêmes requêtes servent à la page « Mes jeux » d'un joueur et à la page
 * d'administration qui les passe tous en revue.
 */

const colonnesJeu = {
  id: games.id,
  slug: games.slug,
  consoleSlug: games.consoleSlug,
  title: games.title,
  coverPath: games.coverPath,
  groupTitle: games.groupTitle,
  partNumber: games.partNumber,
} as const;

// ---------------------------------------------------------------------------
// Temps de jeu
// ---------------------------------------------------------------------------

export type TempsJeu = {
  jeu: JeuResume;
  /** Secondes cumulées sur toutes les parties. */
  secondes: number;
  parties: number;
  derniere: Date;
};

export async function tempsDeJeu(visiteur: Visiteur): Promise<TempsJeu[]> {
  const lignes = await db
    .select({
      ...colonnesJeu,
      secondes: sql<number>`sum(${playSessions.durationSec})`,
      parties: sql<number>`count(*)`,
      derniere: sql<number>`max(${playSessions.lastSeenAt})`,
    })
    .from(playSessions)
    .innerJoin(games, eq(playSessions.gameId, games.id))
    .where(and(eq(playSessions.userId, visiteur.id), conditionAcces(visiteur)))
    .groupBy(games.id)
    .orderBy(desc(sql`sum(${playSessions.durationSec})`))
    .all();

  return lignes.map(({ secondes, parties, derniere, ...jeu }) => ({
    jeu,
    secondes,
    parties,
    derniere: new Date(derniere),
  }));
}

export type TempsCompte = {
  id: string;
  pseudo: string;
  secondes: number;
  jeux: number;
  derniere: Date | null;
};

/** Pour l'administration : chaque compte et son total, les plus joueurs d'abord. */
export async function tempsParCompte(): Promise<TempsCompte[]> {
  const lignes = await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      secondes: sql<number>`coalesce(sum(${playSessions.durationSec}), 0)`,
      jeux: sql<number>`count(distinct ${playSessions.gameId})`,
      derniere: sql<number | null>`max(${playSessions.lastSeenAt})`,
    })
    .from(users)
    .leftJoin(playSessions, eq(playSessions.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(sql`coalesce(sum(${playSessions.durationSec}), 0)`), sql`lower(${users.pseudo})`)
    .all();

  return lignes.map((l) => ({
    ...l,
    derniere: l.derniere === null ? null : new Date(l.derniere),
  }));
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export type NoteJeu = { jeu: JeuResume; score: number; noteLe: Date };

/** Les jeux notés, les mieux notés d'abord — c'est la liste des préférés. */
export async function mesNotes(visiteur: Visiteur): Promise<NoteJeu[]> {
  const lignes = await db
    .select({ ...colonnesJeu, score: ratings.score, noteLe: ratings.updatedAt })
    .from(ratings)
    .innerJoin(games, eq(ratings.gameId, games.id))
    .where(and(eq(ratings.userId, visiteur.id), conditionAcces(visiteur)))
    .orderBy(desc(ratings.score), desc(ratings.updatedAt))
    .all();

  return lignes.map(({ score, noteLe, ...jeu }) => ({ jeu, score, noteLe }));
}

// ---------------------------------------------------------------------------
// Sauvegardes
// ---------------------------------------------------------------------------

export type SauvegardeJeu = {
  jeu: JeuResume;
  taille: number;
  revision: number;
  modifiee: Date;
  etatsManuels: number;
  etatsAuto: number;
  copies: Copie[];
};

/** Toutes les sauvegardes du compte, les plus récemment modifiées d'abord. */
export async function mesSauvegardes(userId: string): Promise<SauvegardeJeu[]> {
  const lignes = await db
    .select({
      ...colonnesJeu,
      saveId: saveFiles.id,
      taille: saveFiles.size,
      revision: saveFiles.revision,
      modifiee: saveFiles.updatedAt,
    })
    .from(saveFiles)
    .innerJoin(games, eq(saveFiles.gameId, games.id))
    .where(eq(saveFiles.userId, userId))
    .orderBy(desc(saveFiles.updatedAt))
    .all();

  // Les points de reprise, comptés par jeu en une requête (voir `statsJeu`
  // pour la raison d'éviter une sous-requête corrélée).
  const etats = await db
    .select({
      gameId: saveStates.gameId,
      isAuto: saveStates.isAuto,
      nombre: sql<number>`count(*)`,
    })
    .from(saveStates)
    .where(and(eq(saveStates.userId, userId), sql`${saveStates.slot} <= 5`))
    .groupBy(saveStates.gameId, saveStates.isAuto)
    .all();
  const compterEtats = (gameId: string, auto: boolean) =>
    etats.find((e) => e.gameId === gameId && e.isAuto === auto)?.nombre ?? 0;

  // Une seule requête pour toutes les copies du compte plutôt qu'une par jeu.
  const copies = await db
    .select({
      id: saveBackups.id,
      saveFileId: saveBackups.saveFileId,
      revision: saveBackups.revision,
      taille: saveBackups.size,
      creeLe: saveBackups.createdAt,
    })
    .from(saveBackups)
    .innerJoin(saveFiles, eq(saveBackups.saveFileId, saveFiles.id))
    .where(eq(saveFiles.userId, userId))
    .orderBy(desc(saveBackups.createdAt))
    .all();

  return lignes.map(({ saveId, taille, revision, modifiee, ...jeu }) => ({
    jeu,
    taille,
    revision,
    modifiee,
    etatsManuels: compterEtats(jeu.id, false),
    etatsAuto: compterEtats(jeu.id, true),
    copies: copies
      .filter((c) => c.saveFileId === saveId)
      .map(({ id, revision, taille, creeLe }) => ({ id, revision, taille, creeLe })),
  }));
}

// ---------------------------------------------------------------------------
// La partie en cours, et les chiffres d'un jeu pour un compte
// ---------------------------------------------------------------------------

export type StatsJeu = {
  secondes: number;
  parties: number;
  derniere: Date | null;
  /** Date de la sauvegarde courante, s'il y en a une. */
  sauvegarde: Date | null;
  copies: number;
};

/** Ce qu'un compte a fait sur un jeu précis : la fiche l'affiche. */
export async function statsJeu(userId: string, gameId: string): Promise<StatsJeu> {
  const jeu = await db
    .select({
      secondes: sql<number>`coalesce(sum(${playSessions.durationSec}), 0)`,
      parties: sql<number>`count(*)`,
      derniere: sql<number | null>`max(${playSessions.lastSeenAt})`,
    })
    .from(playSessions)
    .where(and(eq(playSessions.userId, userId), eq(playSessions.gameId, gameId)))
    .get();

  /**
   * Jointure plutôt que sous-requête corrélée : dans une requête sur une seule
   * table, drizzle écrit les colonnes sans préfixe de table, et `"id"` dans la
   * sous-requête désignerait alors la copie, pas la sauvegarde — le compte
   * serait toujours zéro.
   */
  const sauvegarde = await db
    .select({
      modifiee: saveFiles.updatedAt,
      copies: sql<number>`count(${saveBackups.id})`,
    })
    .from(saveFiles)
    .leftJoin(saveBackups, eq(saveBackups.saveFileId, saveFiles.id))
    .where(and(eq(saveFiles.userId, userId), eq(saveFiles.gameId, gameId)))
    .groupBy(saveFiles.id)
    .get();

  return {
    secondes: jeu?.secondes ?? 0,
    parties: jeu?.parties ?? 0,
    derniere: jeu?.derniere ? new Date(jeu.derniere) : null,
    sauvegarde: sauvegarde?.modifiee ?? null,
    copies: sauvegarde?.copies ?? 0,
  };
}

export type PartieEnCours = { jeu: JeuResume; stats: StatsJeu };

/** Le dernier jeu ouvert par le compte, avec ses chiffres : la tête de l'accueil. */
export async function partieEnCours(visiteur: Visiteur): Promise<PartieEnCours | null> {
  const ligne = await db
    .select({ ...colonnesJeu, derniere: sql<number>`max(${playSessions.lastSeenAt})` })
    .from(playSessions)
    .innerJoin(games, eq(playSessions.gameId, games.id))
    .where(and(eq(playSessions.userId, visiteur.id), conditionAcces(visiteur)))
    .groupBy(games.id)
    .orderBy(desc(sql`max(${playSessions.lastSeenAt})`))
    .limit(1)
    .get();
  if (!ligne) return null;

  const { derniere: _derniere, ...jeu } = ligne;
  return { jeu, stats: await statsJeu(visiteur.id, jeu.id) };
}
