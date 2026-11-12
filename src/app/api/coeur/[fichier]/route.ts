import { NextResponse } from "next/server";
import { FICHIERS_COEUR, lireFichierCoeur, type FichierCoeur } from "@/lib/discord/coeur";

/**
 * Sert au lecteur du site le cœur « une console », celui de l'Activité
 * Discord : le lecteur s'en sert pour les jeux dont la cartouche vibre (voir
 * `src/lib/emulator/vibration.ts`).
 *
 * Sans contrôle de compte, comme le cœur ordinaire rangé dans `public/mgba` :
 * c'est un logiciel libre, pas un jeu. Seuls les deux noms connus sont servis ;
 * rien de ce que porte l'adresse ne désigne un fichier.
 */
export async function GET(_request: Request, context: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await context.params;
  if (!Object.hasOwn(FICHIERS_COEUR, fichier)) return new NextResponse("Introuvable", { status: 404 });
  const nom = fichier as FichierCoeur;

  return new NextResponse(new Uint8Array(lireFichierCoeur(nom)), {
    headers: {
      "Content-Type": FICHIERS_COEUR[nom].type,
      // L'adresse porte l'empreinte du cœur (voir `adressesCoeurDuSite`).
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
