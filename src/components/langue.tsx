"use client";

import { createContext, useContext, type ReactNode } from "react";
import { dictionnaire, type Dictionnaire } from "@/lib/i18n/dictionnaires";
import { COOKIE_LANGUE, LANGUE_DE_REFERENCE, LANGUES, NOM_DES_LANGUES, type Langue } from "@/lib/i18n/langues";

/**
 * La langue de l'interface, côté navigateur.
 *
 * Le serveur décide de la langue (`src/lib/i18n/serveur.ts`) et la pose ici,
 * à la racine du site ; les composants la lisent par `useT()`. Hors de tout
 * fournisseur, c'est la langue de référence : un composant qui n'a pas été
 * placé sous une langue s'affiche en français, comme avant.
 *
 * Un fournisseur peut en recouvrir un autre : le lecteur d'un invité prend
 * ainsi la langue du jeu lancé, sans changer celle du reste de la page.
 */
const Contexte = createContext<Langue>(LANGUE_DE_REFERENCE);

export function FournisseurLangue({ langue, children }: { langue: Langue; children: ReactNode }) {
  return <Contexte.Provider value={langue}>{children}</Contexte.Provider>;
}

export function useLangue(): Langue {
  return useContext(Contexte);
}

/** Les textes dans la langue en vigueur : `const t = useT()`, puis `t.lecteur.quitter`. */
export function useT(): Dictionnaire {
  return dictionnaire(useContext(Contexte));
}

/**
 * Met en valeur les passages entre astérisques d'un texte de dictionnaire :
 * « ta partie n'est que *dans ce navigateur* ». Les dictionnaires restent du
 * texte ; c'est ici que l'emphase prend sa balise.
 */
export function Accentue({ texte, balise: Balise = "strong" }: { texte: string; balise?: "strong" | "em" }) {
  const morceaux = texte.split("*");
  return (
    <>
      {morceaux.map((morceau, rang) =>
        rang % 2 === 1 ? <Balise key={rang}>{morceau}</Balise> : <span key={rang}>{morceau}</span>,
      )}
    </>
  );
}

/** Pose le cookie du choix explicite, puis recharge pour que le serveur rende la page dans cette langue. */
function retenirLangue(langue: Langue): void {
  // Un an : le choix d'une langue ne se refait pas à chaque visite.
  document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

/**
 * Le sélecteur de langue. Un clic pose le cookie du choix explicite puis
 * recharge la page : le serveur la rend alors dans la langue choisie, et un
 * rechargement complet est de toute façon ce que demande le lecteur
 * (document isolé).
 */
export function ChoixLangue({ className = "" }: { className?: string }) {
  const actuelle = useLangue();
  const t = useT();

  function choisir(langue: Langue) {
    if (langue !== actuelle) retenirLangue(langue);
  }

  return (
    <div role="group" aria-label={t.commun.langue} className={`flex items-center gap-1 text-xs ${className}`}>
      {LANGUES.map((langue) => (
        <button
          key={langue}
          type="button"
          lang={langue}
          title={NOM_DES_LANGUES[langue]}
          aria-pressed={langue === actuelle}
          onClick={() => choisir(langue)}
          className={`rounded-md px-2 py-1 uppercase transition-colors ${
            langue === actuelle ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:bg-ink-800 hover:text-ink-50"
          }`}
        >
          {langue}
        </button>
      ))}
    </div>
  );
}
