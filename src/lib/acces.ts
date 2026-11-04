import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { games, userGames } from "@/db/schema";

/**
 * Ce qu'un compte a le droit de voir.
 *
 * Trois modes, décidés par l'administrateur :
 * - **normal** : tout le catalogue publié ;
 * - **restreint** : seulement les jeux attribués au compte, pour faire
 *   essayer le site sans ouvrir toute la bibliothèque ;
 * - **testeur** : le catalogue publié, plus les jeux attribués — qui peuvent
 *   ne pas être publiés : c'est ainsi qu'un jeu se fait tester avant sa sortie.
 *
 * Partout — catalogue, fiches, lecteur, ROM, sauvegardes, câble link — la
 * même condition s'applique, et elle est construite ici une fois pour toutes.
 * Elle remplace le simple « jeu publié » d'avant : la publication en fait
 * partie.
 */

import { MODES_ACCES, type ModeAcces } from "./modes-acces";

export { MODES_ACCES, type ModeAcces };

/** Le strict nécessaire pour décider : qui, et son mode. */
export type Visiteur = { id: string; accessMode: ModeAcces };

function attribues(userId: string) {
  return db.select({ id: userGames.gameId }).from(userGames).where(eq(userGames.userId, userId));
}

/** Condition SQL sur `games` : le jeu est visible par ce compte. */
export function conditionAcces(visiteur: Visiteur): SQL {
  const publie = eq(games.isPublished, true);
  switch (visiteur.accessMode) {
    case "restreint":
      return inArray(games.id, attribues(visiteur.id));
    case "testeur":
      return or(publie, inArray(games.id, attribues(visiteur.id)))!;
    default:
      return publie;
  }
}

/** Le jeu existe et le compte y a accès. */
export async function jeuAccessible(visiteur: Visiteur, gameId: string): Promise<boolean> {
  const ligne = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.id, gameId), conditionAcces(visiteur)))
    .get();
  return Boolean(ligne);
}

/** Les jeux attribués à un compte, pour l'administration. */
export async function jeuxAttribues(userId: string): Promise<string[]> {
  const lignes = await attribues(userId).all();
  return lignes.map((l) => l.id);
}
