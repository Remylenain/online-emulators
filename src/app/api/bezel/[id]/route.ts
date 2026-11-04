import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bezels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { paths } from "@/lib/paths";

/**
 * Sert un habillage d'écran, depuis la copie produite par le scan.
 *
 * L'adresse porte l'empreinte de l'image (`?v=`) : une image remplacée change
 * d'adresse, ce qui permet une mise en cache longue sans jamais resservir
 * l'ancienne version.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { id } = await context.params;
  const row = await db
    .select({ path: bezels.path })
    .from(bezels)
    .where(eq(bezels.id, id))
    .get();
  if (!row) return new NextResponse("Introuvable", { status: 404 });

  try {
    const file = await fs.readFile(paths.data(row.path));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Introuvable", { status: 404 });
  }
}
