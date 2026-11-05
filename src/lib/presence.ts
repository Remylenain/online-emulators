import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { games, playSessions, users } from "@/db/schema";
import { conditionAcces, jeuAccessible, type Visiteur } from "./acces";
import { salons } from "./link/registre";

/**
 * Qui joue en ce moment, pour l'accueil.
 *
 * Deux sources. Le lecteur signale sa partie toutes les minutes
 * (`play_sessions.last_seen_at`) : un signal de moins de deux minutes et
 * demie, c'est quelqu'un qui joue. Et les salons de câble link en cours, qui
 * vivent en mémoire dans le serveur.
 *
 * On ne montre que les jeux que le visiteur a le droit de voir — un compte
 * restreint n'apprend pas l'existence d'un jeu par ce biais — et jamais les
 * salons privés, dont le principe est de ne pas s'afficher.
 */

/** Un battement par minute : au-delà de deux et demie, la partie est finie ou l'onglet fermé. */
const FRAICHEUR_MS = 150 * 1000;

export type Presence = {
  pseudo: string;
  jeu: { titre: string; consoleSlug: string; slug: string };
  /** En salon de câble link, avec qui, et si on peut regarder. */
  link?: { avec: string | null; salon: string; regardable: boolean };
};

export async function quiJoue(visiteur: Visiteur): Promise<Presence[]> {
  const parPseudo = new Map<string, Presence>();

  const seuls = await db
    .select({
      pseudo: users.pseudo,
      titre: games.title,
      groupTitle: games.groupTitle,
      groupSlug: games.groupSlug,
      consoleSlug: games.consoleSlug,
      slug: games.slug,
    })
    .from(playSessions)
    .innerJoin(users, eq(users.id, playSessions.userId))
    .innerJoin(games, eq(games.id, playSessions.gameId))
    .where(
      and(
        gt(playSessions.lastSeenAt, new Date(Date.now() - FRAICHEUR_MS)),
        ne(playSessions.userId, visiteur.id),
        conditionAcces(visiteur),
      ),
    )
    .orderBy(desc(playSessions.lastSeenAt))
    .all();
  for (const ligne of seuls) {
    if (parPseudo.has(ligne.pseudo)) continue;
    parPseudo.set(ligne.pseudo, {
      pseudo: ligne.pseudo,
      jeu: {
        // Une partie d'un ensemble (un film découpé) s'annonce au nom de l'ensemble.
        titre: ligne.groupTitle ?? ligne.titre,
        consoleSlug: ligne.consoleSlug,
        slug: ligne.groupSlug ?? ligne.slug,
      },
    });
  }

  // Le câble link l'emporte sur un battement resté du lecteur.
  for (const salon of salons().values()) {
    if (salon.etat !== "en-jeu" || salon.prive) continue;
    if (salon.places.some((place) => place?.userId === visiteur.id)) continue;
    if (!(await jeuAccessible(visiteur, salon.jeu.id))) continue;
    for (const [i, place] of salon.places.entries()) {
      if (!place || place.connexions === 0) continue;
      parPseudo.set(place.pseudo, {
        pseudo: place.pseudo,
        jeu: { titre: salon.jeu.titre, consoleSlug: salon.jeu.consoleSlug, slug: salon.jeu.slug },
        link: { avec: salon.places[1 - i]?.pseudo ?? null, salon: salon.id, regardable: salon.spectateurs },
      });
    }
  }

  return [...parPseudo.values()].sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));
}
