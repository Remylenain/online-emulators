"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvecCode } from "@/components/link/code-salon";
import { useT } from "@/components/langue";
import { Alert, Button } from "@/components/ui";
import type { Refus } from "@/lib/link/protocole";
import { texteErreurLink } from "@/lib/link/textes";

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
  /** Parties en cours ouvertes aux spectateurs. */
  regardables: { id: string; joueurs: [string, string]; spectateurs: number; max: number }[];
};

export function SalonsJeu({ jeuId, consoleSlug }: { jeuId: string; consoleSlug: string }) {
  const router = useRouter();
  const t = useT();
  const [salons, setSalons] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [prive, setPrive] = useState(false);
  const [spectateurs, setSpectateurs] = useState(false);
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
        body: JSON.stringify({ jeu: jeuId, prive, spectateurs }),
      });
      const corps = (await reponse.json()) as { id?: string } & Partial<Refus>;
      if (!reponse.ok || !corps.id) {
        // Le refus arrive avec son code : c'est lui qui donne le texte dans la
        // langue du joueur, le texte français du serveur ne servant que de repli.
        setErreur(texteErreurLink(t, corps, corps.erreur ?? t.link.fiche.creationImpossible));
        setOccupe(false);
        return;
      }
      router.push(`/link/${corps.id}`);
    } catch {
      // Pas de réponse, ou une réponse qui n'est pas du JSON.
      setErreur(t.link.fiche.creationImpossible);
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
        <h2 className="text-sm font-semibold text-ink-200">{t.link.titre}</h2>
        <p className="text-xs text-ink-400">{t.link.fiche.explication}</p>
      </div>

      {erreur && <Alert tone="error">{erreur}</Alert>}

      {mienIci ? (
        <Button onClick={() => router.push(`/link/${mienIci.id}`)}>{t.link.fiche.reprendre(mienIci.id)}</Button>
      ) : (
        <div className="flex flex-col gap-3">
          {complet && <Alert tone="info">{t.link.fiche.complet}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void creer()} disabled={occupe || complet || Boolean(salons.mien)}>
              {t.link.fiche.ouvrir}
            </Button>
            <label className="flex items-center gap-2 text-xs text-ink-200">
              <input
                type="checkbox"
                className="size-4"
                checked={prive}
                onChange={(e) => setPrive(e.target.checked)}
                disabled={occupe || Boolean(salons.mien)}
              />
              {t.link.fiche.prive}
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-200">
              <input
                type="checkbox"
                className="size-4"
                checked={spectateurs}
                onChange={(e) => setSpectateurs(e.target.checked)}
                disabled={occupe || Boolean(salons.mien)}
              />
              {t.link.fiche.spectateurs}
            </label>
            {salons.mien && (
              <span className="text-xs text-ink-400">{t.link.fiche.dejaAilleurs(salons.mien.id)}</span>
            )}
            {!salons.mien && salons.libres !== null && salons.libres > 0 && (
              <span className="text-xs text-ink-400">{t.link.fiche.disponibles(salons.libres)}</span>
            )}
          </div>

          <form onSubmit={rejoindreParCode} className="flex flex-wrap items-center gap-2">
            <label htmlFor="code-salon" className="text-xs text-ink-400">
              {t.link.fiche.rejoindreAvecUnCode}
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
              {t.link.fiche.rejoindre}
            </Button>
          </form>
        </div>
      )}

      {salons.regardables.length > 0 && (
        <ul className="flex flex-col gap-2">
          {salons.regardables.map((salon) => (
            <li key={salon.id} className="flex items-center gap-3 text-sm">
              <span className="text-ink-200">
                {t.link.fiche.enCours(salon.joueurs[0], salon.joueurs[1])}
                <span className="ml-2 text-xs text-ink-400">{t.link.fiche.places(salon.spectateurs, salon.max)}</span>
              </span>
              <Button
                variant="ghost"
                onClick={() => router.push(`/link/${salon.id}`)}
                disabled={salon.spectateurs >= salon.max}
              >
                {t.link.fiche.regarder}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {autres.length > 0 && (
        <ul className="flex flex-col gap-2">
          {autres.map((salon) => (
            <li key={salon.id} className="flex items-center gap-3 text-sm">
              <span className="text-ink-200">
                <AvecCode texte={t.link.fiche.attend(salon.hote, salon.id)} />
              </span>
              <Button
                variant="ghost"
                onClick={() => router.push(`/link/${salon.id}`)}
                disabled={Boolean(salons.mien)}
              >
                {t.link.fiche.rejoindre}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
