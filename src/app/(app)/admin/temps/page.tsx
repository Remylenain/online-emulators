import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { formatDate, formatDuree } from "@/lib/format";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";
import { tempsDeJeu, tempsParCompte } from "@/lib/mes-jeux";
import { LigneJeu } from "../../mes-jeux/ligne-jeu";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await textes()).adminGeneral.temps.titre };
}

/**
 * Qui joue, et combien : chaque compte avec son total, et sur demande le
 * détail par jeu — la même vue que « Mes jeux », vue depuis l'administration.
 */
export default async function TempsPage({
  searchParams,
}: {
  searchParams: Promise<{ compte?: string }>;
}) {
  await requireAdmin();
  const langue = await langueDeLaRequete();
  const t = (await textes()).adminGeneral.temps;
  const { compte } = await searchParams;
  const comptes = await tempsParCompte();
  const choisi = comptes.find((c) => c.id === compte) ?? null;
  const total = comptes.reduce((somme, c) => somme + c.secondes, 0);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>
      <p className="text-sm text-ink-400">
        {t.resume(formatDuree(total, langue), comptes.length)} {t.explication}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="flex flex-col divide-y divide-ink-800 self-start overflow-hidden rounded-panel border border-ink-800">
          {comptes.map((c) => {
            const actif = choisi?.id === c.id;
            return (
              <li key={c.id}>
                <Link
                  href={actif ? "/admin/temps" : `/admin/temps?compte=${c.id}`}
                  aria-current={actif ? "true" : undefined}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                    actif ? "bg-ink-800/70" : "bg-ink-900/40 hover:bg-ink-800/60"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-50">{c.pseudo}</span>
                    <span className="block text-xs text-ink-700">
                      {c.derniere === null ? t.jamaisJoue : t.compte(c.jeux, formatDate(c.derniere, false, langue))}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-200">
                    {c.derniere === null ? "—" : formatDuree(c.secondes, langue)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {choisi ? (
          <Detail id={choisi.id} pseudo={choisi.pseudo} />
        ) : (
          <p className="self-start rounded-panel border border-dashed border-ink-800 px-4 py-8 text-center text-sm text-ink-400">
            {t.choisir}
          </p>
        )}
      </div>
    </section>
  );
}

async function Detail({ id, pseudo }: { id: string; pseudo: string }) {
  // Vue d'administration : tout le catalogue, quel que soit le mode du compte.
  const lignes = await tempsDeJeu({ id, accessMode: "normal" });
  const langue = await langueDeLaRequete();
  const t = (await textes()).adminGeneral.temps;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink-200">{t.detail(pseudo)}</h3>
      {lignes.length === 0 ? (
        <p className="text-sm text-ink-400">{t.aucunePartie}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
          {lignes.map((l) => (
            <li key={l.jeu.id}>
              <LigneJeu jeu={l.jeu}>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium text-ink-50">{formatDuree(l.secondes, langue)}</span>
                  <span className="block text-xs text-ink-700">
                    {t.ligne(l.parties, formatDate(l.derniere, false, langue))}
                  </span>
                </span>
              </LigneJeu>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
