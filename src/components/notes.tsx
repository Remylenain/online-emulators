"use client";

import { useState, useTransition } from "react";
import { formatNote } from "@/lib/format";
import { noter, retirerNote } from "@/lib/ratings/actions";
import { useLangue, useT } from "./langue";

/**
 * Les cinq étoiles d'un jeu.
 *
 * La moyenne reste affichée à côté de la note personnelle : savoir ce qu'en
 * pensent les autres est la moitié de l'intérêt, et c'est ce qui alimente le
 * tri « mieux notés » du catalogue.
 */
export function Notes({
  gameId,
  maNote,
  moyenne,
  nombre,
}: {
  gameId: string;
  maNote: number | null;
  moyenne: number;
  nombre: number;
}) {
  const [note, setNote] = useState(maNote);
  const [stats, setStats] = useState({ moyenne, nombre });
  const [survol, setSurvol] = useState<number | null>(null);
  const [enCours, demarrer] = useTransition();
  const langue = useLangue();
  const t = useT().catalogue.notes;

  function choisir(valeur: number) {
    demarrer(async () => {
      // Recliquer sa propre note la retire : c'est le geste attendu, et cela
      // évite un bouton « retirer » de plus.
      const resultat = valeur === note ? await retirerNote(gameId) : await noter(gameId, valeur);
      if (!resultat.ok) return;
      setNote(valeur === note ? null : valeur);
      setStats({ moyenne: resultat.moyenne ?? 0, nombre: resultat.nombre ?? 0 });
    });
  }

  const affichee = survol ?? note ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setSurvol(null)}
        role="group"
        aria-label={t.taNote}
      >
        {[1, 2, 3, 4, 5].map((valeur) => (
          <button
            key={valeur}
            type="button"
            disabled={enCours}
            onClick={() => choisir(valeur)}
            onMouseEnter={() => setSurvol(valeur)}
            aria-label={t.surCinq(valeur)}
            aria-pressed={note === valeur}
            className={`text-2xl leading-none transition-colors disabled:opacity-50 ${
              valeur <= affichee ? "text-accent-400" : "text-ink-700 hover:text-ink-400"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-400">
        {stats.nombre === 0
          ? t.personne
          : t.moyenne(formatNote(stats.moyenne, langue), stats.nombre)}
        {note !== null && <span className="ml-2 text-ink-700">{t.laTienne(note)}</span>}
      </p>
    </div>
  );
}
