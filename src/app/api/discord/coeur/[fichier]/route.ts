import { NextResponse } from "next/server";
import { FICHIERS_COEUR, lireFichierCoeur, type FichierCoeur } from "@/lib/discord/coeur";
import { configPourHote, hoteDeLaRequete } from "@/lib/discord/applications";

/**
 * Sert le cœur d'émulation de l'Activité Discord.
 *
 * Sans contrôle de compte : c'est un logiciel libre, pas un jeu, et la page
 * le charge avant de savoir qui joue. Seuls les deux noms connus sont servis ;
 * rien de ce que porte l'adresse ne désigne un fichier.
 */
export async function GET(request: Request, context: { params: Promise<{ fichier: string }> }) {
  if (!configPourHote(hoteDeLaRequete(request.headers))) return new NextResponse("Introuvable", { status: 404 });

  const { fichier } = await context.params;
  if (!Object.hasOwn(FICHIERS_COEUR, fichier)) return new NextResponse("Introuvable", { status: 404 });
  const nom = fichier as FichierCoeur;

  return new NextResponse(new Uint8Array(lireFichierCoeur(nom)), {
    headers: {
      "Content-Type": FICHIERS_COEUR[nom].type,
      // L'adresse porte l'empreinte du cœur (voir `adressesCoeur`).
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
