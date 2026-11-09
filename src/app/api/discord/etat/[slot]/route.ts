import { NextResponse } from "next/server";
import { contexteDeLActivite } from "@/lib/discord/contexte";
import { textes } from "@/lib/i18n/serveur";
import { ecrireEtat, ecrireVignette, emplacementValide, lireEtat, lireVignette, supprimerEtat } from "@/lib/states";

/**
 * Un point de reprise de l'Activité, désigné par son emplacement (1 à 5).
 *
 * Même stockage que `/api/state/[gameId]/[slot]` : une reprise posée dans
 * Discord est celle du compte, que le lecteur du site montrerait. Manuels
 * seulement — pas de segment `a3` ici, l'Activité ne tourne pas de reprises
 * automatiques.
 *
 * Le cœur de l'Activité rend un état brut, sans image : la page joint donc
 * elle-même une capture de l'écran, par la même adresse avec `?vignette=1`
 * (PUT après l'état, GET pour l'afficher). Le jeton va dans l'en-tête ; pour
 * la vignette, qu'une balise `<img>` charge sans en-tête, il peut aller dans
 * l'adresse (`?jeton=`).
 */
const TAILLE_MAX = 8_388_608;
/** Une capture d'écran de console en PNG pèse quelques Kio ; bien au-delà, ce n'en est pas une. */
const TAILLE_MAX_VIGNETTE = 262_144;
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function veutLaVignette(request: Request): boolean {
  return new URL(request.url).searchParams.get("vignette") === "1";
}

type Contexte = { params: Promise<{ slot: string }> };

async function emplacementDe(context: Contexte): Promise<number | null> {
  const { slot } = await context.params;
  const emplacement = Number(slot);
  return emplacementValide(emplacement) ? emplacement : null;
}

export async function GET(request: Request, context: Contexte) {
  const c = await contexteDeLActivite(request);
  if ("refus" in c) return c.refus;
  const emplacement = await emplacementDe(context);
  if (emplacement === null) return new NextResponse("Emplacement invalide", { status: 400 });

  const vignette = veutLaVignette(request);
  const donnees = vignette
    ? await lireVignette(c.visiteur.id, c.jeu.id, emplacement, false)
    : await lireEtat(c.visiteur.id, c.jeu.id, emplacement, false);
  if (!donnees) return new NextResponse("Introuvable", { status: 404 });

  return new NextResponse(new Uint8Array(donnees), {
    headers: {
      "Content-Type": vignette ? "image/png" : "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request, context: Contexte) {
  const c = await contexteDeLActivite(request);
  if ("refus" in c) return c.refus;
  const emplacement = await emplacementDe(context);
  if (emplacement === null) return NextResponse.json({ erreur: (await textes()).activite.serveur.emplacementInvalide }, { status: 400 });

  const corps = new Uint8Array(await request.arrayBuffer());
  if (corps.byteLength === 0) return NextResponse.json({ erreur: (await textes()).activite.serveur.etatVide }, { status: 400 });

  if (veutLaVignette(request)) {
    if (corps.byteLength > TAILLE_MAX_VIGNETTE || !SIGNATURE_PNG.every((octet, i) => corps[i] === octet)) {
      return NextResponse.json({ erreur: (await textes()).activite.serveur.pasUneVignette }, { status: 400 });
    }
    const jointe = await ecrireVignette(c.visiteur.id, c.jeu.id, emplacement, false, corps);
    return jointe
      ? NextResponse.json({ vignette: true })
      : NextResponse.json({ erreur: (await textes()).activite.serveur.pasDEtat }, { status: 404 });
  }

  if (corps.byteLength > TAILLE_MAX) return NextResponse.json({ erreur: (await textes()).activite.serveur.etatTropGros }, { status: 413 });
  return NextResponse.json(await ecrireEtat(c.visiteur.id, c.jeu.id, emplacement, false, corps));
}

export async function DELETE(request: Request, context: Contexte) {
  const c = await contexteDeLActivite(request);
  if ("refus" in c) return c.refus;
  const emplacement = await emplacementDe(context);
  if (emplacement === null) return NextResponse.json({ erreur: (await textes()).activite.serveur.emplacementInvalide }, { status: 400 });

  return NextResponse.json({ supprime: await supprimerEtat(c.visiteur.id, c.jeu.id, emplacement, false) });
}
