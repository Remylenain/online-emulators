import { NextResponse } from "next/server";
import { jeuAccessible } from "@/lib/acces";
import { getCurrentUser } from "@/lib/auth/session";
import { marquerPartie } from "@/lib/play";

/**
 * Signale qu'une partie est en cours.
 *
 * Appelé au lancement, puis régulièrement tant que le jeu tourne. La même
 * route sert aux deux : au serveur de décider s'il s'agit d'une nouvelle
 * partie ou de la poursuite de la précédente — le lecteur n'a pas à le savoir,
 * et une page rechargée ne doit pas compter une partie de plus.
 */
export async function POST(_request: Request, context: { params: Promise<{ gameId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const { gameId } = await context.params;

  if (!(await jeuAccessible(viewer, gameId))) return new NextResponse("Introuvable", { status: 404 });

  return NextResponse.json(await marquerPartie(viewer.id, gameId), {
    headers: { "Cache-Control": "no-store" },
  });
}
