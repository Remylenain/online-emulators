import { and, eq, exists, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { accessGroupGames, accessGroups, games, userAccessGroups, userGames } from "@/db/schema";
import { REGLES_GROUPE, type RegleGroupe } from "./regles-groupe";

/**
 * Ce qu'un compte a le droit de voir.
 *
 * Un compte voit la réunion de ce que lui ouvrent :
 * - **ses groupes** (`access_groups`), chacun selon sa règle — une liste de
 *   jeux cochés, toutes les rom hacks, ou tout le catalogue ; seuls les jeux
 *   publiés en sortent ;
 * - **les jeux qu'on lui a attribués en propre** (`user_games`), publiés ou
 *   non : c'est ainsi qu'un jeu se fait tester avant sa sortie.
 *
 * Un compte sans groupe ne voit donc que les jeux qu'on lui a attribués. Un
 * administrateur voit tout le catalogue publié, quels que soient ses groupes.
 *
 * Partout — catalogue, fiches, lecteur, ROM, sauvegardes, câble link — la
 * même condition s'applique, et elle est construite ici une fois pour toutes.
 */

export { REGLES_GROUPE, type RegleGroupe };

/** Le strict nécessaire pour décider : qui, et s'il administre. */
export type Visiteur = { id: string; role?: "USER" | "ADMIN" };

function attribues(userId: string) {
  return db.select({ id: userGames.gameId }).from(userGames).where(eq(userGames.userId, userId));
}

function groupesDe(userId: string) {
  return db
    .select({ id: userAccessGroups.groupId })
    .from(userAccessGroups)
    .where(eq(userAccessGroups.userId, userId));
}

/** Le compte appartient à un groupe de cette règle. */
function aUnGroupe(userId: string, regle: RegleGroupe): SQL {
  return exists(
    db
      .select({ un: sql`1` })
      .from(accessGroups)
      .where(and(eq(accessGroups.rule, regle), inArray(accessGroups.id, groupesDe(userId)))),
  );
}

/** Condition SQL sur `games` : le jeu est visible par ce compte. */
export function conditionAcces(visiteur: Visiteur): SQL {
  const publie = eq(games.isPublished, true);
  const attribue = inArray(games.id, attribues(visiteur.id));
  if (visiteur.role === "ADMIN") return or(publie, attribue)!;

  // Les jeux cochés ne comptent que pour un groupe resté « à liste » : changer
  // la règle d'un groupe garde sa liste de côté sans plus l'appliquer.
  const coche = inArray(
    games.id,
    db
      .select({ id: accessGroupGames.gameId })
      .from(accessGroupGames)
      .innerJoin(accessGroups, eq(accessGroups.id, accessGroupGames.groupId))
      .where(and(eq(accessGroups.rule, "liste"), inArray(accessGroupGames.groupId, groupesDe(visiteur.id)))),
  );
  const parGroupe = or(
    aUnGroupe(visiteur.id, "tout"),
    and(eq(games.isOfficial, false), aUnGroupe(visiteur.id, "romhacks")),
    coche,
  );
  return or(attribue, and(publie, parGroupe))!;
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

/**
 * Fait entrer un compte qui vient d'être créé dans le groupe par défaut, s'il
 * y en a un. `base` : la connexion, ou la transaction qui crée le compte.
 */
export function rejoindreGroupeParDefaut(base: Pick<typeof db, "select" | "insert">, userId: string): void {
  const parDefaut = base
    .select({ id: accessGroups.id })
    .from(accessGroups)
    .where(eq(accessGroups.isDefault, true))
    .all();
  for (const groupe of parDefaut) {
    base.insert(userAccessGroups).values({ userId, groupId: groupe.id }).onConflictDoNothing().run();
  }
}
