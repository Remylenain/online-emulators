import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import { paths } from "@/lib/paths";

/**
 * Sert l'avatar d'un compte depuis DATA_DIR.
 *
 * Les fichiers des joueurs ne sont pas dans /public : il faut être connecté
 * pour en lire un, comme pour tout le reste du site.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse((await textes()).mesJeux.reponses.nonAutorise, { status: 401 });

  const { id } = await context.params;

  const row = await db
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, id))
    .get();

  if (!row?.avatarPath) return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });

  try {
    const file = await fs.readFile(paths.data(row.avatarPath));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        // Privé : un cache partagé ne doit pas resservir l'image à un autre compte.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    // Enregistré en base mais absent du disque : on ne casse pas la page.
    return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });
  }
}
