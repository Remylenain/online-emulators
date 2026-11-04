"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bezelChoices, bezels } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { CONSOLE_SLUGS } from "@/lib/consoles";

/**
 * Retient l'habillage choisi par le compte pour une console.
 *
 * `bezelId` à `null` : le joueur ne veut aucun habillage. C'est un choix
 * enregistré comme un autre, et non l'absence de choix — sans quoi le défaut
 * reviendrait à la partie suivante.
 */
export async function choisirHabillage(
  consoleSlug: string,
  bezelId: string | null,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!CONSOLE_SLUGS.includes(consoleSlug)) return { ok: false };

  if (bezelId !== null) {
    const existe = await db
      .select({ id: bezels.id })
      .from(bezels)
      .where(and(eq(bezels.id, bezelId), eq(bezels.consoleSlug, consoleSlug)))
      .get();
    if (!existe) return { ok: false };
  }

  db.insert(bezelChoices)
    .values({ userId: user.id, consoleSlug, bezelId })
    .onConflictDoUpdate({
      target: [bezelChoices.userId, bezelChoices.consoleSlug],
      set: { bezelId, updatedAt: new Date() },
    })
    .run();

  return { ok: true };
}
