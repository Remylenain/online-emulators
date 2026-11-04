import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { ecrireEtat, lireEtat, lireSegment, supprimerEtat } from "@/lib/states";

/**
 * Un savestate, désigné par son emplacement.
 *
 * Le fichier produit par mGBA est un PNG qui contient l'état de la console et
 * l'image de l'écran : il est donc servi tel quel, et le site l'affiche
 * directement comme vignette.
 */
const TAILLE_MAX = 8_388_608;

type Contexte = { params: Promise<{ gameId: string; slot: string }> };

async function resoudre(context: Contexte) {
  const { gameId, slot } = await context.params;
  // « 3 » pour le troisième emplacement manuel, « a3 » pour l'automatique.
  return { gameId, cible: lireSegment(slot) };
}

export async function GET(_request: Request, context: Contexte) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { gameId, cible } = await resoudre(context);
  if (!cible) return new NextResponse("Emplacement invalide", { status: 400 });

  const donnees = await lireEtat(viewer.id, gameId, cible.emplacement, cible.auto);
  if (!donnees) return new NextResponse("Introuvable", { status: 404 });

  return new NextResponse(new Uint8Array(donnees), {
    headers: {
      // `image/png` et non `application/octet-stream` : c'en est un, et cela
      // permet de l'afficher comme vignette sans traitement.
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request, context: Contexte) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { gameId, cible } = await resoudre(context);
  if (!cible) return NextResponse.json({ erreur: "Emplacement invalide." }, { status: 400 });

  const jeu = await db
    .select({ isPublished: games.isPublished })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu?.isPublished) {
    return NextResponse.json({ erreur: "Jeu introuvable." }, { status: 404 });
  }

  const corps = await request.arrayBuffer();
  if (corps.byteLength === 0) {
    return NextResponse.json({ erreur: "État vide." }, { status: 400 });
  }
  if (corps.byteLength > TAILLE_MAX) {
    return NextResponse.json({ erreur: "État trop volumineux." }, { status: 413 });
  }

  const resume = await ecrireEtat(
    viewer.id,
    gameId,
    cible.emplacement,
    cible.auto,
    new Uint8Array(corps),
  );
  return NextResponse.json(resume);
}

export async function DELETE(_request: Request, context: Contexte) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { gameId, cible } = await resoudre(context);
  if (!cible) return NextResponse.json({ erreur: "Emplacement invalide." }, { status: 400 });

  const supprime = await supprimerEtat(viewer.id, gameId, cible.emplacement, cible.auto);
  return NextResponse.json({ supprime });
}
