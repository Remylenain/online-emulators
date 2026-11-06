"use client";

import { ManetteConfig } from "@/components/player/manette-config";
import { Touches } from "@/components/player/touches";
import type { useManette } from "@/components/player/use-manette";
import { BUTTONS, type ButtonName, type Touche } from "@/lib/consoles";
import type { Enregistreur } from "@/lib/keymap/actions";

/**
 * Touches et manette, dans l'Activité : les mêmes écrans que le lecteur du
 * site, qui enregistrent sur le compte Discord par le jeton de l'Activité.
 * Un réglage fait ici vaut aussi sur le site, et inversement.
 */
export function ReglagesActivite({
  consoleSlug,
  tactile,
  touches,
  surTouches,
  manette,
  enregistreur,
  fermer,
}: {
  consoleSlug: string;
  tactile: boolean;
  touches: Record<Touche, string>;
  surTouches: (touches: Record<Touche, string>) => void;
  manette: ReturnType<typeof useManette>;
  enregistreur: Enregistreur;
  fermer: () => void;
}) {
  const boutons = (consoleSlug === "gba" ? [...BUTTONS.common, ...BUTTONS.shoulder] : [...BUTTONS.common]) as ButtonName[];

  return (
    <div className="flex w-full max-w-xl flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-50">Touches et manette</h2>
        <button
          type="button"
          onClick={fermer}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-ink-200"
        >
          Fermer
        </button>
      </div>
      <p className="text-xs text-ink-400">
        Enregistrés sur ton compte : les mêmes réglages valent sur le site et dans l&apos;Activité, seul ou
        à deux.
      </p>
      {!tactile && (
        <Touches
          consoleSlug={consoleSlug}
          boutons={boutons}
          touches={touches}
          surChangement={surTouches}
          enregistreur={enregistreur}
        />
      )}
      <ManetteConfig
        boutons={boutons}
        disposition={manette.disposition}
        identite={manette.identite}
        aRegler={manette.aRegler}
        changer={manette.changer}
        retablir={manette.retablir}
      />
    </div>
  );
}
