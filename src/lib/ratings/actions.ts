"use server";

import { and, avg, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { games, ratings } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";

/**
 * Notes des joueurs, de 1 à 5.
 *
 * Une note par compte et par jeu, modifiable : ce n'est pas un vote mais un
 * avis, et un avis change quand on a joué plus longtemps.
 */

export type ResultatNote = { ok: boolean; message?: string; moyenne?: number; nombre?: number };

export async function noter(gameId: string, score: number): Promise<ResultatNote> {
  const user = await requireUser();

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { ok: false, message: "Note invalide." };
  }

  const jeu = await db
    .select({ consoleSlug: games.consoleSlug, slug: games.slug })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu) return { ok: false, message: "Jeu introuvable." };

  db.insert(ratings)
    .values({ userId: user.id, gameId, score })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.gameId],
      set: { score, updatedAt: new Date() },
    })
    .run();

  return { ok: true, ...(await recalculer(gameId, jeu.consoleSlug, jeu.slug)) };
}

export async function retirerNote(gameId: string): Promise<ResultatNote> {
  const user = await requireUser();

  const jeu = await db
    .select({ consoleSlug: games.consoleSlug, slug: games.slug })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu) return { ok: false, message: "Jeu introuvable." };

  db.delete(ratings)
    .where(and(eq(ratings.userId, user.id), eq(ratings.gameId, gameId)))
    .run();

  return { ok: true, ...(await recalculer(gameId, jeu.consoleSlug, jeu.slug)) };
}

/**
 * Remet à jour la moyenne et le nombre stockés sur le jeu.
 *
 * Ces deux valeurs sont dénormalisées exprès : le catalogue trie dessus, et
 * recalculer une moyenne pour chaque jeu à chaque affichage de page serait
 * payer cher une information qui ne bouge presque jamais.
 */
async function recalculer(
  gameId: string,
  consoleSlug: string,
  slug: string,
): Promise<{ moyenne: number; nombre: number }> {
  const agrege = await db
    .select({ moyenne: avg(ratings.score), nombre: count() })
    .from(ratings)
    .where(eq(ratings.gameId, gameId))
    .get();

  const moyenne = Number(agrege?.moyenne ?? 0);
  const nombre = agrege?.nombre ?? 0;

  db.update(games)
    .set({ ratingAvg: moyenne, ratingCount: nombre, updatedAt: new Date() })
    .where(eq(games.id, gameId))
    .run();

  revalidatePath(`/jeux/${consoleSlug}/${slug}`);
  revalidatePath(`/consoles/${consoleSlug}`);

  return { moyenne, nombre };
}
