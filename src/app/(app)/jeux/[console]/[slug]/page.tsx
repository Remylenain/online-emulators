import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ratings, type GameRow } from "@/db/schema";
import { SalonsJeu } from "@/components/link/salons-jeu";
import { Notes } from "@/components/notes";
import { nomDeLangue } from "@/lib/catalog-options";
import { requireUser } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { gameBySlug, partiesDuGroupe } from "@/lib/catalog";
import { findConsole, type ConsoleDefinition } from "@/lib/consoles";
import { formatDate, formatDuree } from "@/lib/format";
import { statsJeu, type StatsJeu } from "@/lib/mes-jeux";

type Params = { console: string; slug: string };

/** Consoles pour lesquelles le serveur sait faire tourner deux consoles reliées. */
const CONSOLES_LINK = new Set(["gb", "gbc", "gba"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { console: consoleSlug, slug } = await params;
  const user = await getCurrentUser();
  if (!user) return {};
  const game = await gameBySlug(user, consoleSlug, slug);
  if (game) return { title: game.title };

  // Le slug peut désigner un ensemble plutôt qu'un jeu : son titre vaut celui
  // de la page, sans quoi l'onglet n'afficherait que le nom du site.
  const parties = await partiesDuGroupe(user, consoleSlug, slug);
  const titre = parties[0]?.groupTitle;
  return { title: titre ? titre : undefined };
}

export default async function GamePage({ params }: { params: Promise<Params> }) {
  const user = await requireUser();

  const { console: consoleSlug, slug } = await params;
  const console = findConsole(consoleSlug);
  if (!console) notFound();

  const game = await gameBySlug(user, consoleSlug, slug);

  /**
   * Le slug peut désigner un jeu, ou un ensemble de parties.
   *
   * Les deux vivent dans le même espace d'adresses : c'est ce qui permet à la
   * carte d'un ensemble de pointer vers une fiche comme n'importe quelle autre.
   * Un jeu l'emporte s'il existe sous ce nom.
   */
  if (!game) {
    const parties = await partiesDuGroupe(user, consoleSlug, slug);
    if (parties.length === 0) notFound();
    return <FicheGroupe console={console} parties={parties} />;
  }

  const taille = `${(game.romSize / 1048576).toFixed(game.romSize > 10485760 ? 0 : 1)} Mio`;

  const [maNote, stats] = await Promise.all([
    db
      .select({ score: ratings.score })
      .from(ratings)
      .where(and(eq(ratings.userId, user.id), eq(ratings.gameId, game.id)))
      .get(),
    statsJeu(user.id, game.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm text-ink-400">
        <Link href={`/consoles/${console.slug}`} className="hover:text-ink-200">
          ← {console.name}
        </Link>
      </nav>

      {/*
        Deux colonnes sur grand écran : à gauche ce qui décrit l'objet —
        jaquette, étiquette, fiche technique — à droite ce qu'on en fait :
        jouer, lire, relier, noter. Sur téléphone, dans l'ordre de lecture :
        la jaquette, puis le titre et le bouton, et la fiche technique en bas.
      */}
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-4 self-center md:self-auto">
          <Jaquette id={game.id} hasCover={Boolean(game.coverPath)} title={game.title} />
          {game.labelPath && (
            // L'étiquette de cartouche : c'est ce qu'on voit quand on tient le
            // jeu en main, et elle distingue une version d'une autre.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/cover/${game.id}?t=etiquette`}
              alt={`Étiquette de cartouche de ${game.title}`}
              className="w-32 self-center rounded border border-ink-800 md:w-40"
            />
          )}
        </div>

        <aside className="order-last flex flex-col gap-5 md:order-none md:col-start-1 md:row-start-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <Detail label="Console" valeur={console.name} />
            <Detail label="Version" valeur={game.version} />
            <Detail label="Langue" valeur={game.language ? nomDeLangue(game.language) : null} />
            <Detail label="Jeu de base" valeur={game.baseGame} />
            <Detail label="Année" valeur={game.year?.toString()} />
            <Detail label="Taille" valeur={taille} />
            <Detail
              label="Parties sur le site"
              valeur={game.playCount === 0 ? "jamais lancé" : String(game.playCount)}
            />
            <Detail
              label="Note des joueurs"
              valeur={game.ratingCount > 0 ? `${game.ratingAvg.toFixed(1)} ★ (${game.ratingCount})` : "aucune"}
            />
          </dl>

          {/*
            L'empreinte permet de vérifier qu'on joue bien à la même version
            qu'un autre joueur — ce qui compte quand deux parties se relient par
            câble link. Repliée : elle ne sert qu'à qui sait quoi en faire.
          */}
          <details className="text-xs text-ink-700">
            <summary className="cursor-pointer select-none hover:text-ink-400">Détails techniques</summary>
            <dl className="mt-2 flex flex-col gap-1">
              <div>
                <dt className="inline">SHA-1 </dt>
                <dd className="inline font-mono break-all">{game.romSha1}</dd>
              </div>
              <div>
                <dt className="inline">Identifiant </dt>
                <dd className="inline font-mono">{game.id}</dd>
              </div>
            </dl>
          </details>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 md:col-start-2 md:row-span-2 md:row-start-1">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-ink-50">{game.title}</h1>
            {game.author && <p className="text-sm text-ink-400">par {game.author}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/*
              Un `<a>` et non un `<Link>`, volontairement.

              Next navigue côté client : avec un `<Link>`, l'URL devient bien
              celle du lecteur mais le **document reste le précédent** — celui
              de cette fiche, servi sans les en-têtes d'isolation cross-origin.
              Or `crossOriginIsolated` est une propriété du document, fixée à
              son chargement : le cœur d'émulation refuserait alors de démarrer,
              alors que les en-têtes sont bien posés sur `/jouer`.

              Une vraie navigation recharge le document avec ses en-têtes.
            */}
            <a
              href={`/jouer/${console.slug}/${game.slug}`}
              className="inline-flex w-fit items-center justify-center rounded-lg bg-accent-600 px-6 py-3 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-500"
            >
              {stats.sauvegarde ? "Reprendre" : "Jouer"}
            </a>
            {stats.parties > 0 && (
              <span className="text-sm text-ink-400">
                {formatDuree(stats.secondes)} de jeu
                {stats.derniere && ` · dernière partie le ${formatDate(stats.derniere, false)}`}
              </span>
            )}
          </div>

          {game.description && (
            <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-ink-200">
              {game.description}
            </p>
          )}

          <TaPartie stats={stats} />

          {/* Le câble link, pour les consoles dont le serveur sait relier deux consoles. */}
          {CONSOLES_LINK.has(console.slug) && <SalonsJeu jeuId={game.id} consoleSlug={console.slug} />}

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink-200">Ton avis</h2>
            <Notes
              gameId={game.id}
              maNote={maNote?.score ?? null}
              moyenne={game.ratingAvg}
              nombre={game.ratingCount}
            />
          </div>
        </div>
      </div>

      {game.hasBackCover && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink-200">Dos de la boîte</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/cover/${game.id}?t=dos`}
            alt={`Dos de la boîte de ${game.title}`}
            loading="lazy"
            className="w-full max-w-2xl rounded-panel border border-ink-800"
          />
        </section>
      )}
    </div>
  );
}

/**
 * Ce que le compte a fait sur ce jeu : sa sauvegarde, ses copies, son temps.
 * Le détail et la restauration sont sur « Mes jeux » ; ici, l'essentiel.
 */
function TaPartie({ stats }: { stats: StatsJeu }) {
  if (stats.parties === 0 && !stats.sauvegarde) return null;

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-ink-800 bg-ink-900/40 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-ink-200">Ta partie</h2>
        <Link
          href="/mes-jeux?onglet=sauvegardes"
          className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
        >
          Toutes mes sauvegardes
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Detail label="Temps de jeu" valeur={formatDuree(stats.secondes)} />
        <Detail label="Parties" valeur={String(stats.parties)} />
        <Detail
          label="Sauvegarde"
          valeur={stats.sauvegarde ? formatDate(stats.sauvegarde) : "aucune encore"}
        />
        <Detail
          label="Copies de secours"
          valeur={stats.copies === 0 ? "aucune" : String(stats.copies)}
        />
      </dl>
    </section>
  );
}

function Detail({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-700">{label}</dt>
      <dd className="text-ink-200">{valeur}</dd>
    </div>
  );
}

function Jaquette({ id, hasCover, title }: { id: string; hasCover: boolean; title: string }) {
  const classes = "w-56 shrink-0 rounded-panel border border-ink-800 md:w-72";

  if (!hasCover) {
    return (
      <div
        className={`${classes} flex aspect-square items-center justify-center bg-ink-950/60 p-4 text-center text-xs text-ink-700`}
      >
        pas de jaquette
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/cover/${id}?t=lg`} alt={`Jaquette de ${title}`} className={classes} />
  );
}

/**
 * Fiche d'un ensemble : une présentation commune, puis la liste des parties.
 *
 * Chaque partie garde son propre bouton de lecture et sa propre sauvegarde —
 * ce sont bien des jeux distincts, simplement présentés ensemble.
 */
function FicheGroupe({
  console: consoleInfo,
  parties,
}: {
  console: ConsoleDefinition;
  parties: GameRow[];
}) {
  const premiere = parties[0]!;
  const avecJaquette = parties.find((partie) => partie.coverPath);
  const total = parties.reduce((somme, partie) => somme + partie.romSize, 0);

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm text-ink-400">
        <Link href={`/consoles/${consoleInfo.slug}`} className="hover:text-ink-200">
          ← {consoleInfo.name}
        </Link>
      </nav>

      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <Jaquette
          id={avecJaquette?.id ?? premiere.id}
          hasCover={Boolean(avecJaquette)}
          title={premiere.groupTitle ?? premiere.title}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <h1 className="text-3xl font-semibold text-ink-50">
            {premiere.groupTitle ?? premiere.title}
          </h1>
          <p className="text-sm text-ink-400">
            {parties.length} parties · {consoleInfo.name} ·{" "}
            {(total / 1048576).toFixed(0)} Mio en tout
          </p>
          {premiere.description && (
            <p className="max-w-prose text-sm leading-relaxed text-ink-200">
              {premiere.description}
            </p>
          )}
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {parties.map((partie) => (
          <li
            key={partie.id}
            className="flex items-center gap-4 bg-ink-900/40 px-4 py-3"
          >
            <span className="w-10 shrink-0 text-center text-lg font-semibold text-ink-700">
              {partie.partNumber ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <Link
                href={`/jeux/${consoleInfo.slug}/${partie.slug}`}
                className="block truncate text-sm font-medium text-ink-50 hover:underline"
              >
                {partie.title}
              </Link>
              <span className="text-xs text-ink-700">
                {(partie.romSize / 1048576).toFixed(0)} Mio
              </span>
            </span>
            {/*
              Vraie navigation vers le lecteur : une navigation côté client
              garderait le document sans ses en-têtes d'isolation, et le cœur
              refuserait de démarrer.
            */}
            <a
              href={`/jouer/${consoleInfo.slug}/${partie.slug}`}
              className="shrink-0 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-500"
            >
              Jouer
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
