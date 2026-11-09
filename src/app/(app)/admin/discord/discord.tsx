"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import {
  ajouterAstuceDiscord,
  enregistrerApplication,
  essayerApplicationDiscord,
  supprimerApplicationDiscord,
  supprimerAstuceDiscord,
} from "@/lib/admin/actions-discord";
import type { Resultat } from "@/lib/admin/actions";
import type { ApplicationDiscord } from "@/lib/discord/applications";
import {
  LONGUEUR_MAX_ACCUEIL,
  LONGUEUR_MAX_ASTUCE,
  LONGUEUR_MAX_CONTACT,
  LONGUEUR_MAX_EDITEUR,
} from "@/lib/discord/limites";
import type { EssaiApplication, Verdict } from "@/lib/discord/essai";
import { Tutoriel } from "./tutoriel";

type Jeu = { id: string; titre: string; console: string; publie: boolean };

/**
 * L'onglet Discord : les Activités déclarées, une par jeu.
 *
 * Tout ce que l'administrateur peut faire d'ici y est ; ce qu'il ne peut pas
 * faire d'ici — le DNS, le certificat, le vhost, l'application chez Discord —
 * est dit en clair, avec les valeurs à recopier.
 */
export function Discord({
  applications,
  jeux,
  hoteDuSite,
  repli,
}: {
  applications: ApplicationDiscord[];
  jeux: Jeu[];
  hoteDuSite: string;
  /** L'Activité configurée par l'environnement du serveur, s'il y en a une. */
  repli: { jeu: string; verrou: boolean } | null;
}) {
  const [enEdition, setEnEdition] = useState<ApplicationDiscord | null | "nouvelle">(null);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-50">Activités Discord</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Un jeu du site, jouable dans Discord. Une Activité est une application Discord et ne
            sert qu&apos;un jeu ; chacune répond sur son propre nom d&apos;hôte, où rien d&apos;autre du
            site n&apos;est servi. Le joueur n&apos;a besoin ni de compte ni de mot de passe : sa partie
            suit son compte Discord.
          </p>
        </div>
        <Button type="button" onClick={() => setEnEdition("nouvelle")} disabled={enEdition === "nouvelle"}>
          Nouvelle application
        </Button>
      </div>

      {repli && (
        <Alert tone="info">
          L&apos;environnement du serveur configure aussi une Activité ({repli.jeu}
          {repli.verrou ? ", verrouillée sur un serveur" : ""}) : elle répond sur{" "}
          <code className="text-ink-50">{hoteDuSite}</code> et sur tout hôte sans application
          ci-dessous.
        </Alert>
      )}

      <Tutoriel ouvertAuDepart={applications.length === 0 && !repli} />

      {enEdition === "nouvelle" && (
        <Formulaire application={null} jeux={jeux} hoteDuSite={hoteDuSite} fermer={() => setEnEdition(null)} />
      )}

      {applications.length === 0 && enEdition !== "nouvelle" && (
        <p className="text-sm text-ink-400">Aucune application déclarée.</p>
      )}

      {applications.map((application) =>
        enEdition !== null && enEdition !== "nouvelle" && enEdition.id === application.id ? (
          <Formulaire
            key={application.id}
            application={application}
            jeux={jeux}
            hoteDuSite={hoteDuSite}
            fermer={() => setEnEdition(null)}
          />
        ) : (
          <Carte key={application.id} application={application} modifier={() => setEnEdition(application)} />
        ),
      )}
    </section>
  );
}

function Carte({ application, modifier }: { application: ApplicationDiscord; modifier: () => void }) {
  const [essai, setEssai] = useState<EssaiApplication | null | "aucune">(null);
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const [marche, setMarche] = useState(false);

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-50">{application.name}</h3>
          <p className="text-sm text-ink-300">
            <code className="text-ink-50">{application.host}</code>
            {" · "}
            {application.jeu ? (
              <>
                {application.jeu.titre}{" "}
                <span className="text-ink-500 uppercase">{application.jeu.console}</span>
              </>
            ) : (
              <span className="text-red-300">jeu introuvable</span>
            )}
          </p>
          <p className="text-xs text-ink-400">
            Application {application.clientId}
            {application.guildId
              ? ` · réservée au serveur ${application.guildId}`
              : " · jouable dans tout serveur où Discord l'accepte"}
            {application.guildId && !application.botTokenDefini ? " · sans jeton de bot !" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={modifier}>
            Modifier
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                setRetour(null);
                setEssai((await essayerApplicationDiscord(application.id)) ?? "aucune");
              })
            }
          >
            {enCours ? "Essai…" : "Essayer auprès de Discord"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMarche((v) => !v)}>
            {marche ? "Masquer la marche à suivre" : "Marche à suivre"}
          </Button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              if (!window.confirm(`Supprimer l'application « ${application.name} » ? L'Activité cessera de répondre sur ${application.host}.`)) return;
              demarrer(async () => setRetour(await supprimerApplicationDiscord(application.id)));
            }}
            className="self-center text-xs text-ink-400 underline-offset-4 hover:text-red-300 hover:underline"
          >
            Supprimer
          </button>
        </div>
      </div>

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
      {essai === "aucune" && <Alert tone="error">Cette application n&apos;existe plus.</Alert>}
      {essai && essai !== "aucune" && (
        <ul className="flex flex-col gap-1 text-sm">
          <Ligne titre="Identifiant et secret" verdict={essai.identifiants} />
          {essai.bot && <Ligne titre="Jeton de bot" verdict={essai.bot} />}
          {essai.serveur && <Ligne titre="Serveur du verrou" verdict={essai.serveur} />}
        </ul>
      )}

      {marche && <MarcheASuivre application={application} />}

      <Astuces application={application} />
    </Panel>
  );
}

/**
 * Le mot d'accueil et les astuces, tels que le joueur les verra : le premier
 * à chaque lancement, une des secondes au hasard. Les astuces s'ajoutent et
 * se retirent d'ici, une par une, sans passer par le formulaire.
 */
function Astuces({ application }: { application: ApplicationDiscord }) {
  const [texte, setTexte] = useState("");
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div className="flex flex-col gap-2 border-t border-ink-800 pt-3 text-sm">
      {application.welcome ? (
        <p className="text-ink-300">
          <span className="text-ink-400">Mot d&apos;accueil : </span>
          <span className="whitespace-pre-line text-ink-100">{application.welcome}</span>
        </p>
      ) : (
        <p className="text-xs text-ink-400">Pas de mot d&apos;accueil : « Modifier » pour en écrire un.</p>
      )}

      <h4 className="text-sm font-semibold text-ink-200">
        Astuces
        <span className="ml-2 font-normal text-ink-400">
          Mot du jour, conseil, rappel : une au hasard à chaque lancement.
        </span>
      </h4>
      {application.astuces.length === 0 && <p className="text-xs text-ink-400">Aucune pour l&apos;instant.</p>}
      {application.astuces.length > 0 && (
        <ul className="flex flex-col gap-1">
          {application.astuces.map((astuce) => (
            <li key={astuce.id} className="flex items-start justify-between gap-3 rounded border border-ink-800 bg-ink-900/50 px-3 py-1.5">
              <span className="text-ink-200">{astuce.texte}</span>
              <button
                type="button"
                disabled={enCours}
                onClick={() => demarrer(async () => setRetour(await supprimerAstuceDiscord(astuce.id)))}
                className="shrink-0 text-xs text-ink-400 underline-offset-4 hover:text-red-300 hover:underline"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          const propre = texte.trim();
          if (!propre) return;
          demarrer(async () => {
            const resultat = await ajouterAstuceDiscord(application.id, propre);
            setRetour(resultat);
            if (resultat.ok) setTexte("");
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          value={texte}
          onChange={(evenement) => setTexte(evenement.target.value)}
          maxLength={LONGUEUR_MAX_ASTUCE}
          placeholder="Une astuce de plus…"
          aria-label="Nouvelle astuce"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="ghost" disabled={enCours || texte.trim().length === 0}>
          Ajouter
        </Button>
      </form>
      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
    </div>
  );
}

function Ligne({ titre, verdict }: { titre: string; verdict: Verdict }) {
  return (
    <li className={verdict.ok ? "text-accent-400" : "text-red-300"}>
      <span className="font-medium">{verdict.ok ? "✓" : "✗"} {titre}</span>
      <span className="text-ink-300"> — {verdict.detail}</span>
    </li>
  );
}

/**
 * Ce qui se règle ailleurs que dans cette page, avec les valeurs à recopier.
 * Le portail Discord n'a pas d'API pour créer une application : c'est à la
 * main. Le DNS et le vhost relèvent de qui tient le serveur.
 */
function MarcheASuivre({ application }: { application: ApplicationDiscord }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 border-t border-ink-800 pt-3 pl-5 text-sm text-ink-300">
      <li>
        <strong className="text-ink-100">Le nom d&apos;hôte.</strong> Faire pointer{" "}
        <code className="text-ink-50">{application.host}</code> vers ce serveur (DNS), puis lui
        donner un certificat et un vhost qui relaie vers le site, comme l&apos;hôte principal — voir{" "}
        <code>docs/discord/README.md</code>. Tant que ce n&apos;est pas fait, Discord n&apos;atteint
        pas l&apos;Activité.
      </li>
      <li>
        <strong className="text-ink-100">Le portail Discord</strong> (discord.com/developers,
        application {application.clientId}) :
        <ul className="mt-1 list-disc pl-5">
          <li>
            OAuth2 → Redirects : <code className="text-ink-50">https://127.0.0.1</code> (exigé,
            jamais utilisé).
          </li>
          <li>Activities → Settings : cocher « Enable Activities », et les plateformes voulues (iOS, Android).</li>
          <li>
            Activities → URL Mappings : préfixe <code className="text-ink-50">/</code>, cible{" "}
            <code className="text-ink-50">{application.host}</code> (sans https://).
          </li>
          {application.guildId && (
            <li>
              Bot : le jeton enregistré ici doit être celui de cette application. Le bot n&apos;a pas
              besoin d&apos;être invité dans le serveur : le verrou interroge l&apos;instance de
              l&apos;Activité, pas le serveur.
            </li>
          )}
        </ul>
      </li>
      <li>
        <strong className="text-ink-100">Les pages légales</strong>, que Discord demande pour vérifier
        l&apos;application (General Information du portail) :
        <ul className="mt-1 list-disc pl-5">
          <li>
            Privacy Policy URL :{" "}
            <code className="text-ink-50">https://{application.host}/discord/confidentialite</code>
          </li>
          <li>
            Terms of Service URL :{" "}
            <code className="text-ink-50">https://{application.host}/discord/conditions</code>
          </li>
        </ul>
        {(!application.publisher || !application.contact) && (
          <span className="mt-1 block text-amber-300">
            « Proposée par » ou « Contact » est vide : ces pages renvoient pour l&apos;instant aux
            responsables du serveur Discord. « Modifier » pour les remplir.
          </span>
        )}
      </li>
      <li>
        <strong className="text-ink-100">Essayer.</strong> Dans Discord, mode développeur activé :
        entrer dans un salon vocal, ouvrir le lanceur d&apos;activités. Une application non vérifiée
        ne se lance que dans un serveur de moins de 25 membres, et seulement pour son propriétaire,
        son équipe et ses testeurs.
      </li>
    </ol>
  );
}

function Formulaire({
  application,
  jeux,
  hoteDuSite,
  fermer,
}: {
  application: ApplicationDiscord | null;
  jeux: Jeu[];
  hoteDuSite: string;
  fermer: () => void;
}) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(enregistrerApplication, null);
  const [, demarrer] = useTransition();
  const [verrou, setVerrou] = useState(Boolean(application?.guildId));
  const nouvelle = application === null;

  return (
    <Panel>
      {/*
       * L'action est appelée à la main : avec `action={…}`, React vide le
       * formulaire après chaque envoi, et un refus (hôte déjà pris, secret
       * manquant) ferait tout ressaisir.
       */}
      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          const donnees = new FormData(evenement.currentTarget);
          demarrer(() => action(donnees));
        }}
        className="flex flex-col gap-4"
      >
        <h3 className="text-sm font-semibold text-ink-200">
          {nouvelle ? "Nouvelle application" : `Modifier « ${application.name} »`}
        </h3>
        {!nouvelle && <input type="hidden" name="id" value={application.id} />}
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="name" hint="Pour toi seulement.">
            <Input id="name" name="name" defaultValue={application?.name ?? ""} required maxLength={60} autoComplete="off" />
          </Field>
          <Field
            label="Nom d'hôte"
            htmlFor="host"
            hint={`Sans https:// ni chemin. Un hôte à elle, différent de ${hoteDuSite} : rien d'autre du site n'y sera servi.`}
          >
            <Input id="host" name="host" defaultValue={application?.host ?? ""} required placeholder="prism.exemple.com" autoComplete="off" />
          </Field>
          <Field label="Jeu servi" htmlFor="gameId" hint="Le seul jeu de cette Activité. Pour un autre jeu, une autre application.">
            <select
              id="gameId"
              name="gameId"
              required
              defaultValue={application?.gameId ?? ""}
              className="w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-ink-50 focus:border-accent-500 focus:outline-none"
            >
              <option value="" disabled>
                Choisir un jeu…
              </option>
              {jeux.map((jeu) => (
                <option key={jeu.id} value={jeu.id}>
                  {jeu.console.toUpperCase()} — {jeu.titre}
                  {jeu.publie ? "" : " (dépublié)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Identifiant d'application" htmlFor="clientId" hint="Application ID, onglet General Information du portail.">
            <Input id="clientId" name="clientId" defaultValue={application?.clientId ?? ""} required inputMode="numeric" pattern="\d{17,20}" autoComplete="off" />
          </Field>
          <Field
            label="Client Secret"
            htmlFor="clientSecret"
            hint={nouvelle ? "Onglet OAuth2 → Reset Secret. Pas la Public Key." : "Enregistré. Vide : inchangé."}
          >
            <Input
              id="clientSecret"
              name="clientSecret"
              type="password"
              autoComplete="new-password"
              required={nouvelle}
              placeholder={nouvelle ? "" : "••••••••"}
            />
          </Field>
        </div>

        <Field
          label="Mot d'accueil"
          htmlFor="welcome"
          hint="Affiché à chaque lancement, sous le titre du jeu : une présentation, une consigne pour les testeurs. Vide : rien. Les astuces, elles, s'ajoutent sur la carte de l'application."
        >
          <textarea
            id="welcome"
            name="welcome"
            defaultValue={application?.welcome ?? ""}
            maxLength={LONGUEUR_MAX_ACCUEIL}
            rows={3}
            className="w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-ink-50 placeholder:text-ink-700 focus:border-accent-500 focus:ring-2 focus:ring-accent-600/30 focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Proposée par"
            htmlFor="publisher"
            hint="Un nom ou un pseudonyme, affiché sur les pages de confidentialité et de conditions de l'Activité."
          >
            <Input
              id="publisher"
              name="publisher"
              defaultValue={application?.publisher ?? ""}
              maxLength={LONGUEUR_MAX_EDITEUR}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Contact"
            htmlFor="contact"
            hint="Affiché sur ces mêmes pages : une adresse e-mail, ou comment te joindre sur Discord. C'est par là qu'un joueur demande la suppression de ses données."
          >
            <Input
              id="contact"
              name="contact"
              defaultValue={application?.contact ?? ""}
              maxLength={LONGUEUR_MAX_CONTACT}
              autoComplete="off"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-200">
          <input type="checkbox" checked={verrou} onChange={(e) => setVerrou(e.target.checked)} className="size-4 accent-accent-500" />
          Réserver l&apos;Activité à un seul serveur Discord
        </label>
        {verrou && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Identifiant du serveur"
              htmlFor="guildId"
              hint="Clic droit sur le serveur → Copier l'identifiant (mode développeur activé)."
            >
              <Input id="guildId" name="guildId" defaultValue={application?.guildId ?? ""} required inputMode="numeric" pattern="\d{17,20}" autoComplete="off" />
            </Field>
            <Field
              label="Jeton de bot"
              htmlFor="botToken"
              hint={
                application?.botTokenDefini
                  ? "Enregistré. Vide : inchangé."
                  : "Onglet Bot → Reset Token. Avec lui, le site demande à Discord où tourne l'Activité."
              }
            >
              <Input
                id="botToken"
                name="botToken"
                type="password"
                autoComplete="new-password"
                required={!application?.botTokenDefini}
                placeholder={application?.botTokenDefini ? "••••••••" : ""}
              />
            </Field>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : nouvelle ? "Enregistrer l'application" : "Enregistrer les changements"}
          </Button>
          <Button type="button" variant="ghost" onClick={fermer}>
            {retour?.ok ? "Fermer" : "Annuler"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
