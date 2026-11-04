import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, playSessions } from "@/db/schema";
import { newId } from "@/lib/auth/session";

/**
 * Suivi des parties.
 *
 * Deux usages : la rangée « Reprendre » de l'accueil, et le tri par jeux les
 * plus joués. Rien de plus — on enregistre quand quelqu'un joue, pas ce qu'il
 * fait.
 */

/**
 * Au-delà de ce silence, la prochaine ouverture compte comme une nouvelle
 * partie. En deçà, c'est la même : recharger la page ou revenir d'un menu ne
 * doit pas gonfler le compteur.
 */
const MEME_PARTIE_MS = 30 * 60 * 1000;

/** Battement maximal retenu, pour qu'un onglet oublié ne compte pas des heures. */
const BATTEMENT_MAX_MS = 5 * 60 * 1000;

export type Battement = { nouvelle: boolean; duree: number };

export async function marquerPartie(userId: string, gameId: string): Promise<Battement> {
  const maintenant = new Date();

  const derniere = await db
    .select({
      id: playSessions.id,
      lastSeenAt: playSessions.lastSeenAt,
      startedAt: playSessions.startedAt,
      durationSec: playSessions.durationSec,
    })
    .from(playSessions)
    .where(and(eq(playSessions.userId, userId), eq(playSessions.gameId, gameId)))
    .orderBy(desc(playSessions.lastSeenAt))
    .get();

  if (derniere && maintenant.getTime() - derniere.lastSeenAt.getTime() < MEME_PARTIE_MS) {
    /**
     * La durée s'accumule par écarts entre battements, et non comme la
     * différence avec le début : un onglet laissé ouvert toute la nuit
     * compterait sinon huit heures de jeu. L'écart est plafonné pour la même
     * raison — un retour après une longue absence n'ajoute que le plafond.
     */
    const ecart = Math.min(
      maintenant.getTime() - derniere.lastSeenAt.getTime(),
      BATTEMENT_MAX_MS,
    );

    const duree = derniere.durationSec + Math.round(ecart / 1000);
    db.update(playSessions)
      .set({ lastSeenAt: maintenant, durationSec: duree })
      .where(eq(playSessions.id, derniere.id))
      .run();

    return { nouvelle: false, duree };
  }

  db.insert(playSessions)
    .values({
      id: newId(),
      userId,
      gameId,
      startedAt: maintenant,
      lastSeenAt: maintenant,
      durationSec: 0,
    })
    .run();

  // Le compteur du jeu suit les parties, pas les battements.
  db.update(games)
    .set({ playCount: sql`${games.playCount} + 1` })
    .where(eq(games.id, gameId))
    .run();

  return { nouvelle: true, duree: 0 };
}
