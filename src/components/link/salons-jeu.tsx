"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";

/**
 * Le câble link depuis la fiche d'un jeu : créer un salon, ou rejoindre celui
 * qu'un ami vient d'ouvrir.
 *
 * Les salons vivent dans le serveur, pas dans la base : ce composant les
 * demande au chargement, par une petite route servie avant Next.
 */

type Reponse = {
  enAttente: { id: string; hote: string; depuis: number }[];
  mien: { id: string; jeu: string; etat: string } | null;
  /** Salons qu'on peut encore ouvrir sur ce serveur ; null = pas de limite mesurée. */
  libres: number | null;
};

export function SalonsJeu({ jeuId, consoleSlug }: { jeuId: string; consoleSlug: string }) {
  const router = useRouter();
  const [salons, setSalons] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [prive, setPrive] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    let annule = false;
    fetch(`/link/salons?jeu=${encodeURIComponent(jeuId)}&console=${encodeURIComponent(consoleSlug)}`, {
      cache: "no-store",
    })
      .then(async (reponse) => {
        if (!reponse.ok) throw new Error();
        const corps = (await reponse.json()) as Reponse;
        if (!annule) setSalons(corps);
      })
      .catch(() => {
        // Le serveur du câble link n'est pas là (par exemple `next dev` seul) :
        // la fiche reste utilisable, la section se tait.
        if (!annule) setSalons(null);
      });
    return () => {
      annule = true;
    };
  }, [jeuId, consoleSlug]);

  async function creer() {
    setOccupe(true);
    setErreur(null);
    try {
      const reponse = await fetch("/link/salons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeu: jeuId, prive }),
      });
      const corps = (await reponse.json()) as { id?: string; erreur?: string };
      if (!reponse.ok || !corps.id) throw new Error(corps.erreur ?? "Impossible de créer le salon.");
      router.push(`/link/${corps.id}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de créer le salon.");
      setOccupe(false);
    }
  }

  /**
   * Rejoindre par le code : la page du salon fait le reste — elle dit si le
   * code ne correspond à rien, et la WebSocket refuse un salon complet.
   */
  function rejoindreParCode(evenement: React.FormEvent) {
    evenement.preventDefault();
    const propre = code.trim().toUpperCase();
    if (propre.length < 4) return;
    router.push(`/link/${encodeURIComponent(propre)}`);
  }

  if (!salons) return null;

  const mienIci = salons.mien && salons.mien.jeu === jeuId ? salons.mien : null;
  const autres = salons.enAttente.filter((salon) => salon.id !== mienIci?.id);
  const complet = salons.libres === 0;

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-ink-800 bg-ink-900/40 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ink-200">Câble link</h2>
        <p className="text-xs text-ink-400">
          Deux joueurs, deux navigateurs : le jeu tourne sur le serveur, chacun voit sa console.
          Échanges et combats comme avec un vrai câble.
        </p>
      </div>

      {erreur && <Alert tone="error">{erreur}</Alert>}

      {mienIci ? (
        <Button onClick={() => router.push(`/link/${mienIci.id}`)}>
          Reprendre mon salon {mienIci.id}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          {complet && (
            <Alert tone="info">
              Le serveur est au complet pour le moment : tous les salons sont pris. Réessaie dans
              quelques minutes, ou rejoins un salon déjà ouvert.
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void creer()} disabled={occupe || complet || Boolean(salons.mien)}>
              Ouvrir un salon
            </Button>
            <label className="flex items-center gap-2 text-xs text-ink-200">
              <input
                type="checkbox"
                className="size-4"
                checked={prive}
                onChange={(e) => setPrive(e.target.checked)}
                disabled={occupe || Boolean(salons.mien)}
              />
              Privé : invisible ici, on y entre avec le code
            </label>
            {salons.mien && (
              <span className="text-xs text-ink-400">
                Tu es déjà dans un salon sur un autre jeu ({salons.mien.id}).
              </span>
            )}
            {!salons.mien && salons.libres !== null && salons.libres > 0 && (
              <span className="text-xs text-ink-400">
                {salons.libres === 1 ? "Dernier salon disponible" : `${salons.libres} salons disponibles`} sur le
                serveur
              </span>
            )}
          </div>

          <form onSubmit={rejoindreParCode} className="flex flex-wrap items-center gap-2">
            <label htmlFor="code-salon" className="text-xs text-ink-400">
              Rejoindre avec un code
            </label>
            <input
              id="code-salon"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              disabled={Boolean(salons.mien)}
              className="w-28 rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-1.5 font-mono text-sm uppercase text-ink-50 placeholder:text-ink-700 focus:border-accent-500 focus:outline-none"
            />
            <Button type="submit" variant="ghost" disabled={code.trim().length < 4 || Boolean(salons.mien)}>
              Rejoindre
            </Button>
          </form>
        </div>
      )}

      {autres.length > 0 && (
        <ul className="flex flex-col gap-2">
          {autres.map((salon) => (
            <li key={salon.id} className="flex items-center gap-3 text-sm">
              <span className="text-ink-200">
                {salon.hote} attend dans le salon{" "}
                <span className="font-mono">{salon.id}</span>
              </span>
              <Button
                variant="ghost"
                onClick={() => router.push(`/link/${salon.id}`)}
                disabled={Boolean(salons.mien)}
              >
                Rejoindre
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
