"use client";

import { useEffect, useState } from "react";
import { enregistrerTouches, retablirTouches } from "@/lib/keymap/actions";
import { boutonsSansEntree, enumerer } from "@/lib/keymap/disposition";
import {
  ACTIONS,
  DEFAULT_KEYMAP,
  keyLabel,
  toucheDeEvenement,
  type ButtonName,
  type Touche,
} from "@/lib/consoles";

const LIBELLES: Record<Touche, string> = {
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
  FAST: "Accélérer (maintenir)",
};

/**
 * Configuration des touches, pour le clavier.
 *
 * L'attribution se fait en appuyant sur la touche voulue plutôt qu'en la
 * choisissant dans une liste : c'est le seul moyen fiable de désigner une
 * touche telle que le clavier du joueur la produit, quelle que soit sa
 * disposition. Voir `toucheDeEvenement`.
 *
 * Chaque changement part aussitôt sur le compte : les touches valent pour
 * toutes les consoles, sur tous les appareils. Une touche déjà prise par un
 * autre bouton lui est retirée ; ce bouton reste alors sans touche, et une
 * alerte le dit tant qu'on ne lui en a pas redonné une.
 */
export function Touches({
  consoleSlug,
  boutons,
  touches,
  surChangement,
}: {
  consoleSlug: string;
  boutons: ButtonName[];
  touches: Record<Touche, string>;
  surChangement: (touches: Record<Touche, string>) => void;
}) {
  const [enAttente, setEnAttente] = useState<Touche | null>(null);
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
      // L'alerte plus bas dit quel bouton s'en trouve dépourvu.
      for (const [autre, valeur] of Object.entries(suivantes)) {
        if (autre !== bouton && valeur === touche) {
          delete (suivantes as Record<string, string>)[autre];
        }
      }

      setEnAttente(null);
      setMessage(null);
      surChangement(suivantes as Record<Touche, string>);

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

  const affiches = [...boutons, ...ACTIONS];
  const depourvus = boutonsSansEntree(affiches, touches);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink-200">
        Touches
        <span className="ml-2 font-normal text-ink-700">
          Clique sur une touche, puis appuie sur celle que tu veux. Échap annule. Tes touches sont
          enregistrées sur ton compte, pour toutes les consoles.
        </span>
      </h2>

      {depourvus.length > 0 && (
        <p
          role="alert"
          className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
        >
          {enumerer(depourvus.map((bouton) => LIBELLES[bouton]))}{" "}
          {depourvus.length > 1 ? "n'ont plus de touche" : "n'a plus de touche"} : sa touche est passée
          à un autre bouton. Clique dessus pour {depourvus.length > 1 ? "leur" : "lui"} en donner une.
        </p>
      )}

      {message && (
        <p role="alert" className="text-xs text-red-300">
          {message}
        </p>
      )}

      <ul className="flex flex-wrap gap-2">
        {affiches.map((bouton) => {
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
                    : touche
                      ? "border-ink-700 hover:border-ink-400"
                      : "border-amber-600 bg-amber-950/40 hover:border-amber-400"
                }`}
              >
                <span className="text-xs text-ink-400">{LIBELLES[bouton]}</span>
                <span
                  className={`font-mono text-sm ${
                    attend ? "text-accent-400" : touche ? "text-ink-50" : "text-amber-200"
                  }`}
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
