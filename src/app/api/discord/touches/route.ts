import { NextResponse } from "next/server";
import { compteDepuisRequete } from "@/lib/discord/compte";
import {
  enregistrerManetteDe,
  enregistrerTouchesDe,
  retablirManetteDe,
  retablirTouchesDe,
} from "@/lib/keymap/ecriture";
import { textes } from "@/lib/i18n/serveur";
import { dansLaLangue } from "@/lib/keymap/langue";
import { dispositionsDuCompte } from "@/lib/keymap/lecture";

/**
 * Touches et manette du compte Discord : les mêmes réglages que sur le site,
 * la même ligne `keymaps`, mais par le jeton de l'Activité au lieu du cookie.
 *
 * GET : les dispositions du compte. PUT : une des quatre écritures, nommée
 * dans le corps, avec les mêmes contrôles que les actions du site.
 */
export async function GET(request: Request) {
  const visiteur = compteDepuisRequete(request);
  if (!visiteur) return new NextResponse("Non autorisé", { status: 401 });
  return NextResponse.json(dispositionsDuCompte(visiteur.id), { headers: { "Cache-Control": "no-store" } });
}

type Demande =
  | { action: "touches"; console: string; mapping: Record<string, string> }
  | { action: "retablirTouches"; console: string }
  | { action: "manette"; console: string; mapping: Record<string, string>; cle?: string }
  | { action: "retablirManette"; console: string; cle?: string };

export async function PUT(request: Request) {
  const visiteur = compteDepuisRequete(request);
  if (!visiteur) return new NextResponse("Non autorisé", { status: 401 });

  let demande: Demande;
  try {
    demande = (await request.json()) as Demande;
  } catch {
    return NextResponse.json({ ok: false, message: (await textes()).activite.serveur.requeteIllisible }, { status: 400 });
  }
  if (!demande || typeof demande !== "object" || typeof demande.console !== "string") {
    return NextResponse.json({ ok: false, message: (await textes()).activite.serveur.requeteIllisible }, { status: 400 });
  }
  const mapping = "mapping" in demande && demande.mapping && typeof demande.mapping === "object" ? demande.mapping : {};
  const cle = "cle" in demande && typeof demande.cle === "string" ? demande.cle : undefined;

  switch (demande.action) {
    case "touches":
      return NextResponse.json(await dansLaLangue(enregistrerTouchesDe(visiteur.id, demande.console, mapping)));
    case "retablirTouches":
      return NextResponse.json(await dansLaLangue(retablirTouchesDe(visiteur.id, demande.console)));
    case "manette":
      return NextResponse.json(await dansLaLangue(enregistrerManetteDe(visiteur.id, demande.console, mapping, cle)));
    case "retablirManette":
      return NextResponse.json(await dansLaLangue(retablirManetteDe(visiteur.id, demande.console, cle)));
    default:
      return NextResponse.json({ ok: false, message: (await textes()).activite.serveur.actionInconnue }, { status: 400 });
  }
}
