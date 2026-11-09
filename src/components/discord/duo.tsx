"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/langue";
import { SalonLink } from "@/components/link/salon-link";
import type { Touche } from "@/lib/consoles";
import type { Refus } from "@/lib/link/protocole";
import { texteErreurLink } from "@/lib/link/textes";
import type { Enregistreur } from "@/lib/keymap/actions";

/**
 * Jouer à deux dans l'Activité : le salon vocal est le salon de jeu.
 *
 * Tous ceux qui ouvrent l'Activité dans le même salon vocal partagent une
 * instance ; le serveur du site en fait un salon de câble link, privé, sans
 * code à échanger. Le premier qui choisit « Jouer à deux » l'ouvre, le
 * second s'y assoit, les suivants regardent.
 *
 * Le serveur ne tient qu'un nombre de salons à la fois : quand il est au
 * complet, l'instance prend un rang dans la file et l'écran le dit. Tout
 * passe par `/link/salons` — la même route que le site — avec le jeton de
 * l'Activité ; l'émulation tourne sur le serveur, la page ne reçoit que
 * l'image et le son (voir `SalonLink`).
 */
type Rang = { position: number; total: number; libres: number | null };
type SalonInstance = {
  id: string;
  etat: "attente" | "en-jeu" | "termine";
  joueurs: (string | null)[];
  spectateurs: number;
  /** Place du compte dans le salon, −1 s'il n'y est pas. */
  maPlace: number;
};
type Reponse = { instance?: { salon: SalonInstance | null; rang: Rang | null }; libres: number | null };

/** Entre deux demandes au serveur, tant qu'on cherche ou qu'on attend. */
const INTERVALLE_MS = 2500;
const MAX_SPECTATEURS = 5;

export function Duo({
  jeton,
  instance,
  jeu,
  dispositions,
  enregistreur,
  surQuitter,
}: {
  jeton: string;
  /** La clé du salon de l'instance, donnée par la session. */
  instance: string;
  jeu: { id: string; console: string; titre: string };
  dispositions: { touches: Record<Touche, string>; manette: Record<Touche, string>; manettes: Record<string, Record<Touche, string>> };
  enregistreur: Enregistreur;
  surQuitter: () => void;
}) {
  const [salon, setSalon] = useState<{ id: string; spectateur: boolean } | null>(null);
  const [rang, setRang] = useState<Rang | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (salon) return;
    let arrete = false;
    let minuterie: ReturnType<typeof setTimeout> | null = null;
    const autorisation = { Authorization: `Bearer ${jeton}` };

    async function chercher(): Promise<void> {
      try {
        const parametres = new URLSearchParams({ jeu: jeu.id, console: jeu.console, instance, attente: "1" });
        const reponse = await fetch(`/link/salons?${parametres}`, { headers: autorisation, cache: "no-store" });
        if (!reponse.ok) throw new Error(t.activite.erreurs.reponse(reponse.status));
        const corps = (await reponse.json()) as Reponse;
        if (arrete) return;

        const existant = corps.instance?.salon ?? null;
        if (existant) {
          // Quelqu'un du salon vocal l'a ouvert : on s'y assoit s'il reste une
          // chaise ou si c'est la nôtre, sinon on regarde.
          const joueur = existant.maPlace >= 0 || existant.joueurs[1] === null;
          if (!joueur && existant.spectateurs >= MAX_SPECTATEURS) {
            setMessage(t.activite.duo.pleine(MAX_SPECTATEURS));
          } else {
            setSalon({ id: existant.id, spectateur: !joueur });
            return;
          }
        } else {
          const r = corps.instance?.rang ?? null;
          setRang(r);
          const monTour = !r || (r.position === 0 && (r.libres === null || r.libres > 0));
          if (monTour) {
            const creation = await fetch("/link/salons", {
              method: "POST",
              headers: { ...autorisation, "Content-Type": "application/json" },
              body: JSON.stringify({ jeu: jeu.id, instance }),
            });
            if (arrete) return;
            if (creation.status === 201) {
              const { id } = (await creation.json()) as { id: string };
              setSalon({ id, spectateur: false });
              return;
            }
            const refus = (await creation.json().catch(() => null)) as Partial<Refus> | null;
            // « D'autres salons attendent », « serveur au complet » : on garde
            // notre rang et on redemande. Le serveur dit lequel c'est par un
            // code, que `texteErreurLink` rend dans la langue du joueur ; à
            // défaut de code, son texte, puis le numéro de la réponse.
            setMessage(
              texteErreurLink(t, refus ?? undefined, refus?.erreur ?? t.activite.duo.nonOuvert(creation.status)),
            );
          } else {
            setMessage(null);
          }
        }
      } catch (cause) {
        if (!arrete) setMessage(cause instanceof Error ? cause.message : t.activite.duo.sansReponse);
      }
      if (!arrete) minuterie = setTimeout(() => void chercher(), INTERVALLE_MS);
    }

    void chercher();
    return () => {
      arrete = true;
      if (minuterie) clearTimeout(minuterie);
    };
  }, [salon, jeton, instance, jeu.id, jeu.console, t]);

  if (salon) {
    return (
      <SalonLink
        salonId={salon.id}
        consoleSlug={jeu.console}
        touches={dispositions.touches}
        manette={dispositions.manette}
        manettes={dispositions.manettes}
        spectateur={salon.spectateur}
        retour="/"
        jeton={jeton}
        surQuitter={surQuitter}
        enregistreur={enregistreur}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-ink-50">{t.activite.duo.titre(jeu.titre)}</h1>
      {rang && rang.position > 0 ? (
        <>
          <p className="text-ink-200">
            <AvecExposant texte={t.activite.duo.file(rang.position + 1, rang.total)} />
          </p>
          <p className="text-sm text-ink-400">{t.activite.duo.fileConseil}</p>
        </>
      ) : rang && rang.libres === 0 ? (
        <>
          <p className="text-ink-200">{t.activite.duo.premiers}</p>
          <p className="text-sm text-ink-400">{t.activite.duo.premiersConseil}</p>
        </>
      ) : (
        <p className="text-ink-400">{t.activite.duo.ouverture}</p>
      )}
      {message && <p className="text-sm text-red-300">{message}</p>}
      <button
        type="button"
        onClick={surQuitter}
        className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-ink-200"
      >
        {t.activite.duo.retour}
      </button>
    </div>
  );
}

/**
 * L'exposant d'un ordinal, que le dictionnaire écrit entre accents
 * circonflexes — « 2^e^ dans la file » — et qui prend sa balise ici. Une
 * langue qui n'en met pas n'en écrit pas.
 */
function AvecExposant({ texte }: { texte: string }) {
  return (
    <>
      {texte.split("^").map((morceau, rang) => (rang % 2 === 1 ? <sup key={rang}>{morceau}</sup> : morceau))}
    </>
  );
}
