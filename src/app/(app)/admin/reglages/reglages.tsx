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
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import type { EtatCapacite } from "@/lib/link/capacite";
import { ENTREES_MAX, LIBELLE_MAX, type Vitrine as ReglageVitrine } from "@/lib/vitrine-limites";

export function Reglages({
  nom,
  description,
  application,
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
  capacite: EtatCapacite;
  vitrine: ReglageVitrine;
  jeux: JeuDeVitrine[];
  mail: ReglageMail;
  captcha: ReglageCaptcha;
  /** Adresse de l'administrateur connecté, proposée pour l'e-mail de test. */
  adresseAdmin: string;
  scraper: ReglageScraper;
}) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(
    definirNomDuSite,
    null,
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">Réglages</h2>
      <Panel className="max-w-xl">
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">Identité du site</h3>
          {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
          <Field label="Nom du site" htmlFor="nom" hint="Affiché dans l'en-tête, les onglets et sur la page de connexion.">
            <Input id="nom" name="nom" defaultValue={nom} required maxLength={40} />
          </Field>
          <Field label="Phrase d'accueil" htmlFor="description" hint="Sous le nom, sur la page de connexion.">
            <Input id="description" name="description" defaultValue={description} maxLength={120} />
          </Field>
          <Field
            label="Nom de l'application installée"
            htmlFor="application"
            hint="Sous l'icône, quand le site est ajouté à l'écran d'accueil d'un téléphone. Vide : le nom du site. Un téléphone n'affiche qu'une douzaine de caractères."
          >
            <Input id="application" name="application" defaultValue={application} maxLength={40} placeholder={nom} />
          </Field>
          <Button type="submit" disabled={enCours} className="self-start">
            {enCours ? "Enregistrement…" : "Enregistrer"}
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
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(definirLaVitrine, null);
  const lignes = Array.from({ length: ENTREES_MAX }, (_, i) => vitrine.entrees[i] ?? { libelle: "", jeu: "" });

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">Vitrine : jouer sans compte</h3>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
        <p className="text-sm text-ink-400">
          Ouverte, l&apos;accueil du site montre à un visiteur sans compte un bouton par jeu choisi
          ci-dessous, et rien d&apos;autre. Il joue en invité : sa sauvegarde, ses points de reprise et ses
          réglages restent dans son navigateur. Le reste du site demande toujours un compte.
        </p>
        <label className="flex items-center gap-2 text-sm text-ink-200">
          <input type="checkbox" name="active" defaultChecked={vitrine.active} className="size-4 accent-accent-500" />
          Ouvrir ces jeux aux visiteurs sans compte
        </label>

        {lignes.map((ligne, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label={`Bouton ${i + 1}`} htmlFor={`libelle-${i}`} hint={i === 0 ? "Vide : le titre du jeu." : undefined}>
              <Input
                id={`libelle-${i}`}
                name={`libelle-${i}`}
                defaultValue={ligne.libelle}
                maxLength={LIBELLE_MAX}
                placeholder={i === 0 ? "Jouer en français" : i === 1 ? "Play in English" : ""}
              />
            </Field>
            <Field label="Jeu lancé" htmlFor={`jeu-${i}`}>
              <select
                id={`jeu-${i}`}
                name={`jeu-${i}`}
                defaultValue={ligne.jeu}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-50"
              >
                <option value="">Aucun</option>
                {jeux.map((jeu) => (
                  <option key={jeu.id} value={jeu.id}>
                    {jeu.console.toUpperCase()} — {jeu.titre}
                    {jeu.publie ? "" : " (dépublié)"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}

        <Button type="submit" disabled={enCours} className="self-start">
          {enCours ? "Enregistrement…" : "Enregistrer la vitrine"}
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

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">Scraper (ScreenScraper)</h3>
        <p className="text-xs text-ink-400">
          Pour remplir les fiches des jeux officiels depuis screenscraper.fr : description en
          français, année, jaquette. Le bouton est dans Bibliothèque. L&apos;API demande deux paires
          d&apos;identifiants : celle du <strong className="text-ink-200">membre</strong> (ton compte),
          et celle du <strong className="text-ink-200">logiciel</strong>, dite « développeur », que
          ScreenScraper délivre sur demande depuis son forum. Sans la seconde, seules les jaquettes
          de libretro sont cherchées — elles couvrent déjà la plupart des jeux.
        </p>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
        {oubli && <Alert tone={oubli.ok ? "success" : "error"}>{oubli.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Identifiant du compte" htmlFor="ssId">
            <Input id="ssId" name="ssId" defaultValue={scraper.ssId} autoComplete="off" />
          </Field>
          <Field
            label="Mot de passe du compte"
            htmlFor="ssPassword"
            hint={scraper.ssPasswordDefini ? "Enregistré. Vide : inchangé." : "Aucun enregistré."}
          >
            <Input id="ssPassword" name="ssPassword" type="password" autoComplete="new-password" placeholder={scraper.ssPasswordDefini ? "••••••••" : ""} />
          </Field>
          <Field label="Identifiant développeur" htmlFor="devId">
            <Input id="devId" name="devId" defaultValue={scraper.devId} autoComplete="off" />
          </Field>
          <Field
            label="Mot de passe développeur"
            htmlFor="devPassword"
            hint={scraper.devPasswordDefini ? "Enregistré. Vide : inchangé." : "Aucun enregistré."}
          >
            <Input id="devPassword" name="devPassword" type="password" autoComplete="new-password" placeholder={scraper.devPasswordDefini ? "••••••••" : ""} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer le compte"}
          </Button>
          {renseigne && (
            <button
              type="button"
              disabled={oubliEnCours}
              onClick={() => demarrer(async () => setOubli(await oublierScraper()))}
              className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
            >
              Effacer le compte
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

function Provenance({ source, quoi }: { source: Source; quoi: string }) {
  return (
    <p className="text-xs text-ink-400">
      {source === "reglages"
        ? `${quoi} réglé ici. Il l'emporte sur la configuration du serveur.`
        : source === "serveur"
          ? `${quoi} vient de la configuration du serveur. Enregistrer ce formulaire le remplace, sans redémarrage.`
          : `${quoi} n'est pas configuré.`}
    </p>
  );
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

  return (
    <Panel className="max-w-xl">
      <div className="flex flex-col gap-4">
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">Envoi d&apos;e-mails</h3>
          <Provenance source={mail.source} quoi="Le relais" />
          {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
          {oubli && <Alert tone={oubli.ok ? "success" : "error"}>{oubli.message}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label="Hôte SMTP" htmlFor="host">
              <Input id="host" name="host" defaultValue={mail.host} required placeholder="smtp-relay.exemple.com" autoComplete="off" />
            </Field>
            <Field label="Port" htmlFor="port">
              <Input id="port" name="port" type="number" min={1} max={65535} defaultValue={mail.port} required />
            </Field>
          </div>
          <Field label="Identifiant" htmlFor="user" hint="Celui que donne le relais, pas forcément l'adresse du compte.">
            <Input id="user" name="user" defaultValue={mail.user} autoComplete="off" />
          </Field>
          <Field
            label="Mot de passe ou clé SMTP"
            htmlFor="password"
            hint={mail.motDePasseDefini ? "Un mot de passe est enregistré. Laisse vide pour le garder." : "Aucun mot de passe enregistré."}
          >
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder={mail.motDePasseDefini ? "••••••••" : ""} />
          </Field>
          <Field label="Expéditeur" htmlFor="from" hint="Tel qu'il apparaît dans les messages. L'adresse doit être sur un domaine que le relais accepte.">
            <Input id="from" name="from" defaultValue={mail.from} placeholder="Mon site <jeux@exemple.com>" autoComplete="off" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer le relais"}
            </Button>
            {mail.source === "reglages" && (
              <button
                type="button"
                disabled={oubliEnCours}
                onClick={() => demarrer(async () => setOubli(await oublierMail()))}
                className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
              >
                Revenir à la configuration du serveur
              </button>
            )}
          </div>
        </form>

        <form action={actionEssai} className="flex flex-col gap-3 border-t border-ink-800 pt-4">
          {essai && <Alert tone={essai.ok ? "success" : "error"}>{essai.message}</Alert>}
          <Field label="Envoyer un e-mail de test à" htmlFor="destinataire">
            <Input id="destinataire" name="destinataire" type="email" defaultValue={adresseAdmin} required />
          </Field>
          <Button type="submit" variant="ghost" disabled={essaiEnCours || mail.source === "aucune"} className="self-start">
            {essaiEnCours ? "Envoi…" : "Envoyer le test"}
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

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">Captcha (Cloudflare Turnstile)</h3>
        <Provenance source={captcha.source} quoi="Le captcha" />
        <p className="text-xs text-ink-400">
          Il protège « Mot de passe oublié » et l&apos;inscription ouverte. Les deux clés se créent
          gratuitement dans le tableau de bord Cloudflare, rubrique Turnstile.
        </p>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
        {oubli && <Alert tone={oubli.ok ? "success" : "error"}>{oubli.message}</Alert>}
        <Field label="Clé du site" htmlFor="siteKey" hint="Publique : elle part dans la page.">
          <Input id="siteKey" name="siteKey" defaultValue={captcha.siteKey} required autoComplete="off" />
        </Field>
        <Field
          label="Clé secrète"
          htmlFor="secretKey"
          hint={captcha.secretDefini ? "Une clé secrète est enregistrée. Laisse vide pour la garder." : "Aucune clé secrète enregistrée."}
        >
          <Input id="secretKey" name="secretKey" type="password" autoComplete="new-password" placeholder={captcha.secretDefini ? "••••••••" : ""} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer les clés"}
          </Button>
          {captcha.source === "reglages" && (
            <button
              type="button"
              disabled={oubliEnCours}
              onClick={() => demarrer(async () => setOubli(await oublierCaptcha()))}
              className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
            >
              Revenir à la configuration du serveur
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

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">Câble link</h3>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-400">Processeur</dt>
          <dd className="text-ink-50">
            {capacite.coeurs} cœur{capacite.coeurs > 1 ? "s" : ""}, dont {capacite.budget.toFixed(1)} pour le câble link
            à {capacite.marge} %
          </dd>
          <dt className="text-ink-400">Un salon GB / GBC</dt>
          <dd className="text-ink-50">
            {capacite.charges.gb === null ? "pas mesuré" : `${capacite.charges.gb.toFixed(2)} cœur`}
          </dd>
          <dt className="text-ink-400">Un salon GBA</dt>
          <dd className="text-ink-50">
            {capacite.charges.gba === null ? "pas mesuré" : `${capacite.charges.gba.toFixed(2)} cœur`}
          </dd>
          <dt className="text-ink-400">En ce moment</dt>
          <dd className="text-ink-50">
            {capacite.salonsOuverts === 0
              ? "aucun salon ouvert"
              : `${capacite.salonsOuverts} salon${capacite.salonsOuverts > 1 ? "s" : ""} ouvert${capacite.salonsOuverts > 1 ? "s" : ""}, ${capacite.enCours.toFixed(2)} cœur pris`}
            {mesure && (
              <>
                {" "}
                — encore {capacite.libres.gb ?? "∞"} salon{(capacite.libres.gb ?? 2) > 1 ? "s" : ""} GB / GBC ou{" "}
                {capacite.libres.gba ?? "∞"} GBA
              </>
            )}
          </dd>
        </dl>

        {!mesure && (
          <Alert tone="info">
            Aucune limite pour l&apos;instant. Pour en poser une, lance sur le serveur{" "}
            <code className="font-mono text-xs">npm run link:capacite -- --appliquer</code> : il mesure ce
            que coûte un salon de chaque console et l&apos;enregistre ici.
          </Alert>
        )}

        <Field
          label="Part du processeur réservée au câble link"
          htmlFor="marge"
          hint="En pour cent. Le reste sert au site lui-même. 60 à 70 % laisse de quoi voir venir."
        >
          <Input id="marge" name="marge" type="number" min={10} max={100} step={1} defaultValue={capacite.marge} className="w-28" />
        </Field>
        <Button type="submit" disabled={enCours} className="self-start">
          {enCours ? "Enregistrement…" : "Enregistrer la marge"}
        </Button>
      </form>
    </Panel>
  );
}
