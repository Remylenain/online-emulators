"use client";

import { useEffect, useState } from "react";
import { enregistrerTouches, retablirTouches } from "@/lib/keymap/actions";
import {
  DEFAULT_KEYMAP,
  keyLabel,
  toucheDeEvenement,
  type ButtonName,
} from "@/lib/consoles";

const LIBELLES: Record<ButtonName, string> = {
  A: "A",
  B: "B",
  START: "Start",
  SELECT: "Select",
  UP: "Haut",
  DOWN: "Bas",
  LEFT: "Gauche",
  RIGHT: "Droite",
  L: "L",
  R: "R",
};

/**
 * Configuration des touches, pour le clavier.
 *
 * L'attribution se fait en appuyant sur la touche voulue plutôt qu'en la
 * choisissant dans une liste : c'est le seul moyen fiable de désigner une
 * touche telle que le clavier du joueur la produit, quelle que soit sa
 * disposition. Voir `toucheDeEvenement`.
 */
export function Touches({
  consoleSlug,
  boutons,
  touches,
  surChangement,
}: {
  consoleSlug: string;
  boutons: ButtonName[];
  touches: Record<ButtonName, string>;
  surChangement: (touches: Record<ButtonName, string>) => void;
}) {
  const [enAttente, setEnAttente] = useState<ButtonName | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Pendant l'attente, le clavier entier est intercepté — y compris les
   * touches du jeu, qui sinon feraient agir le personnage pendant qu'on
   * reconfigure. Échap annule.
   */
  useEffect(() => {
    if (!enAttente) return;

    async function surFrappe(evenement: KeyboardEvent) {
      evenement.preventDefault();
      evenement.stopPropagation();

      if (evenement.key === "Escape") {
        setEnAttente(null);
        return;
      }

      const touche = toucheDeEvenement(evenement);
      const bouton = enAttente!;
      const suivantes = { ...touches, [bouton]: touche };

      // Une touche déjà prise par un autre bouton est libérée : l'alternative
      // serait de refuser, ce qui obligerait à défaire avant de refaire.
      for (const [autre, valeur] of Object.entries(suivantes)) {
        if (autre !== bouton && valeur === touche) {
          delete (suivantes as Record<string, string>)[autre];
        }
      }

      setEnAttente(null);
      setMessage(null);
      surChangement(suivantes as Record<ButtonName, string>);

      const resultat = await enregistrerTouches(consoleSlug, suivantes);
      if (!resultat.ok) setMessage(resultat.message ?? "Enregistrement refusé.");
    }

    window.addEventListener("keydown", surFrappe, { capture: true });
    return () => window.removeEventListener("keydown", surFrappe, { capture: true });
  }, [enAttente, touches, consoleSlug, surChangement]);

  async function retablir() {
    setMessage(null);
    surChangement({ ...DEFAULT_KEYMAP });
    const resultat = await retablirTouches(consoleSlug);
    if (!resultat.ok) setMessage(resultat.message ?? "Opération refusée.");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink-200">
        Touches
        <span className="ml-2 font-normal text-ink-700">
          Clique sur une touche, puis appuie sur celle que tu veux. Échap annule.
        </span>
      </h2>

      {message && (
        <p role="alert" className="text-xs text-red-300">
          {message}
        </p>
      )}

      <ul className="flex flex-wrap gap-2">
        {boutons.map((bouton) => {
          const attend = enAttente === bouton;
          const touche = touches[bouton];

          return (
            <li key={bouton}>
              <button
                type="button"
                onClick={() => setEnAttente(attend ? null : bouton)}
                className={`flex min-w-24 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors ${
                  attend
                    ? "border-accent-600 bg-accent-600/15"
                    : "border-ink-700 hover:border-ink-400"
                }`}
              >
                <span className="text-xs text-ink-400">{LIBELLES[bouton]}</span>
                <span
                  className={`font-mono text-sm ${attend ? "text-accent-400" : "text-ink-50"}`}
                >
                  {attend ? "…" : touche ? keyLabel(touche) : "aucune"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => void retablir()}
        className="self-start text-xs text-ink-700 underline-offset-4 hover:text-ink-200 hover:underline"
      >
        Rétablir les touches par défaut
      </button>
    </section>
  );
}
