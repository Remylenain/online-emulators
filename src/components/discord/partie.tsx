"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/langue";
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
  const t = useT().activite;
  const autorisation = { Authorization: `Bearer ${jeton}` };

  async function telecharger(): Promise<void> {
    setMessage(null);
    setOccupe(true);
    try {
      const reponse = await fetch("/api/discord/sauvegarde", { headers: autorisation, cache: "no-store" });
      if (reponse.status === 204) {
        setMessage(t.partie.rienATelecharger);
        return;
      }
      if (!reponse.ok) throw new Error(t.erreurs.reponse(reponse.status));
      const donnees = await reponse.arrayBuffer();
      const url = URL.createObjectURL(new Blob([donnees]));
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `${nomDeFichier(titre)}.sav`;
      lien.click();
      URL.revokeObjectURL(url);
      // Discord peut refuser le téléchargement depuis son cadre : le dire,
      // sans pouvoir le savoir d'ici.
      setMessage(t.partie.telechargee(donnees.byteLength));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t.partie.telechargementEchoue);
    } finally {
      setOccupe(false);
    }
  }

  async function importer(fichier: File): Promise<void> {
    setMessage(null);
    const donnees = new Uint8Array(await fichier.arrayBuffer());
    if (donnees.length === 0) {
      setMessage(t.partie.fichierVide);
      return;
    }
    const inhabituelle = !TAILLES_CONNUES.includes(donnees.length);
    if (!window.confirm(t.partie.confirmer.remplacer(inhabituelle ? donnees.length : null))) return;

    setOccupe(true);
    try {
      // Sans en-tête de révision : le joueur remplace volontairement.
      const reponse = await fetch("/api/discord/sauvegarde", {
        method: "PUT",
        headers: { ...autorisation, "Content-Type": "application/octet-stream" },
        body: donnees,
      });
      if (!reponse.ok) {
        // Le serveur explique son refus en français. Le fichier trop gros a
        // son code à lui ; pour le reste, son texte s'affiche tel quel, faute
        // de mieux — rien de ce que cet écran envoie n'y mène.
        const detail = (await reponse.json().catch(() => null)) as { erreur?: string } | null;
        setMessage(reponse.status === 413 ? t.partie.tropGros : (detail?.erreur ?? t.partie.refusee));
        return;
      }
      setMessage(t.partie.remplacee);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t.partie.envoiEchoue);
    } finally {
      setOccupe(false);
    }
  }

  async function repartirDeZero(): Promise<void> {
    setMessage(null);
    if (!window.confirm(t.partie.confirmer.repartirDeZero)) return;
    setOccupe(true);
    try {
      const reponse = await fetch("/api/discord/sauvegarde", { method: "DELETE", headers: autorisation });
      if (!reponse.ok) throw new Error(t.erreurs.reponse(reponse.status));
      const { effacee } = (await reponse.json()) as { effacee: boolean };
      setMessage(effacee ? t.partie.miseDeCote : t.partie.rienAMettreDeCote);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t.partie.echec);
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
          {t.partie.telecharger}
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={() => champ.current?.click()}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 disabled:opacity-40"
        >
          {occupe ? t.partie.enCours : t.partie.remplacer}
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={() => void repartirDeZero()}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-ink-400 hover:text-red-300 disabled:opacity-40"
        >
          {t.partie.repartirDeZero}
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
