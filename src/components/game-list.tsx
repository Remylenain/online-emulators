import Link from "next/link";
import type { GameCard } from "@/lib/catalog";

/**
 * Vue en liste : plus dense que la grille, et elle montre des informations
 * qu'une jaquette ne porte pas — version, jeu de base, nombre de parties.
 * Utile quand on cherche un jeu précis plutôt qu'on ne parcourt le catalogue.
 */
export function GameList({
  games,
}: {
  games: GameCard[];
  /** Préfixe des liens, à la place de la fiche du jeu. Suivi de `/<slug>`. */
}) {
  return (
    <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
      {games.map((game) => (
        <li key={game.id}>
          <Link
            href={`/jeux/${game.consoleSlug}/${game.slug}`}
            className="flex items-center gap-4 bg-ink-900/40 px-4 py-3 transition-colors hover:bg-ink-800/60"
          >
            <Vignette game={game} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-50">
                {game.title}
                {game.version && (
                  <span className="ml-2 text-xs font-normal text-ink-400">{game.version}</span>
                )}
                {game.favori && (
                  <span className="ml-2 text-xs text-accent-400" aria-label="Dans tes favoris">
                    ★
                  </span>
                )}
                {game.enCours && (
                  <span className="ml-2 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                    en cours
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-ink-400">
                {[game.author, game.baseGame].filter(Boolean).join(" · ") || "—"}
              </span>
            </span>

            <span className="hidden shrink-0 text-xs text-ink-400 sm:block">
              {game.ratingCount > 0 ? `${game.ratingAvg.toFixed(1)} ★` : "pas de note"}
            </span>

            <span className="shrink-0 text-xs text-ink-700">
              {game.playCount === 0
                ? "jamais lancé"
                : game.playCount === 1
                  ? "1 partie"
                  : `${game.playCount} parties`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Vignette({ game }: { game: GameCard }) {
  if (!game.coverPath) {
    return <span className="size-12 shrink-0 rounded border border-ink-800 bg-ink-950/60" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/cover/${game.id}`}
      alt=""
      loading="lazy"
      className="size-12 shrink-0 rounded border border-ink-800 bg-ink-950/60 object-contain"
    />
  );
}
