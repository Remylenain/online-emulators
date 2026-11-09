import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { demarrerScan, etatDuScan } from "@/lib/admin/scan";
import { textes } from "@/lib/i18n/serveur";

/**
 * Le scan de bibliothèque, lancé et suivi depuis le site.
 *
 * Une route plutôt qu'une action de serveur : l'interface interroge l'état
 * toutes les deux secondes pendant que le scan tourne, ce qu'une action ne
 * sait pas faire sans recharger la page.
 */
async function exigerAdmin() {
  const viewer = await getCurrentUser();
  if (viewer?.role === "ADMIN") return { refus: null };
  const t = (await textes()).adminBibliotheque.api;
  if (!viewer) return { refus: new NextResponse(t.nonAutorise, { status: 401 }) };
  return { refus: new NextResponse(t.interdit, { status: 403 }) };
}

export async function GET() {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  return NextResponse.json(await etatDuScan(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  // `?console=gbc` : ne relire que cette console.
  const resultat = await demarrerScan(new URL(request.url).searchParams.get("console") ?? undefined);
  if (!resultat.demarre) {
    return NextResponse.json({ erreur: resultat.message }, { status: 409 });
  }
  return NextResponse.json({ demarre: true });
}
