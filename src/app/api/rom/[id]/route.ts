import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { jeuAccessible } from "@/lib/acces";
import { getCurrentUser } from "@/lib/auth/session";
import { paths } from "@/lib/paths";
import { jeuInvite } from "@/lib/vitrine";

/**
 * Sert la ROM d'un jeu au lecteur.
 *
 * Point sensible du site : c'est la seule route qui rend un jeu entier. Elle
 * exige donc une session valide, comme le reste, et ne sert que des jeux
 * publiés — dépublier un jeu doit suffire à le retirer de la circulation.
 *
 * Une seule exception, voulue par l'administrateur : les jeux de la vitrine
 * (`src/lib/vitrine.ts`), qu'un invité lance sans compte. Eux seuls sortent
 * sans session, et seulement tant que la vitrine est allumée.
 *
 * Le chemin vient de la base et passe par `paths.library()`, qui refuse tout
 * ce qui sortirait de LIBRARY_DIR : l'identifiant de l'URL ne désigne jamais
 * un fichier directement.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  const { id } = await context.params;

  if (!viewer) {
    if (!(await jeuInvite(id))) return new NextResponse("Non autorisé", { status: 401 });
  } else if (!(await jeuAccessible(viewer, id)) && !(await jeuInvite(id))) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const game = await db
    .select({ romPath: games.romPath, romSize: games.romSize, romSha1: games.romSha1 })
    .from(games)
    .where(eq(games.id, id))
    .get();
  if (!game) return new NextResponse("Introuvable", { status: 404 });

  let fichier: Buffer;
  try {
    fichier = await fs.readFile(paths.library(game.romPath));
  } catch {
    return new NextResponse("ROM absente du disque", { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fichier.length),
      // L'empreinte sert de validateur : une ROM ne change pas, et le
      // navigateur peut la garder sans la redemander à chaque partie. Une
      // nouvelle version du jeu change l'empreinte, donc l'étiquette.
      ETag: `"${game.romSha1}"`,
      // Privé : une ROM de 32 Mio ne doit pas finir dans un cache partagé.
      // `immutable` évite la revalidation pendant la durée de vie du cache.
      "Cache-Control": "private, max-age=604800, immutable",
    },
  });
}
