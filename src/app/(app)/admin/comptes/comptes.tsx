"use client";

import { useActionState, useState, useTransition } from "react";
import {
  basculerActivation,
  basculerAdministration,
  creerCompte,
  creerInvitation,
  definirInscriptions,
  definirJeuxAttribues,
  definirModeAcces,
  importerSauvegarde,
  reinitialiserMotDePasse,
  remettreAZero,
  renvoyerInvitation,
  revoquerInvitation,
  voirLeSiteComme,
  type Resultat,
} from "@/lib/admin/actions";
import { MODES_ACCES, type ModeAcces } from "@/lib/modes-acces";
import { INSCRIPTION_PLAFONDS } from "@/lib/auth/inscription";
import type { LienInscription } from "@/lib/auth/invitations";
import { formatDate } from "@/lib/format";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

export type Compte = {
  id: string;
  pseudo: string;
  email: string | null;
  role: string;
  isActive: boolean;
  accessMode: ModeAcces;
  createdAt: Date;
  parties: number;
  /** Jeux attribués, pour un compte restreint ou testeur. */
  jeux: string[];
};

/**
 * Gestion des comptes.
 *
 * L'inscription est fermée : c'est ici que naissent les comptes des amis, et
 * ici seulement. Le mot de passe est tiré au hasard et affiché **une seule
 * fois** — il n'est écrit nulle part ailleurs, pas même dans un journal.
 */
export type JeuImportable = { id: string; titre: string; console: string; publie: boolean };

export function Comptes({
  comptes,
  moi,
  jeux,
  liens,
  inscriptions,
}: {
  comptes: Compte[];
  moi: string;
  jeux: JeuImportable[];
  liens: LienInscription[];
  inscriptions: { ouvertes: boolean; ouvrables: boolean };
}) {
  const [importPour, setImportPour] = useState<string | null>(null);
  const [attribuerPour, setAttribuerPour] = useState<string | null>(null);
  const [plafond, setPlafond] = useState<number>(1);
  const [creation, action, enCreation] = useActionState<Resultat | null, FormData>(
    creerCompte,
    null,
  );
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();

  function agir(operation: () => Promise<Resultat>) {
    demarrer(async () => setRetour(await operation()));
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">Comptes</h2>

      <Panel>
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">Créer un compte</h3>

          {creation && (
            <Alert tone={creation.ok ? "success" : "error"}>{creation.message}</Alert>
          )}
          {creation?.ok && <Acces resultat={creation} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pseudo" htmlFor="pseudo">
              <Input id="pseudo" name="pseudo" required autoComplete="off" />
            </Field>
            <Field label="Adresse e-mail (facultative)" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="off" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" name="admin" className="size-4" />
            Administrateur
          </label>

          <Button type="submit" disabled={enCreation} className="self-start">
            {enCreation ? "Création…" : "Créer le compte"}
          </Button>
        </form>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink-200">Ou laisser les gens s&apos;inscrire</h3>
          <p className="text-xs text-ink-400">
            Un lien à donner : chacun y choisit son pseudo et son mot de passe. Il expire au bout
            de 24 heures et vaut pour le nombre de comptes choisi ici. Qui a le lien peut créer
            un compte : s&apos;il circule trop, révoque-le, les comptes qu&apos;il a donnés sont
            listés dessous.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-200">
              Pour
              <select
                value={plafond}
                onChange={(e) => setPlafond(Number(e.target.value))}
                className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm text-ink-200"
                aria-label="Nombre de comptes"
              >
                {INSCRIPTION_PLAFONDS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "un seul compte" : `${n} comptes au plus`}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => agir(() => creerInvitation(plafond))}
              disabled={enCours}
            >
              Créer un lien d&apos;inscription
            </Button>
          </div>

          {liens.length > 0 && (
            <ul className="flex flex-col divide-y divide-ink-800 rounded-lg border border-ink-800">
              {liens.map((lien) => (
                <LigneLien
                  key={lien.id}
                  lien={lien}
                  occupe={enCours}
                  surRevocation={() => agir(() => revoquerInvitation(lien.id))}
                />
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink-200">Inscriptions</h3>
          <p className="text-xs text-ink-400">
            Fermées, un compte ne naît que d&apos;une invitation. Ouvertes, n&apos;importe qui peut
            s&apos;inscrire avec une adresse e-mail confirmée, derrière un captcha — et accéder à
            tout le catalogue.
          </p>
          {!inscriptions.ouvrables && (
            <Alert tone="info">
              L&apos;ouverture demande un serveur de mail (SMTP) et un captcha Turnstile configurés
              dans l&apos;environnement du serveur. Sans eux, les inscriptions restent fermées.
            </Alert>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-ink-200">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="inscriptions"
                className="size-4"
                checked={!inscriptions.ouvertes}
                disabled={enCours}
                onChange={() => agir(() => definirInscriptions(false))}
              />
              Fermées, sur invitation
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="inscriptions"
                className="size-4"
                checked={inscriptions.ouvertes}
                disabled={enCours || !inscriptions.ouvrables}
                onChange={() => agir(() => definirInscriptions(true))}
              />
              Ouvertes à tous, avec e-mail confirmé et captcha
            </label>
          </div>
        </div>
      </Panel>

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
      {retour?.ok && <Acces resultat={retour} />}

      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {comptes.map((compte) => (
          <li
            key={compte.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-900/40 px-4 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink-50">
                  {compte.pseudo}
                </span>
                {compte.role === "ADMIN" && (
                  <span className="rounded border border-accent-600/50 px-1.5 py-0.5 text-[10px] text-accent-400">
                    admin
                  </span>
                )}
                {!compte.isActive && (
                  <span className="rounded border border-red-900 px-1.5 py-0.5 text-[10px] text-red-300">
                    désactivé
                  </span>
                )}
                {compte.accessMode !== "normal" && (
                  <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-400">
                    {compte.accessMode === "restreint" ? "restreint" : "testeur"} · {compte.jeux.length} jeu
                    {compte.jeux.length > 1 ? "x" : ""}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-ink-700">
                {compte.email ?? "sans adresse e-mail"} · {compte.parties} partie
                {compte.parties > 1 ? "s" : ""} sauvegardée
                {compte.parties > 1 ? "s" : ""}
              </span>
              {/* L'identifiant est le nom du dossier du compte dans `saves/` et
                  `states/` sur le serveur : c'est par lui qu'on retrouve ses
                  fichiers. `select-all` le sélectionne d'un clic. */}
              <span
                className="block truncate font-mono text-[11px] text-ink-700 select-all"
                title="Nom du dossier de ses sauvegardes sur le serveur"
              >
                {compte.id}
              </span>
            </span>

            <div className="flex flex-wrap items-center gap-1">
              <select
                value={compte.accessMode}
                onChange={(e) => agir(() => definirModeAcces(compte.id, e.target.value))}
                disabled={enCours}
                aria-label="Accès au catalogue"
                title="Ce que le compte voit du catalogue"
                className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-200"
              >
                {MODES_ACCES.map((m) => (
                  <option key={m.valeur} value={m.valeur}>
                    Accès {m.libelle.toLowerCase()}
                  </option>
                ))}
              </select>
              {compte.accessMode !== "normal" && (
                <Petit
                  onClick={() => setAttribuerPour(attribuerPour === compte.id ? null : compte.id)}
                  disabled={enCours}
                >
                  Jeux attribués
                </Petit>
              )}
              <Petit
                onClick={() => agir(() => renvoyerInvitation(compte.id))}
                disabled={enCours}
              >
                Lien d&apos;accès
              </Petit>
              <Petit
                onClick={() => agir(() => reinitialiserMotDePasse(compte.id))}
                disabled={enCours}
              >
                Nouveau mot de passe
              </Petit>
              <Petit
                onClick={() => setImportPour(importPour === compte.id ? null : compte.id)}
                disabled={enCours}
              >
                Importer une sauvegarde
              </Petit>
              {/* On ne se retire pas ses propres droits ni son propre accès :
                  le site se retrouverait sans administrateur. */}
              {compte.id !== moi && (
                <>
                  {compte.isActive && (
                    <Petit onClick={() => demarrer(() => voirLeSiteComme(compte.id))} disabled={enCours}>
                      Voir le site comme {compte.pseudo}
                    </Petit>
                  )}
                  <Petit
                    onClick={() => agir(() => basculerAdministration(compte.id))}
                    disabled={enCours}
                  >
                    {compte.role === "ADMIN" ? "Retirer admin" : "Passer admin"}
                  </Petit>
                  <Petit
                    onClick={() => agir(() => basculerActivation(compte.id))}
                    disabled={enCours}
                    danger={compte.isActive}
                  >
                    {compte.isActive ? "Désactiver" : "Réactiver"}
                  </Petit>
                </>
              )}
              <Petit
                onClick={() => {
                  if (
                    window.confirm(
                      `Remettre à zéro le compte de ${compte.pseudo} ? Sauvegardes, copies de secours, ` +
                        "points de reprise, temps de jeu et notes seront effacés. Le compte et son mot de passe restent.",
                    )
                  ) {
                    agir(() => remettreAZero(compte.id));
                  }
                }}
                disabled={enCours}
                danger
              >
                Remettre à zéro
              </Petit>
            </div>

            {importPour === compte.id && (
              <ImportSauvegarde compte={compte} jeux={jeux} surFin={() => setImportPour(null)} />
            )}
            {attribuerPour === compte.id && compte.accessMode !== "normal" && (
              <AttributionJeux compte={compte} jeux={jeux} surFin={() => setAttribuerPour(null)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Un lien d'inscription : son état, ce qu'il a produit, et de quoi le couper.
 *
 * Le lien lui-même n'est plus affichable — seule son empreinte est en base —
 * d'où l'intérêt de le copier au moment où il est créé.
 */
function LigneLien({
  lien,
  occupe,
  surRevocation,
}: {
  lien: LienInscription;
  occupe: boolean;
  surRevocation: () => void;
}) {
  const expire = lien.expireLe.getTime() <= Date.now();
  const epuise = lien.usesCount >= lien.maxUses;
  const actif = !expire && !epuise;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
      <span className="min-w-0 flex-1">
        <span className="block text-ink-200">
          Lien du {formatDate(lien.creeLe)} · {lien.usesCount}/{lien.maxUses} compte
          {lien.maxUses > 1 ? "s" : ""}
          {actif ? (
            <span className="ml-2 text-accent-400">valable jusqu&apos;au {formatDate(lien.expireLe)}</span>
          ) : (
            <span className="ml-2 text-ink-700">{epuise ? "épuisé" : "expiré ou révoqué"}</span>
          )}
        </span>
        {lien.comptes.length > 0 && (
          <span className="block truncate text-ink-400">
            A donné : {lien.comptes.join(", ")}
          </span>
        )}
      </span>
      {actif && (
        <Petit onClick={surRevocation} disabled={occupe} danger>
          Révoquer
        </Petit>
      )}
    </li>
  );
}

/**
 * Les jeux attribués à un compte restreint ou testeur.
 *
 * Un compte restreint choisit parmi tous les jeux ; un testeur voit déjà le
 * catalogue publié, on ne lui propose donc que les jeux non publiés.
 */
function AttributionJeux({
  compte,
  jeux,
  surFin,
}: {
  compte: Compte;
  jeux: JeuImportable[];
  surFin: () => void;
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(
    definirJeuxAttribues,
    null,
  );
  const proposes = compte.accessMode === "testeur" ? jeux.filter((j) => !j.publie) : jeux;

  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-lg border border-ink-800 p-3">
      <input type="hidden" name="userId" value={compte.id} />
      <span className="text-xs text-ink-400">
        {compte.accessMode === "testeur"
          ? "Jeux non publiés que ce testeur peut voir, en plus du catalogue."
          : "Les seuls jeux que ce compte verra."}
      </span>
      {resultat && <Alert tone={resultat.ok ? "success" : "error"}>{resultat.message}</Alert>}
      {proposes.length === 0 ? (
        <span className="text-xs text-ink-700">Aucun jeu à proposer.</span>
      ) : (
        <ul className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
          {proposes.map((jeu) => (
            <li key={jeu.id}>
              <label className="flex items-center gap-2 text-xs text-ink-200">
                <input
                  type="checkbox"
                  name="jeux"
                  value={jeu.id}
                  defaultChecked={compte.jeux.includes(jeu.id)}
                  className="size-4"
                />
                <span className="uppercase text-ink-700">{jeu.console}</span>
                <span className="truncate">{jeu.titre}</span>
                {!jeu.publie && <span className="text-[10px] text-ink-700">non publié</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" variant="ghost" onClick={surFin}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

/**
 * Dépôt d'une sauvegarde sur un compte : jeu, fichier, envoi.
 *
 * Le fichier est un `.sav` ordinaire, tel que mGBA ou le site le produisent.
 */
function ImportSauvegarde({
  compte,
  jeux,
  surFin,
}: {
  compte: Compte;
  jeux: JeuImportable[];
  surFin: () => void;
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(
    importerSauvegarde,
    null,
  );

  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-lg border border-ink-800 p-3">
      <input type="hidden" name="userId" value={compte.id} />
      <span className="text-xs text-ink-400">
        Sauvegarde à déposer sur le compte de <strong className="text-ink-200">{compte.pseudo}</strong>.
        Sa sauvegarde actuelle pour ce jeu, s&apos;il en a une, part dans les copies de secours.
      </span>
      {resultat && <Alert tone={resultat.ok ? "success" : "error"}>{resultat.message}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="gameId"
          required
          defaultValue=""
          aria-label="Jeu"
          className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm text-ink-200"
        >
          <option value="" disabled>
            Choisir le jeu…
          </option>
          {jeux.map((jeu) => (
            <option key={jeu.id} value={jeu.id}>
              {jeu.console.toUpperCase()} · {jeu.titre}
            </option>
          ))}
        </select>
        <input
          type="file"
          name="fichier"
          required
          accept=".sav,.srm"
          aria-label="Fichier de sauvegarde"
          className="text-xs text-ink-400"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={enCours}>
          {enCours ? "Import…" : "Importer"}
        </Button>
        <Button type="button" variant="ghost" onClick={surFin}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

/**
 * Les deux façons de donner l'accès à quelqu'un.
 *
 * **Le lien** l'emmène sur une page où il choisit son propre mot de passe ;
 * c'est le plus propre, et le seul qui n'oblige personne à transmettre un mot
 * de passe. **Le mot de passe provisoire** sert quand c'est plus simple de le
 * dire de vive voix.
 *
 * Les deux sont montrés ensemble : à l'administrateur de choisir selon la
 * personne en face.
 */
function Acces({
  resultat,
}: {
  resultat: { motDePasse?: string; lien?: string; lienLibelle?: string; mailEnvoye?: boolean };
}) {
  return (
    <div className="flex flex-col gap-2">
      {resultat.lien && (
        <ValeurACopier
          valeur={resultat.lien}
          libelle={
            resultat.lienLibelle ??
            (resultat.mailEnvoye
              ? "Lien envoyé par mail. À transmettre aussi en direct si besoin — pense aux indésirables."
              : "Lien à transmettre : la personne y choisira son mot de passe. Valable une semaine.")
          }
        />
      )}
      {resultat.motDePasse && (
        <ValeurACopier
          valeur={resultat.motDePasse}
          libelle="Ou ce mot de passe, à donner de vive voix. Il ne sera plus affiché."
        />
      )}
    </div>
  );
}

/**
 * Une valeur affichée une seule fois.
 *
 * Il n'est ni enregistré ni renvoyé ensuite : s'il est perdu avant d'avoir été
 * transmis, il faut en générer un autre. C'est voulu — un mot de passe qu'on
 * peut relire plus tard est un mot de passe qui traîne.
 */
function ValeurACopier({ valeur, libelle }: { valeur: string; libelle: string }) {
  const [copie, setCopie] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-600/50 bg-accent-600/10 px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-accent-400">
        {valeur}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(valeur);
          setCopie(true);
        }}
        className="shrink-0 text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
      >
        {copie ? "copié" : "copier"}
      </button>
      <span className="w-full text-xs text-ink-700">{libelle}</span>
    </div>
  );
}

function Petit({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
        danger
          ? "border-red-900 text-red-300 hover:bg-red-950/50"
          : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
      }`}
    >
      {children}
    </button>
  );
}
