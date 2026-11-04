import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { formatDate, formatDuree } from "@/lib/format";
import { tempsDeJeu, tempsParCompte } from "@/lib/mes-jeux";
import { LigneJeu } from "../../mes-jeux/ligne-jeu";

export const metadata: Metadata = { title: "Temps de jeu" };

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
  const { compte } = await searchParams;
  const comptes = await tempsParCompte();
  const choisi = comptes.find((c) => c.id === compte) ?? null;
  const total = comptes.reduce((somme, c) => somme + c.secondes, 0);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">Temps de jeu</h2>
      <p className="text-sm text-ink-400">
        {formatDuree(total)} de jeu en tout, sur {comptes.length} compte{comptes.length > 1 ? "s" : ""}.
        Le temps est compté par battements pendant qu&apos;un jeu tourne, plafonnés à cinq
        minutes : un onglet oublié ne gonfle pas les chiffres.
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
                      {c.derniere === null
                        ? "n'a jamais joué"
                        : `${c.jeux} jeu${c.jeux > 1 ? "x" : ""} · vu le ${formatDate(c.derniere, false)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-200">
                    {c.derniere === null ? "—" : formatDuree(c.secondes)}
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
            Choisis un compte pour voir son détail par jeu.
          </p>
        )}
      </div>
    </section>
  );
}

async function Detail({ id, pseudo }: { id: string; pseudo: string }) {
  const lignes = await tempsDeJeu(id);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink-200">{pseudo}, jeu par jeu</h3>
      {lignes.length === 0 ? (
        <p className="text-sm text-ink-400">Aucune partie enregistrée.</p>
      ) : (
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
      )}
    </div>
  );
}
