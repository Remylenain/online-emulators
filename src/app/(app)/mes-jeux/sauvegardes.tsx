"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { formatDate, formatTaille } from "@/lib/format";
import { titreComplet } from "@/lib/jeu-resume";
import type { SauvegardeJeu } from "@/lib/mes-jeux";
import { restaurer } from "@/lib/sauvegardes/actions";

/**
 * Toutes les sauvegardes du compte, et pour chacune ses copies de secours.
 *
 * Composant client pour deux gestes : déplier les copies d'un jeu, et en
 * restaurer une. Le reste n'est qu'affichage.
 */
export function Sauvegardes({ sauvegardes }: { sauvegardes: SauvegardeJeu[] }) {
  const [deplie, setDeplie] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  if (sauvegardes.length === 0) {
    return (
      <p className="rounded-panel border border-dashed border-ink-800 px-4 py-8 text-center text-sm text-ink-400">
        Aucune sauvegarde pour l&apos;instant : elles apparaissent dès qu&apos;un jeu enregistre.
      </p>
    );
  }

  function restaurerCopie(copieId: string, titre: string, quand: string) {
    if (
      !window.confirm(
        `Remettre la copie du ${quand} à la place de ta sauvegarde de ${titre} ? ` +
          "La version actuelle sera gardée dans les copies.",
      )
    ) {
      return;
    }
    demarrer(async () => setRetour(await restaurer(copieId)));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-ink-400">
          {sauvegardes.length} jeu{sauvegardes.length > 1 ? "x" : ""} avec une sauvegarde. Les copies de
          secours gardent les cinq dernières écritures et une par jour pendant trente jours.
        </p>
        <a
          href="/api/sauvegardes/zip"
          className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-500"
        >
          Tout télécharger (zip)
        </a>
      </div>

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {sauvegardes.map((s) => {
          const titre = titreComplet(s.jeu);
          const ouvert = deplie === s.jeu.id;
          return (
            <li key={s.jeu.id} className="bg-ink-900/40">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <Link
                  href={`/jeux/${s.jeu.consoleSlug}/${s.jeu.slug}`}
                  className="min-w-0 flex-1 basis-48"
                >
                  <span className="block truncate text-sm font-medium text-ink-50 hover:underline">
                    {titre}
                  </span>
                  <span className="block text-xs text-ink-700">
                    <span className="uppercase">{s.jeu.consoleSlug}</span> · {formatTaille(s.taille)} ·
                    modifiée le {formatDate(s.modifiee)} · {s.etatsManuels} point
                    {s.etatsManuels > 1 ? "s" : ""} de reprise
                  </span>
                </Link>

                <div className="flex flex-wrap gap-1">
                  <a
                    href={`/api/save/${s.jeu.id}?fichier`}
                    className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50"
                  >
                    Télécharger
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeplie(ouvert ? null : s.jeu.id)}
                    disabled={s.copies.length === 0}
                    className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50 disabled:opacity-40"
                  >
                    {s.copies.length === 0
                      ? "Pas de copie"
                      : `${s.copies.length} copie${s.copies.length > 1 ? "s" : ""} de secours`}
                  </button>
                </div>
              </div>

              {ouvert && (
                <ul className="flex flex-col gap-1 border-t border-ink-800 bg-ink-950/40 px-4 py-3">
                  {s.copies.map((c) => {
                    const quand = formatDate(c.creeLe);
                    return (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="min-w-0 flex-1 text-ink-200">
                          {quand}
                          <span className="ml-2 text-ink-700">
                            rév. {c.revision} · {formatTaille(c.taille)}
                          </span>
                        </span>
                        <a
                          href={`/api/copies/${c.id}`}
                          className="text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
                        >
                          télécharger
                        </a>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => restaurerCopie(c.id, titre, quand)}
                          className="text-accent-400 underline-offset-4 hover:underline disabled:opacity-40"
                        >
                          restaurer
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
