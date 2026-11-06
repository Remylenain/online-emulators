import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { jeuAccessible } from "@/lib/acces";
import { compteDepuisRequete } from "@/lib/discord/compte";
import { jeuConfigure } from "@/lib/discord/jeu";
import { paths } from "@/lib/paths";

/**
 * La ROM du jeu de l'Activité, pour le compte porté par le jeton.
 *
 * Même prudence que `/api/rom/[id]` : pas de compte, pas de jeu, et le compte
 * doit y avoir accès selon `src/lib/acces.ts`. L'adresse ne désigne rien :
 * le jeu servi est celui de la configuration, et aucun autre.
 */
export async function GET(request: Request) {
  const visiteur = compteDepuisRequete(request);
  if (!visiteur) return new NextResponse("Non autorisé", { status: 401 });

  const jeu = await jeuConfigure();
  if (!jeu || !(await jeuAccessible(visiteur, jeu.id))) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fs.readFile(paths.library(jeu.cheminRom));
  } catch {
    return new NextResponse("ROM absente du disque", { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fichier.length),
      ETag: `"${jeu.empreinte}"`,
      // La page met l'empreinte dans l'adresse : une ROM corrigée change
      // d'adresse, et le navigateur la retélécharge.
      "Cache-Control": "private, max-age=604800, immutable",
    },
  });
}
