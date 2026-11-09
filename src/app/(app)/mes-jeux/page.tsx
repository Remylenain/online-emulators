import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { formatDate, formatDuree } from "@/lib/format";
import { GameGrid } from "@/components/game-grid";
import { favorisDe } from "@/lib/catalog";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";
import { mesNotes, mesSauvegardes, tempsDeJeu } from "@/lib/mes-jeux";
import { LigneJeu } from "./ligne-jeu";
import { Sauvegardes } from "./sauvegardes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await textes()).mesJeux.titre };
}

/** Les onglets, dans l'ordre ; leurs libellés sont dans `t.mesJeux.onglets`. */
const ONGLETS = ["temps", "favoris", "notes", "sauvegardes"] as const;

type Onglet = (typeof ONGLETS)[number];

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
  const t = await textes();
  const { onglet: demande } = await searchParams;
  const onglet: Onglet = ONGLETS.some((cle) => cle === demande) ? (demande as Onglet) : "temps";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-50">{t.mesJeux.titre}</h1>

      <nav className="flex gap-1 border-b border-ink-800" aria-label={t.mesJeux.titre}>
        {ONGLETS.map((cle) => (
          <Link
            key={cle}
            href={cle === "temps" ? "/mes-jeux" : `/mes-jeux?onglet=${cle}`}
            aria-current={cle === onglet ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              cle === onglet
                ? "border-accent-500 text-ink-50"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            {t.mesJeux.onglets[cle]}
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
  if (jeux.length === 0) return <Vide>{(await textes()).mesJeux.favoris.vide}</Vide>;
  return <GameGrid games={jeux} />;
}

async function Temps({ visiteur }: { visiteur: SessionUser }) {
  const [t, langue] = await Promise.all([textes(), langueDeLaRequete()]);
  const lignes = await tempsDeJeu(visiteur);
  if (lignes.length === 0) return <Vide>{t.mesJeux.temps.vide}</Vide>;

  const total = lignes.reduce((somme, l) => somme + l.secondes, 0);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-ink-400">
        {t.mesJeux.temps.total(formatDuree(total, langue), lignes.length)}
      </p>
      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {lignes.map((l) => (
          <li key={l.jeu.id}>
            <LigneJeu jeu={l.jeu}>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-medium text-ink-50">
                  {formatDuree(l.secondes, langue)}
                </span>
                <span className="block text-xs text-ink-700">
                  {t.mesJeux.temps.parties(l.parties, formatDate(l.derniere, false, langue))}
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
  const [t, langue] = await Promise.all([textes(), langueDeLaRequete()]);
  const lignes = await mesNotes(visiteur);
  if (lignes.length === 0) return <Vide>{t.mesJeux.notes.vide}</Vide>;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-ink-400">{t.mesJeux.notes.explication}</p>
      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {lignes.map((l) => (
          <li key={l.jeu.id}>
            <LigneJeu jeu={l.jeu}>
              <span className="shrink-0 text-right">
                <span
                  className="block text-sm font-medium text-accent-400"
                  aria-label={t.mesJeux.notes.sur5(l.score)}
                >
                  {"★".repeat(l.score)}
                  <span className="text-ink-800">{"★".repeat(5 - l.score)}</span>
                </span>
                <span className="block text-xs text-ink-700">
                  {t.mesJeux.notes.noteLe(formatDate(l.noteLe, false, langue))}
                </span>
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
