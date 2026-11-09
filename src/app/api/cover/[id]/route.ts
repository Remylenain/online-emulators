import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import { paths } from "@/lib/paths";

/**
 * Sert la jaquette d'un jeu, depuis les miniatures produites par le scan.
 *
 * Deux tailles : `?t=sm` pour les grilles, `?t=lg` pour la fiche de jeu. La
 * bibliothèque d'origine n'est jamais servie telle quelle — elle contient des
 * fichiers d'impression de plusieurs mégaoctets.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse((await textes()).mesJeux.reponses.nonAutorise, { status: 401 });

  const { id } = await context.params;
  const demande = new URL(request.url).searchParams.get("t") ?? "sm";

  const row = await db
    .select({
      coverPath: games.coverPath,
      hasBackCover: games.hasBackCover,
      labelPath: games.labelPath,
    })
    .from(games)
    .where(eq(games.id, id))
    .get();

  if (!row) return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });

  // L'étiquette de cartouche est un fichier à part entière ; la face avant et
  // le dos sont deux découpes d'une même jaquette, distinguées par suffixe.
  let fichier: string | null = null;
  if (demande === "etiquette") {
    fichier = row.labelPath ? `${row.labelPath}.webp` : null;
  } else if (demande === "dos") {
    fichier = row.coverPath && row.hasBackCover ? `${row.coverPath}-dos.webp` : null;
  } else {
    const taille = demande === "lg" ? "lg" : "sm";
    fichier = row.coverPath ? `${row.coverPath}-${taille}.webp` : null;
  }

  if (!fichier) return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });

  try {
    const file = await fs.readFile(paths.data(fichier));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        // Privé, comme tout le reste : le site n'est pas public, et un cache
        // partagé n'a pas à conserver son contenu.
        //
        // Durée courte, contrairement aux ROMs : l'adresse d'une jaquette ne
        // porte pas de version, donc une jaquette remplacée resterait
        // invisible aussi longtemps qu'elle serait gardée. Cinq minutes
        // suffisent à éviter les rechargements d'une même page.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    // Enregistrée en base mais absente du disque : la grille affichera son
    // cadre vide plutôt que de casser la page.
    return new NextResponse((await textes()).mesJeux.reponses.introuvable, { status: 404 });
  }
}
