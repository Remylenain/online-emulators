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
  supprimerCompte,
  renvoyerInvitation,
  revoquerInvitation,
  voirLeSiteComme,
  type Resultat,
} from "@/lib/admin/actions";
import { modesAcces, type ModeAcces } from "@/lib/modes-acces";
import { INSCRIPTION_PLAFONDS } from "@/lib/auth/inscription";
import type { LienInscription } from "@/lib/auth/invitations";
import { formatDate } from "@/lib/format";
import { Accentue, useLangue, useT } from "@/components/langue";
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
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [importPour, setImportPour] = useState<string | null>(null);
  const [attribuerPour, setAttribuerPour] = useState<string | null>(null);
  const [plafond, setPlafond] = useState<number>(1);
  const [creation, action, enCreation] = useActionState<Resultat | null, FormData>(
    creerCompte,
    null,
  );
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const t = useT().adminComptes;

  function agir(operation: () => Promise<Resultat>) {
    demarrer(async () => setRetour(await operation()));
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
      {retour?.ok && <Acces resultat={retour} />}

      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {comptes.map((compte) => (
          <FicheCompte
            key={compte.id}
            compte={compte}
            moi={moi}
            jeux={jeux}
            ouverte={ouvert === compte.id}
            surOuverture={() => {
              setOuvert(ouvert === compte.id ? null : compte.id);
              setImportPour(null);
              setAttribuerPour(null);
            }}
            enCours={enCours}
            agir={agir}
            demarrer={demarrer}
            importPour={importPour}
            setImportPour={setImportPour}
            attribuerPour={attribuerPour}
            setAttribuerPour={setAttribuerPour}
          />
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold text-ink-200">{t.creation.nouveauxComptes}</h3>
      <Panel>
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">{t.creation.titre}</h3>

          {creation && (
            <Alert tone={creation.ok ? "success" : "error"}>{creation.message}</Alert>
          )}
          {creation?.ok && <Acces resultat={creation} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.creation.pseudo} htmlFor="pseudo">
              <Input id="pseudo" name="pseudo" required autoComplete="off" />
            </Field>
            <Field label={t.creation.email} htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="off" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" name="admin" className="size-4" />
            {t.creation.administrateur}
          </label>

          <Button type="submit" disabled={enCreation} className="self-start">
            {enCreation ? t.creation.enCours : t.creation.creer}
          </Button>
        </form>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink-200">{t.liens.titre}</h3>
          <p className="text-xs text-ink-400">{t.liens.explication}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-200">
              {t.liens.pour}
              <select
                value={plafond}
                onChange={(e) => setPlafond(Number(e.target.value))}
                className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm text-ink-200"
                aria-label={t.liens.nombreDeComptes}
              >
                {INSCRIPTION_PLAFONDS.map((n) => (
                  <option key={n} value={n}>
                    {t.liens.plafond(n)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => agir(() => creerInvitation(plafond))}
              disabled={enCours}
            >
              {t.liens.creer}
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
          <h3 className="text-sm font-semibold text-ink-200">{t.inscriptions.titre}</h3>
          <p className="text-xs text-ink-400">{t.inscriptions.explication}</p>
          {!inscriptions.ouvrables && <Alert tone="info">{t.inscriptions.prerequis}</Alert>}
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
              {t.inscriptions.fermees}
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
              {t.inscriptions.ouvertes}
            </label>
          </div>
        </div>
      </Panel>

    </section>
  );
}

/**
 * Un compte dans la liste : une ligne qui se lit (pseudo, état, adresse,
 * parties), et un seul bouton « Gérer » qui déplie les actions, rangées par
 * sujet. Avant, neuf petits boutons s'alignaient sur la ligne et mordaient
 * sur les noms dès que l'écran se resserrait.
 */
function FicheCompte({
  compte,
  moi,
  jeux,
  ouverte,
  surOuverture,
  enCours,
  agir,
  demarrer,
  importPour,
  setImportPour,
  attribuerPour,
  setAttribuerPour,
}: {
  compte: Compte;
  moi: string;
  jeux: JeuImportable[];
  ouverte: boolean;
  surOuverture: () => void;
  enCours: boolean;
  agir: (operation: () => Promise<Resultat>) => void;
  demarrer: (operation: () => Promise<void>) => void;
  importPour: string | null;
  setImportPour: (id: string | null) => void;
  attribuerPour: string | null;
  setAttribuerPour: (id: string | null) => void;
}) {
  const t = useT().adminComptes;
  const langue = useLangue();

  return (
    <li className="bg-ink-900/40">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink-50">{compte.pseudo}</span>
            {compte.role === "ADMIN" && <Badge tone="accent">{t.ligne.admin}</Badge>}
            {!compte.isActive && <Badge tone="danger">{t.ligne.desactive}</Badge>}
            {compte.accessMode !== "normal" && (
              <Badge>{t.ligne.mode(t.modes[compte.accessMode].libelle, compte.jeux.length)}</Badge>
            )}
          </div>
          <div className="truncate text-xs text-ink-700">
            {t.ligne.resume(compte.email, compte.parties, formatDate(compte.createdAt, true, langue))}
          </div>
        </div>
        <button
          type="button"
          onClick={surOuverture}
          aria-expanded={ouverte}
          className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors ${
            ouverte
              ? "border-ink-400 bg-ink-800 text-ink-50"
              : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
          }`}
        >
          {ouverte ? t.ligne.fermer : t.ligne.gerer}
        </button>
      </div>

      {ouverte && (
        <div className="grid gap-5 border-t border-ink-800 bg-ink-950/40 px-4 py-4 sm:grid-cols-2">
          <Groupe titre={t.acces.titre}>
            <select
              value={compte.accessMode}
              onChange={(e) => agir(() => definirModeAcces(compte.id, e.target.value))}
              disabled={enCours}
              aria-label={t.acces.titre}
              className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-200"
            >
              {modesAcces(t.modes).map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {t.acces.option(m.libelle)}
                </option>
              ))}
            </select>
            {compte.accessMode !== "normal" && (
              <Petit
                onClick={() => setAttribuerPour(attribuerPour === compte.id ? null : compte.id)}
                disabled={enCours}
              >
                {t.acces.jeuxAttribues(compte.jeux.length)}
              </Petit>
            )}
          </Groupe>

          <Groupe titre={t.connexion.titre}>
            <Petit onClick={() => agir(() => renvoyerInvitation(compte.id))} disabled={enCours}>
              {t.connexion.lienAcces}
            </Petit>
            <Petit onClick={() => agir(() => reinitialiserMotDePasse(compte.id))} disabled={enCours}>
              {t.connexion.nouveauMotDePasse}
            </Petit>
            {compte.id !== moi && compte.isActive && (
              <Petit onClick={() => demarrer(() => voirLeSiteComme(compte.id))} disabled={enCours}>
                {t.connexion.voirComme(compte.pseudo)}
              </Petit>
            )}
          </Groupe>

          <Groupe titre={t.sauvegardes.titre}>
            <Petit
              onClick={() => setImportPour(importPour === compte.id ? null : compte.id)}
              disabled={enCours}
            >
              {t.sauvegardes.importer}
            </Petit>
            <Petit
              onClick={() => {
                if (window.confirm(t.sauvegardes.confirmerRemiseAZero(compte.pseudo))) {
                  agir(() => remettreAZero(compte.id));
                }
              }}
              disabled={enCours}
              danger
            >
              {t.sauvegardes.remettreAZero}
            </Petit>
          </Groupe>

          <Groupe titre={t.compte.titre}>
            {/* On ne se retire pas ses propres droits ni son propre accès :
                le site se retrouverait sans administrateur. */}
            {compte.id !== moi ? (
              <>
                <Petit onClick={() => agir(() => basculerAdministration(compte.id))} disabled={enCours}>
                  {compte.role === "ADMIN" ? t.compte.retirerAdmin : t.compte.passerAdmin}
                </Petit>
                <Petit
                  onClick={() => agir(() => basculerActivation(compte.id))}
                  disabled={enCours}
                  danger={compte.isActive}
                >
                  {compte.isActive ? t.compte.desactiver : t.compte.reactiver}
                </Petit>
                {/* Seul un compte désactivé se supprime : deux gestes séparés,
                    le second ne se défait pas. */}
                {!compte.isActive && (
                  <Petit
                    onClick={() => {
                      if (window.confirm(t.compte.confirmerSuppression(compte.pseudo))) {
                        agir(() => supprimerCompte(compte.id));
                      }
                    }}
                    disabled={enCours}
                    danger
                  >
                    {t.compte.supprimer}
                  </Petit>
                )}
              </>
            ) : (
              <span className="text-xs text-ink-700">{t.compte.cEstToi}</span>
            )}
            {/* L'identifiant est le nom du dossier du compte dans `saves/` et
                `states/` sur le serveur : c'est par lui qu'on retrouve ses
                fichiers. `select-all` le sélectionne d'un clic. */}
            <span
              className="w-full truncate font-mono text-[11px] text-ink-700 select-all"
              title={t.compte.dossierInfobulle}
            >
              {t.compte.dossier(compte.id)}
            </span>
          </Groupe>

          {importPour === compte.id && (
            <div className="sm:col-span-2">
              <ImportSauvegarde compte={compte} jeux={jeux} surFin={() => setImportPour(null)} />
            </div>
          )}
          {attribuerPour === compte.id && compte.accessMode !== "normal" && (
            <div className="sm:col-span-2">
              <AttributionJeux compte={compte} jeux={jeux} surFin={() => setAttribuerPour(null)} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-700">{titre}</h4>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone?: "accent" | "danger"; children: React.ReactNode }) {
  const couleurs = {
    accent: "border-accent-600/50 text-accent-400",
    danger: "border-red-900 text-red-300",
    neutre: "border-ink-700 text-ink-400",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${couleurs[tone ?? "neutre"]}`}>{children}</span>
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
  // L'heure est prise une fois, à la création du composant : un rendu doit
  // donner le même résultat chaque fois qu'on le rejoue.
  const [maintenant] = useState(() => Date.now());
  const expire = lien.expireLe.getTime() <= maintenant;
  const epuise = lien.usesCount >= lien.maxUses;
  const actif = !expire && !epuise;
  const t = useT().adminComptes.liens;
  const langue = useLangue();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
      <span className="min-w-0 flex-1">
        <span className="block text-ink-200">
          {t.lien(formatDate(lien.creeLe, true, langue), lien.usesCount, lien.maxUses)}
          {actif ? (
            <span className="ml-2 text-accent-400">
              {t.valableJusquAu(formatDate(lien.expireLe, true, langue))}
            </span>
          ) : (
            <span className="ml-2 text-ink-700">{epuise ? t.epuise : t.expire}</span>
          )}
        </span>
        {lien.comptes.length > 0 && (
          <span className="block truncate text-ink-400">{t.aDonne(lien.comptes)}</span>
        )}
      </span>
      {actif && (
        <Petit onClick={surRevocation} disabled={occupe} danger>
          {t.revoquer}
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
  const t = useT().adminComptes.attribution;

  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-lg border border-ink-800 p-3">
      <input type="hidden" name="userId" value={compte.id} />
      <span className="text-xs text-ink-400">
        {compte.accessMode === "testeur" ? t.testeur : t.restreint}
      </span>
      {resultat && <Alert tone={resultat.ok ? "success" : "error"}>{resultat.message}</Alert>}
      {proposes.length === 0 ? (
        <span className="text-xs text-ink-700">{t.aucunJeu}</span>
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
                {!jeu.publie && <span className="text-[10px] text-ink-700">{t.nonPublie}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={enCours}>
          {enCours ? t.enregistrement : t.enregistrer}
        </Button>
        <Button type="button" variant="ghost" onClick={surFin}>
          {t.fermer}
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
  const t = useT().adminComptes.importation;

  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-lg border border-ink-800 p-3">
      <input type="hidden" name="userId" value={compte.id} />
      <span className="text-xs text-ink-400 [&_strong]:text-ink-200">
        <Accentue texte={t.explication(compte.pseudo)} />
      </span>
      {resultat && <Alert tone={resultat.ok ? "success" : "error"}>{resultat.message}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="gameId"
          required
          defaultValue=""
          aria-label={t.jeu}
          className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm text-ink-200"
        >
          <option value="" disabled>
            {t.choisirLeJeu}
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
          aria-label={t.fichier}
          className="text-xs text-ink-400"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={enCours}>
          {enCours ? t.enCours : t.importer}
        </Button>
        <Button type="button" variant="ghost" onClick={surFin}>
          {t.fermer}
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
  const t = useT().adminComptes.transmission;

  return (
    <div className="flex flex-col gap-2">
      {resultat.lien && (
        <ValeurACopier
          valeur={resultat.lien}
          libelle={
            resultat.lienLibelle ??
            (resultat.mailEnvoye ? t.lienEnvoye : t.lienATransmettre)
          }
        />
      )}
      {resultat.motDePasse && (
        <ValeurACopier valeur={resultat.motDePasse} libelle={t.motDePasse} />
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
  const t = useT().adminComptes.transmission;

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
        {copie ? t.copie : t.copier}
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
