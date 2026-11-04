"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bouton } from "@/lib/emulator/adapter";

/**
 * Manette tactile.
 *
 * Tout tient à une idée : **chaque doigt est suivi séparément**. Un pointeur
 * sait quels boutons il tient, et un bouton compte combien de doigts le
 * tiennent. Sans cela, lever le doigt d'une direction relâchait aussi le B
 * maintenu par l'autre main — or tenir B en marchant, c'est courir, et le
 * joueur se remettait à marcher sans comprendre pourquoi.
 *
 * Deux autres exigences :
 *
 * - **Le doigt doit pouvoir glisser d'une direction à l'autre**, comme sur une
 *   vraie croix. Les événements de pointeur capturent par défaut le premier
 *   élément touché, ce qui figerait la direction de départ : on relâche la
 *   capture dès l'appui pour que `pointerenter` se déclenche sur les voisines.
 * - **Rien ne doit bouger sous les doigts.** `touch-action: none` coupe le
 *   défilement et le zoom, et la sélection de texte est désactivée.
 */

/**
 * Durée minimale pendant laquelle un bouton reste enfoncé côté cœur.
 *
 * La console lit ses boutons une fois par image, soit toutes les 16 ms. Un
 * tapotement vif peut durer moins : le bouton serait relâché avant d'avoir
 * jamais été vu enfoncé. Cent millisecondes restent imperceptibles.
 */
const DUREE_MINIMALE = 100;

export function Manette({
  gachettes,
  surBouton,
  paysage = false,
  basGauche,
}: {
  gachettes: boolean;
  surBouton: (bouton: Bouton, enfonce: boolean) => void;
  /** Téléphone à l'horizontale : les commandes encadrent l'écran. */
  paysage?: boolean;
  /** En paysage, ce qui se range sous la croix (Menu, Quitter). */
  basGauche?: React.ReactNode;
}) {
  /** Ce que chaque doigt tient en ce moment. */
  const parPointeur = useRef(new Map<number, Bouton[]>());
  /** Nombre de doigts par bouton, et l'instant du premier appui. */
  const tenus = useRef(new Map<Bouton, { doigts: number; depuis: number }>());
  /** Pour l'affichage : les boutons visuellement enfoncés. */
  const [actifs, setActifs] = useState<ReadonlySet<Bouton>>(new Set());

  const rafraichirActifs = useCallback(() => {
    setActifs(new Set(tenus.current.keys()));
  }, []);

  const presser = useCallback(
    (bouton: Bouton) => {
      const etat = tenus.current.get(bouton);
      if (etat) {
        // Un second doigt sur le même bouton : il est déjà enfoncé.
        etat.doigts += 1;
        return;
      }
      tenus.current.set(bouton, { doigts: 1, depuis: performance.now() });
      surBouton(bouton, true);
      // Un retour haptique court : sur une surface lisse, c'est ce qui
      // remplace la sensation du bouton qui s'enfonce.
      navigator.vibrate?.(8);
    },
    [surBouton],
  );

  const relacher = useCallback(
    (bouton: Bouton) => {
      const etat = tenus.current.get(bouton);
      if (!etat) return;
      etat.doigts -= 1;
      if (etat.doigts > 0) return;

      tenus.current.delete(bouton);
      const ecoule = performance.now() - etat.depuis;
      if (ecoule >= DUREE_MINIMALE) surBouton(bouton, false);
      else setTimeout(() => surBouton(bouton, false), DUREE_MINIMALE - ecoule);
    },
    [surBouton],
  );

  /** Ce doigt tient désormais exactement ces boutons-là. */
  const affecter = useCallback(
    (pointeur: number, boutons: Bouton[]) => {
      const avant = parPointeur.current.get(pointeur) ?? [];
      if (avant.length === boutons.length && avant.every((b) => boutons.includes(b))) return;

      for (const bouton of avant) if (!boutons.includes(bouton)) relacher(bouton);
      for (const bouton of boutons) if (!avant.includes(bouton)) presser(bouton);

      if (boutons.length === 0) parPointeur.current.delete(pointeur);
      else parPointeur.current.set(pointeur, boutons);
      rafraichirActifs();
    },
    [presser, relacher, rafraichirActifs],
  );

  /**
   * Un doigt levé est suivi au niveau de la fenêtre et non du bouton : relâché
   * hors de la zone, ou interrompu par une alerte système, son `pointerup`
   * n'atteindrait jamais le bouton concerné, qui resterait enfoncé.
   *
   * On ne relâche que ce que **ce** doigt tenait : les autres continuent.
   */
  useEffect(() => {
    function surLevee(evenement: PointerEvent) {
      affecter(evenement.pointerId, []);
    }
    function toutRelacher() {
      for (const pointeur of [...parPointeur.current.keys()]) affecter(pointeur, []);
    }

    window.addEventListener("pointerup", surLevee);
    window.addEventListener("pointercancel", surLevee);
    window.addEventListener("blur", toutRelacher);
    return () => {
      window.removeEventListener("pointerup", surLevee);
      window.removeEventListener("pointercancel", surLevee);
      window.removeEventListener("blur", toutRelacher);
    };
  }, [affecter]);

  const proprietes = (boutons: Bouton[]) => ({
    onPointerDown: (evenement: React.PointerEvent<HTMLButtonElement>) => {
      // Sans cette libération, le navigateur garde le pointeur sur cet
      // élément : glisser vers une autre case ne déclencherait jamais son
      // entrée, et la croix serait figée sur la direction de départ.
      //
      // Entourée d'un try : la libération lève une exception quand aucune
      // capture n'est en cours, et une exception ici ferait manquer l'appui.
      try {
        evenement.currentTarget.releasePointerCapture(evenement.pointerId);
      } catch {
        // Pas de capture à libérer : l'appui se traite normalement.
      }
      affecter(evenement.pointerId, boutons);
    },
    onPointerEnter: (evenement: React.PointerEvent<HTMLButtonElement>) => {
      if (evenement.buttons > 0 || evenement.pressure > 0) {
        affecter(evenement.pointerId, boutons);
      }
    },
    onContextMenu: (evenement: React.MouseEvent) => evenement.preventDefault(),
  });

  const enfonce = (boutons: Bouton[]) => boutons.every((b) => actifs.has(b));

  const styleTactile = {
    touchAction: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
  } as React.CSSProperties;

  const boutonsAction = (taille: string) => (
    /*
      A à droite et plus haut que B, comme sur la console : c'est la
      position que le pouce retrouve sans regarder.

      B est décalé vers la droite plutôt que collé au bord : il se
      retrouvait contre la croix directionnelle, et le pouce gauche
      risquait de l'effleurer en changeant de direction.
    */
    <div className={`relative aspect-square shrink-0 ${taille}`}>
      <Touche
        nom="B"
        {...proprietes(["B"])}
        actif={enfonce(["B"])}
        classe="absolute bottom-[3%] left-[15%] size-[44%] rounded-full text-xl"
      >
        B
      </Touche>
      <Touche
        nom="A"
        {...proprietes(["A"])}
        actif={enfonce(["A"])}
        classe="absolute right-[1%] top-[5%] size-[44%] rounded-full text-xl"
      >
        A
      </Touche>
    </div>
  );

  const selectStart = (classe: string) => (
    <>
      <Touche
        nom="SELECT"
        {...proprietes(["SELECT"])}
        actif={enfonce(["SELECT"])}
        classe={classe}
      >
        SELECT
      </Touche>
      <Touche nom="START" {...proprietes(["START"])} actif={enfonce(["START"])} classe={classe}>
        START
      </Touche>
    </>
  );

  /*
   * Paysage : deux colonnes posées sur les bandes réservées de chaque côté de
   * l'écran. Le conteneur laisse passer les doigts (`pointer-events-none`) ;
   * seules les colonnes les captent, pour ne jamais masquer l'image.
   *
   * La taille suit la plus petite des deux contraintes : la largeur de la
   * bande et la hauteur de l'écran, pour que la croix tienne aussi bien sur
   * un téléphone étroit que sur un long.
   */
  if (paysage) {
    const colonne =
      "pointer-events-auto absolute inset-y-0 flex flex-col items-center justify-between py-2";
    const taille = "w-[min(calc(var(--cote)_-_1rem),calc(var(--haut)_*_0.46))]";
    const gachette = "w-[min(calc(var(--cote)_-_1.5rem),7rem)] rounded-xl py-2";

    return (
      <div className="absolute inset-0 select-none" style={styleTactile}>
        <div
          className={`${colonne} left-0`}
          style={{
            width: "var(--cote)",
            marginLeft: "env(safe-area-inset-left)",
          }}
        >
          {gachettes ? (
            <Touche nom="L" {...proprietes(["L"])} actif={enfonce(["L"])} classe={gachette}>
              L
            </Touche>
          ) : (
            <span />
          )}
          <CroixDirectionnelle proprietes={proprietes} enfonce={enfonce} taille={taille} />
          <div className="flex gap-2">{basGauche}</div>
        </div>

        <div
          className={`${colonne} right-0`}
          style={{
            width: "var(--cote)",
            marginRight: "env(safe-area-inset-right)",
          }}
        >
          {gachettes ? (
            <Touche nom="R" {...proprietes(["R"])} actif={enfonce(["R"])} classe={gachette}>
              R
            </Touche>
          ) : (
            <span />
          )}
          {boutonsAction(taille)}
          <div className="flex gap-2">
            {selectStart("w-16 rounded-full py-1.5 text-[10px]")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex select-none flex-col gap-3 px-2 pb-3"
      style={styleTactile}
    >
      {gachettes && (
        <div className="flex justify-between">
          <Touche
            nom="L"
            {...proprietes(["L"])}
            actif={enfonce(["L"])}
            classe="w-28 rounded-xl py-2.5"
          >
            L
          </Touche>
          <Touche
            nom="R"
            {...proprietes(["R"])}
            actif={enfonce(["R"])}
            classe="w-28 rounded-xl py-2.5"
          >
            R
          </Touche>
        </div>
      )}

      <div className="flex items-center justify-between gap-1">
        <CroixDirectionnelle
          proprietes={proprietes}
          enfonce={enfonce}
          taille="w-[47vw] max-w-56"
        />
        {boutonsAction("w-[47vw] max-w-56")}
      </div>

      {/*
        Start et Select sont volontairement écartés de la croix et des boutons
        d'action : ils ne servent qu'entre deux actions, et une pression par
        inadvertance en plein jeu ouvrirait le menu.
      */}
      <div className="mt-6 flex justify-center gap-6">
        {selectStart("w-28 -rotate-12 rounded-full py-2 text-xs")}
      </div>
    </div>
  );
}

/**
 * La croix directionnelle, en grille de trois sur trois.
 *
 * Les quatre coins sont de vraies cases : elles enfoncent deux directions à la
 * fois. Sans elles, les diagonales demanderaient de poser le doigt pile entre
 * deux cases — or une diagonale sert à chaque coin de couloir dans un Pokémon.
 */
function CroixDirectionnelle({
  proprietes,
  enfonce,
  taille,
}: {
  proprietes: (boutons: Bouton[]) => Record<string, unknown>;
  enfonce: (boutons: Bouton[]) => boolean;
  /** Largeur de la croix ; la hauteur suit, elle reste carrée. */
  taille: string;
}) {
  const cases: Array<{ boutons: Bouton[]; classe: string; signe?: string } | null> = [
    { boutons: ["UP", "LEFT"], classe: "rounded-tl-xl" },
    { boutons: ["UP"], classe: "rounded-t-xl", signe: "▲" },
    { boutons: ["UP", "RIGHT"], classe: "rounded-tr-xl" },
    { boutons: ["LEFT"], classe: "rounded-l-xl", signe: "◀" },
    null,
    { boutons: ["RIGHT"], classe: "rounded-r-xl", signe: "▶" },
    { boutons: ["DOWN", "LEFT"], classe: "rounded-bl-xl" },
    { boutons: ["DOWN"], classe: "rounded-b-xl", signe: "▼" },
    { boutons: ["DOWN", "RIGHT"], classe: "rounded-br-xl" },
  ];

  return (
    <div className={`grid aspect-square ${taille} shrink-0 grid-cols-3 grid-rows-3 gap-px rounded-2xl border border-ink-700 bg-ink-950/40 p-px`}>
      {cases.map((caseDirection, index) =>
        caseDirection === null ? (
          <span key={index} className="bg-ink-700" />
        ) : (
          <button
            key={index}
            type="button"
            aria-label={caseDirection.boutons.join(" et ")}
            {...proprietes(caseDirection.boutons)}
            className={`flex items-center justify-center text-sm transition-colors ${
              caseDirection.classe
            } ${
              // Les diagonales restent plus sombres : ce sont des zones
              // d'appoint, elles ne doivent pas attirer le pouce autant que
              // les quatre directions franches.
              caseDirection.boutons.length > 1
                ? "bg-ink-800/50 text-transparent"
                : "bg-ink-700 text-ink-300"
            } ${enfonce(caseDirection.boutons) ? "!bg-accent-600 !text-ink-950" : ""}`}
          >
            {caseDirection.signe}
          </button>
        ),
      )}
    </div>
  );
}

function Touche({
  nom,
  actif,
  classe,
  children,
  ...proprietes
}: {
  nom: string;
  actif: boolean;
  classe: string;
  children: React.ReactNode;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      aria-label={nom}
      {...proprietes}
      className={`flex items-center justify-center border border-ink-700 font-semibold text-ink-200 transition-colors ${classe} ${
        actif ? "border-accent-600 bg-accent-600 text-ink-950" : "bg-ink-800"
      }`}
    >
      {children}
    </button>
  );
}
