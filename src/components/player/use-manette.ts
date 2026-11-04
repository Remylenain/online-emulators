"use client";

import { useEffect, useRef, useState } from "react";
import type { Touche } from "@/lib/consoles";
import { lireManette, manetteBranchee } from "@/lib/manette";

/**
 * Suit la manette branchée et signale chaque touche qui change d'état.
 *
 * L'API Gamepad ne prévient de rien : il faut relire l'état à chaque image
 * et comparer avec la précédente. La boucle tourne tant que le composant
 * vit — relire une manette coûte moins qu'une image du jeu — et s'arrête
 * d'elle-même quand l'onglet est caché, puisque `requestAnimationFrame`
 * ne tourne plus ; au retour, tout est relâché d'abord, comme pour le
 * clavier au changement de fenêtre.
 *
 * `branchee` sert à l'affichage : sur téléphone, la manette tactile
 * s'efface tant qu'une vraie manette est là.
 */
export function useManette(
  disposition: Record<Touche, string>,
  surTouche: (touche: Touche, enfonce: boolean) => void,
  actif = true,
): { branchee: boolean } {
  const [branchee, setBranchee] = useState(false);
  const surToucheRef = useRef(surTouche);
  surToucheRef.current = surTouche;

  useEffect(() => {
    if (!actif || typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    let tenues = new Set<Touche>();
    let demande = 0;
    let presente = false;

    const relacherTout = () => {
      for (const touche of tenues) surToucheRef.current(touche, false);
      tenues = new Set();
    };

    const lire = () => {
      const manette = manetteBranchee();
      if (Boolean(manette) !== presente) {
        presente = Boolean(manette);
        setBranchee(presente);
        if (!presente) relacherTout();
      }
      if (manette) {
        const maintenant = lireManette(manette, disposition);
        for (const touche of maintenant) if (!tenues.has(touche)) surToucheRef.current(touche, true);
        for (const touche of tenues) if (!maintenant.has(touche)) surToucheRef.current(touche, false);
        tenues = maintenant;
      }
      demande = requestAnimationFrame(lire);
    };
    demande = requestAnimationFrame(lire);

    const surRetour = () => {
      if (document.visibilityState === "visible") relacherTout();
    };
    document.addEventListener("visibilitychange", surRetour);
    return () => {
      cancelAnimationFrame(demande);
      document.removeEventListener("visibilitychange", surRetour);
      relacherTout();
    };
  }, [disposition, actif]);

  return { branchee };
}
