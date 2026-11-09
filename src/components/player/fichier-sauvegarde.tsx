"use client";

import { useRef, useState } from "react";
import { nomDeFichier } from "@/lib/format";

/**
 * Téléversement et téléchargement de la sauvegarde.
 *
 * C'est ce qui permet de reprendre sur le site une partie commencée sur une
 * vraie cartouche, et inversement d'en ressortir sa partie — le site n'est pas
 * une impasse.
 */

/** Tailles de sauvegarde que les consoles produisent réellement. */
const TAILLES_CONNUES = [512, 8192, 32768, 65536, 131072];

/**
 * Propose la sauvegarde en téléchargement. Rend sa taille, ou `null` s'il n'y
 * avait rien à télécharger.
 */
export function telechargerSauvegarde(titre: string, donnees: Uint8Array | null): number | null {
  if (!donnees || donnees.length === 0) return null;

  // Le nom reprend le titre du jeu : un fichier « rom.sav » dans le dossier
  // des téléchargements ne dirait rien à personne.
  const nom = `${nomDeFichier(titre)}.sav`;
  const url = URL.createObjectURL(new Blob([new Uint8Array(donnees)]));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
  return donnees.length;
}

export function FichierSauvegarde({
  gameId,
  titre,
  lireSauvegarde,
  local = false,
  requete = fetch,
  surTelecharger,
  surImport,
}: {
  gameId: string;
  titre: string;
  lireSauvegarde: () => Uint8Array | null;
  /** Invité : la partie reste dans le navigateur, sans copie de secours. */
  local?: boolean;
  /** Par où enregistrer : le réseau par défaut, le navigateur pour un invité. */
  requete?: typeof fetch;
  /** Remplace le téléchargement ordinaire ; rend faux s'il n'y avait rien à télécharger. */
  surTelecharger?: () => Promise<boolean>;
  /** Appelé une fois le fichier importé, juste avant le rechargement. */
  surImport?: () => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function telecharger() {
    if (surTelecharger) {
      setMessage(
        (await surTelecharger())
          ? "Sauvegarde téléchargée. Garde ce fichier : c'est ta partie."
          : "Il n'y a pas encore de sauvegarde à télécharger.",
      );
      return;
    }
    const taille = telechargerSauvegarde(titre, lireSauvegarde());
    setMessage(
      taille === null
        ? "Il n'y a pas encore de sauvegarde à télécharger."
        : `Sauvegarde téléchargée (${taille} octets).`,
    );
  }

  async function importer(fichier: File) {
    setMessage(null);

    const donnees = new Uint8Array(await fichier.arrayBuffer());
    if (donnees.length === 0) {
      setMessage("Ce fichier est vide.");
      return;
    }
    if (!TAILLES_CONNUES.includes(donnees.length)) {
      // Averti plutôt que refusé : certains émulateurs ajoutent un en-tête ou
      // complètent le fichier, et la sauvegarde peut rester valable.
      setMessage(
        `Taille inhabituelle pour une sauvegarde (${donnees.length} octets). ` +
          "Si le jeu ne la reconnaît pas, c'est sans doute de là que ça vient.",
      );
    }

    const actuelle = lireSauvegarde();
    const avertissement =
      actuelle && actuelle.length > 0
        ? local
          ? "Cela remplacera ta partie en cours, sans copie de secours : télécharge-la d'abord si tu veux la garder. Continuer ?"
          : "Cela remplacera ta partie en cours. L'ancienne version est gardée en secours. Continuer ?"
        : "Importer cette sauvegarde ?";
    if (!window.confirm(avertissement)) return;

    setOccupe(true);
    try {
      // Sans en-tête de révision : le joueur remplace volontairement, il n'y a
      // pas de conflit à détecter.
      const reponse = await requete(`/api/save/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: donnees,
      });
      if (!reponse.ok) {
        setMessage(local ? "Le navigateur a refusé cette sauvegarde." : "Le serveur a refusé cette sauvegarde.");
        return;
      }
      surImport?.();

      /**
       * Rechargement de la page plutôt qu'injection à chaud : le cœur lit la
       * sauvegarde à l'ouverture du jeu, et la lui glisser en cours de partie
       * laisserait la mémoire du jeu désaccordée avec le fichier.
       */
      window.location.reload();
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink-200">
        Fichier de sauvegarde
        <span className="ml-2 font-normal text-ink-700">
          {local
            ? "Ta partie n'est que dans ce navigateur : télécharge-la pour la garder ou continuer ailleurs, importe-la pour la reprendre."
            : "Pour reprendre une partie venue d'ailleurs, ou emporter la tienne."}
        </span>
      </h2>

      {message && <p className="text-xs text-ink-400">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void telecharger()}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50"
        >
          Télécharger
        </button>

        <button
          type="button"
          disabled={occupe}
          onClick={() => champ.current?.click()}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50 disabled:opacity-40"
        >
          {occupe ? "Import en cours…" : "Remplacer par un fichier"}
        </button>

        <input
          ref={champ}
          type="file"
          accept=".sav,.srm,application/octet-stream"
          className="hidden"
          onChange={(evenement) => {
            const fichier = evenement.target.files?.[0];
            // Le champ est vidé pour que réimporter le même fichier après une
            // annulation déclenche bien un nouvel évènement.
            evenement.target.value = "";
            if (fichier) void importer(fichier);
          }}
        />
      </div>
    </section>
  );
}
