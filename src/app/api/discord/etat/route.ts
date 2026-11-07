import { NextResponse } from "next/server";
import { contexteDeLActivite } from "@/lib/discord/contexte";
import { listerEtats } from "@/lib/states";

/**
 * Les points de reprise du compte Discord pour le jeu de l'Activité, sans
 * leur contenu. Les manuels seulement : l'Activité ne prend pas de reprises
 * automatiques (voir `src/components/discord/activite.tsx`).
 */
export async function GET(request: Request) {
  const c = await contexteDeLActivite(request);
  if ("refus" in c) return c.refus;

  const etats = (await listerEtats(c.visiteur.id, c.jeu.id)).filter((etat) => !etat.auto);
  return NextResponse.json({ etats }, { headers: { "Cache-Control": "no-store" } });
}
