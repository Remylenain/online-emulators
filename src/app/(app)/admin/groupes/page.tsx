import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessGroupGames, accessGroups, games, userAccessGroups, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { Groupes } from "./groupes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await textes()).adminGroupes.titreOnglet };
}

/**
 * Les groupes d'accès : ce que chacun ouvre du catalogue, et qui en fait
 * partie. Tout est envoyé d'un coup à la page — groupes, jeux, comptes — :
 * cocher, chercher et filtrer se font alors sans aller-retour.
 */
export default async function GroupesPage() {
  await requireAdmin();

  const groupes = db.select().from(accessGroups).orderBy(asc(accessGroups.createdAt), asc(accessGroups.name)).all();
  const coches = db.select().from(accessGroupGames).all();
  const appartenances = db.select().from(userAccessGroups).all();

  const jeux = db
    .select({
      id: games.id,
      titre: games.title,
      console: games.consoleSlug,
      publie: games.isPublished,
      officiel: games.isOfficial,
      recherche: games.searchText,
    })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all();

  const comptes = db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      admin: sql<number>`${users.role} = 'ADMIN'`,
      actif: users.isActive,
      discord: sql<number>`${users.discordId} is not null`,
    })
    .from(users)
    .orderBy(asc(sql`lower(${users.pseudo})`))
    .all();

  const avecGroupe = new Set(appartenances.map((a) => a.userId));

  return (
    <Groupes
      groupes={groupes.map((groupe) => ({
        id: groupe.id,
        nom: groupe.name,
        regle: groupe.rule,
        parDefaut: groupe.isDefault,
        jeux: coches.filter((c) => c.groupId === groupe.id).map((c) => c.gameId),
        membres: appartenances.filter((a) => a.groupId === groupe.id).map((a) => a.userId),
      }))}
      jeux={jeux}
      comptes={comptes.map((compte) => ({
        id: compte.id,
        pseudo: compte.pseudo,
        admin: Boolean(compte.admin),
        actif: compte.actif,
        discord: Boolean(compte.discord),
        sansGroupe: !avecGroupe.has(compte.id),
      }))}
    />
  );
}
