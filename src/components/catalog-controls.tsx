"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  nomDeLangue,
  SORTS,
  TOUTES_LANGUES,
  VIEWS,
  type SortKey,
  type ViewMode,
} from "@/lib/catalog-options";

/**
 * Recherche, tri et bascule grille/liste.
 *
 * Tout passe par l'URL plutôt que par un état interne : une recherche se
 * partage, se met en favori, survit à un rechargement, et le rendu reste côté
 * serveur — la page n'a pas à charger le catalogue entier pour le filtrer.
 */
export function CatalogControls({
  search,
  sort,
  view,
  langue,
  langues,
  filtrable,
  defaut,
  total,
}: {
  search: string;
  sort: SortKey;
  view: ViewMode;
  langue: string;
  /** Langues réellement présentes sur cette console. */
  langues: string[];
  /** Y a-t-il quelque chose à révéler en changeant de filtre ? */
  filtrable: boolean;
  /** Langue retenue quand l'adresse n'en précise aucune. */
  defaut: string;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [saisie, setSaisie] = useState(search);
  // La valeur de l'URL fait foi quand elle change sous nos pieds : retour
  // arrière du navigateur, ou lien partagé ouvert dans l'onglet courant.
  useEffect(() => setSaisie(search), [search]);

  const premierRendu = useRef(true);

  function naviguer(modifications: Record<string, string>) {
    const suivants = new URLSearchParams(params.toString());
    for (const [cle, valeur] of Object.entries(modifications)) {
      if (valeur) suivants.set(cle, valeur);
      else suivants.delete(cle);
    }
    const requete = suivants.toString();
    router.replace(requete ? `${pathname}?${requete}` : pathname, { scroll: false });
  }

  // Frappe au clavier : on attend une pause avant de relancer la requête,
  // sinon chaque lettre déclencherait un aller-retour serveur.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    if (saisie === search) return;

    const minuterie = setTimeout(() => naviguer({ q: saisie.trim() }), 250);
    return () => clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <label htmlFor="recherche" className="sr-only">
          Rechercher un jeu
        </label>
        <input
          id="recherche"
          type="search"
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-700 focus:border-accent-500 focus:ring-2 focus:ring-accent-600/30 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        {/*
          Le sélecteur n'apparaît que s'il y a quelque chose à révéler : soit
          plusieurs langues, soit des jeux masqués par le filtre — dont ceux
          qui ne déclarent aucune langue. Sans cette seconde condition, ces
          jeux-là disparaissaient sans aucun moyen de les faire revenir.
        */}
        {filtrable && (
          <>
            <label htmlFor="langue" className="sr-only">
              Langue
            </label>
            <select
              id="langue"
              value={langue}
              onChange={(evenement) =>
                naviguer({
                  langue:
                    evenement.target.value === defaut ? "" : evenement.target.value,
                })
              }
              className="rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-200 focus:border-accent-500 focus:outline-none"
            >
              {langues.map((code) => (
                <option key={code} value={code}>
                  {nomDeLangue(code)}
                </option>
              ))}
              <option value={TOUTES_LANGUES}>Toutes les langues</option>
            </select>
          </>
        )}

        <label htmlFor="tri" className="sr-only">
          Trier par
        </label>
        <select
          id="tri"
          value={sort}
          onChange={(evenement) => naviguer({ tri: evenement.target.value })}
          className="rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-200 focus:border-accent-500 focus:outline-none"
        >
          {Object.entries(SORTS).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-ink-700 p-0.5" role="group" aria-label="Affichage">
          {VIEWS.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => naviguer({ vue: mode === "grille" ? "" : mode })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === mode
                  ? "bg-ink-800 text-ink-50"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <p className="w-full text-xs text-ink-400 sm:ml-auto sm:w-auto" aria-live="polite">
        {total === 0 ? "aucun jeu" : total === 1 ? "1 jeu" : `${total} jeux`}
      </p>
    </div>
  );
}
