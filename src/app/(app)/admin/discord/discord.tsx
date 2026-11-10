"use client";

import { useActionState, useState, useTransition } from "react";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import {
  ajouterAstuceDiscord,
  activerCommandeTapee,
  confierLanceurDiscord,
  type CommandeDiscord,
  commandeDiscord,
  definirRolesDiscord,
  desactiverCommandeTapee,
  enregistrerApplication,
  essayerApplicationDiscord,
  type EtatCommandeTapee,
  renommerCommandeDiscord,
  rolesDiscord,
  type RolesDiscord,
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
import { Prose, Tutoriel } from "./tutoriel";

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
  const t = useT().adminDiscord;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">{t.presentation}</p>
        </div>
        <Button type="button" onClick={() => setEnEdition("nouvelle")} disabled={enEdition === "nouvelle"}>
          {t.nouvelle}
        </Button>
      </div>

      {repli && (
        <Alert tone="info">
          {/* Le titre du jeu est une saisie libre : il ne passe pas par `Prose`. */}
          {t.repli.annonce(repli.jeu, repli.verrou)}{" "}
          <span className="[&_code]:text-ink-50">
            <Prose texte={t.repli.portee(hoteDuSite)} />
          </span>
        </Alert>
      )}

      <Tutoriel ouvertAuDepart={applications.length === 0 && !repli} />

      {enEdition === "nouvelle" && (
        <Formulaire application={null} jeux={jeux} hoteDuSite={hoteDuSite} fermer={() => setEnEdition(null)} />
      )}

      {applications.length === 0 && enEdition !== "nouvelle" && (
        <p className="text-sm text-ink-400">{t.aucune}</p>
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
          <Carte
            key={application.id}
            application={application}
            hoteDuSite={hoteDuSite}
            modifier={() => setEnEdition(application)}
          />
        ),
      )}
    </section>
  );
}

function Carte({
  application,
  hoteDuSite,
  modifier,
}: {
  application: ApplicationDiscord;
  hoteDuSite: string;
  modifier: () => void;
}) {
  const [essai, setEssai] = useState<EssaiApplication | null | "aucune">(null);
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const [marche, setMarche] = useState(false);
  const t = useT().adminDiscord;

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-50">{application.name}</h3>
          <p className="text-sm text-ink-300">
            <code className="text-ink-50">{application.host}</code>
            {application.host === hoteDuSite && <span className="text-ink-400"> {t.carte.hoteDuSite}</span>}
            {" · "}
            {application.jeu ? (
              <>
                {application.jeu.titre}{" "}
                <span className="text-ink-500 uppercase">{application.jeu.console}</span>
              </>
            ) : (
              <span className="text-red-300">{t.carte.jeuIntrouvable}</span>
            )}
          </p>
          <p className="text-xs text-ink-400">
            {t.carte.resume(application.clientId, application.guildId, !application.botTokenDefini)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={modifier}>
            {t.carte.modifier}
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
            {enCours ? t.carte.essaiEnCours : t.carte.essayer}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMarche((v) => !v)}>
            {marche ? t.carte.masquerMarche : t.carte.marche}
          </Button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              if (!window.confirm(t.carte.confirmerSuppression(application.name, application.host))) return;
              demarrer(async () => setRetour(await supprimerApplicationDiscord(application.id)));
            }}
            className="self-center text-xs text-ink-400 underline-offset-4 hover:text-red-300 hover:underline"
          >
            {t.carte.supprimer}
          </button>
        </div>
      </div>

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
      {essai === "aucune" && <Alert tone="error">{t.actions.applicationDisparue}</Alert>}
      {essai && essai !== "aucune" && (
        <ul className="flex flex-col gap-1 text-sm">
          <Ligne titre={t.essai.identifiants} verdict={essai.identifiants} />
          {essai.bot && <Ligne titre={t.essai.bot} verdict={essai.bot} />}
          {essai.serveur && <Ligne titre={t.essai.serveur} verdict={essai.serveur} />}
          {essai.roles && <Ligne titre={t.essai.roles} verdict={essai.roles} />}
        </ul>
      )}

      {marche && <MarcheASuivre application={application} surLeSite={application.host === hoteDuSite} />}

      <CommandeDeLancement application={application} />

      {application.guildId && application.botTokenDefini && <Roles application={application} />}

      <Astuces application={application} />
    </Panel>
  );
}

/**
 * La commande qui lance l'Activité dans Discord : `/launch` tant qu'on ne l'a
 * pas renommée. Rien n'est enregistré ici — c'est Discord qui la tient, on la
 * lui lit quand on ouvre le panneau, et on la lui renvoie renommée.
 */
function CommandeDeLancement({ application }: { application: ApplicationDiscord }) {
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [connue, setConnue] = useState<string | null>(null);
  /** Des noms traduits masquent encore le nom : il faut renommer pour l'imposer partout. */
  const [traduite, setTraduite] = useState(false);
  /** La commande se tape-t-elle ? `null` tant que Discord n'a pas répondu. */
  const [tapee, setTapee] = useState<EtatCommandeTapee | null>(null);
  /** Le bouton du lanceur passe par le site : Discord ne poste pas d'invitation dans le salon. */
  const [lanceurParLeSite, setLanceurParLeSite] = useState(false);
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const t = useT().adminDiscord.commande;

  const retenir = (lue: Extract<CommandeDiscord, { ok: true }>) => {
    setNom(lue.nom);
    setDescription(lue.description);
    setConnue(lue.nom);
    setTraduite(lue.traduite);
    setTapee(lue.tapee);
    setLanceurParLeSite(lue.lanceurParLeSite);
  };

  const lire = () =>
    demarrer(async () => {
      setRetour(null);
      const reponse = await commandeDiscord(application.id);
      setOuvert(true);
      if (reponse.ok) {
        setErreur(null);
        retenir(reponse);
      } else {
        setErreur(reponse.message);
      }
    });

  /** Activer ou défaire la commande tapée, puis relire ce que Discord en a retenu. */
  const brancher = (action: (id: string) => Promise<Resultat>) =>
    demarrer(async () => {
      const resultat = await action(application.id);
      setRetour(resultat);
      const relue = await commandeDiscord(application.id);
      if (relue.ok) retenir(relue);
    });

  return (
    <div className="flex flex-col gap-2 border-t border-ink-800 pt-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink-200">
          {t.titre}
          {connue && <code className="ml-2 font-normal text-ink-50">/{connue}</code>}
          <span className="ml-2 font-normal text-ink-400">{t.explication}</span>
        </h4>
        {ouvert ? (
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
          >
            {t.fermer}
          </button>
        ) : (
          <Button type="button" variant="ghost" disabled={enCours} onClick={lire}>
            {enCours ? t.chargement : t.voir}
          </Button>
        )}
      </div>

      {ouvert && erreur && (
        <>
          <Alert tone="error">{erreur}</Alert>
          <Button type="button" variant="ghost" disabled={enCours} onClick={lire} className="self-start">
            {enCours ? t.chargement : t.relire}
          </Button>
        </>
      )}

      {ouvert && !erreur && (
        <form
          onSubmit={(evenement) => {
            evenement.preventDefault();
            demarrer(async () => {
              const resultat = await renommerCommandeDiscord(application.id, nom, description);
              setRetour(resultat);
              // Ce que Discord a retenu, pas ce qui a été tapé : on relit.
              if (resultat.ok) {
                const relue = await commandeDiscord(application.id);
                if (relue.ok) retenir(relue);
              }
            });
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-xs text-ink-400">{t.consigne}</p>
          {traduite && <Alert tone="info">{t.traduite}</Alert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
            <Field label={t.nom} htmlFor={`commande-nom-${application.id}`} hint={t.aideNom}>
              <Input
                id={`commande-nom-${application.id}`}
                value={nom}
                onChange={(evenement) => setNom(evenement.target.value)}
                maxLength={32}
                required
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label={t.description} htmlFor={`commande-description-${application.id}`} hint={t.aideDescription}>
              <Input
                id={`commande-description-${application.id}`}
                value={description}
                onChange={(evenement) => setDescription(evenement.target.value)}
                maxLength={100}
                required
                autoComplete="off"
              />
            </Field>
          </div>
          <p className="text-xs text-ink-400">{t.delai}</p>
          <Button type="submit" variant="ghost" disabled={enCours} className="self-start">
            {t.renommer}
          </Button>
        </form>
      )}

      {ouvert && !erreur && tapee && connue && (
        <div className="flex flex-col gap-2 border-t border-ink-800 pt-3">
          <h5 className="text-sm font-semibold text-ink-200">{t.tapee.titre}</h5>
          <p className="text-xs text-ink-400">
            {tapee === "active"
              ? t.tapee.active(connue)
              : tapee === "inactive"
                ? t.tapee.inactive(connue)
                : t.tapee.sansJeton}
          </p>
          {tapee !== "sans-jeton" && (
            <Button
              type="button"
              variant="ghost"
              disabled={enCours}
              onClick={() => brancher(tapee === "active" ? desactiverCommandeTapee : activerCommandeTapee)}
              className="self-start"
            >
              {enCours ? t.tapee.enCours : tapee === "active" ? t.tapee.desactiver : t.tapee.activer(connue)}
            </Button>
          )}
        </div>
      )}

      {/*
        Proposé une fois la commande tapée branchée : c'est par la même
        adresse que Discord prévient le site. Affiché aussi tant que le bouton
        passe par le site, même débranché, pour qu'on puisse le rendre à
        Discord.
      */}
      {ouvert && !erreur && tapee && (tapee === "active" || lanceurParLeSite) && (
        <div className="flex flex-col gap-2 border-t border-ink-800 pt-3">
          <h5 className="text-sm font-semibold text-ink-200">{t.invitation.titre}</h5>
          <p className="text-xs text-ink-400">
            {!lanceurParLeSite
              ? t.invitation.postee
              : tapee === "active"
                ? t.invitation.masquee
                : t.invitation.orpheline}
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={enCours}
            onClick={() => brancher((id) => confierLanceurDiscord(id, !lanceurParLeSite))}
            className="self-start"
          >
            {enCours ? t.tapee.enCours : lanceurParLeSite ? t.invitation.retablir : t.invitation.masquer}
          </Button>
        </div>
      )}

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
    </div>
  );
}

/**
 * Les rôles réservés : parmi les membres du serveur du verrou, ceux qui ont
 * le droit de jouer. Absent sans verrou — des rôles ne désignent rien hors
 * d'un serveur.
 *
 * Les noms des rôles ne sont pas enregistrés : ils se lisent auprès de
 * Discord quand on ouvre le choix, avec le jeton de bot. C'est aussi là
 * qu'on apprend que le bot n'est pas dans le serveur, et comment l'y inviter.
 */
function Roles({ application }: { application: ApplicationDiscord }) {
  const [lus, setLus] = useState<RolesDiscord | null>(null);
  const [coches, setCoches] = useState<string[]>([]);
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const t = useT().adminDiscord.roles;

  const lire = () =>
    demarrer(async () => {
      setRetour(null);
      const reponse = await rolesDiscord(application.id);
      setLus(reponse);
      if (reponse.ok) setCoches(reponse.choisis);
    });

  // Un rôle enregistré que le serveur n'a plus : montré, pour pouvoir le décocher.
  const disparus = lus?.ok ? coches.filter((id) => !lus.roles.some((role) => role.id === id)) : [];

  return (
    <div className="flex flex-col gap-2 border-t border-ink-800 pt-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink-200">
          {t.titre}
          <span className="ml-2 font-normal text-ink-400">{t.explication}</span>
        </h4>
        {lus === null ? (
          <Button type="button" variant="ghost" disabled={enCours} onClick={lire}>
            {enCours ? t.chargement : t.choisir}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setLus(null)}
            className="text-xs text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
          >
            {t.fermer}
          </button>
        )}
      </div>

      {lus === null && (
        <p className="text-xs text-ink-400">
          {application.roles.length === 0 ? t.tous : t.reserves(application.roles.length)}
        </p>
      )}

      {lus && !lus.ok && (
        <>
          <Alert tone="error">{lus.message}</Alert>
          {lus.invitation && (
            <p className="text-xs text-ink-300">
              <a
                href={lus.invitation}
                target="_blank"
                rel="noreferrer"
                className="text-accent-400 underline underline-offset-4"
              >
                {t.inviter}
              </a>
              . {t.apresInvitation}
            </p>
          )}
          <Button type="button" variant="ghost" disabled={enCours} onClick={lire} className="self-start">
            {enCours ? t.chargement : t.relire}
          </Button>
        </>
      )}

      {lus?.ok && (
        <form
          onSubmit={(evenement) => {
            evenement.preventDefault();
            demarrer(async () => {
              const resultat = await definirRolesDiscord(application.id, coches);
              setRetour(resultat);
              if (resultat.ok) setLus(null);
            });
          }}
          className="flex flex-col gap-2"
        >
          <p className="text-xs text-ink-400">{t.consigne}</p>
          {lus.roles.length === 0 && disparus.length === 0 && <p className="text-xs text-ink-400">{t.aucunRole}</p>}
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {[...lus.roles, ...disparus.map((id) => ({ id, nom: id, couleur: 0, absent: true }))].map((role) => (
              <li key={role.id}>
                <label className="flex items-center gap-2 text-ink-200">
                  <input
                    type="checkbox"
                    checked={coches.includes(role.id)}
                    onChange={(evenement) =>
                      setCoches((actuels) =>
                        evenement.target.checked ? [...actuels, role.id] : actuels.filter((id) => id !== role.id),
                      )
                    }
                    className="size-4 accent-accent-500"
                  />
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full border border-ink-700"
                    style={role.couleur ? { backgroundColor: `#${role.couleur.toString(16).padStart(6, "0")}` } : undefined}
                  />
                  <span className="min-w-0 truncate">{role.nom}</span>
                  {"absent" in role && <span className="text-xs text-red-300">{t.disparu}</span>}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-400">{t.quand}</p>
          <Button type="submit" variant="ghost" disabled={enCours} className="self-start">
            {t.enregistrer}
          </Button>
        </form>
      )}

      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
    </div>
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
  const t = useT().adminDiscord.astuces;

  return (
    <div className="flex flex-col gap-2 border-t border-ink-800 pt-3 text-sm">
      {application.welcome ? (
        <p className="text-ink-300">
          <span className="text-ink-400">{t.accueil} </span>
          <span className="whitespace-pre-line text-ink-100">{application.welcome}</span>
        </p>
      ) : (
        <p className="text-xs text-ink-400">{t.sansAccueil}</p>
      )}

      <h4 className="text-sm font-semibold text-ink-200">
        {t.titre}
        <span className="ml-2 font-normal text-ink-400">{t.explication}</span>
      </h4>
      {application.astuces.length === 0 && <p className="text-xs text-ink-400">{t.aucune}</p>}
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
                {t.retirer}
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
          placeholder={t.exemple}
          aria-label={t.nouvelle}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="ghost" disabled={enCours || texte.trim().length === 0}>
          {t.ajouter}
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
function MarcheASuivre({
  application,
  surLeSite,
}: {
  application: ApplicationDiscord;
  /** L'Activité est déclarée sur l'hôte du site : rien à préparer côté serveur. */
  surLeSite: boolean;
}) {
  const t = useT().adminDiscord.marche;
  const hote = application.host;

  return (
    <ol className="flex list-decimal flex-col gap-2 border-t border-ink-800 pt-3 pl-5 text-sm text-ink-300 [&_code]:text-ink-50 [&_strong]:text-ink-100">
      <li>
        <Prose texte={surLeSite ? t.hote.enPlace(hote) : t.hote.aPreparer(hote)} />
      </li>
      <li>
        <Prose texte={t.portail.titre(application.clientId)} />
        <ul className="mt-1 list-disc pl-5">
          <li>
            <Prose texte={t.portail.redirects} />
          </li>
          <li>
            <Prose texte={t.portail.activites} />
          </li>
          <li>
            <Prose texte={t.portail.mappings(hote)} />
          </li>
          {application.guildId && (
            <li>
              <Prose texte={t.portail.bot} />
            </li>
          )}
        </ul>
      </li>
      <li>
        <Prose texte={t.pages.titre} />
        <ul className="mt-1 list-disc pl-5">
          <li>
            <Prose texte={t.pages.confidentialite(hote)} />
          </li>
          <li>
            <Prose texte={t.pages.conditions(hote)} />
          </li>
        </ul>
        {(!application.publisher || !application.contact) && (
          <span className="mt-1 block text-amber-300">{t.pages.incompletes}</span>
        )}
      </li>
      <li>
        <Prose texte={t.essayer} />
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
  const t = useT().adminDiscord.formulaire;

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
          {nouvelle ? t.titreNouvelle : t.titreModifier(application.name)}
        </h3>
        {!nouvelle && <input type="hidden" name="id" value={application.id} />}
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.nom.libelle} htmlFor="name" hint={t.nom.aide}>
            <Input id="name" name="name" defaultValue={application?.name ?? ""} required maxLength={60} autoComplete="off" />
          </Field>
          <Field label={t.hote.libelle} htmlFor="host" hint={t.hote.aide(hoteDuSite)}>
            <Input id="host" name="host" defaultValue={application?.host ?? ""} required placeholder="prism.exemple.com" autoComplete="off" />
          </Field>
          <Field label={t.jeu.libelle} htmlFor="gameId" hint={t.jeu.aide}>
            <select
              id="gameId"
              name="gameId"
              required
              defaultValue={application?.gameId ?? ""}
              className="w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-ink-50 focus:border-accent-500 focus:outline-none"
            >
              <option value="" disabled>
                {t.jeu.choisir}
              </option>
              {jeux.map((jeu) => (
                <option key={jeu.id} value={jeu.id}>
                  {t.jeu.option(jeu.console.toUpperCase(), jeu.titre, jeu.publie)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.identifiant.libelle} htmlFor="clientId" hint={t.identifiant.aide}>
            <Input id="clientId" name="clientId" defaultValue={application?.clientId ?? ""} required inputMode="numeric" pattern="\d{17,20}" autoComplete="off" />
          </Field>
          <Field
            label={t.secret.libelle}
            htmlFor="clientSecret"
            hint={nouvelle ? t.secret.aide : t.dejaEnregistre}
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

        <Field label={t.accueil.libelle} htmlFor="welcome" hint={t.accueil.aide}>
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
          <Field label={t.editeur.libelle} htmlFor="publisher" hint={t.editeur.aide}>
            <Input
              id="publisher"
              name="publisher"
              defaultValue={application?.publisher ?? ""}
              maxLength={LONGUEUR_MAX_EDITEUR}
              autoComplete="off"
            />
          </Field>
          <Field label={t.contact.libelle} htmlFor="contact" hint={t.contact.aide}>
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
          {t.verrou}
        </label>
        {verrou && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.serveur.libelle} htmlFor="guildId" hint={t.serveur.aide}>
              <Input id="guildId" name="guildId" defaultValue={application?.guildId ?? ""} required inputMode="numeric" pattern="\d{17,20}" autoComplete="off" />
            </Field>
            <Field
              label={t.jetonBot.libelle}
              htmlFor="botToken"
              hint={application?.botTokenDefini ? t.dejaEnregistre : t.jetonBot.aide}
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
            {enCours ? t.enregistrement : nouvelle ? t.enregistrerNouvelle : t.enregistrerChangements}
          </Button>
          <Button type="button" variant="ghost" onClick={fermer}>
            {retour?.ok ? t.fermer : t.annuler}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
