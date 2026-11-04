import Link from "next/link";
import { GameGrid } from "@/components/game-grid";
import { requireUser } from "@/lib/auth/guard";
import { countByConsole, latestGames, recentlyPlayed } from "@/lib/catalog";
import { LANGUE_PAR_DEFAUT } from "@/lib/catalog-options";
import { CONSOLES } from "@/lib/consoles";
import { jeuAccessible } from "@/lib/acces";
import type { SessionUser } from "@/lib/auth/session";
import { formatDate, formatDuree } from "@/lib/format";
import { salonDuCompte, salons, salonsRegardables } from "@/lib/link/registre";
import { partieEnCours, titreComplet, type PartieEnCours } from "@/lib/mes-jeux";

/**
 * L'accueil : d'abord la partie en cours, parce que c'est pour elle qu'on
 * revient ; puis les salons où un ami attend ; puis le catalogue.
 */
export default async function HomePage() {
  const user = await requireUser();
  const [enCours, latest, recent, parConsole] = await Promise.all([
    partieEnCours(user),
    latestGames(user, 8, LANGUE_PAR_DEFAUT),
    recentlyPlayed(user, 9),
    countByConsole(user, LANGUE_PAR_DEFAUT),
  ]);

  // Le jeu en tête n'a pas à réapparaître juste dessous.
  const recentsSansEnCours = recent.filter((jeu) => jeu.id !== enCours?.jeu.id).slice(0, 8);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold text-ink-50">Salut {user.pseudo}</h1>
        {enCours ? (
          <Reprendre partie={enCours} />
        ) : (
          <p className="rounded-panel border border-dashed border-ink-800 px-5 py-8 text-center text-sm text-ink-400">
            Tu n&apos;as pas encore lancé de partie. Choisis une console pour commencer.
          </p>
        )}
      </section>

      <Salons moi={user} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink-50">Consoles</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CONSOLES.map((console) => (
            <Link
              key={console.slug}
              href={`/consoles/${console.slug}`}
              className="flex items-baseline justify-between rounded-panel border border-ink-800 bg-ink-900/60 px-5 py-4 transition-colors hover:border-accent-600/60"
            >
              <span className="text-sm font-semibold text-ink-50">{console.name}</span>
              <span className="text-xs text-ink-400">
                {parConsole[console.slug] === 1 ? "1 jeu" : `${parConsole[console.slug] ?? 0} jeux`}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {recentsSansEnCours.length > 0 && (
        <Section title="Joués récemment" games={recentsSansEnCours} />
      )}

      <Section title="Nouveautés" empty="Rien de neuf en français pour le moment." games={latest} />
    </div>
  );
}

/**
 * Le dernier jeu ouvert, en grand : jaquette, temps passé, dernière partie,
 * date de la sauvegarde, et le bouton pour y retourner.
 */
function Reprendre({ partie }: { partie: PartieEnCours }) {
  const { jeu, stats } = partie;
  const console = CONSOLES.find((c) => c.slug === jeu.consoleSlug);

  return (
    <div className="flex flex-col gap-5 rounded-panel border border-ink-800 bg-ink-900/60 p-5 sm:flex-row sm:items-center">
      <Link href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`} className="shrink-0 self-center sm:self-auto">
        {jeu.coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/cover/${jeu.id}?t=lg`}
            alt={`Jaquette de ${jeu.title}`}
            className="w-40 rounded-md border border-ink-800 bg-ink-950/60 sm:w-48"
          />
        ) : (
          <span className="flex aspect-square w-40 items-center justify-center rounded-md border border-ink-800 bg-ink-950/60 text-xs text-ink-700 sm:w-48">
            pas de jaquette
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-accent-400 uppercase">Reprendre</span>
          <Link
            href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`}
            className="text-2xl font-semibold text-ink-50 hover:underline"
          >
            {titreComplet(jeu)}
          </Link>
          <span className="text-sm text-ink-400">{console?.name ?? jeu.consoleSlug}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Chiffre label="Temps de jeu" valeur={formatDuree(stats.secondes)} />
          <Chiffre
            label="Dernière partie"
            valeur={stats.derniere ? formatDate(stats.derniere, false) : "—"}
          />
          <Chiffre
            label="Sauvegarde"
            valeur={stats.sauvegarde ? formatDate(stats.sauvegarde) : "aucune encore"}
          />
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          {/* Un `<a>` et non un `<Link>` : le lecteur a besoin d'un document
              chargé avec ses en-têtes d'isolation (voir la fiche du jeu). */}
          <a
            href={`/jouer/${jeu.consoleSlug}/${jeu.slug}`}
            className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-6 py-2.5 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-500"
          >
            Jouer
          </a>
          <Link
            href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`}
            className="text-sm text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
          >
            Voir la fiche
          </Link>
        </div>
      </div>
    </div>
  );
}

function Chiffre({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-700">{label}</dt>
      <dd className="text-ink-200">{valeur}</dd>
    </div>
  );
}

/**
 * Les salons de câble link où quelqu'un attend, tous jeux confondus, et le
 * mien s'il y en a un. Les salons vivent en mémoire dans le serveur, pas en
 * base : l'accueil les lit directement dans le registre.
 */
async function Salons({ moi }: { moi: SessionUser }) {
  const mien = salonDuCompte(moi.id);
  const candidats = [...salons().values()]
    .filter((s) => s.etat === "attente" && !s.prive && s.id !== mien?.id)
    .sort((a, b) => b.creeLe - a.creeLe);
  // Un compte restreint ne voit que les salons des jeux qu'il peut lancer.
  const visibles = await Promise.all(candidats.map((s) => jeuAccessible(moi, s.jeu.id)));
  const ouverts = candidats.filter((_, i) => visibles[i]);
  // Et les parties en cours qu'on peut regarder.
  const candidatsRegardables = salonsRegardables().filter((s) => s.id !== mien?.id);
  const regardablesVisibles = await Promise.all(candidatsRegardables.map((s) => jeuAccessible(moi, s.jeu.id)));
  const regardables = candidatsRegardables.filter((_, i) => regardablesVisibles[i]);

  if (!mien && ouverts.length === 0 && regardables.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">Câble link</h2>
      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {mien && (
          <li className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-accent-600/10 px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink-200">
              Ton salon sur <strong className="text-ink-50">{mien.jeu.titre}</strong>
              {mien.etat === "attente" ? " attend un second joueur" : " est en cours"}
              {mien.prive && <span className="ml-2 text-xs text-ink-400">privé</span>}
            </span>
            <Link
              href={`/link/${mien.id}`}
              className="rounded-lg bg-accent-600 px-4 py-1.5 text-sm font-semibold text-ink-950 hover:bg-accent-500"
            >
              Reprendre
            </Link>
          </li>
        )}
        {ouverts.map((salon) => (
          <li key={salon.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-900/40 px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink-200">
              <strong className="text-ink-50">{salon.places[0].pseudo}</strong> attend sur{" "}
              <Link
                href={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`}
                className="text-ink-50 hover:underline"
              >
                {salon.jeu.titre}
              </Link>
              <span className="ml-2 text-xs text-ink-700">depuis {formatDate(new Date(salon.creeLe))}</span>
            </span>
            {!mien && (
              <Link
                href={`/link/${salon.id}`}
                className="rounded-lg border border-ink-700 px-4 py-1.5 text-sm text-ink-200 hover:border-ink-400 hover:text-ink-50"
              >
                Rejoindre
              </Link>
            )}
          </li>
        ))}
        {regardables.map((salon) => (
          <li key={salon.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-900/40 px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink-200">
              <strong className="text-ink-50">{salon.places[0].pseudo}</strong> et{" "}
              <strong className="text-ink-50">{salon.places[1]?.pseudo}</strong> jouent à{" "}
              <Link
                href={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`}
                className="text-ink-50 hover:underline"
              >
                {salon.jeu.titre}
              </Link>
              <span className="ml-2 text-xs text-ink-700">
                {salon.nombreSpectateurs} spectateur{salon.nombreSpectateurs > 1 ? "s" : ""}
              </span>
            </span>
            <Link
              href={`/link/${salon.id}`}
              className="rounded-lg border border-ink-700 px-4 py-1.5 text-sm text-ink-200 hover:border-ink-400 hover:text-ink-50"
            >
              Regarder
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Section({
  title,
  games,
  empty,
}: {
  title: string;
  games: Awaited<ReturnType<typeof latestGames>>;
  empty?: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">{title}</h2>
      {games.length === 0 ? (
        <p className="rounded-panel border border-dashed border-ink-800 px-5 py-8 text-center text-sm text-ink-400">
          {empty}
        </p>
      ) : (
        <GameGrid games={games} />
      )}
    </section>
  );
}
