import { textes } from "@/lib/i18n/serveur";
import type { ResultatTouches } from "./ecriture";

/**
 * Redit un refus dans la langue de la requête. `./ecriture.ts` ne connaît que
 * des comptes et des dispositions, pas des requêtes : il rend un code, et ce
 * sont ses deux appelants — les actions du site et la route de l'Activité
 * Discord — qui choisissent les mots.
 */
export async function dansLaLangue(resultat: ResultatTouches): Promise<ResultatTouches> {
  if (resultat.ok || !resultat.code) return resultat;
  return { ...resultat, message: (await textes()).commandes.refus[resultat.code] };
}
