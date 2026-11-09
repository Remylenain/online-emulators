import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogControls } from "@/components/catalog-controls";
import { GameGrid } from "@/components/game-grid";
import { GameList } from "@/components/game-list";
import { requireUser } from "@/lib/auth/guard";
import { languesDisponibles, listConsoleGames, typesMelanges } from "@/lib/catalog";
import {
  isSortKey,
  isTypeKey,
  TYPE_PAR_DEFAUT,
  TRI_PAR_DEFAUT,
  isViewMode,
  nomDeLangue,
  TOUTES_LANGUES,
  type ViewMode,
} from "@/lib/catalog-options";
import { CONSOLES, findConsole } from "@/lib/consoles";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";

type Params = { slug: string };
type Query = { q?: string; tri?: string; vue?: string; langue?: string; type?: string };

/** Les trois consoles sont connues d'avance : autant préparer leurs routes. */
export function generateStaticParams(): Params[] {
  return CONSOLES.map((console) => ({ slug: console.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const nom = findConsole(slug)?.name;
  return { title: nom ? nom : undefined };
}

export default async function ConsolePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const user = await requireUser();
  const langueInterface = await langueDeLaRequete();
  const t = (await textes()).catalogue.console;

  const { slug } = await params;
  const console = findConsole(slug);
  if (!console) notFound();

  const query = await searchParams;
  const search = query.q?.trim() ?? "";
  const sort = isSortKey(query.tri) ? query.tri : TRI_PAR_DEFAUT;
  const view: ViewMode = isViewMode(query.vue) ? query.vue : "grille";

  // Rom hacks par défaut, mais seulement si la console mélange les deux
  // types : une console qui n'a que des jeux officiels les montre.
  const melange = await typesMelanges(user, console.slug);
  const type = !melange ? "tous" : isTypeKey(query.type) ? query.type : TYPE_PAR_DEFAUT;
  const langues = await languesDisponibles(user, console.slug, type);

  /**
   * Les jeux dans la langue du visiteur s'affichent par défaut, mais
   * seulement s'il y en a sur cette console : sinon le catalogue s'ouvrirait
   * vide, ce qui ressemble à une panne plus qu'à un filtre.
   */
  const defaut = langues.includes(langueInterface) ? langueInterface : TOUTES_LANGUES;
  const langue = query.langue ?? defaut;

  const { jeux, total } = await listConsoleGames({
    visiteur: user,
    consoleSlug: console.slug,
    search,
    sort,
    langue,
    type,
  });

  const masques = total - jeux.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink-50">{console.name}</h1>
        <p className="text-sm text-ink-400">
          {t.ecran(console.screenWidth, console.screenHeight, console.hasShoulderButtons)}
        </p>
      </div>

      <CatalogControls
        search={search}
        sort={sort}
        view={view}
        langue={langue}
        langues={langues}
        type={melange ? type : null}
        filtrable={langues.length > 1 || masques > 0 || langue !== defaut}
        defaut={defaut}
        total={jeux.length}
      />

      {jeux.length === 0 ? (
        <p className="rounded-panel border border-dashed border-ink-800 px-5 py-12 text-center text-sm text-ink-400">
          {search
            ? t.rienNeCorrespond(search)
            : langue !== TOUTES_LANGUES
              ? t.aucunDansLaLangue(nomDeLangue(langue, langueInterface))
              : t.aucunJeu}
        </p>
      ) : view === "liste" ? (
        <GameList games={jeux} />
      ) : (
        <GameGrid games={jeux} />
      )}

      {/*
        Dire ce que le filtre cache. Un catalogue qui rétrécit sans explication
        donne l'impression que des jeux ont disparu.
      */}
      {masques > 0 && (
        <p className="text-center text-xs text-ink-700">{t.autresMasques(masques)}</p>
      )}
    </div>
  );
}
