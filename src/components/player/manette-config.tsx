"use client";

import { useEffect, useState } from "react";
import { enregistrerManette, retablirManette } from "@/lib/keymap/actions";
import { ACTIONS, type ButtonName, type Touche } from "@/lib/consoles";
import { entreesActives, libelleManette, manetteBranchee, MANETTE_PAR_DEFAUT } from "@/lib/manette";

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
 * Configuration de la manette, sur le même principe que le clavier : on
 * clique sur un bouton de la console, puis on appuie sur l'entrée voulue de
 * la manette. L'attente scrute la manette à chaque image, puisque l'API ne
 * prévient de rien.
 */
export function ManetteConfig({
  consoleSlug,
  boutons,
  disposition,
  branchee,
  surChangement,
}: {
  consoleSlug: string;
  boutons: ButtonName[];
  disposition: Record<Touche, string>;
  branchee: boolean;
  surChangement: (disposition: Record<Touche, string>) => void;
}) {
  const [enAttente, setEnAttente] = useState<Touche | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enAttente) return;
    let demande = 0;
    // Ce qui est déjà enfoncé au moment du clic ne compte pas : on attend
    // une entrée qui passe d'inactive à active.
    let ignorees = new Set(entreesActives(manetteBranchee() ?? ({ buttons: [], axes: [] } as unknown as Gamepad)));

    const scruter = () => {
      const manette = manetteBranchee();
      if (manette) {
        const actives = entreesActives(manette);
        const nouvelle = actives.find((entree) => !ignorees.has(entree));
        if (nouvelle) {
          const bouton = enAttente!;
          const suivante = { ...disposition, [bouton]: nouvelle };
          for (const [autre, valeur] of Object.entries(suivante)) {
            if (autre !== bouton && valeur === nouvelle) delete (suivante as Record<string, string>)[autre];
          }
          setEnAttente(null);
          setMessage(null);
          surChangement(suivante as Record<Touche, string>);
          void enregistrerManette(consoleSlug, suivante).then((resultat) => {
            if (!resultat.ok) setMessage(resultat.message ?? "Enregistrement refusé.");
          });
          return;
        }
        ignorees = new Set(actives.filter((entree) => ignorees.has(entree)));
      }
      demande = requestAnimationFrame(scruter);
    };
    demande = requestAnimationFrame(scruter);

    const echap = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setEnAttente(null);
    };
    window.addEventListener("keydown", echap);
    return () => {
      cancelAnimationFrame(demande);
      window.removeEventListener("keydown", echap);
    };
  }, [enAttente, disposition, consoleSlug, surChangement]);

  async function retablir() {
    setMessage(null);
    surChangement({ ...MANETTE_PAR_DEFAUT });
    const resultat = await retablirManette(consoleSlug);
    if (!resultat.ok) setMessage(resultat.message ?? "Opération refusée.");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink-200">
        Manette
        <span className="ml-2 font-normal text-ink-700">
          {branchee
            ? "Clique sur un bouton, puis appuie sur l'entrée voulue de la manette. Échap annule."
            : "Branche une manette (USB ou Bluetooth) et appuie sur un de ses boutons pour qu'elle soit vue."}
        </span>
      </h2>

      {message && (
        <p role="alert" className="text-xs text-red-300">
          {message}
        </p>
      )}

      <ul className="flex flex-wrap gap-2">
        {[...boutons, ...ACTIONS].map((bouton) => {
          const attend = enAttente === bouton;
          const entree = disposition[bouton];
          return (
            <li key={bouton}>
              <button
                type="button"
                onClick={() => setEnAttente(attend ? null : bouton)}
                disabled={!branchee && !attend}
                className={`flex min-w-24 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors disabled:opacity-60 ${
                  attend ? "border-accent-600 bg-accent-600/15" : "border-ink-700 hover:border-ink-400"
                }`}
              >
                <span className="text-xs text-ink-400">{LIBELLES[bouton]}</span>
                <span className={`text-sm ${attend ? "text-accent-400" : "text-ink-50"}`}>
                  {attend ? "…" : entree ? libelleManette(entree) : "aucune"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-700">Le stick gauche fait toujours la croix, en plus de ce qui est réglé ici.</p>

      <button
        type="button"
        onClick={() => void retablir()}
        className="self-start text-xs text-ink-700 underline-offset-4 hover:text-ink-200 hover:underline"
      >
        Rétablir la manette par défaut
      </button>
    </section>
  );
}
