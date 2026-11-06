"use client";

import { useEffect, useState } from "react";
import { SalonLink } from "@/components/link/salon-link";
import type { Touche } from "@/lib/consoles";
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

  useEffect(() => {
    if (salon) return;
    let arrete = false;
    let minuterie: ReturnType<typeof setTimeout> | null = null;
    const autorisation = { Authorization: `Bearer ${jeton}` };

    async function chercher(): Promise<void> {
      try {
        const parametres = new URLSearchParams({ jeu: jeu.id, console: jeu.console, instance, attente: "1" });
        const reponse = await fetch(`/link/salons?${parametres}`, { headers: autorisation, cache: "no-store" });
        if (!reponse.ok) throw new Error(`Le serveur a répondu ${reponse.status}.`);
        const corps = (await reponse.json()) as Reponse;
        if (arrete) return;

        const existant = corps.instance?.salon ?? null;
        if (existant) {
          // Quelqu'un du salon vocal l'a ouvert : on s'y assoit s'il reste une
          // chaise ou si c'est la nôtre, sinon on regarde.
          const joueur = existant.maPlace >= 0 || existant.joueurs[1] === null;
          if (!joueur && existant.spectateurs >= MAX_SPECTATEURS) {
            setMessage(`La partie est pleine : deux joueurs et ${MAX_SPECTATEURS} spectateurs.`);
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
            const refus = (await creation.json().catch(() => null)) as { erreur?: string } | null;
            // « D'autres salons attendent », « serveur au complet » : on garde
            // notre rang et on redemande.
            setMessage(refus?.erreur ?? `Le salon n'a pas pu être ouvert (${creation.status}).`);
          } else {
            setMessage(null);
          }
        }
      } catch (cause) {
        if (!arrete) setMessage(cause instanceof Error ? cause.message : "Le serveur ne répond pas.");
      }
      if (!arrete) minuterie = setTimeout(() => void chercher(), INTERVALLE_MS);
    }

    void chercher();
    return () => {
      arrete = true;
      if (minuterie) clearTimeout(minuterie);
    };
  }, [salon, jeton, instance, jeu.id, jeu.console]);

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
      <h1 className="text-xl font-semibold text-ink-50">{jeu.titre} — à deux</h1>
      {rang && rang.position > 0 ? (
        <>
          <p className="text-ink-200">
            Le serveur est au complet. Vous êtes {rang.position + 1}
            <sup>e</sup> dans la file{rang.total > 1 ? ` (${rang.total} salons attendent)` : ""}.
          </p>
          <p className="text-sm text-ink-400">
            Un salon s&apos;ouvre dès qu&apos;une partie se termine ; reste sur cet écran, il se mettra à jour
            tout seul.
          </p>
        </>
      ) : rang && rang.libres === 0 ? (
        <>
          <p className="text-ink-200">Le serveur est au complet. Vous êtes les premiers dans la file.</p>
          <p className="text-sm text-ink-400">Un salon s&apos;ouvre dès qu&apos;une partie se termine.</p>
        </>
      ) : (
        <p className="text-ink-400">Ouverture du salon…</p>
      )}
      {message && <p className="text-sm text-red-300">{message}</p>}
      <button
        type="button"
        onClick={surQuitter}
        className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-ink-200"
      >
        Retour
      </button>
    </div>
  );
}
