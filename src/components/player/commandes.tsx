"use client";

import { useT } from "@/components/langue";
import { keyLabel } from "@/lib/consoles";

/**
 * Les commandes du lecteur que l'Activité Discord partage avec le site : la
 * vitesse de jeu, le son. Un même aspect des deux côtés, et un seul endroit
 * où les régler.
 */

export const VITESSES = [1, 2, 3, 4, 5];

/** Le volume retenu dans le navigateur, d'une partie à l'autre. */
export const CLE_VOLUME = "oe_volume";

/** Le volume retenu, ou `null` : rien d'enregistré, ou stockage indisponible. */
export function lireVolumeRetenu(): number | null {
  try {
    // `Number(null)` vaut 0 : sans rien d'enregistré, un premier passage
    // démarrait sinon sans le son.
    const brut = localStorage.getItem(CLE_VOLUME);
    const retenu = brut === null ? NaN : Number(brut);
    return Number.isInteger(retenu) && retenu >= 0 && retenu <= 100 ? retenu : null;
  } catch {
    return null;
  }
}

export function retenirVolume(pourcentage: number): void {
  try {
    localStorage.setItem(CLE_VOLUME, String(pourcentage));
  } catch {
    // Sans stockage, le réglage vaut pour cette partie seulement.
  }
}

export function Commande({
  onClick,
  actif,
  children,
}: {
  onClick: () => void;
  actif?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        actif
          ? "border-accent-600 bg-accent-600/15 text-accent-400"
          : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Vitesse de jeu, de ×1 à ×5. Mise en évidence comme un bouton actif dès
 * qu'elle dépasse ×1, ou tant que la touche d'accélération est tenue.
 *
 * `court` : le multiplicateur seul, « ×2 », là où la place manque — la barre
 * d'un téléphone tenu debout. Le nom du réglage reste dit aux lecteurs d'écran.
 */
export function ChoixVitesse({
  valeur,
  accelere,
  surChoix,
  toucheAcceleration,
  vitesseTouche = 4,
  court = false,
}: {
  valeur: number;
  accelere: boolean;
  surChoix: (multiplicateur: number) => void;
  /** Touche à tenir pour accélérer, pour l'infobulle ; null sur tactile. */
  toucheAcceleration: string | null | undefined;
  /** Ce que donne la touche tenue, pour l'infobulle. */
  vitesseTouche?: number;
  court?: boolean;
}) {
  const t = useT();

  return (
    <select
      value={valeur}
      onChange={(evenement) => surChoix(Number(evenement.target.value))}
      aria-label={t.partie.vitesse.libelle}
      title={
        toucheAcceleration
          ? t.partie.vitesse.toucheATenir(keyLabel(toucheAcceleration, t.commandes.clavier), vitesseTouche)
          : undefined
      }
      className={`rounded-lg border bg-ink-950 py-1.5 text-sm transition-colors ${court ? "px-1.5" : "px-3"} ${
        valeur > 1 || accelere
          ? "border-accent-600 text-accent-400"
          : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
      }`}
    >
      {VITESSES.map((multiplicateur) => (
        <option key={multiplicateur} value={multiplicateur}>
          {court
            ? `×${multiplicateur}`
            : multiplicateur === 1
              ? t.partie.vitesse.normale
              : t.partie.vitesse.acceleree(multiplicateur)}
        </option>
      ))}
    </select>
  );
}

/**
 * Le son : un bouton pour le couper, un curseur de 0 à 100 %.
 *
 * `court` : sans le pourcentage, et le curseur prend la place qui reste sur
 * la ligne au lieu d'une largeur fixe. Il part d'une petite largeur et
 * s'étire : parti de sa largeur naturelle, il ferait passer les commandes à
 * la ligne là où elles tiennent.
 */
export function Volume({
  valeur,
  muet,
  surChangement,
  surMuet,
  court = false,
}: {
  valeur: number;
  muet: boolean;
  surChangement: (pourcentage: number) => void;
  surMuet: () => void;
  court?: boolean;
}) {
  const t = useT();

  return (
    <div className={`flex items-center gap-2 ${court ? "grow" : ""}`}>
      <Commande onClick={surMuet} actif={muet}>
        {muet ? t.partie.son.coupe : t.partie.son.actif}
      </Commande>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={valeur}
        onChange={(evenement) => surChangement(Number(evenement.target.value))}
        disabled={muet}
        aria-label={t.partie.son.volume}
        className={`accent-accent-500 disabled:opacity-40 ${court ? "w-10 max-w-40 grow" : "w-24"}`}
      />
      {!court && (
        <span className="w-10 font-mono text-xs text-ink-400">{t.partie.son.pourcentage(muet ? 0 : valeur)}</span>
      )}
    </div>
  );
}
