import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import { listerEtats } from "@/lib/states";

/** Les savestates du compte connecté pour un jeu, sans leur contenu. */
export async function GET(_request: Request, context: { params: Promise<{ gameId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse((await textes()).mesJeux.reponses.nonAutorise, { status: 401 });

  const { gameId } = await context.params;
  const etats = await listerEtats(viewer.id, gameId);

  return NextResponse.json(
    { etats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
