"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Touche } from "@/lib/consoles";
import { enregistrerManette, retablirManette, type ResultatTouches } from "@/lib/keymap/actions";
import {
  identiteManette,
  lireManette,
  manetteBranchee,
  MANETTE_PAR_DEFAUT,
  type IdentiteManette,
} from "@/lib/manette";

type Disposition = Record<Touche, string>;

/**
 * La manette branchée : la suivre, traduire ses boutons, et tenir sa
 * disposition.
 *
 * **Lecture.** L'API Gamepad ne prévient de rien : il faut relire l'état à
 * chaque image et comparer avec la précédente. La boucle tourne tant que le
 * composant vit — relire une manette coûte moins qu'une image du jeu — et
 * s'arrête d'elle-même quand l'onglet est caché ; au retour, tout est
 * relâché d'abord, comme pour le clavier au changement de fenêtre.
 *
 * **Deux dispositions.** Une manette que le navigateur reconnaît (numérotation
 * « standard ») utilise la disposition du compte, enregistrée sur le serveur :
 * elle vaut pour toutes les manettes standard, sur tous les appareils. Une
 * manette qu'il ne reconnaît pas a sa propre numérotation, qui ne vaut que
 * pour ce modèle dans ce navigateur : sa disposition est retenue ici, sur
 * l'appareil, sous le nom de la manette. Sans cela, régler sa 8BitDo sur le
 * téléphone déréglerait la même sur le PC, où elle est vue autrement.
 */
export function useManette(
  consoleSlug: string,
  dispositionCompte: Disposition,
  surTouche: (touche: Touche, enfonce: boolean) => void,
  actif = true,
): {
  branchee: boolean;
  identite: IdentiteManette | null;
  disposition: Disposition;
  /** La manette non reconnue n'a pas encore été réglée sur cet appareil. */
  aRegler: boolean;
  changer: (disposition: Disposition) => Promise<ResultatTouches>;
  retablir: () => Promise<ResultatTouches>;
} {
  const [identite, setIdentite] = useState<IdentiteManette | null>(null);
  const [compte, setCompte] = useState(dispositionCompte);
  const [locales, setLocales] = useState<Record<string, Disposition>>({});
  const cle = `oe_manette:${consoleSlug}`;

  useEffect(() => {
    try {
      const lues = JSON.parse(localStorage.getItem(cle) ?? "{}") as Record<string, Disposition>;
      if (lues && typeof lues === "object") setLocales(lues);
    } catch {
      // Stockage illisible : on repart de rien.
    }
  }, [cle]);

  const locale = identite && !identite.standard ? locales[identite.id] : undefined;
  const disposition = identite && !identite.standard ? (locale ?? compte) : compte;
  const aRegler = Boolean(identite && !identite.standard && !locale);

  // La boucle de lecture lit ces deux valeurs par des références, tenues à
  // jour après chaque rendu : elle n'a pas à redémarrer quand elles changent.
  const dispositionRef = useRef(disposition);
  const surToucheRef = useRef(surTouche);
  useEffect(() => {
    dispositionRef.current = disposition;
    surToucheRef.current = surTouche;
  });

  useEffect(() => {
    if (!actif || typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    let tenues = new Set<Touche>();
    let demande = 0;
    let presente = "";

    const relacherTout = () => {
      for (const touche of tenues) surToucheRef.current(touche, false);
      tenues = new Set();
    };

    const lire = () => {
      const manette = manetteBranchee();
      const signature = manette ? `${manette.id}|${manette.mapping}` : "";
      if (signature !== presente) {
        presente = signature;
        setIdentite(manette ? identiteManette(manette) : null);
        relacherTout();
      }
      if (manette) {
        const maintenant = lireManette(manette, dispositionRef.current);
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
  }, [actif]);

  const ecrireLocales = useCallback(
    (suivantes: Record<string, Disposition>) => {
      setLocales(suivantes);
      try {
        localStorage.setItem(cle, JSON.stringify(suivantes));
      } catch {
        // Sans stockage, le réglage vaut pour cette partie seulement.
      }
    },
    [cle],
  );

  const changer = useCallback(
    async (suivante: Disposition): Promise<ResultatTouches> => {
      if (identite && !identite.standard) {
        ecrireLocales({ ...locales, [identite.id]: suivante });
        return { ok: true };
      }
      setCompte(suivante);
      return enregistrerManette(consoleSlug, suivante);
    },
    [identite, locales, ecrireLocales, consoleSlug],
  );

  const retablir = useCallback(async (): Promise<ResultatTouches> => {
    if (identite && !identite.standard) {
      const reste = { ...locales };
      delete reste[identite.id];
      ecrireLocales(reste);
      return { ok: true };
    }
    setCompte({ ...MANETTE_PAR_DEFAUT });
    return retablirManette(consoleSlug);
  }, [identite, locales, ecrireLocales, consoleSlug]);

  return { branchee: identite !== null, identite, disposition, aRegler, changer, retablir };
}
