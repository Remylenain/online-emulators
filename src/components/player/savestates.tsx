"use client";

import { useCallback, useEffect, useState } from "react";

export type EtatResume = {
  emplacement: number;
  auto: boolean;
  taille: number;
  creeLe: string;
};

const EMPLACEMENTS = [1, 2, 3, 4, 5];

/** Intervalle entre deux reprises automatiques. */
export const INTERVALLE_AUTO = 2 * 60 * 1000;

function segment(emplacement: number, auto: boolean): string {
  return auto ? `a${emplacement}` : String(emplacement);
}

/**
 * Points de reprise : cinq manuels, cinq automatiques.
 *
 * Les automatiques tournent seuls et remplacent toujours le plus ancien des
 * cinq, ce qui laisse en permanence dix minutes de marge arrière. Ils sont
 * tenus à l'écart des manuels : une rotation ne doit jamais effacer la reprise
 * qu'un joueur a posée exprès avant un combat difficile.
 *
 * La rotation elle-même ne vit **pas** ici mais dans le lecteur : sur
 * téléphone ce panneau n'est monté que quand le menu est ouvert, et la
 * rotation s'arrêterait donc dès qu'on referme le menu pour jouer.
 *
 * La vignette est le fichier d'état lui-même — mGBA produit un PNG qui porte
 * l'état de la console *et* l'image de l'écran. Ce que le joueur voit est donc
 * exactement l'instant qu'il retrouvera.
 */
export function Savestates({
  gameId,
  surEcrire,
  surLire,
}: {
  gameId: string;
  surEcrire: () => Uint8Array | null;
  surLire: (donnees: Uint8Array) => boolean;
}) {
  const [etats, setEtats] = useState<EtatResume[]>([]);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const rafraichir = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/state/${gameId}`, { cache: "no-store" });
      if (!reponse.ok) return;
      setEtats((await reponse.json()).etats);
    } catch {
      // Sans liste, les emplacements s'affichent vides : le joueur peut quand
      // même en créer, ce qui remettra la liste à jour.
    }
  }, [gameId]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  const envoyer = useCallback(
    async (emplacement: number, auto: boolean) => {
      const donnees = surEcrire();
      if (!donnees) return false;
      const reponse = await fetch(`/api/state/${gameId}/${segment(emplacement, auto)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(donnees),
      });
      return reponse.ok;
    },
    [gameId, surEcrire],
  );

  async function capturer(emplacement: number, auto: boolean) {
    const cle = segment(emplacement, auto);
    setOccupe(cle);
    setMessage(null);
    try {
      if (!(await envoyer(emplacement, auto))) {
        setMessage("La capture a échoué.");
        return;
      }
      setVersion((v) => v + 1);
      await rafraichir();
    } finally {
      setOccupe(null);
    }
  }

  async function reprendre(emplacement: number, auto: boolean) {
    const cle = segment(emplacement, auto);
    setOccupe(cle);
    setMessage(null);
    try {
      const reponse = await fetch(`/api/state/${gameId}/${cle}`, { cache: "no-store" });
      if (!reponse.ok) {
        setMessage("Cette reprise est introuvable.");
        return;
      }
      if (!surLire(new Uint8Array(await reponse.arrayBuffer()))) {
        setMessage("Le cœur a refusé cette reprise.");
      }
    } finally {
      setOccupe(null);
    }
  }

  async function effacer(emplacement: number, auto: boolean) {
    const cle = segment(emplacement, auto);
    setOccupe(cle);
    try {
      await fetch(`/api/state/${gameId}/${cle}`, { method: "DELETE" });
      await rafraichir();
    } finally {
      setOccupe(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Serie
        titre="Mes points de reprise"
        explication="Cinq emplacements que tu remplis quand tu veux."
        auto={false}
        etats={etats}
        occupe={occupe}
        gameId={gameId}
        version={version}
        surCapturer={capturer}
        surReprendre={reprendre}
        surEffacer={effacer}
      />

      <Serie
        titre="Reprises automatiques"
        explication="Une toutes les deux minutes, en roulement sur cinq emplacements : de quoi revenir dix minutes en arrière."
        auto
        etats={etats}
        occupe={occupe}
        gameId={gameId}
        version={version}
        surReprendre={reprendre}
      />

      {message && (
        <p role="alert" className="text-xs text-red-300">
          {message}
        </p>
      )}
    </div>
  );
}

function Serie({
  titre,
  explication,
  auto,
  etats,
  occupe,
  gameId,
  version,
  surCapturer,
  surReprendre,
  surEffacer,
}: {
  titre: string;
  explication: string;
  auto: boolean;
  etats: EtatResume[];
  occupe: string | null;
  gameId: string;
  version: number;
  surCapturer?: (emplacement: number, auto: boolean) => void;
  surReprendre: (emplacement: number, auto: boolean) => void;
  surEffacer?: (emplacement: number, auto: boolean) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink-200">
        {titre}
        <span className="ml-2 font-normal text-ink-700">{explication}</span>
      </h2>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {EMPLACEMENTS.map((emplacement) => {
          const existant = etats.find(
            (etat) => etat.emplacement === emplacement && etat.auto === auto,
          );
          const enCours = occupe === segment(emplacement, auto);

          return (
            <li
              key={emplacement}
              className="flex flex-col gap-2 rounded-panel border border-ink-800 bg-ink-900/50 p-2"
            >
              <div className="relative aspect-[10/9] overflow-hidden rounded bg-black">
                {existant ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/state/${gameId}/${segment(emplacement, auto)}?v=${version}`}
                    alt={`Aperçu de l'emplacement ${emplacement}`}
                    className="size-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-xs text-ink-700">
                    vide
                  </span>
                )}
              </div>

              <p className="text-xs text-ink-400">
                {emplacement}
                {existant && (
                  <span className="ml-1 text-ink-700">
                    {new Date(existant.creeLe).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </p>

              <div className="flex flex-wrap gap-1">
                {surCapturer && (
                  <PetitBouton
                    onClick={() => surCapturer(emplacement, auto)}
                    disabled={enCours}
                  >
                    {existant ? "Remplacer" : "Capturer"}
                  </PetitBouton>
                )}
                {existant && (
                  <PetitBouton
                    onClick={() => surReprendre(emplacement, auto)}
                    disabled={enCours}
                  >
                    Reprendre
                  </PetitBouton>
                )}
                {existant && surEffacer && (
                  <PetitBouton
                    onClick={() => surEffacer(emplacement, auto)}
                    disabled={enCours}
                    discret
                  >
                    Effacer
                  </PetitBouton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PetitBouton({
  onClick,
  disabled,
  discret,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  discret?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
        discret
          ? "border-transparent text-ink-700 hover:text-red-300"
          : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
      }`}
    >
      {children}
    </button>
  );
}
