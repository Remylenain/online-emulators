"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
 * Où et comment parler au serveur. Le site passe par ses routes et son
 * cookie ; l'Activité Discord par les siennes et son jeton — dans l'en-tête,
 * et dans l'adresse de la vignette, qu'une balise `<img>` charge sans en-tête.
 */
export type AccesEtats = {
  liste: string;
  emplacement: (segment: string) => string;
  vignette: (segment: string, version: number) => string;
  /** Où déposer une image de l'écran après la capture, quand l'état n'en porte pas. */
  vignetteEcriture?: (segment: string) => string;
  entetes?: Record<string, string>;
  /**
   * Par où passent les requêtes : le réseau par défaut. Un invité de la
   * vitrine donne un `fetch` qui répond depuis son navigateur
   * (`src/lib/invite/stockage.ts`).
   */
  requete?: typeof fetch;
};

function accesDuSite(gameId: string): AccesEtats {
  return {
    liste: `/api/state/${gameId}`,
    emplacement: (seg) => `/api/state/${gameId}/${seg}`,
    vignette: (seg, version) => `/api/state/${gameId}/${seg}?v=${version}`,
  };
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
  surVignette,
  acces: accesDonne,
  autos = true,
}: {
  gameId: string;
  surEcrire: () => Uint8Array | null;
  surLire: (donnees: Uint8Array) => boolean;
  /** L'image de l'écran au moment de la capture, pour un cœur dont l'état n'en porte pas. */
  surVignette?: () => Promise<Blob | null>;
  /** À défaut, les routes du site. */
  acces?: AccesEtats;
  /** Montrer la série automatique ; l'Activité Discord n'en tient pas. */
  autos?: boolean;
}) {
  const acces = useMemo(() => accesDonne ?? accesDuSite(gameId), [accesDonne, gameId]);
  const requete = acces.requete ?? fetch;
  const [etats, setEtats] = useState<EtatResume[]>([]);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const rafraichir = useCallback(async () => {
    try {
      const reponse = await requete(acces.liste, { cache: "no-store", headers: acces.entetes });
      if (!reponse.ok) return;
      setEtats((await reponse.json()).etats);
    } catch {
      // Sans liste, les emplacements s'affichent vides : le joueur peut quand
      // même en créer, ce qui remettra la liste à jour.
    }
  }, [acces, requete]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  const envoyer = useCallback(
    async (emplacement: number, auto: boolean) => {
      const donnees = surEcrire();
      if (!donnees) return false;
      const reponse = await requete(acces.emplacement(segment(emplacement, auto)), {
        method: "PUT",
        headers: { ...acces.entetes, "Content-Type": "application/octet-stream" },
        body: new Uint8Array(donnees),
      });
      if (!reponse.ok) return false;

      // La vignette ensuite, à part : sans elle, l'emplacement reste valable,
      // seulement sans image.
      if (acces.vignetteEcriture && surVignette) {
        const image = await surVignette();
        if (image) {
          await requete(acces.vignetteEcriture(segment(emplacement, auto)), {
            method: "PUT",
            headers: { ...acces.entetes, "Content-Type": "image/png" },
            body: image,
          }).catch(() => undefined);
        }
      }
      return true;
    },
    [acces, requete, surEcrire, surVignette],
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
      const reponse = await requete(acces.emplacement(cle), { cache: "no-store", headers: acces.entetes });
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
      await requete(acces.emplacement(cle), { method: "DELETE", headers: acces.entetes });
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
        acces={acces}
        version={version}
        surCapturer={capturer}
        surReprendre={reprendre}
        surEffacer={effacer}
      />

      {autos && (
        <Serie
          titre="Reprises automatiques"
          explication="Une toutes les deux minutes, en roulement sur cinq emplacements : de quoi revenir dix minutes en arrière."
          auto
          etats={etats}
          occupe={occupe}
          acces={acces}
          version={version}
          surReprendre={reprendre}
        />
      )}

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
  acces,
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
  acces: AccesEtats;
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
                    src={acces.vignette(segment(emplacement, auto), version)}
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
