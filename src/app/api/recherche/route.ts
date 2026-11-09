import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rechercherJeux } from "@/lib/catalog";
import { textes } from "@/lib/i18n/serveur";

/**
 * Recherche globale : les jeux du catalogue dont le titre, l'auteur ou le jeu
 * de base contiennent tous les mots saisis, toutes consoles confondues. Ne
 * rend que ce que le compte a le droit de voir.
 */
export async function GET(request: Request) {
  const t = await textes();
  const visiteur = await getCurrentUser();
  if (!visiteur) return NextResponse.json({ erreur: t.site.recherche.nonConnecte }, { status: 401 });

  const saisie = new URL(request.url).searchParams.get("q") ?? "";
  const jeux = await rechercherJeux(visiteur, saisie);
  return NextResponse.json(
    {
      jeux: jeux.map((jeu) => ({
        id: jeu.id,
        slug: jeu.slug,
        console: jeu.consoleSlug,
        titre: jeu.title,
        precision: jeu.parties
          ? t.catalogue.cartes.partiesDUnEnsemble(jeu.parties)
          : (jeu.baseGame ?? jeu.author ?? null),
        jaquette: Boolean(jeu.coverPath),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
