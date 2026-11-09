import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import { nomDeFichier } from "@/lib/format";
import { lireCopie } from "@/lib/saves";

/**
 * Une copie de secours du compte connecté, à télécharger.
 *
 * Le numéro vient de l'adresse, mais `lireCopie` ne rend que les copies du
 * compte : un numéro deviné ne donne rien.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse((await textes()).mesJeux.reponses.nonAutorise, { status: 401 });

  const { id } = await context.params;
  const copie = await lireCopie(viewer.id, id);
  if (!copie) return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });

  const jeu = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.id, copie.gameId))
    .get();
  const nom = `${nomDeFichier(jeu?.title ?? "sauvegarde")} (rev ${copie.revision}).sav`;

  return new NextResponse(new Uint8Array(copie.donnees), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "no-store",
    },
  });
}
