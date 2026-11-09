import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guard";
import { tableauDeBord } from "@/lib/admin/tableau";
import { formatDate, formatDuree, formatTaille } from "@/lib/format";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await textes()).adminGeneral.tableau.titre };
}
// Tout ici décrit l'instant : rien ne doit sortir d'un cache.
export const dynamic = "force-dynamic";

/**
 * Le tableau de bord : d'abord ce qui se passe maintenant — qui joue, quels
 * salons tournent, ce qu'il reste de place au câble link — puis l'état du
 * site. Il se lit, il ne se règle pas : chaque bloc renvoie à la page où
 * l'on agit.
 */
export default async function TableauPage() {
  await requireAdmin();
  const langue = await langueDeLaRequete();
  const { onglets, tableau: t } = (await textes()).adminGeneral;
  const tableau = await tableauDeBord();
  const { capacite } = tableau.maintenant;
  const mesure = capacite.charges.gb !== null || capacite.charges.gba !== null;
  const occupation = capacite.budget > 0 ? Math.min(100, Math.round((capacite.enCours / capacite.budget) * 100)) : 0;
  const disque = tableau.stockage.disque;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre={t.maintenant.titre}>
          {tableau.maintenant.joueurs.length === 0 ? (
            <Vide>{t.maintenant.personne}</Vide>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {tableau.maintenant.joueurs.map((joueur) => (
                <li key={joueur.pseudo} className="flex items-center gap-2 text-ink-200">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-400" />
                  <strong className="text-ink-50">{joueur.pseudo}</strong>
                  <span className="min-w-0 truncate">{t.maintenant.joueA(joueur.jeu)}</span>
                  <Etiquette>{joueur.console}</Etiquette>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre={t.link.titre} lien={{ href: "/admin/reglages", libelle: onglets.reglages }}>
          {tableau.maintenant.salons.length === 0 ? (
            <Vide>{t.link.aucunSalon}</Vide>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {tableau.maintenant.salons.map((salon) => (
                <li key={salon.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-200">
                  <span className="font-mono text-ink-50">{salon.id}</span>
                  <span className="min-w-0 truncate">{t.link.salon(salon.jeu, salon.joueurs)}</span>
                  <Etiquette>{salon.console}</Etiquette>
                  <Etiquette>{salon.etat === "attente" ? t.link.enAttente : t.link.enJeu}</Etiquette>
                  {salon.prive && <Etiquette>{t.link.prive}</Etiquette>}
                  {salon.spectateurs !== null && <Etiquette>{t.link.spectateurs(salon.spectateurs)}</Etiquette>}
                  <span className="text-xs text-ink-700">
                    {t.link.depuis(formatDate(new Date(salon.depuis), true, langue))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {mesure ? (
            <div className="flex flex-col gap-1">
              <div className="h-2 overflow-hidden rounded-full bg-ink-800" role="img" aria-label={t.link.occupation(occupation)}>
                <div
                  className={`h-full rounded-full ${occupation >= 85 ? "bg-red-400" : "bg-accent-500"}`}
                  style={{ width: `${occupation}%` }}
                />
              </div>
              <p className="text-xs text-ink-400">
                {t.link.capacite({
                  enCours: capacite.enCours,
                  budget: capacite.budget,
                  marge: capacite.marge,
                  coeurs: capacite.coeurs,
                  gb: capacite.libres.gb,
                  gba: capacite.libres.gba,
                })}
              </p>
            </div>
          ) : (
            <p className="text-xs text-ink-400">{t.link.nonMesuree}</p>
          )}
        </Bloc>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre
          titre={t.comptes.titre}
          valeur={String(tableau.comptes.total)}
          detail={t.comptes.actifs(tableau.comptes.actifs7j)}
          href="/admin/comptes"
        />
        <Chiffre
          titre={t.jeux.titre}
          valeur={String(tableau.jeux.publies)}
          detail={[
            ...tableau.jeux.parConsole.map((c) => `${c.total} ${c.console.toUpperCase()}`),
            tableau.jeux.officiels > 0 ? t.jeux.officiels(tableau.jeux.officiels) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          href="/admin/bibliotheque"
        />
        <Chiffre
          titre={t.temps.titre}
          valeur={formatDuree(tableau.temps.septJours, langue)}
          detail={t.temps.detail(formatDuree(tableau.temps.aujourdhui, langue), formatDuree(tableau.temps.total, langue))}
          href="/admin/temps"
        />
        <Chiffre
          titre={t.sauvegardes.titre}
          valeur={formatTaille(
            tableau.stockage.sauvegardes.octets + tableau.stockage.copies.octets + tableau.stockage.etats.octets,
            langue,
          )}
          detail={t.sauvegardes.detail(
            tableau.stockage.sauvegardes.nombre,
            tableau.stockage.copies.nombre,
            tableau.stockage.etats.nombre,
          )}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre={t.connexions.titre} lien={{ href: "/admin/comptes", libelle: onglets.comptes }}>
          {tableau.comptes.connexions.length === 0 ? (
            <Vide>{t.connexions.aucune}</Vide>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {tableau.comptes.connexions.map((connexion, index) => (
                <li key={index} className="flex flex-wrap items-baseline gap-x-2 text-ink-200">
                  <strong className="text-ink-50">{connexion.pseudo}</strong>
                  <span className="text-xs text-ink-400">{formatDate(connexion.quand, true, langue)}</span>
                  <span className="text-xs text-ink-700">{connexion.appareil}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre={t.serveur.titre} lien={{ href: "/admin/bibliotheque", libelle: onglets.bibliotheque }}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-400">{t.serveur.service}</dt>
            <dd className="text-ink-50">
              {t.serveur.demarre(
                formatDate(new Date(tableau.serveur.depuis), true, langue),
                formatTaille(tableau.serveur.memoire, langue),
                tableau.serveur.node,
              )}
            </dd>
            <dt className="text-ink-400">{t.serveur.charge}</dt>
            <dd className="text-ink-50">
              {t.serveur.chargeSur(tableau.serveur.charge.map((c) => c.toFixed(2)).join(" · "), tableau.serveur.coeurs)}
              <span className="text-ink-700"> {t.serveur.periodes}</span>
            </dd>
            {disque && (
              <>
                <dt className="text-ink-400">{t.serveur.disque}</dt>
                <dd className="text-ink-50">
                  {t.serveur.disqueLibre(formatTaille(disque.libre, langue), formatTaille(disque.total, langue))}
                </dd>
              </>
            )}
            <dt className="text-ink-400">{t.serveur.catalogue}</dt>
            <dd className="text-ink-50">
              {t.serveur.etatDuCatalogue(tableau.jeux.sansJaquette, tableau.jeux.depublies)}
            </dd>
          </dl>
        </Bloc>
      </div>
    </section>
  );
}

function Bloc({
  titre,
  lien,
  children,
}: {
  titre: string;
  lien?: { href: string; libelle: string };
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-ink-800 bg-ink-900/40 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-200">{titre}</h3>
        {lien && (
          <Link href={lien.href} className="text-xs text-ink-400 hover:text-ink-50">
            {lien.libelle} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Chiffre({ titre, valeur, detail, href }: { titre: string; valeur: string; detail: string; href?: string }) {
  const contenu = (
    <>
      <span className="text-xs text-ink-400">{titre}</span>
      <span className="text-2xl font-semibold text-ink-50">{valeur}</span>
      <span className="text-xs text-ink-700">{detail}</span>
    </>
  );
  const classes = "flex flex-col gap-1 rounded-panel border border-ink-800 bg-ink-900/40 p-4";
  return href ? (
    <Link href={href} className={`${classes} transition-colors hover:border-ink-700`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-ink-400">
      {children}
    </span>
  );
}

function Vide({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-700">{children}</p>;
}
