import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, saveFiles, userGames, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { listerLiensInscription } from "@/lib/auth/invitations";
import { inscriptionsOuvertes, inscriptionsOuvrables } from "@/lib/parametres";
import { Comptes } from "./comptes";

export const metadata: Metadata = { title: "Comptes" };

export default async function ComptesPage() {
  const admin = await requireAdmin();

  const comptes = await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      accessMode: users.accessMode,
      createdAt: users.createdAt,
      // Le nombre de parties sauvegardées dit en un coup d'œil si un compte
      // sert vraiment, ce qu'une date d'inscription ne dit pas. Jointure et
      // non sous-requête : sur une seule table, drizzle écrit les colonnes
      // sans préfixe, et la sous-requête comptait toujours zéro.
      parties: sql<number>`count(${saveFiles.id})`,
    })
    .from(users)
    .leftJoin(saveFiles, eq(saveFiles.userId, users.id))
    .groupBy(users.id)
    .orderBy(asc(sql`lower(${users.pseudo})`))
    .all();

  // Pour l'import de sauvegarde et l'attribution : tous les jeux, publiés ou non.
  const jeux = await db
    .select({ id: games.id, titre: games.title, console: games.consoleSlug, publie: games.isPublished })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all();

  // Les jeux attribués, pour les comptes restreints ou testeurs.
  const attributions = await db.select().from(userGames).all();
  const comptesAvecJeux = comptes.map((compte) => ({
    ...compte,
    jeux: attributions.filter((a) => a.userId === compte.id).map((a) => a.gameId),
  }));

  const liens = await listerLiensInscription();

  return (
    <Comptes
      comptes={comptesAvecJeux}
      moi={admin.id}
      jeux={jeux}
      liens={liens}
      inscriptions={{ ouvertes: inscriptionsOuvertes(), ouvrables: inscriptionsOuvrables() }}
    />
  );
}
