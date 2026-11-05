"use client";

import { useCallback, useRef } from "react";
import { BOUTONS_PSX } from "@/lib/emulator/libretro";

/**
 * Manette tactile de l'essai PlayStation : de quoi jouer sur un téléphone sans
 * manette Bluetooth, pas la manette définitive.
 *
 * Elle n'apparaît que sur un écran tactile (`pointer: coarse`). Chaque doigt
 * tient ce qu'il touche : plusieurs boutons à la fois, sans que le premier
 * relâché libère les autres. La croix est une seule zone, lue par la position
 * du doigt, pour qu'on puisse glisser d'une direction à l'autre et tenir une
 * diagonale — indispensable dès qu'un jeu se dirige en continu.
 *
 * Pas de sticks analogiques : le cœur est réglé sur la manette numérique.
 */
/**
 * Attache le doigt à ce qu'il a touché, même s'il en déborde ensuite. Un
 * navigateur qui refuse la capture laisse le bouton marcher sans elle.
 */
function capturer(evenement: React.PointerEvent<HTMLElement>): void {
  try {
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
  } catch {
    // Pointeur déjà relâché, ou capture indisponible.
  }
}

export function ManettePs1({ surMasque }: { surMasque: (masque: number) => void }) {
  /** Ce que chaque doigt tient, en bits de boutons. */
  const doigts = useRef(new Map<number, number>());

  const publier = useCallback(() => {
    let masque = 0;
    for (const bits of doigts.current.values()) masque |= bits;
    surMasque(masque);
  }, [surMasque]);

  const tenir = useCallback(
    (evenement: React.PointerEvent<HTMLElement>, bits: number) => {
      evenement.preventDefault();
      capturer(evenement);
      evenement.currentTarget.dataset.tenu = "";
      doigts.current.set(evenement.pointerId, bits);
      publier();
    },
    [publier],
  );

  const lacher = useCallback(
    (evenement: React.PointerEvent<HTMLElement>) => {
      delete evenement.currentTarget.dataset.tenu;
      if (doigts.current.delete(evenement.pointerId)) publier();
    },
    [publier],
  );

  /** La direction sous le doigt, d'après sa position par rapport au centre de la croix. */
  const diriger = useCallback(
    (evenement: React.PointerEvent<HTMLElement>) => {
      if (evenement.type === "pointermove" && !doigts.current.has(evenement.pointerId)) return;
      evenement.preventDefault();
      if (evenement.type === "pointerdown") capturer(evenement);

      const cadre = evenement.currentTarget.getBoundingClientRect();
      const x = (evenement.clientX - cadre.left) / cadre.width - 0.5;
      const y = (evenement.clientY - cadre.top) / cadre.height - 0.5;
      let bits = 0;
      // Zone morte au centre ; au-delà, chaque axe compte s'il pèse assez
      // face à l'autre, ce qui laisse de larges diagonales.
      if (Math.hypot(x, y) > 0.12) {
        if (Math.abs(x) > Math.abs(y) * 0.45) bits |= x < 0 ? BOUTONS_PSX.LEFT : BOUTONS_PSX.RIGHT;
        if (Math.abs(y) > Math.abs(x) * 0.45) bits |= y < 0 ? BOUTONS_PSX.UP : BOUTONS_PSX.DOWN;
      }
      if (doigts.current.get(evenement.pointerId) !== bits) {
        doigts.current.set(evenement.pointerId, bits);
        publier();
      }
    },
    [publier],
  );

  const bouton = (libelle: string, bits: number, classes: string) => (
    <button
      type="button"
      aria-label={libelle}
      onPointerDown={(evenement) => tenir(evenement, bits)}
      onPointerUp={lacher}
      onPointerCancel={lacher}
      onContextMenu={(evenement) => evenement.preventDefault()}
      className={`flex items-center justify-center border border-ink-700 bg-ink-950/60 text-ink-200 data-[tenu]:border-accent-500 data-[tenu]:bg-accent-600/30 ${classes}`}
    >
      {libelle}
    </button>
  );

  const gachette = "h-10 w-16 rounded-lg text-xs";
  // En proportion du cadre : les quatre ronds ne se chevauchent à aucune taille.
  const face = "absolute size-[38%] rounded-full text-xl";

  return (
    <div className="hidden w-full max-w-3xl touch-none flex-col gap-3 select-none [@media(pointer:coarse)]:flex">
      <div className="flex justify-between">
        <div className="flex gap-2">
          {bouton("L2", BOUTONS_PSX.L2, gachette)}
          {bouton("L1", BOUTONS_PSX.L1, gachette)}
        </div>
        <div className="flex gap-2">
          {bouton("R1", BOUTONS_PSX.R1, gachette)}
          {bouton("R2", BOUTONS_PSX.R2, gachette)}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Croix directionnelle"
          onPointerDown={diriger}
          onPointerMove={diriger}
          onPointerUp={lacher}
          onPointerCancel={lacher}
          onContextMenu={(evenement) => evenement.preventDefault()}
          className="grid aspect-square w-[38%] max-w-40 shrink-0 grid-cols-3 grid-rows-3 rounded-full border border-ink-700 bg-ink-950/60 text-xl text-ink-400"
        >
          <span className="col-start-2 row-start-1 flex items-center justify-center">▲</span>
          <span className="col-start-1 row-start-2 flex items-center justify-center">◀</span>
          <span className="col-start-3 row-start-2 flex items-center justify-center">▶</span>
          <span className="col-start-2 row-start-3 flex items-center justify-center">▼</span>
        </div>

        <div className="flex flex-col gap-2">
          {bouton("Select", BOUTONS_PSX.SELECT, "h-9 w-14 rounded-lg text-xs")}
          {bouton("Start", BOUTONS_PSX.START, "h-9 w-14 rounded-lg text-xs")}
        </div>

        <div className="relative aspect-square w-[38%] max-w-40 shrink-0">
          {bouton("△", BOUTONS_PSX.TRIANGLE, `${face} top-0 left-1/2 -translate-x-1/2`)}
          {bouton("□", BOUTONS_PSX.CARRE, `${face} top-1/2 left-0 -translate-y-1/2`)}
          {bouton("○", BOUTONS_PSX.ROND, `${face} top-1/2 right-0 -translate-y-1/2`)}
          {bouton("✕", BOUTONS_PSX.CROIX, `${face} bottom-0 left-1/2 -translate-x-1/2`)}
        </div>
      </div>
    </div>
  );
}
