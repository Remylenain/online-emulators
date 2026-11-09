import Link from "next/link";
import type { GameCard } from "@/lib/catalog";
import { formatNote } from "@/lib/format";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";

/** Grille de jaquettes. Utilisée par l'accueil et par les pages console. */
export async function GameGrid({
  games,
}: {
  games: GameCard[];
  /** Préfixe des liens, à la place de la fiche du jeu. Suivi de `/<slug>`. */
}) {
  const langue = await langueDeLaRequete();
  const t = (await textes()).catalogue.cartes;

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((game) => (
        <li key={game.id}>
          <Link
            href={`/jeux/${game.consoleSlug}/${game.slug}`}
            className="group flex flex-col gap-2 rounded-panel border border-ink-800 bg-ink-900/60 p-3 transition-colors hover:border-accent-600/60"
          >
            <span className="relative">
              <Cover game={game} absente={t.pasDeJaquette} />
              {game.enCours && (
                <span className="absolute left-1.5 top-1.5 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                  {t.enCours}
                </span>
              )}
              {game.favori && (
                <span
                  className="absolute right-1.5 top-1.5 rounded bg-ink-950/80 px-1.5 py-0.5 text-xs text-accent-400"
                  aria-label={t.dansTesFavoris}
                >
                  ★
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-sm font-medium text-ink-50">{game.title}</span>
            <span className="flex items-center justify-between text-xs text-ink-400">
              <span className="truncate">
                {game.parties ? t.partiesDUnEnsemble(game.parties) : (game.author ?? "—")}
              </span>
              {game.ratingCount > 0 && <span>{formatNote(game.ratingAvg, langue)} ★</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cadre carré et `object-contain` plutôt qu'un rapport imposé : une face de
 * boîte Game Boy est plus large que haute (1,115), une boîte Game Boy Advance
 * est plus haute que large. Un rapport fixe rognerait l'une ou l'autre, alors
 * qu'un cadre carré les accueille toutes sans rien couper et garde les
 * vignettes alignées.
 */
function Cover({ game, absente }: { game: GameCard; absente: string }) {
  if (!game.coverPath) {
    return (
      <span className="flex aspect-square items-center justify-center rounded-md border border-ink-800 bg-ink-950/60 text-xs text-ink-700">
        {absente}
      </span>
    );
  }

  return (
    // Servies par une route authentifiée, et déjà dimensionnées à l'import.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/cover/${game.id}`}
      alt=""
      loading="lazy"
      className="aspect-square w-full rounded-md border border-ink-800 bg-ink-950/60 object-contain"
    />
  );
}
