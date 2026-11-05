"use client";

import { useEffect, useState } from "react";
import type { ResultatTouches } from "@/lib/keymap/actions";
import { ACTIONS, type ButtonName, type Touche } from "@/lib/consoles";
import { boutonsSansEntree, enumerer } from "@/lib/keymap/disposition";
import { entreesActives, libelleManette, manetteBranchee, type IdentiteManette } from "@/lib/manette";

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
 *
 * La section dit aussi ce que le navigateur voit — le nom de la manette, si
 * sa numérotation est standard, et les entrées enfoncées à l'instant — parce
 * qu'une manette mal reconnue ne se règle bien qu'en voyant ce qu'elle envoie.
 */
export function ManetteConfig({
  boutons,
  disposition,
  identite,
  aRegler,
  changer,
  retablir,
}: {
  boutons: ButtonName[];
  disposition: Record<Touche, string>;
  identite: IdentiteManette | null;
  aRegler: boolean;
  changer: (disposition: Record<Touche, string>) => Promise<ResultatTouches>;
  retablir: () => Promise<ResultatTouches>;
}) {
  const [enAttente, setEnAttente] = useState<Touche | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actives, setActives] = useState<string[]>([]);
  const branchee = identite !== null;
  const standard = identite?.standard ?? true;

  // Ce que la manette envoie à l'instant, pour s'y retrouver.
  useEffect(() => {
    if (!branchee) {
      setActives([]);
      return;
    }
    let demande = 0;
    let precedent = "";
    const scruter = () => {
      const manette = manetteBranchee();
      const maintenant = manette ? entreesActives(manette) : [];
      const signature = maintenant.join(",");
      if (signature !== precedent) {
        precedent = signature;
        setActives(maintenant);
      }
      demande = requestAnimationFrame(scruter);
    };
    demande = requestAnimationFrame(scruter);
    return () => cancelAnimationFrame(demande);
  }, [branchee]);

  useEffect(() => {
    if (!enAttente) return;
    let demande = 0;
    // Ce qui est déjà actif au moment du clic ne compte pas — un bouton
    // encore tenu, ou une gâchette dont l'axe vaut −1 au repos : on attend
    // une entrée qui passe d'inactive à active.
    const depart = manetteBranchee();
    let ignorees = new Set(depart ? entreesActives(depart) : []);

    const scruter = () => {
      const manette = manetteBranchee();
      if (manette) {
        const maintenant = entreesActives(manette);
        const nouvelle = maintenant.find((entree) => !ignorees.has(entree));
        if (nouvelle) {
          const bouton = enAttente!;
          const suivante = { ...disposition, [bouton]: nouvelle };
          for (const [autre, valeur] of Object.entries(suivante)) {
            if (autre !== bouton && valeur === nouvelle) delete (suivante as Record<string, string>)[autre];
          }
          setEnAttente(null);
          setMessage(null);
          void changer(suivante as Record<Touche, string>).then((resultat) => {
            if (!resultat.ok) setMessage(resultat.message ?? "Enregistrement refusé.");
          });
          return;
        }
        ignorees = new Set(maintenant.filter((entree) => ignorees.has(entree)));
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
  }, [enAttente, disposition, changer]);

  async function surRetablir() {
    setMessage(null);
    const resultat = await retablir();
    if (!resultat.ok) setMessage(resultat.message ?? "Opération refusée.");
  }

  const affiches = [...boutons, ...ACTIONS];
  // Sans manette branchée, ou tant qu'elle reste à régler, l'alerte n'apprendrait rien.
  const depourvus = branchee && !aRegler ? boutonsSansEntree(affiches, disposition) : [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink-200">
        Manette
        <span className="ml-2 font-normal text-ink-700">
          {branchee
            ? "Touche un bouton ci-dessous, puis appuie sur l'entrée voulue de la manette."
            : "Branche une manette (USB ou Bluetooth) et appuie sur un de ses boutons pour qu'elle soit vue."}
        </span>
      </h2>

      {identite && (
        <p className="text-xs text-ink-400">
          <span className="text-ink-200">{identite.id}</span> —{" "}
          {identite.standard
            ? "reconnue par le navigateur, numérotation standard. Le réglage ci-dessous est enregistré sur ton compte, pour toutes les consoles."
            : "numérotation propre à cette manette sur ce type d'appareil : le réglage ci-dessous est enregistré sur ton compte pour elle, et ne change rien pour tes autres manettes."}
          {actives.length > 0 && (
            <span className="ml-2 font-mono text-accent-400">
              {actives.map((entree) => `${entree} (${libelleManette(entree, standard)})`).join(" · ")}
            </span>
          )}
        </p>
      )}
      {aRegler && (
        <p className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          Le navigateur ne reconnaît pas cette manette : ses boutons ne sont pas là où on les attend.
          Attribue-les une fois, un par un — c&apos;est l&apos;affaire d&apos;une minute.
        </p>
      )}

      {depourvus.length > 0 && (
        <p
          role="alert"
          className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
        >
          {enumerer(depourvus.map((bouton) => LIBELLES[bouton]))}{" "}
          {depourvus.length > 1 ? "n'ont plus de bouton" : "n'a plus de bouton"} sur la manette : le
          sien est passé à un autre. Touche-{depourvus.length > 1 ? "les" : "le"} ci-dessous pour{" "}
          {depourvus.length > 1 ? "leur" : "lui"} en donner un.
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
          const entree = disposition[bouton];
          const tenue = Boolean(entree && actives.includes(entree));
          return (
            <li key={bouton}>
              <button
                type="button"
                onClick={() => setEnAttente(attend ? null : bouton)}
                disabled={!branchee && !attend}
                className={`flex min-w-24 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors disabled:opacity-60 ${
                  attend
                    ? "border-accent-600 bg-accent-600/15"
                    : tenue
                      ? "border-accent-600/70 bg-accent-600/10"
                      : entree || !branchee
                        ? "border-ink-700 hover:border-ink-400"
                        : "border-amber-600 bg-amber-950/40 hover:border-amber-400"
                }`}
              >
                <span className="text-xs text-ink-400">{LIBELLES[bouton]}</span>
                <span className={`text-sm ${attend ? "text-accent-400" : "text-ink-50"}`}>
                  {attend ? "…" : entree ? libelleManette(entree, standard) : "aucune"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-700">Le stick gauche fait toujours la croix, en plus de ce qui est réglé ici.</p>

      <button
        type="button"
        onClick={() => void surRetablir()}
        className="self-start text-xs text-ink-700 underline-offset-4 hover:text-ink-200 hover:underline"
      >
        Rétablir la manette par défaut
      </button>
    </section>
  );
}
