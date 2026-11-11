"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * Téléphone couché : ce que l'Activité et le salon de câble link partagent
 * pour poser la manette de part et d'autre de l'écran.
 */

/**
 * Ce dont la manette s'écarte encore des bords, en plus des marges sûres que
 * Discord annonce : sur un téléphone Android couché, la marge annoncée s'est
 * montrée plus étroite que la barre de navigation.
 */
export const GARDE_COUCHE = "1rem";

/**
 * Le sens dans lequel l'appareil est tenu, suivi tant que la page est
 * ouverte : un téléphone se tourne en pleine partie.
 */
const ORIENTATION = "(orientation: landscape)";

function suivreOrientation(rappel: () => void): () => void {
  const requete = window.matchMedia(ORIENTATION);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

export function usePaysage(): boolean {
  return useSyncExternalStore(
    suivreOrientation,
    () => window.matchMedia(ORIENTATION).matches,
    () => false,
  );
}

export type Zone = { largeur: number; hauteur: number };

/**
 * La place qu'occupent l'écran et la manette, mesurée plutôt que déduite de
 * la fenêtre : Discord retire ses marges sûres tout autour, et les barres
 * vont et viennent. La manette couchée s'y taille.
 */
export function useZone(ref: RefObject<HTMLElement | null>): Zone | null {
  const [zone, setZone] = useState<Zone | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(([entree]) => {
      if (!entree) return;
      setZone({
        largeur: Math.round(entree.contentRect.width),
        hauteur: Math.round(entree.contentRect.height),
      });
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [ref]);
  return zone;
}

/** Les variables CSS que la manette couchée lit, pour une zone mesurée. */
export function variablesCouche(zone: Zone | null): React.CSSProperties {
  return {
    "--cote": zone ? `${Math.round(zone.largeur * 0.22)}px` : "22vw",
    "--haut": zone ? `${zone.hauteur}px` : "100dvh",
    "--marge-gauche": GARDE_COUCHE,
    "--marge-droite": GARDE_COUCHE,
  } as React.CSSProperties;
}

/** Les marges sûres de Discord, à défaut celles du système : pour un calque qui couvre tout l'écran. */
export const MARGES_SURES: React.CSSProperties = {
  paddingTop: "var(--discord-safe-area-inset-top, env(safe-area-inset-top))",
  paddingBottom: "var(--discord-safe-area-inset-bottom, env(safe-area-inset-bottom))",
  paddingLeft: "var(--discord-safe-area-inset-left, env(safe-area-inset-left))",
  paddingRight: "var(--discord-safe-area-inset-right, env(safe-area-inset-right))",
};
