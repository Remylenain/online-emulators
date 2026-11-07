"use client";

import { useRef, useState } from "react";
import { nomDeFichier } from "@/lib/format";

/**
 * Emporter sa partie, ou en apporter une : le fichier de sauvegarde, dans
 * l'Activité. Même format que le lecteur du site (`fichier-sauvegarde.tsx`),
 * donc lisible par mGBA ou une vraie cartouche, et même partie que sur le
 * site — c'est le compte qui la porte.
 *
 * Avant de jouer seulement : le cœur lit la sauvegarde au démarrage, et le
 * salon de câble link la lit à l'ouverture. Une partie importée remplace la
 * partie en cours ; le serveur garde les versions précédentes. « Repartir de
 * zéro » la met de côté de la même façon : le prochain « Jouer » démarre
 * comme la première fois, et le site sait la restaurer.
 */

/** Tailles que les consoles produisent réellement ; au-delà, on avertit sans refuser (pieds de page d'horloge). */
const TAILLES_CONNUES = [512, 8192, 32768, 65536, 131072];

export function PartieActivite({ jeton, titre }: { jeton: string; titre: string }) {
  const champ = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const autorisation = { Authorization: `Bearer ${jeton}` };

  async function telecharger(): Promise<void> {
    setMessage(null);
    setOccupe(true);
    try {
      const reponse = await fetch("/api/discord/sauvegarde", { headers: autorisation, cache: "no-store" });
      if (reponse.status === 204) {
        setMessage("Il n'y a pas encore de partie à télécharger.");
        return;
      }
      if (!reponse.ok) throw new Error(`Le serveur a répondu ${reponse.status}.`);
      const donnees = await reponse.arrayBuffer();
      const url = URL.createObjectURL(new Blob([donnees]));
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `${nomDeFichier(titre)}.sav`;
      lien.click();
      URL.revokeObjectURL(url);
      // Discord peut refuser le téléchargement depuis son cadre : le dire,
      // sans pouvoir le savoir d'ici.
      setMessage(`Partie envoyée au téléchargement (${donnees.byteLength} octets). Si rien n'arrive, Discord l'a bloqué : récupère-la depuis le site, c'est la même.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le téléchargement a échoué.");
    } finally {
      setOccupe(false);
    }
  }

  async function importer(fichier: File): Promise<void> {
    setMessage(null);
    const donnees = new Uint8Array(await fichier.arrayBuffer());
    if (donnees.length === 0) {
      setMessage("Ce fichier est vide.");
      return;
    }
    const inhabituelle = !TAILLES_CONNUES.includes(donnees.length);
    const question = `${inhabituelle ? `Taille inhabituelle pour une sauvegarde (${donnees.length} octets). ` : ""}Remplacer ta partie en cours par ce fichier ? L'ancienne version est gardée en secours.`;
    if (!window.confirm(question)) return;

    setOccupe(true);
    try {
      // Sans en-tête de révision : le joueur remplace volontairement.
      const reponse = await fetch("/api/discord/sauvegarde", {
        method: "PUT",
        headers: { ...autorisation, "Content-Type": "application/octet-stream" },
        body: donnees,
      });
      if (!reponse.ok) {
        const detail = (await reponse.json().catch(() => null)) as { erreur?: string } | null;
        setMessage(detail?.erreur ?? "Le serveur a refusé cette sauvegarde.");
        return;
      }
      setMessage("Partie remplacée. Elle sera lue au prochain « Jouer ».");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "L'envoi a échoué.");
    } finally {
      setOccupe(false);
    }
  }

  async function repartirDeZero(): Promise<void> {
    setMessage(null);
    if (
      !window.confirm(
        "Repartir de zéro ? Ta partie en cours est mise de côté avec les versions précédentes, et le jeu redémarrera comme la première fois. Tes points de reprise restent.",
      )
    )
      return;
    setOccupe(true);
    try {
      const reponse = await fetch("/api/discord/sauvegarde", { method: "DELETE", headers: autorisation });
      if (!reponse.ok) throw new Error(`Le serveur a répondu ${reponse.status}.`);
      const { effacee } = (await reponse.json()) as { effacee: boolean };
      setMessage(effacee ? "Partie mise de côté. Le prochain « Jouer » repart du début." : "Il n'y avait pas de partie à mettre de côté.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Ça n'a pas marché.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={occupe}
          onClick={() => void telecharger()}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 disabled:opacity-40"
        >
          Télécharger ma partie
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={() => champ.current?.click()}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 disabled:opacity-40"
        >
          {occupe ? "En cours…" : "Remplacer par un fichier"}
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={() => void repartirDeZero()}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-ink-400 hover:text-red-300 disabled:opacity-40"
        >
          Repartir de zéro
        </button>
        <input
          ref={champ}
          type="file"
          accept=".sav,.srm,application/octet-stream"
          className="hidden"
          onChange={(evenement) => {
            const fichier = evenement.target.files?.[0];
            evenement.target.value = "";
            if (fichier) void importer(fichier);
          }}
        />
      </div>
      {message && <p className="max-w-md text-xs text-ink-400">{message}</p>}
    </div>
  );
}
