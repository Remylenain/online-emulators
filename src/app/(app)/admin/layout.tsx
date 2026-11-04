import type { ReactNode } from "react";
import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { OngletsAdmin } from "./onglets";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s — Administration" },
};

/**
 * Coquille de l'administration : le titre, le résumé et les deux onglets.
 *
 * Comptes et bibliothèque sont deux pages distinctes, et non deux sections
 * d'une seule : les listes sont longues, et chercher un compte en faisant
 * défiler trente-cinq jeux n'a pas de sens. Le résumé reste commun, parce
 * qu'il répond à la même question depuis les deux pages.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  const comptes = await db.select({ n: sql<number>`count(*)` }).from(users).get();
  const publies = await db
    .select({ n: sql<number>`count(*)` })
    .from(games)
    .where(eq(games.isPublished, true))
    .get();
  const dernier = await db
    .select({ titre: games.title })
    .from(games)
    .where(eq(games.isPublished, true))
    .orderBy(desc(games.createdAt))
    .limit(1)
    .get();

  const nbComptes = comptes?.n ?? 0;
  const nbJeux = publies?.n ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink-50">Administration</h1>
        <p className="text-sm text-ink-400">
          {nbComptes} compte{nbComptes > 1 ? "s" : ""} · {nbJeux} jeu
          {nbJeux > 1 ? "x" : ""} au catalogue
          {dernier && ` · dernier ajout : ${dernier.titre}`}
        </p>
      </div>

      <OngletsAdmin />

      {children}
    </div>
  );
}
