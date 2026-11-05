import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cheminDisquePsx, listerDisquesPsx } from "@/lib/library/disques-psx";

/**
 * Les images de disque PlayStation posées sur le serveur, pour la page
 * d'essai de l'administration.
 *
 *   GET /api/admin/ps1/disques            la liste : [{ nom, taille }]
 *   GET /api/admin/ps1/disques?nom=…      une image, en flux
 *
 * Elles se rangent dans `LIBRARY_DIR/psx/` (voir `disques-psx.ts`). Ces
 * disques ne sont pas au catalogue : seul un administrateur peut les lister
 * ou les lire.
 *
 * Une image pèse plusieurs centaines de Mo : elle part en flux, sans passer
 * en entier par la mémoire du serveur, et les demandes par plage (`Range`)
 * sont honorées — de quoi reprendre un téléchargement, et plus tard ne lire
 * que les secteurs dont le jeu a besoin.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });
  if (viewer.role !== "ADMIN") return new NextResponse("Interdit", { status: 403 });

  const disques = await listerDisquesPsx();
  const nom = request.nextUrl.searchParams.get("nom");
  if (nom === null) return NextResponse.json(disques);

  // Le nom demandé doit être l'un de ceux qu'on vient de lister : il ne sert
  // jamais à construire un chemin tout seul.
  const disque = disques.find((candidat) => candidat.nom === nom);
  if (!disque) return new NextResponse("Introuvable", { status: 404 });
  const chemin = cheminDisquePsx(disque);

  const enTetes: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };

  let debut = 0;
  let fin = disque.taille - 1;
  let statut = 200;
  const plage = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (plage && (plage[1] || plage[2])) {
    if (plage[1]) {
      debut = Number(plage[1]);
      if (plage[2]) fin = Math.min(Number(plage[2]), fin);
    } else {
      // « bytes=-N » : les N derniers octets.
      debut = Math.max(0, disque.taille - Number(plage[2]));
    }
    if (debut > fin || debut >= disque.taille) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${disque.taille}` } });
    }
    statut = 206;
    enTetes["Content-Range"] = `bytes ${debut}-${fin}/${disque.taille}`;
  }
  enTetes["Content-Length"] = String(fin - debut + 1);

  const flux = Readable.toWeb(createReadStream(chemin, { start: debut, end: fin })) as ReadableStream<Uint8Array>;
  return new NextResponse(flux, { status: statut, headers: enTetes });
}
