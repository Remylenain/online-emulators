import { NextResponse } from "next/server";
import { contexteDeLActivite } from "@/lib/discord/contexte";
import { marquerPartie } from "@/lib/play";

/**
 * Le battement de partie de l'Activité : le même compteur que `/api/play`,
 * avec le jeton de l'Activité à la place du cookie. Appelé au lancement puis
 * chaque minute tant que le jeu tourne, en solo — à deux, c'est le serveur du
 * câble link qui compte, pour les deux joueurs à la fois.
 *
 * C'est ce qui alimente « Temps de jeu » et « qui joue » dans l'administration :
 * sans lui, un joueur venu de Discord y restait « jamais joué ».
 */
export async function POST(request: Request) {
  const contexte = await contexteDeLActivite(request);
  if ("refus" in contexte) return contexte.refus;
  return NextResponse.json(await marquerPartie(contexte.visiteur.id, contexte.jeu.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
