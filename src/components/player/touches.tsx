"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/langue";
import { enregistrerTouches, retablirTouches, type Enregistreur } from "@/lib/keymap/actions";
import { boutonsSansEntree } from "@/lib/keymap/disposition";
import {
  ACTIONS,
  DEFAULT_KEYMAP,
  keyLabel,
  toucheDeEvenement,
  type ButtonName,
  type Touche,
} from "@/lib/consoles";

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
const ACTIONS_DU_SITE = { touches: enregistrerTouches, retablirTouches };

export function Touches({
  consoleSlug,
  boutons,
  touches,
  surChangement,
  enregistreur = ACTIONS_DU_SITE,
  local = false,
}: {
  consoleSlug: string;
  boutons: ButtonName[];
  touches: Record<Touche, string>;
  surChangement: (touches: Record<Touche, string>) => void;
  /** Où enregistrer : les actions du site par défaut ; l'Activité Discord donne les siennes. */
  enregistreur?: Pick<Enregistreur, "touches" | "retablirTouches">;
  /** Invité : les touches restent dans le navigateur, et le texte le dit. */
  local?: boolean;
}) {
  const t = useT();
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

      const resultat = await enregistreur.touches(consoleSlug, suivantes);
      if (!resultat.ok) {
        // L'enregistreur d'un invité n'a qu'un refus à annoncer, celui du
        // navigateur, et il l'annonce en français : le dictionnaire le dit
        // dans la langue du joueur. Le serveur, lui, garde le dernier mot.
        setMessage(
          local ? t.commandes.touches.refuseLocal : (resultat.message ?? t.commandes.enregistrementRefuse),
        );
      }
    }

    window.addEventListener("keydown", surFrappe, { capture: true });
    return () => window.removeEventListener("keydown", surFrappe, { capture: true });
  }, [enAttente, touches, consoleSlug, surChangement, enregistreur, local, t]);

  async function retablir() {
    setMessage(null);
    surChangement({ ...DEFAULT_KEYMAP });
    const resultat = await enregistreur.retablirTouches(consoleSlug);
    if (!resultat.ok) {
      setMessage(local ? t.commandes.touches.refuseLocal : (resultat.message ?? t.commandes.retablissementRefuse));
    }
  }

  const affiches = [...boutons, ...ACTIONS];
  const depourvus = boutonsSansEntree(affiches, touches);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink-200">
        {t.commandes.touches.titre}
        <span className="ml-2 font-normal text-ink-700">
          {local ? t.commandes.touches.explicationLocale : t.commandes.touches.explication}
        </span>
      </h2>

      {depourvus.length > 0 && (
        <p
          role="alert"
          className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
        >
          {t.commandes.touches.sansTouche(depourvus.map((bouton) => t.commandes.boutons[bouton]))}
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
                <span className="text-xs text-ink-400">{t.commandes.boutons[bouton]}</span>
                <span
                  className={`font-mono text-sm ${
                    attend ? "text-accent-400" : touche ? "text-ink-50" : "text-amber-200"
                  }`}
                >
                  {attend ? "…" : touche ? keyLabel(touche, t.commandes.clavier) : t.commandes.touches.aucune}
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
        {t.commandes.touches.retablir}
      </button>
    </section>
  );
}
