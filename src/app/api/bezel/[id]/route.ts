import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bezels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import { paths } from "@/lib/paths";
import { vitrineOuverte } from "@/lib/vitrine";

/**
 * Sert un habillage d'écran, depuis la copie produite par le scan.
 *
 * L'adresse porte l'empreinte de l'image (`?v=`) : une image remplacée change
 * d'adresse, ce qui permet une mise en cache longue sans jamais resservir
 * l'ancienne version.
 *
 * Un habillage n'est que le dessin d'une console : il sort aussi sans compte
 * quand la vitrine est allumée, pour le lecteur de l'invité.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer && !vitrineOuverte()) {
    return new NextResponse((await textes()).mesJeux.reponses.nonAutorise, { status: 401 });
  }

  const { id } = await context.params;
  const row = await db
    .select({ path: bezels.path })
    .from(bezels)
    .where(eq(bezels.id, id))
    .get();
  if (!row) return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });

  try {
    const file = await fs.readFile(paths.data(row.path));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });
  }
}
