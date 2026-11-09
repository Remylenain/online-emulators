import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { demarrerLaTache, etatDeLaTache } from "@/lib/admin/scan";
import { textes } from "@/lib/i18n/serveur";

/**
 * Le scraper — « Compléter les fiches » — lancé et suivi depuis le site, sur
 * le même patron que le scan : une tâche de fond, un journal relu toutes les
 * deux secondes tant qu'elle tourne.
 */
async function exigerAdmin() {
  const viewer = await getCurrentUser();
  if (viewer?.role === "ADMIN") return null;
  const t = (await textes()).adminBibliotheque.api;
  if (!viewer) return new NextResponse(t.nonAutorise, { status: 401 });
  return new NextResponse(t.interdit, { status: 403 });
}

export async function GET() {
  const refus = await exigerAdmin();
  if (refus) return refus;
  return NextResponse.json(await etatDeLaTache("scraper"), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const refus = await exigerAdmin();
  if (refus) return refus;
  // `?console=gbc` : ne compléter que les jeux de cette console.
  const resultat = await demarrerLaTache("scraper", new URL(request.url).searchParams.get("console") ?? undefined);
  if (!resultat.demarre) return NextResponse.json({ erreur: resultat.message }, { status: 409 });
  return NextResponse.json({ demarre: true });
}
