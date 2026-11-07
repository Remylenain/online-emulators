import { NextResponse } from "next/server";
import { jeuAccessible, type Visiteur } from "@/lib/acces";
import { configPourHote, hoteDeLaRequete } from "./applications";
import { compteDepuisRequete } from "./compte";
import { jeuDeLActivite, type JeuDiscord } from "./jeu";

/**
 * Ce que toute route de l'Activité commence par établir : qui demande (le
 * jeton), quelle Activité répond (l'hôte), et que ce compte a bien accès à
 * son jeu. Un refus est déjà une réponse.
 */
export async function contexteDeLActivite(
  request: Request,
): Promise<{ visiteur: Visiteur; jeu: JeuDiscord } | { refus: NextResponse }> {
  const visiteur = compteDepuisRequete(request);
  if (!visiteur) return { refus: new NextResponse("Non autorisé", { status: 401 }) };
  const application = configPourHote(hoteDeLaRequete(request.headers));
  const jeu = application ? await jeuDeLActivite(application.gameId) : null;
  if (!jeu || !(await jeuAccessible(visiteur, jeu.id))) {
    return { refus: new NextResponse("Introuvable", { status: 404 }) };
  }
  return { visiteur, jeu };
}
