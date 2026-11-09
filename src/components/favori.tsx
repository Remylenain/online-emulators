"use client";

import { useState, useTransition } from "react";
import { basculerFavori } from "@/lib/favoris/actions";
import { useT } from "./langue";

/** L'étoile d'un jeu : un clic l'ajoute aux favoris du compte, un second l'en retire. */
export function Favori({ gameId, initial }: { gameId: string; initial: boolean }) {
  const [favori, setFavori] = useState(initial);
  const [enCours, demarrer] = useTransition();
  const t = useT().catalogue.favori;

  return (
    <button
      type="button"
      aria-pressed={favori}
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          const resultat = await basculerFavori(gameId);
          if (resultat.ok) setFavori(resultat.favori);
        })
      }
      className={`inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors disabled:opacity-60 ${
        favori
          ? "border-accent-600 bg-accent-600/10 text-accent-400"
          : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
      }`}
    >
      <span aria-hidden>{favori ? "★" : "☆"}</span>
      {favori ? t.dansTesFavoris : t.ajouter}
    </button>
  );
}
