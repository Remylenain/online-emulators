"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { jeuAccessible } from "@/lib/acces";
import { requireUser } from "@/lib/auth/guard";

/**
 * Favoris : les jeux qu'un compte veut retrouver d'un geste, sur l'accueil
 * et dans « Mes jeux ». Rien de public là-dedans — ça ne compte pas comme
 * une note, et personne d'autre ne les voit.
 */
export async function basculerFavori(gameId: string): Promise<{ ok: boolean; favori: boolean }> {
  const user = await requireUser();
  if (!(await jeuAccessible(user, gameId))) return { ok: false, favori: false };

  const cle = and(eq(favorites.userId, user.id), eq(favorites.gameId, gameId));
  const deja = db.select({ gameId: favorites.gameId }).from(favorites).where(cle).get();
  if (deja) db.delete(favorites).where(cle).run();
  else db.insert(favorites).values({ userId: user.id, gameId }).run();

  revalidatePath("/");
  revalidatePath("/mes-jeux");
  return { ok: true, favori: !deja };
}
