"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Resultat = {
  id: string;
  slug: string;
  console: string;
  titre: string;
  precision: string | null;
  jaquette: boolean;
};

/**
 * Recherche globale, depuis n'importe quelle page : un bouton dans
 * l'en-tête, ou la touche « / » (ou Ctrl+K). On tape, les jeux arrivent,
 * les flèches choisissent, Entrée ouvre la fiche.
 *
 * La touche est ignorée dans un champ de saisie — on y tape vraiment une
 * barre oblique — et pendant une partie ou dans un salon, où le clavier
 * appartient au jeu.
 */
export function RechercheGlobale() {
  const router = useRouter();
  const chemin = usePathname();
  const [ouverte, setOuverte] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [choisi, setChoisi] = useState(0);
  const [cherche, setCherche] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const enJeu = chemin.startsWith("/jouer/") || chemin.startsWith("/link/");

  const fermer = () => {
    setOuverte(false);
    setSaisie("");
    setResultats([]);
    setChoisi(0);
  };

  // « / » et Ctrl+K ouvrent ; Échap ferme.
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") {
        setOuverte(false);
        return;
      }
      if (enJeu) return;
      const cible = evenement.target as HTMLElement | null;
      const dansUnChamp = Boolean(
        cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable),
      );
      const raccourci =
        (evenement.key === "/" && !dansUnChamp && !evenement.ctrlKey && !evenement.metaKey) ||
        (evenement.key.toLowerCase() === "k" && (evenement.ctrlKey || evenement.metaKey));
      if (!raccourci) return;
      evenement.preventDefault();
      setOuverte(true);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [enJeu]);

  useEffect(() => {
    if (ouverte) champ.current?.focus();
  }, [ouverte]);

  // La requête part après une courte pause de frappe ; une réponse en retard
  // sur une saisie déjà changée est ignorée.
  useEffect(() => {
    const mots = saisie.trim();
    if (!ouverte || mots.length < 2) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      setCherche(true);
      fetch(`/api/recherche?q=${encodeURIComponent(mots)}`, { cache: "no-store" })
        .then((reponse) => (reponse.ok ? reponse.json() : { jeux: [] }))
        .then((corps: { jeux: Resultat[] }) => {
          if (annule) return;
          setResultats(corps.jeux);
          setChoisi(0);
        })
        .catch(() => {
          if (!annule) setResultats([]);
        })
        .finally(() => {
          if (!annule) setCherche(false);
        });
    }, 180);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [saisie, ouverte]);

  function ouvrir(resultat: Resultat) {
    fermer();
    router.push(`/jeux/${resultat.console}/${resultat.slug}`);
  }

  function surToucheChamp(evenement: React.KeyboardEvent) {
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      setChoisi((i) => Math.min(i + 1, Math.max(resultats.length - 1, 0)));
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      setChoisi((i) => Math.max(i - 1, 0));
    } else if (evenement.key === "Enter") {
      const resultat = resultats[choisi];
      if (resultat) ouvrir(resultat);
    }
  }

  const visibles = saisie.trim().length < 2 ? [] : resultats;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        aria-label="Rechercher un jeu"
        className="flex items-center gap-2 rounded-md border border-ink-800 px-2.5 py-1.5 text-sm text-ink-400 transition-colors hover:border-ink-700 hover:text-ink-50"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4.5 4.5" strokeLinecap="round" />
        </svg>
        <span className="hidden md:inline">Rechercher</span>
        <kbd className="hidden rounded border border-ink-700 px-1 font-mono text-[10px] text-ink-400 md:inline">/</kbd>
      </button>

      {ouverte && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/80 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(evenement) => {
            if (evenement.target === evenement.currentTarget) fermer();
          }}
        >
          <div
            role="dialog"
            aria-label="Rechercher un jeu"
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-panel border border-ink-700 bg-ink-900 shadow-2xl"
          >
            <input
              ref={champ}
              value={saisie}
              onChange={(evenement) => setSaisie(evenement.target.value)}
              onKeyDown={surToucheChamp}
              placeholder="Titre, auteur, jeu de base…"
              aria-label="Rechercher un jeu"
              autoComplete="off"
              spellCheck={false}
              className="w-full border-b border-ink-800 bg-transparent px-4 py-3 text-base text-ink-50 placeholder:text-ink-700 focus:outline-none"
            />
            <ul className="min-h-0 flex-1 overflow-y-auto" role="listbox">
              {visibles.map((resultat, index) => (
                <li key={resultat.id} role="option" aria-selected={index === choisi}>
                  <button
                    type="button"
                    onClick={() => ouvrir(resultat)}
                    onMouseEnter={() => setChoisi(index)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                      index === choisi ? "bg-ink-800" : ""
                    }`}
                  >
                    {resultat.jaquette ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/cover/${resultat.id}`}
                        alt=""
                        className="size-10 shrink-0 rounded border border-ink-800 bg-ink-950/60 object-contain"
                      />
                    ) : (
                      <span className="size-10 shrink-0 rounded border border-ink-800 bg-ink-950/60" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-50">{resultat.titre}</span>
                      {resultat.precision && (
                        <span className="block truncate text-xs text-ink-400">{resultat.precision}</span>
                      )}
                    </span>
                    <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-ink-400">
                      {resultat.console}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-ink-800 px-4 py-2 text-xs text-ink-700">
              {saisie.trim().length < 2
                ? "Tape au moins deux lettres. Flèches pour choisir, Entrée pour ouvrir, Échap pour fermer."
                : cherche && visibles.length === 0
                  ? "Recherche…"
                  : visibles.length === 0
                    ? `Rien ne correspond à « ${saisie.trim()} ».`
                    : `${visibles.length} jeu${visibles.length > 1 ? "x" : ""}`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
