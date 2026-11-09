"use client";

import { useSyncExternalStore } from "react";
import { lireReglagesInvite, type ReglagesInvite } from "@/lib/invite/stockage";
import type { Habillage } from "./habillage";
import { Lecteur, type ConsoleLecteur, type JeuLecteur } from "./lecteur";

/**
 * Les réglages lus une fois par console et par chargement de page : le
 * lecteur les prend comme valeurs de départ puis tient les siens, et
 * `useSyncExternalStore` exige de toute façon le même objet d'un appel à
 * l'autre.
 */
const lus = new Map<string, ReglagesInvite>();
function reglagesDe(consoleSlug: string): ReglagesInvite {
  let reglages = lus.get(consoleSlug);
  if (!reglages) {
    reglages = lireReglagesInvite(consoleSlug);
    lus.set(consoleSlug, reglages);
  }
  return reglages;
}
const sansAbonnement = () => () => {};

/**
 * Le lecteur d'un invité de la vitrine.
 *
 * Le même lecteur que celui des comptes, à une différence près : rien ne
 * vient du serveur ni n'y retourne. Les réglages — touches, manette,
 * habillage — sont lus dans le navigateur **avant** de monter le lecteur, qui
 * les prend comme valeurs de départ : le cœur démarre ainsi avec les bonnes
 * touches, sans disposition par défaut le temps d'une image.
 *
 * Le serveur ne peut pas les lire à sa place : il rend donc une attente, et
 * le navigateur fait le reste au montage.
 */
export function LecteurInvite({
  jeu,
  console: consoleInfo,
  habillages,
}: {
  jeu: JeuLecteur;
  console: ConsoleLecteur;
  habillages: Habillage[];
}) {
  // `null` au rendu serveur et à l'hydratation, les réglages ensuite.
  const reglages = useSyncExternalStore(
    sansAbonnement,
    () => reglagesDe(jeu.consoleSlug),
    () => null,
  );

  if (!reglages) {
    return <p className="py-10 text-center text-sm text-ink-400">Préparation…</p>;
  }

  // Comme pour un compte : sans choix, le premier habillage ; un choix qui ne
  // correspond plus à aucune image retombe sur ce défaut.
  const parDefaut = habillages[0]?.id ?? null;
  const habillageInitial =
    reglages.habillage === undefined
      ? parDefaut
      : reglages.habillage === null
        ? null
        : habillages.some((h) => h.id === reglages.habillage)
          ? reglages.habillage
          : parDefaut;

  return (
    <Lecteur
      jeu={jeu}
      console={consoleInfo}
      touches={reglages.touches}
      manette={reglages.manette}
      manettes={reglages.manettes}
      habillages={habillages}
      habillageInitial={habillageInitial}
      invite
    />
  );
}
