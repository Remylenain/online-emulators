import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { jeuAccessible } from "@/lib/acces";
import { getCurrentUser } from "@/lib/auth/session";
import { nomDeFichier } from "@/lib/format";
import { ecrireSauvegarde, lireSauvegarde } from "@/lib/saves";

/**
 * La sauvegarde SRAM du compte connecté pour un jeu.
 *
 * L'en-tête `X-Revision` porte le numéro de version. Le lecteur le renvoie à
 * l'écriture : s'il ne correspond plus, c'est qu'une autre session a
 * enregistré entre-temps, et le serveur refuse plutôt que d'écraser.
 *
 * Une sauvegarde dépasse rarement 128 Ko. La limite est là contre l'envoi
 * accidentel d'un gros fichier, pas contre un joueur malveillant — il n'aurait
 * de toute façon que sa propre partie à abîmer.
 */
const TAILLE_MAX = 1_048_576;

export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { gameId } = await context.params;
  const sauvegarde = await lireSauvegarde(viewer.id, gameId);

  // 204 et non 404 : l'absence de sauvegarde est le cas normal d'une première
  // partie, pas une erreur à signaler dans la console du navigateur.
  if (!sauvegarde) return new NextResponse(null, { status: 204 });

  const entetes: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Revision": String(sauvegarde.revision),
    "X-Modifiee": sauvegarde.modifiee.toISOString(),
    "Cache-Control": "no-store",
  };

  // `?fichier` : la même sauvegarde, mais proposée en téléchargement sous le
  // nom du jeu — depuis la page « Mes jeux », sans ouvrir le lecteur.
  if (new URL(request.url).searchParams.has("fichier")) {
    const jeu = await db
      .select({ title: games.title })
      .from(games)
      .where(eq(games.id, gameId))
      .get();
    entetes["Content-Disposition"] =
      `attachment; filename="${nomDeFichier(jeu?.title ?? "sauvegarde")}.sav"`;
  }

  return new NextResponse(new Uint8Array(sauvegarde.donnees), { headers: entetes });
}

export async function PUT(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { gameId } = await context.params;
  if (!(await jeuAccessible(viewer, gameId))) {
    return NextResponse.json({ erreur: "Jeu introuvable." }, { status: 404 });
  }

  const corps = await request.arrayBuffer();
  if (corps.byteLength === 0) {
    return NextResponse.json({ erreur: "Sauvegarde vide." }, { status: 400 });
  }
  if (corps.byteLength > TAILLE_MAX) {
    return NextResponse.json({ erreur: "Sauvegarde trop volumineuse." }, { status: 413 });
  }

  const entete = request.headers.get("X-Revision");
  const revisionAttendue = entete === null || entete === "" ? null : Number(entete);
  if (revisionAttendue !== null && !Number.isInteger(revisionAttendue)) {
    return NextResponse.json({ erreur: "Révision invalide." }, { status: 400 });
  }

  const resultat = await ecrireSauvegarde(
    viewer.id,
    gameId,
    new Uint8Array(corps),
    revisionAttendue,
  );

  if (resultat.etat === "conflit") {
    return NextResponse.json(
      {
        erreur:
          "Cette partie a été sauvegardée ailleurs depuis que tu as commencé. " +
          "Ta sauvegarde n'a pas été écrasée.",
        revision: resultat.revision,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ etat: resultat.etat, revision: resultat.revision });
}
