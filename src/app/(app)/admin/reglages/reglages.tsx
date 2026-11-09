"use client";

import { useActionState, useState, useTransition } from "react";
import {
  definirCaptcha,
  definirMail,
  definirMargeCableLink,
  definirNomDuSite,
  definirScraper,
  envoyerMailDeTest,
  oublierCaptcha,
  oublierMail,
  oublierScraper,
  type Resultat,
} from "@/lib/admin/actions";
import { definirLaVitrine } from "@/lib/admin/actions-vitrine";
import { Accentue, useLangue, useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import { LANGUES, NOM_DES_LANGUES, REGION, type Langue } from "@/lib/i18n/langues";
import type { EtatCapacite } from "@/lib/link/capacite";
import { ENTREES_MAX, LIBELLE_MAX, type Vitrine as ReglageVitrine } from "@/lib/vitrine-limites";

export function Reglages({
  nom,
  description,
  application,
  langue,
  capacite,
  vitrine,
  jeux,
  mail,
  captcha,
  adresseAdmin,
  scraper,
}: {
  nom: string;
  description: string;
  /** Nom sous l'icône une fois le site installé sur un téléphone ; vide = nom du site. */
  application: string;
  /** La langue d'un visiteur qui n'en a pas choisi et dont le navigateur n'en demande aucune connue. */
  langue: Langue;
  capacite: EtatCapacite;
  vitrine: ReglageVitrine;
  jeux: JeuDeVitrine[];
  mail: ReglageMail;
  captcha: ReglageCaptcha;
  /** Adresse de l'administrateur connecté, proposée pour l'e-mail de test. */
  adresseAdmin: string;
  scraper: ReglageScraper;
}) {
  const t = useT().adminReglages;
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(
    definirNomDuSite,
    null,
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>
      <Panel className="max-w-xl">
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">{t.identite.titre}</h3>
          {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
          <Field label={t.identite.nom} htmlFor="nom" hint={t.identite.aideNom}>
            <Input id="nom" name="nom" defaultValue={nom} required maxLength={40} />
          </Field>
          <Field label={t.identite.phraseDAccueil} htmlFor="description" hint={t.identite.aidePhraseDAccueil}>
            <Input id="description" name="description" defaultValue={description} maxLength={120} />
          </Field>
          <Field label={t.identite.application} htmlFor="application" hint={t.identite.aideApplication}>
            <Input id="application" name="application" defaultValue={application} maxLength={40} placeholder={nom} />
          </Field>
          <Field label={t.identite.langue} htmlFor="langue" hint={t.identite.aideLangue}>
            <select
              id="langue"
              name="langue"
              defaultValue={langue}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-50"
            >
              {LANGUES.map((code) => (
                <option key={code} value={code}>
                  {NOM_DES_LANGUES[code]}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={enCours} className="self-start">
            {enCours ? t.enregistrement : t.identite.enregistrer}
          </Button>
        </form>
      </Panel>
      <Vitrine vitrine={vitrine} jeux={jeux} />
      <CableLink capacite={capacite} />
      <Mail mail={mail} adresseAdmin={adresseAdmin} />
      <Captcha captcha={captcha} />
      <Scraper scraper={scraper} />
    </section>
  );
}

export type JeuDeVitrine = { id: string; titre: string; console: string; publie: boolean };

/**
 * La vitrine : ouvrir quelques jeux aux visiteurs sans compte. L'accueil du
 * site leur montre alors un bouton par jeu, et ils jouent en invités — leur
 * partie reste dans leur navigateur, le serveur n'en garde rien.
 */
function Vitrine({ vitrine, jeux }: { vitrine: ReglageVitrine; jeux: JeuDeVitrine[] }) {
  const { enregistrement, vitrine: t } = useT().adminReglages;
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(definirLaVitrine, null);
  const lignes = Array.from({ length: ENTREES_MAX }, (_, i) => vitrine.entrees[i] ?? { libelle: "", jeu: "" });

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">{t.titre}</h3>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
        <p className="text-sm text-ink-400">{t.explication}</p>
        <label className="flex items-center gap-2 text-sm text-ink-200">
          <input type="checkbox" name="active" defaultChecked={vitrine.active} className="size-4 accent-accent-500" />
          {t.ouvrir}
        </label>

        {lignes.map((ligne, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label={t.bouton(i + 1)} htmlFor={`libelle-${i}`} hint={i === 0 ? t.aideBouton : undefined}>
              <Input
                id={`libelle-${i}`}
                name={`libelle-${i}`}
                defaultValue={ligne.libelle}
                maxLength={LIBELLE_MAX}
                // Des exemples de ce que l'administrateur écrira, un par langue : ils ne se traduisent pas.
                placeholder={i === 0 ? "Jouer en français" : i === 1 ? "Play in English" : ""}
              />
            </Field>
            <Field label={t.jeuLance} htmlFor={`jeu-${i}`}>
              <select
                id={`jeu-${i}`}
                name={`jeu-${i}`}
                defaultValue={ligne.jeu}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-50"
              >
                <option value="">{t.aucun}</option>
                {jeux.map((jeu) => {
                  const nom = `${jeu.console.toUpperCase()} — ${jeu.titre}`;
                  return (
                    <option key={jeu.id} value={jeu.id}>
                      {jeu.publie ? nom : t.depublie(nom)}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
        ))}

        <Button type="submit" disabled={enCours} className="self-start">
          {enCours ? enregistrement : t.enregistrer}
        </Button>
      </form>
    </Panel>
  );
}

export type ReglageScraper = {
  devId: string;
  devPasswordDefini: boolean;
  ssId: string;
  ssPasswordDefini: boolean;
};

/**
 * Le compte ScreenScraper : il sert à « Compléter les fiches » dans
 * Bibliothèque, qui va chercher description, année et jaquette des jeux
 * officiels. Sans lui, seules les jaquettes de libretro sont cherchées.
 */
function Scraper({ scraper }: { scraper: ReglageScraper }) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(definirScraper, null);
  const [oubli, setOubli] = useState<Resultat | null>(null);
  const [oubliEnCours, demarrer] = useTransition();
  const renseigne = Boolean(scraper.devId || scraper.ssId);
  const { enregistrement, scraper: t } = useT().adminReglages;

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">{t.titre}</h3>
        <p className="text-xs text-ink-400 [&_strong]:text-ink-200">
          <Accentue texte={t.explication} />
        </p>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
        {oubli && <Alert tone={oubli.ok ? "success" : "error"}>{oubli.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.identifiantDuCompte} htmlFor="ssId">
            <Input id="ssId" name="ssId" defaultValue={scraper.ssId} autoComplete="off" />
          </Field>
          <Field
            label={t.motDePasseDuCompte}
            htmlFor="ssPassword"
            hint={scraper.ssPasswordDefini ? t.motDePasseEnregistre : t.aucunMotDePasse}
          >
            <Input id="ssPassword" name="ssPassword" type="password" autoComplete="new-password" placeholder={scraper.ssPasswordDefini ? "••••••••" : ""} />
          </Field>
          <Field label={t.identifiantDeveloppeur} htmlFor="devId">
            <Input id="devId" name="devId" defaultValue={scraper.devId} autoComplete="off" />
          </Field>
          <Field
            label={t.motDePasseDeveloppeur}
            htmlFor="devPassword"
            hint={scraper.devPasswordDefini ? t.motDePasseEnregistre : t.aucunMotDePasse}
          >
            <Input id="devPassword" name="devPassword" type="password" autoComplete="new-password" placeholder={scraper.devPasswordDefini ? "••••••••" : ""} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? enregistrement : t.enregistrer}
          </Button>
          {renseigne && (
            <button
              type="button"
              disabled={oubliEnCours}
              onClick={() => demarrer(async () => setOubli(await oublierScraper()))}
              className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
            >
              {t.effacer}
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}

type Source = "reglages" | "serveur" | "aucune";

export type ReglageMail = {
  host: string;
  port: number;
  user: string;
  from: string;
  motDePasseDefini: boolean;
  source: Source;
};

export type ReglageCaptcha = { siteKey: string; secretDefini: boolean; source: Source };

/** D'où vient le réglage en vigueur : d'ici, de la configuration du serveur, ou de nulle part. */
function Provenance({ source, quoi }: { source: Source; quoi: "mail" | "captcha" }) {
  const t = useT().adminReglages;
  return <p className="text-xs text-ink-400">{t[quoi].provenance[source]}</p>;
}

/**
 * Le relais d'e-mails : invitations, mots de passe oubliés, confirmations
 * d'inscription. Le mot de passe ne s'affiche jamais ; le laisser vide garde
 * celui qui est enregistré.
 */
function Mail({ mail, adresseAdmin }: { mail: ReglageMail; adresseAdmin: string }) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(definirMail, null);
  const [essai, actionEssai, essaiEnCours] = useActionState<Resultat | null, FormData>(envoyerMailDeTest, null);
  const [oubli, setOubli] = useState<Resultat | null>(null);
  const [oubliEnCours, demarrer] = useTransition();
  const { enregistrement, revenirAuServeur, mail: t } = useT().adminReglages;

  return (
    <Panel className="max-w-xl">
      <div className="flex flex-col gap-4">
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">{t.titre}</h3>
          <Provenance source={mail.source} quoi="mail" />
          {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
          {oubli && <Alert tone={oubli.ok ? "success" : "error"}>{oubli.message}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label={t.hote} htmlFor="host">
              <Input id="host" name="host" defaultValue={mail.host} required placeholder={t.exempleHote} autoComplete="off" />
            </Field>
            <Field label={t.port} htmlFor="port">
              <Input id="port" name="port" type="number" min={1} max={65535} defaultValue={mail.port} required />
            </Field>
          </div>
          <Field label={t.identifiant} htmlFor="user" hint={t.aideIdentifiant}>
            <Input id="user" name="user" defaultValue={mail.user} autoComplete="off" />
          </Field>
          <Field
            label={t.motDePasse}
            htmlFor="password"
            hint={mail.motDePasseDefini ? t.motDePasseEnregistre : t.aucunMotDePasse}
          >
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder={mail.motDePasseDefini ? "••••••••" : ""} />
          </Field>
          <Field label={t.expediteur} htmlFor="from" hint={t.aideExpediteur}>
            <Input id="from" name="from" defaultValue={mail.from} placeholder={t.exempleExpediteur} autoComplete="off" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={enCours}>
              {enCours ? enregistrement : t.enregistrer}
            </Button>
            {mail.source === "reglages" && (
              <button
                type="button"
                disabled={oubliEnCours}
                onClick={() => demarrer(async () => setOubli(await oublierMail()))}
                className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
              >
                {revenirAuServeur}
              </button>
            )}
          </div>
        </form>

        <form action={actionEssai} className="flex flex-col gap-3 border-t border-ink-800 pt-4">
          {essai && <Alert tone={essai.ok ? "success" : "error"}>{essai.message}</Alert>}
          <Field label={t.destinataireDuTest} htmlFor="destinataire">
            <Input id="destinataire" name="destinataire" type="email" defaultValue={adresseAdmin} required />
          </Field>
          <Button type="submit" variant="ghost" disabled={essaiEnCours || mail.source === "aucune"} className="self-start">
            {essaiEnCours ? t.envoi : t.envoyerLeTest}
          </Button>
        </form>
      </div>
    </Panel>
  );
}

/** Les clés Turnstile : sans elles, les inscriptions ouvertes restent fermées. */
function Captcha({ captcha }: { captcha: ReglageCaptcha }) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(definirCaptcha, null);
  const [oubli, setOubli] = useState<Resultat | null>(null);
  const [oubliEnCours, demarrer] = useTransition();
  const { enregistrement, revenirAuServeur, captcha: t } = useT().adminReglages;

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">{t.titre}</h3>
        <Provenance source={captcha.source} quoi="captcha" />
        <p className="text-xs text-ink-400">{t.explication}</p>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
        {oubli && <Alert tone={oubli.ok ? "success" : "error"}>{oubli.message}</Alert>}
        <Field label={t.cleDuSite} htmlFor="siteKey" hint={t.aideCleDuSite}>
          <Input id="siteKey" name="siteKey" defaultValue={captcha.siteKey} required autoComplete="off" />
        </Field>
        <Field
          label={t.cleSecrete}
          htmlFor="secretKey"
          hint={captcha.secretDefini ? t.cleSecreteEnregistree : t.aucuneCleSecrete}
        >
          <Input id="secretKey" name="secretKey" type="password" autoComplete="new-password" placeholder={captcha.secretDefini ? "••••••••" : ""} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? enregistrement : t.enregistrer}
          </Button>
          {captcha.source === "reglages" && (
            <button
              type="button"
              disabled={oubliEnCours}
              onClick={() => demarrer(async () => setOubli(await oublierCaptcha()))}
              className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
            >
              {revenirAuServeur}
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}

/**
 * Combien de salons le serveur accepte en même temps. Les coûts viennent
 * d'une mesure faite sur le serveur ; seule la marge se règle ici.
 */
function CableLink({ capacite }: { capacite: EtatCapacite }) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(
    definirMargeCableLink,
    null,
  );
  const mesure = capacite.charges.gb !== null || capacite.charges.gba !== null;
  const { enregistrement, cableLink: t } = useT().adminReglages;
  const langue = useLangue();
  /** Un nombre de cœurs, écrit dans la langue : « 0,25 » en français, « 0.25 » en anglais. */
  const decimales = (nombre: number, chiffres: number) =>
    nombre.toLocaleString(REGION[langue], { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres });

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">{t.titre}</h3>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-400">{t.processeur}</dt>
          <dd className="text-ink-50">{t.coeurs(capacite.coeurs, decimales(capacite.budget, 1), capacite.marge)}</dd>
          <dt className="text-ink-400">{t.salonGb}</dt>
          <dd className="text-ink-50">
            {capacite.charges.gb === null ? t.pasMesure : t.cout(decimales(capacite.charges.gb, 2))}
          </dd>
          <dt className="text-ink-400">{t.salonGba}</dt>
          <dd className="text-ink-50">
            {capacite.charges.gba === null ? t.pasMesure : t.cout(decimales(capacite.charges.gba, 2))}
          </dd>
          <dt className="text-ink-400">{t.enCeMoment}</dt>
          <dd className="text-ink-50">
            {capacite.salonsOuverts === 0
              ? t.aucunSalon
              : t.salonsOuverts(capacite.salonsOuverts, decimales(capacite.enCours, 2))}
            {mesure && ` — ${t.encore(capacite.libres.gb, capacite.libres.gba)}`}
          </dd>
        </dl>

        {!mesure && (
          <Alert tone="info">
            {/* La commande, entre accents graves dans le dictionnaire, s'affiche comme du code. */}
            {t.sansLimite.split("`").map((morceau, rang) =>
              rang % 2 === 1 ? (
                <code key={rang} className="font-mono text-xs">
                  {morceau}
                </code>
              ) : (
                <span key={rang}>{morceau}</span>
              ),
            )}
          </Alert>
        )}

        <Field
          label={t.part}
          htmlFor="marge"
          hint={t.aidePart}
        >
          <Input id="marge" name="marge" type="number" min={10} max={100} step={1} defaultValue={capacite.marge} className="w-28" />
        </Field>
        <Button type="submit" disabled={enCours} className="self-start">
          {enCours ? enregistrement : t.enregistrer}
        </Button>
      </form>
    </Panel>
  );
}
