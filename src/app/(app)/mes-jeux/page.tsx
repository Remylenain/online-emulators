import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { formatDate, formatDuree } from "@/lib/format";
import { GameGrid } from "@/components/game-grid";
import { favorisDe } from "@/lib/catalog";
import { mesNotes, mesSauvegardes, tempsDeJeu } from "@/lib/mes-jeux";
import { LigneJeu } from "./ligne-jeu";
import { Sauvegardes } from "./sauvegardes";

export const metadata: Metadata = { title: "Mes jeux" };

const ONGLETS = [
  { cle: "temps", libelle: "Temps de jeu" },
  { cle: "favoris", libelle: "Favoris" },
  { cle: "notes", libelle: "Mes notes" },
  { cle: "sauvegardes", libelle: "Sauvegardes" },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/**
 * Ce que le compte a fait sur le site, en trois volets.
 *
 * Les onglets sont des liens : la page reste rendue côté serveur, et une
 * adresse se partage ou se met en favori — « /mes-jeux?onglet=sauvegardes ».
 */
export default async function MesJeuxPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const user = await requireUser();
  const { onglet: demande } = await searchParams;
  const onglet: Onglet = ONGLETS.some((o) => o.cle === demande) ? (demande as Onglet) : "temps";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-50">Mes jeux</h1>

      <nav className="flex gap-1 border-b border-ink-800" aria-label="Mes jeux">
        {ONGLETS.map((o) => (
          <Link
            key={o.cle}
            href={o.cle === "temps" ? "/mes-jeux" : `/mes-jeux?onglet=${o.cle}`}
            aria-current={o.cle === onglet ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              o.cle === onglet
                ? "border-accent-500 text-ink-50"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            {o.libelle}
          </Link>
        ))}
      </nav>

      {onglet === "temps" && <Temps visiteur={user} />}
      {onglet === "favoris" && <Favoris visiteur={user} />}
      {onglet === "notes" && <Notes visiteur={user} />}
      {onglet === "sauvegardes" && <Sauvegardes sauvegardes={await mesSauvegardes(user.id)} />}
    </div>
  );
}

async function Favoris({ visiteur }: { visiteur: SessionUser }) {
  const jeux = await favorisDe(visiteur);
  if (jeux.length === 0) {
    return <Vide>Aucun favori pour l&apos;instant. L&apos;étoile est sur la fiche de chaque jeu.</Vide>;
  }
  return <GameGrid games={jeux} />;
}

async function Temps({ visiteur }: { visiteur: SessionUser }) {
  const lignes = await tempsDeJeu(visiteur);
  if (lignes.length === 0) return <Vide>Tu n&apos;as encore lancé aucun jeu.</Vide>;

  const total = lignes.reduce((somme, l) => somme + l.secondes, 0);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-ink-400">
        {formatDuree(total)} de jeu en tout, sur {lignes.length} jeu{lignes.length > 1 ? "x" : ""}.
      </p>
      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {lignes.map((l) => (
          <li key={l.jeu.id}>
            <LigneJeu jeu={l.jeu}>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-medium text-ink-50">{formatDuree(l.secondes)}</span>
                <span className="block text-xs text-ink-700">
                  {l.parties} partie{l.parties > 1 ? "s" : ""} · dernière le {formatDate(l.derniere, false)}
                </span>
              </span>
            </LigneJeu>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Notes({ visiteur }: { visiteur: SessionUser }) {
  const lignes = await mesNotes(visiteur);
  if (lignes.length === 0) {
    return <Vide>Tu n&apos;as noté aucun jeu. Les notes se donnent sur la fiche de chaque jeu.</Vide>;
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-ink-400">Tes jeux notés, les préférés en premier.</p>
      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {lignes.map((l) => (
          <li key={l.jeu.id}>
            <LigneJeu jeu={l.jeu}>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-medium text-accent-400" aria-label={`${l.score} sur 5`}>
                  {"★".repeat(l.score)}
                  <span className="text-ink-800">{"★".repeat(5 - l.score)}</span>
                </span>
                <span className="block text-xs text-ink-700">noté le {formatDate(l.noteLe, false)}</span>
              </span>
            </LigneJeu>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Vide({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-panel border border-dashed border-ink-800 px-4 py-8 text-center text-sm text-ink-400">
      {children}
    </p>
  );
}
