import { NextResponse } from "next/server";
import { jeuAccessible } from "@/lib/acces";
import { compteDepuisRequete } from "@/lib/discord/compte";
import { jeuConfigure } from "@/lib/discord/jeu";
import { ecrireSauvegarde, lireSauvegarde } from "@/lib/saves";

/**
 * La sauvegarde du compte pour le jeu de l'Activité.
 *
 * Même contrat que `/api/save/[gameId]` — `X-Revision` à la lecture, renvoyée
 * à l'écriture, refus plutôt qu'écrasement en cas de conflit —, et même
 * stockage : une partie commencée dans Discord est la sauvegarde du compte,
 * celle que le lecteur du site ouvrirait.
 */
const TAILLE_MAX = 1_048_576;

async function contexte(request: Request) {
  const visiteur = compteDepuisRequete(request);
  if (!visiteur) return { refus: new NextResponse("Non autorisé", { status: 401 }) };
  const jeu = await jeuConfigure();
  if (!jeu || !(await jeuAccessible(visiteur, jeu.id))) {
    return { refus: new NextResponse("Introuvable", { status: 404 }) };
  }
  return { visiteur, jeu };
}

export async function GET(request: Request) {
  const c = await contexte(request);
  if ("refus" in c) return c.refus;

  const sauvegarde = await lireSauvegarde(c.visiteur.id, c.jeu.id);
  // 204 : pas encore de partie, le cas normal d'un premier lancement.
  if (!sauvegarde) return new NextResponse(null, { status: 204 });

  return new NextResponse(new Uint8Array(sauvegarde.donnees), {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Revision": String(sauvegarde.revision),
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request) {
  const c = await contexte(request);
  if ("refus" in c) return c.refus;

  const corps = await request.arrayBuffer();
  if (corps.byteLength === 0) return NextResponse.json({ erreur: "Sauvegarde vide." }, { status: 400 });
  if (corps.byteLength > TAILLE_MAX) {
    return NextResponse.json({ erreur: "Sauvegarde trop volumineuse." }, { status: 413 });
  }

  const entete = request.headers.get("X-Revision");
  const revisionAttendue = entete === null || entete === "" ? null : Number(entete);
  if (revisionAttendue !== null && !Number.isInteger(revisionAttendue)) {
    return NextResponse.json({ erreur: "Révision invalide." }, { status: 400 });
  }

  const resultat = await ecrireSauvegarde(c.visiteur.id, c.jeu.id, new Uint8Array(corps), revisionAttendue);
  if (resultat.etat === "conflit") {
    return NextResponse.json(
      {
        erreur:
          "Cette partie a été sauvegardée ailleurs depuis que tu as commencé. " +
          "Ta sauvegarde n'a pas été écrasée.",
        revision: resultat.revision,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ etat: resultat.etat, revision: resultat.revision });
}
