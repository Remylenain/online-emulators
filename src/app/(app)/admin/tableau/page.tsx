import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guard";
import { tableauDeBord } from "@/lib/admin/tableau";
import { formatDate, formatDuree, formatTaille } from "@/lib/format";

export const metadata: Metadata = { title: "Tableau de bord" };
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
  const t = await tableauDeBord();
  const { capacite } = t.maintenant;
  const mesure = capacite.charges.gb !== null || capacite.charges.gba !== null;
  const occupation = capacite.budget > 0 ? Math.min(100, Math.round((capacite.enCours / capacite.budget) * 100)) : 0;
  const disque = t.stockage.disque;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-ink-50">Tableau de bord</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="En ce moment">
          {t.maintenant.joueurs.length === 0 ? (
            <Vide>Personne ne joue en solo.</Vide>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {t.maintenant.joueurs.map((joueur) => (
                <li key={joueur.pseudo} className="flex items-center gap-2 text-ink-200">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-400" />
                  <strong className="text-ink-50">{joueur.pseudo}</strong>
                  <span className="min-w-0 truncate">joue à {joueur.jeu}</span>
                  <Etiquette>{joueur.console}</Etiquette>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre="Câble link" lien={{ href: "/admin/reglages", libelle: "Réglages" }}>
          {t.maintenant.salons.length === 0 ? (
            <Vide>Aucun salon ouvert.</Vide>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {t.maintenant.salons.map((salon) => (
                <li key={salon.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-200">
                  <span className="font-mono text-ink-50">{salon.id}</span>
                  <span className="min-w-0 truncate">
                    {salon.jeu} — {salon.joueurs.join(" et ")}
                  </span>
                  <Etiquette>{salon.console}</Etiquette>
                  <Etiquette>{salon.etat === "attente" ? "en attente" : "en jeu"}</Etiquette>
                  {salon.prive && <Etiquette>privé</Etiquette>}
                  {salon.spectateurs !== null && (
                    <Etiquette>
                      {salon.spectateurs} spectateur{salon.spectateurs > 1 ? "s" : ""}
                    </Etiquette>
                  )}
                  <span className="text-xs text-ink-700">depuis {formatDate(new Date(salon.depuis))}</span>
                </li>
              ))}
            </ul>
          )}
          {mesure ? (
            <div className="flex flex-col gap-1">
              <div className="h-2 overflow-hidden rounded-full bg-ink-800" role="img" aria-label={`Occupation ${occupation} %`}>
                <div
                  className={`h-full rounded-full ${occupation >= 85 ? "bg-red-400" : "bg-accent-500"}`}
                  style={{ width: `${occupation}%` }}
                />
              </div>
              <p className="text-xs text-ink-400">
                {capacite.enCours.toFixed(2)} cœur pris sur {capacite.budget.toFixed(1)} réservés ({capacite.marge} % de{" "}
                {capacite.coeurs} cœurs) — encore {capacite.libres.gb ?? "∞"} salon
                {(capacite.libres.gb ?? 2) > 1 ? "s" : ""} GB / GBC ou {capacite.libres.gba ?? "∞"} GBA.
              </p>
            </div>
          ) : (
            <p className="text-xs text-ink-400">
              Capacité non mesurée : aucune limite de salons. Voir Réglages.
            </p>
          )}
        </Bloc>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre titre="Comptes" valeur={String(t.comptes.total)} detail={`${t.comptes.actifs7j} ont joué ces 7 jours`} href="/admin/comptes" />
        <Chiffre
          titre="Jeux publiés"
          valeur={String(t.jeux.publies)}
          detail={[
            ...t.jeux.parConsole.map((c) => `${c.total} ${c.console.toUpperCase()}`),
            t.jeux.officiels > 0 ? `${t.jeux.officiels} officiels` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          href="/admin/bibliotheque"
        />
        <Chiffre
          titre="Temps de jeu"
          valeur={formatDuree(t.temps.septJours)}
          detail={`ces 7 jours · ${formatDuree(t.temps.aujourdhui)} aujourd'hui · ${formatDuree(t.temps.total)} en tout`}
          href="/admin/temps"
        />
        <Chiffre
          titre="Sauvegardes"
          valeur={formatTaille(t.stockage.sauvegardes.octets + t.stockage.copies.octets + t.stockage.etats.octets)}
          detail={`${t.stockage.sauvegardes.nombre} parties · ${t.stockage.copies.nombre} copies · ${t.stockage.etats.nombre} points de reprise`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Dernières connexions" lien={{ href: "/admin/comptes", libelle: "Comptes" }}>
          {t.comptes.connexions.length === 0 ? (
            <Vide>Aucune session.</Vide>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {t.comptes.connexions.map((connexion, index) => (
                <li key={index} className="flex flex-wrap items-baseline gap-x-2 text-ink-200">
                  <strong className="text-ink-50">{connexion.pseudo}</strong>
                  <span className="text-xs text-ink-400">{formatDate(connexion.quand)}</span>
                  <span className="text-xs text-ink-700">{connexion.appareil}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre="Serveur et bibliothèque" lien={{ href: "/admin/bibliotheque", libelle: "Bibliothèque" }}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-400">Service</dt>
            <dd className="text-ink-50">
              démarré le {formatDate(new Date(t.serveur.depuis))} · {formatTaille(t.serveur.memoire)} de mémoire · Node{" "}
              {t.serveur.node}
            </dd>
            <dt className="text-ink-400">Charge</dt>
            <dd className="text-ink-50">
              {t.serveur.charge.map((c) => c.toFixed(2)).join(" · ")} sur {t.serveur.coeurs} cœurs
              <span className="text-ink-700"> (1, 5 et 15 min)</span>
            </dd>
            {disque && (
              <>
                <dt className="text-ink-400">Disque</dt>
                <dd className="text-ink-50">
                  {formatTaille(disque.libre)} libres sur {formatTaille(disque.total)}
                </dd>
              </>
            )}
            <dt className="text-ink-400">Catalogue</dt>
            <dd className="text-ink-50">
              {t.jeux.sansJaquette} jeu{t.jeux.sansJaquette > 1 ? "x" : ""} sans jaquette · {t.jeux.depublies} dépublié
              {t.jeux.depublies > 1 ? "s" : ""}
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
