"use server";

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { favorites, games, playSessions, ratings, saveFiles, saveStates, sessions, userGames, users } from "@/db/schema";
import fs from "node:fs/promises";
import { MODES_ACCES, type ModeAcces } from "@/lib/acces";
import { requireAdmin } from "@/lib/auth/guard";
import { voirComme } from "@/lib/auth/session";
import { paths } from "@/lib/paths";
import {
  creerLienInscription,
  INSCRIPTION_PLAFONDS,
  revoquerLienInscription,
} from "@/lib/auth/invitations";
import { dureeValide, INSCRIPTION_DUREE_PAR_DEFAUT } from "@/lib/auth/inscription";
import { hashPassword } from "@/lib/auth/password";
import {
  createPasswordResetToken,
  INVITATION_TOKEN_DURATION_MS,
  newId,
} from "@/lib/auth/session";
import { env } from "@/lib/env";
import { definirMargeLink, MARGE_MAX, MARGE_MIN } from "@/lib/link/capacite";
import {
  definirConfigCaptcha,
  definirConfigMail,
  definirConfigScraper,
  definirIdentite,
  definirLangueDuSite,
  definirInscriptionsOuvertes,
  effacerConfigCaptcha,
  effacerConfigMail,
  effacerConfigScraper,
  inscriptionsOuvrables,
  langueDuSite,
  mailActif,
} from "@/lib/parametres";
import { estLangue } from "@/lib/i18n/langues";
import { textes } from "@/lib/i18n/serveur";
import { sendMail } from "@/lib/mail";
import {
  manifestSchema,
  manifestToColumns,
  type Manifest,
} from "@/lib/library/manifest";
import {
  appliquerRetouche,
  CHAMPS_RETOUCHABLES,
  ecrireRetouche,
  lireRetouche,
  retoucheSchema,
} from "@/lib/library/retouches";
import { sendInvitation } from "@/lib/mail";
import { ecrireSauvegarde, TAILLE_MAX_SAUVEGARDE } from "@/lib/saves";
import { normalizeForSearch, schemasDeValidation } from "@/lib/validation";

/**
 * Actions d'administration.
 *
 * Chacune commence par `requireAdmin()` : le menu ne montre l'entrée qu'aux
 * administrateurs, mais une action reste une adresse que n'importe qui peut
 * appeler. Le contrôle se fait ici, pas dans l'affichage.
 *
 * Vient ensuite `textes()` : chaque message renvoyé à l'écran est lu dans le
 * dictionnaire `adminActions`, dans la langue de l'administrateur qui agit.
 */

export type Resultat =
  | {
      ok: true;
      message?: string;
      /** Mot de passe provisoire, à transmettre de vive voix. */
      motDePasse?: string;
      /** Lien où la personne choisit elle-même son mot de passe. */
      lien?: string;
      /** Ce que le lien permet, affiché sous lui. Sinon : le texte du lien d'accès. */
      lienLibelle?: string;
      /** L'invitation est-elle aussi partie par mail ? */
      mailEnvoye?: boolean;
    }
  | { ok: false; message: string };

/**
 * Les bornes des réglages, dites une fois : le contrôle et le message qui
 * l'explique lisent la même valeur.
 */
const NOM_DU_SITE = { min: 2, max: 40 };
const DESCRIPTION_MAX = 120;
const NOM_D_APPLICATION_MAX = 40;
const PORT = { min: 1, max: 65535 };
const CLE_CAPTCHA_MAX = 200;

/**
 * Mot de passe lisible à l'oral, sans caractères ambigus — un zéro et un O se
 * confondent quand on dicte un mot de passe à quelqu'un.
 */
function motDePasseAleatoire(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(20), (octet) => alphabet[octet % alphabet.length]).join("");
}

export async function creerCompte(_etat: unknown, donnees: FormData): Promise<Resultat> {
  const admin = await requireAdmin();
  const dictionnaire = await textes();
  const t = dictionnaire.adminActions.comptes;
  // Les schémas disent eux-mêmes ce qui ne va pas : on leur donne leurs
  // messages dans la langue de l'administrateur.
  const { pseudoSchema, optionalEmailSchema } = schemasDeValidation(dictionnaire.validation);

  const pseudo = pseudoSchema.safeParse(donnees.get("pseudo"));
  if (!pseudo.success) {
    return { ok: false, message: pseudo.error.issues[0]?.message ?? t.pseudoInvalide };
  }

  // Facultative : un ami sans adresse aura un compte quand même. Il ne pourra
  // simplement pas réinitialiser son mot de passe seul.
  const email = optionalEmailSchema.safeParse(donnees.get("email"));
  if (!email.success) {
    return { ok: false, message: email.error.issues[0]?.message ?? t.adresseInvalide };
  }

  const doublon = await db
    .select({ pseudo: users.pseudo, email: users.email })
    .from(users)
    .where(
      email.data === null
        ? sql`lower(${users.pseudo}) = ${pseudo.data.toLowerCase()}`
        : sql`lower(${users.pseudo}) = ${pseudo.data.toLowerCase()} or lower(${users.email}) = ${email.data}`,
    )
    .get();

  if (doublon) {
    return {
      ok: false,
      message:
        email.data !== null && doublon.email === email.data
          ? t.adresseDejaPrise(email.data)
          : t.pseudoDejaPris(doublon.pseudo),
    };
  }

  const motDePasse = motDePasseAleatoire();
  const id = newId();
  db.insert(users)
    .values({
      id,
      pseudo: pseudo.data,
      email: email.data,
      passwordHash: await hashPassword(motDePasse),
      role: donnees.get("admin") === "on" ? "ADMIN" : "USER",
    })
    .run();

  const { lien, mailEnvoye } = await preparerInvitation(id, pseudo.data, email.data, admin.pseudo);

  revalidatePath("/admin");
  // Les deux voies sont offertes : le lien, où la personne choisit son mot de
  // passe, et le mot de passe provisoire pour le lui donner de vive voix. Ni
  // l'un ni l'autre n'est écrit ailleurs qu'ici.
  return {
    ok: true,
    message: t.cree(pseudo.data),
    motDePasse,
    lien,
    mailEnvoye,
  };
}

/**
 * Crée le lien d'invitation et tente de l'envoyer par mail.
 *
 * L'échec de l'envoi n'est pas une erreur : le lien reste affiché, et
 * l'administrateur le transmet comme il veut. Tant qu'aucun serveur de mail
 * n'est configuré, c'est même le cas normal.
 *
 * Le mail part dans la langue par défaut du site, pas dans celle de
 * l'administrateur : c'est l'invité qui le lit, et il n'a encore rien choisi.
 */
async function preparerInvitation(
  userId: string,
  pseudo: string,
  email: string | null,
  invitePar: string,
): Promise<{ lien: string; mailEnvoye: boolean }> {
  const token = await createPasswordResetToken(userId, INVITATION_TOKEN_DURATION_MS);
  const lien = `${env.PUBLIC_URL}/reinitialiser?token=${encodeURIComponent(token)}&bienvenue=1`;

  if (!mailActif() || email === null) return { lien, mailEnvoye: false };

  try {
    await sendInvitation(email, pseudo, lien, invitePar, langueDuSite());
    return { lien, mailEnvoye: true };
  } catch (erreur) {
    console.error("[invitation] envoi impossible", erreur);
    return { lien, mailEnvoye: false };
  }
}

/** Refait un lien d'invitation pour un compte existant. */
export async function renvoyerInvitation(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();
  const t = (await textes()).adminActions.comptes;

  const compte = await db
    .select({ pseudo: users.pseudo, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: t.introuvable };

  const { lien, mailEnvoye } = await preparerInvitation(
    userId,
    compte.pseudo,
    compte.email,
    admin.pseudo,
  );

  return {
    ok: true,
    message: t.nouveauLien(compte.pseudo),
    lien,
    mailEnvoye,
  };
}

/**
 * Lien d'inscription : la personne qui le reçoit crée son compte elle-même,
 * pseudo compris. À donner de la main à la main ; il vit une journée, une
 * semaine ou un mois, et vaut pour autant de comptes que l'administrateur l'a
 * décidé.
 */
export async function creerInvitation(plafond: number, jours: number = INSCRIPTION_DUREE_PAR_DEFAUT): Promise<Resultat> {
  const admin = await requireAdmin();
  const t = (await textes()).adminActions.invitations;
  if (!INSCRIPTION_PLAFONDS.includes(plafond as (typeof INSCRIPTION_PLAFONDS)[number])) {
    return { ok: false, message: t.plafondInvalide };
  }
  if (!dureeValide(jours)) return { ok: false, message: t.dureeInvalide };

  const { token } = await creerLienInscription(admin.id, plafond, jours);
  revalidatePath("/admin/comptes");
  return {
    ok: true,
    message: t.cree,
    lien: `${env.PUBLIC_URL}/inscription?token=${encodeURIComponent(token)}`,
    lienLibelle: t.aTransmettre(plafond, jours),
  };
}

/**
 * « Voir comme » : regarder le site avec les yeux d'un autre compte — son
 * catalogue selon son mode d'accès, ses parties, ses salons. Tout ce qu'on y
 * fait (jouer, noter) compte pour ce compte ; le bandeau le rappelle, et le
 * bouton du bandeau ramène à soi.
 */
export async function voirLeSiteComme(userId: string): Promise<void> {
  await requireAdmin();
  const refus = await voirComme(userId);
  if (refus) throw new Error((await textes()).adminActions.comptes.voirComme[refus]);
  redirect("/");
}

/** Nom et phrase d'accueil du site, affichés partout. */
export async function definirNomDuSite(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages.identite;
  const nom = String(donnees.get("nom") ?? "").trim();
  const description = String(donnees.get("description") ?? "").trim();
  if (nom.length < NOM_DU_SITE.min || nom.length > NOM_DU_SITE.max) {
    return { ok: false, message: t.nom(NOM_DU_SITE.min, NOM_DU_SITE.max) };
  }
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, message: t.description(DESCRIPTION_MAX) };
  }
  const application = String(donnees.get("application") ?? "").trim();
  if (application.length > NOM_D_APPLICATION_MAX) {
    return { ok: false, message: t.application(NOM_D_APPLICATION_MAX) };
  }
  const langue = String(donnees.get("langue") ?? "");
  if (!estLangue(langue)) return { ok: false, message: t.langueInconnue };
  definirIdentite(nom, description, application);
  definirLangueDuSite(langue);
  revalidatePath("/", "layout");
  return { ok: true, message: t.enregistree };
}

/**
 * Le relais d'e-mails, réglé depuis l'administration. Le mot de passe laissé
 * vide garde celui déjà enregistré : il n'est jamais renvoyé au navigateur,
 * on ne peut donc pas le « ressaisir tel quel ».
 */
export async function definirMail(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages;
  const host = String(donnees.get("host") ?? "").trim();
  const port = Number(donnees.get("port"));
  const user = String(donnees.get("user") ?? "").trim();
  const password = String(donnees.get("password") ?? "");
  const from = String(donnees.get("from") ?? "").trim();
  if (!host || host.length > 255) return { ok: false, message: t.mail.hoteObligatoire };
  if (!Number.isInteger(port) || port < PORT.min || port > PORT.max) return { ok: false, message: t.mail.port(PORT.min, PORT.max) };
  if (user.length > 255 || from.length > 255 || password.length > 500) return { ok: false, message: t.valeurTropLongue };

  definirConfigMail({ host, port, user, from, ...(password ? { password } : {}) });
  revalidatePath("/admin/reglages");
  revalidatePath("/admin/comptes");
  return { ok: true, message: t.mail.enregistre };
}

/** Revient au relais de l'environnement du serveur, s'il y en a un. */
export async function oublierMail(): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages;
  effacerConfigMail();
  revalidatePath("/admin/reglages");
  revalidatePath("/admin/comptes");
  return { ok: true, message: t.efface };
}

/** Un e-mail de test, pour savoir tout de suite si le relais accepte. */
export async function envoyerMailDeTest(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages.mail;
  const destinataire = String(donnees.get("destinataire") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) return { ok: false, message: t.destinataireInvalide };
  if (!mailActif()) return { ok: false, message: t.aucunRelais };
  try {
    // L'administrateur se l'envoie à lui-même : l'e-mail est dans sa langue.
    await sendMail({
      to: destinataire,
      subject: t.test.objet,
      text: t.test.texte,
    });
  } catch (erreur) {
    // Le message du relais (« 535 Authentication failed »…) est ce qui permet de corriger.
    return { ok: false, message: t.refus(erreur instanceof Error ? erreur.message : undefined) };
  }
  return { ok: true, message: t.envoye(destinataire) };
}

/** Les clés Turnstile du captcha. La clé secrète laissée vide garde celle enregistrée. */
export async function definirCaptcha(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages.captcha;
  const siteKey = String(donnees.get("siteKey") ?? "").trim();
  const secretKey = String(donnees.get("secretKey") ?? "").trim();
  if (!siteKey || siteKey.length > CLE_CAPTCHA_MAX || secretKey.length > CLE_CAPTCHA_MAX) return { ok: false, message: t.cleObligatoire(CLE_CAPTCHA_MAX) };
  definirConfigCaptcha(siteKey, secretKey || undefined);
  revalidatePath("/admin/reglages");
  revalidatePath("/admin/comptes");
  return { ok: true, message: t.enregistre };
}

export async function oublierCaptcha(): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages;
  effacerConfigCaptcha();
  revalidatePath("/admin/reglages");
  revalidatePath("/admin/comptes");
  return { ok: true, message: t.efface };
}

/**
 * Le compte ScreenScraper dont se sert « Compléter les fiches ». Comme pour
 * le relais d'e-mails, un mot de passe laissé vide garde celui enregistré.
 */
export async function definirScraper(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages;
  const devId = String(donnees.get("devId") ?? "").trim();
  const devPassword = String(donnees.get("devPassword") ?? "");
  const ssId = String(donnees.get("ssId") ?? "").trim();
  const ssPassword = String(donnees.get("ssPassword") ?? "");
  if ([devId, devPassword, ssId, ssPassword].some((valeur) => valeur.length > 200)) {
    return { ok: false, message: t.valeurTropLongue };
  }
  definirConfigScraper({
    devId,
    ssId,
    ...(devPassword ? { devPassword } : {}),
    ...(ssPassword ? { ssPassword } : {}),
  });
  revalidatePath("/admin/reglages");
  return {
    ok: true,
    message: devId ? t.scraper.enregistre : t.scraper.sansIdentifiant,
  };
}

export async function oublierScraper(): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages.scraper;
  effacerConfigScraper();
  revalidatePath("/admin/reglages");
  return { ok: true, message: t.efface };
}

/**
 * Part du processeur laissée au câble link. Les coûts par salon, eux, se
 * mesurent sur le serveur (`npm run link:capacite -- --appliquer`).
 */
export async function definirMargeCableLink(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.reglages.link;
  const marge = Number(donnees.get("marge"));
  if (!Number.isInteger(marge) || marge < MARGE_MIN || marge > MARGE_MAX) {
    return { ok: false, message: t.marge(MARGE_MIN, MARGE_MAX) };
  }
  definirMargeLink(marge);
  revalidatePath("/admin/reglages");
  return { ok: true, message: t.enregistree };
}

/**
 * Ouvrir ou fermer les inscriptions. Ouvertes, n'importe qui crée un compte
 * avec une adresse e-mail confirmée, derrière un captcha : à ne faire qu'en
 * sachant que tout le catalogue devient accessible à qui s'inscrit.
 */
export async function definirInscriptions(ouvertes: boolean): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.invitations;
  if (ouvertes && !inscriptionsOuvrables()) {
    return { ok: false, message: t.ouvertureImpossible };
  }
  definirInscriptionsOuvertes(ouvertes);
  revalidatePath("/admin/comptes");
  revalidatePath("/connexion");
  revalidatePath("/inscription");
  return { ok: true, message: ouvertes ? t.ouvertes : t.fermees };
}

export async function revoquerInvitation(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.invitations;
  const fait = await revoquerLienInscription(id);
  revalidatePath("/admin/comptes");
  return fait ? { ok: true, message: t.revoque } : { ok: false, message: t.dejaRevoque };
}

/** Ce que le compte voit du catalogue : normal, restreint ou testeur. */
export async function definirModeAcces(userId: string, mode: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.comptes;
  if (!MODES_ACCES.some((m) => m.valeur === mode)) return { ok: false, message: t.modeInconnu };
  const resultat = db
    .update(users)
    .set({ accessMode: mode as ModeAcces, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();
  if (resultat.changes === 0) return { ok: false, message: t.introuvable };
  revalidatePath("/admin/comptes");
  // Une phrase entière par mode, lue dans le dictionnaire : les libellés de
  // `MODES_ACCES` ne s'assemblent pas en phrase dans une autre langue.
  return { ok: true, message: t.acces[mode as ModeAcces] };
}

/** Les jeux attribués à un compte restreint ou testeur : la liste cochée remplace l'ancienne. */
export async function definirJeuxAttribues(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.comptes;
  const userId = String(donnees.get("userId") ?? "");
  const choisis = donnees.getAll("jeux").map(String);

  const compte = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!compte) return { ok: false, message: t.introuvable };

  // Seuls des identifiants de jeux existants : la liste vient d'un formulaire.
  const valides =
    choisis.length === 0
      ? []
      : (await db.select({ id: games.id }).from(games).where(inArray(games.id, choisis)).all()).map(
          (g) => g.id,
        );

  db.transaction((tx) => {
    tx.delete(userGames).where(eq(userGames.userId, userId)).run();
    if (valides.length > 0) {
      tx.insert(userGames)
        .values(valides.map((gameId) => ({ userId, gameId })))
        .run();
    }
  });
  revalidatePath("/admin/comptes");
  return { ok: true, message: t.jeuxAttribues(valides.length) };
}

/**
 * Remise à zéro d'un compte : sauvegardes, copies de secours, points de
 * reprise, temps de jeu et notes disparaissent. Le compte, son pseudo, son
 * mot de passe et ses réglages restent. Pour repartir d'une page blanche —
 * un compte de démonstration qu'on prête, par exemple.
 */
export async function remettreAZero(userId: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.comptes;
  const compte = await db
    .select({ id: users.id, pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: t.introuvable };

  const touches = await jeuxTouches(userId);

  db.transaction((tx) => {
    // Les copies de secours suivent la sauvegarde par cascade.
    tx.delete(saveFiles).where(eq(saveFiles.userId, userId)).run();
    tx.delete(saveStates).where(eq(saveStates.userId, userId)).run();
    tx.delete(playSessions).where(eq(playSessions.userId, userId)).run();
    tx.delete(ratings).where(eq(ratings.userId, userId)).run();
    tx.delete(favorites).where(eq(favorites.userId, userId)).run();
    recalculerCompteurs(tx, touches);
  });

  await effacerFichiersDeJeu(userId);

  revalidatePath("/admin/comptes");
  revalidatePath("/admin/temps");
  return { ok: true, message: t.remisAZero(compte.pseudo) };
}

/** Les jeux où ce compte a joué ou noté : leurs compteurs sont à refaire après son départ. */
async function jeuxTouches(userId: string): Promise<Set<string>> {
  const touches = new Set<string>();
  for (const table of [playSessions, ratings] as const) {
    for (const l of await db.select({ gameId: table.gameId }).from(table).where(eq(table.userId, userId)).all()) {
      touches.add(l.gameId);
    }
  }
  return touches;
}

/** Nombre de parties et note moyenne sont dénormalisés sur le jeu : on les recompte. */
function recalculerCompteurs(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  jeux: Set<string>,
): void {
  for (const gameId of jeux) {
    tx.update(games)
      .set({
        playCount: sql`(select count(*) from ${playSessions} where ${playSessions.gameId} = ${gameId})`,
        ratingAvg: sql`coalesce((select avg(${ratings.score}) from ${ratings} where ${ratings.gameId} = ${gameId}), 0)`,
        ratingCount: sql`(select count(*) from ${ratings} where ${ratings.gameId} = ${gameId})`,
      })
      .where(eq(games.id, gameId))
      .run();
  }
}

/** Les fichiers de jeu d'un compte : `saves/<compte>/` et `states/<compte>/`. */
async function effacerFichiersDeJeu(userId: string): Promise<void> {
  await fs.rm(paths.data(path.posix.join("saves", userId)), { recursive: true, force: true });
  await fs.rm(paths.data(path.posix.join("states", userId)), { recursive: true, force: true });
}

/**
 * Suppression définitive d'un compte, avec tout ce qui lui appartenait.
 *
 * Réservée aux comptes déjà désactivés : désactiver ferme les sessions et
 * laisse le temps de se raviser ; supprimer ne se défait pas. Les deux gestes
 * sont séparés exprès.
 *
 * Ce qui part : le compte, ses sessions, ses sauvegardes et leurs copies, ses
 * points de reprise, son temps de jeu, ses notes, ses favoris, ses touches,
 * ses habillages, ses jeux attribués, son avatar — en base par les cascades
 * des clés étrangères, sur le disque par les dossiers à son nom. Les liens
 * d'inscription qu'il avait créés restent, sans auteur.
 */
export async function supprimerCompte(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();
  const t = (await textes()).adminActions.comptes;
  if (admin.id === userId) {
    return { ok: false, message: t.surSoi.supprimer };
  }

  const compte = await db
    .select({ pseudo: users.pseudo, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: t.introuvable };
  if (compte.isActive) {
    return { ok: false, message: t.desactiverDAbord(compte.pseudo) };
  }

  const touches = await jeuxTouches(userId);

  db.transaction((tx) => {
    tx.delete(users).where(eq(users.id, userId)).run();
    recalculerCompteurs(tx, touches);
  });

  await effacerFichiersDeJeu(userId);
  await fs.rm(paths.data(paths.avatar(userId)), { force: true });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.supprime(compte.pseudo) };
}

export async function basculerActivation(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();
  const t = (await textes()).adminActions.comptes;
  if (admin.id === userId) {
    return { ok: false, message: t.surSoi.desactiver };
  }

  const compte = await db
    .select({ isActive: users.isActive, pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: t.introuvable };

  const actif = !compte.isActive;
  db.update(users).set({ isActive: actif, updatedAt: new Date() }).where(eq(users.id, userId)).run();

  // Désactiver ferme les sessions ouvertes : sans cela, le compte continuerait
  // de naviguer jusqu'à l'expiration de son cookie.
  if (!actif) db.delete(sessions).where(eq(sessions.userId, userId)).run();

  revalidatePath("/admin");
  return { ok: true, message: actif ? t.actif(compte.pseudo) : t.desactive(compte.pseudo) };
}

export async function basculerAdministration(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();
  const t = (await textes()).adminActions.comptes;
  if (admin.id === userId) {
    return { ok: false, message: t.surSoi.retirerDroits };
  }

  const compte = await db
    .select({ role: users.role, pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: t.introuvable };

  const role = compte.role === "ADMIN" ? "USER" : "ADMIN";
  db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).run();

  revalidatePath("/admin");
  return {
    ok: true,
    message: role === "ADMIN" ? t.administrateur(compte.pseudo) : t.plusAdministrateur(compte.pseudo),
  };
}

export async function reinitialiserMotDePasse(userId: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.comptes;

  const compte = await db
    .select({ pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: t.introuvable };

  const motDePasse = motDePasseAleatoire();
  db.update(users)
    .set({ passwordHash: await hashPassword(motDePasse), updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();

  // Les sessions ouvertes sont fermées : un mot de passe réinitialisé doit
  // couper l'accès à qui l'utilisait.
  db.delete(sessions).where(eq(sessions.userId, userId)).run();

  revalidatePath("/admin");
  return { ok: true, message: t.nouveauMotDePasse(compte.pseudo), motDePasse };
}


/**
 * Dépose une sauvegarde de jeu sur le compte de quelqu'un.
 *
 * Sert à préparer des parties de test (le câble link en demande deux), ou à
 * reprendre la partie d'un ami faite sur un autre émulateur. Le fichier passe
 * par le même circuit que le lecteur : l'ancienne sauvegarde du compte part
 * dans les copies de secours, elle n'est jamais perdue.
 */
export async function importerSauvegarde(
  _etat: unknown,
  donnees: FormData,
): Promise<Resultat> {
  await requireAdmin();
  const { sauvegardes: t, comptes, bibliotheque } = (await textes()).adminActions;

  const userId = donnees.get("userId");
  const gameId = donnees.get("gameId");
  const fichier = donnees.get("fichier");
  if (typeof userId !== "string" || typeof gameId !== "string" || !gameId) {
    return { ok: false, message: t.choisirJeu };
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: t.choisirFichier };
  }
  if (fichier.size > TAILLE_MAX_SAUVEGARDE) {
    return { ok: false, message: t.tropGros };
  }

  const compte = await db
    .select({ pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: comptes.introuvable };

  const jeu = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu) return { ok: false, message: bibliotheque.jeuIntrouvable };

  const resultat = await ecrireSauvegarde(
    userId,
    gameId,
    new Uint8Array(await fichier.arrayBuffer()),
    null,
  );

  revalidatePath("/admin/comptes");
  return {
    ok: true,
    message:
      resultat.etat === "inchange"
        ? t.dejaLaMeme(compte.pseudo, jeu.title)
        : t.importee(jeu.title, compte.pseudo),
  };
}

/** Jeu tel qu'il faut le connaître pour le retoucher : son adresse et son manifeste. */
async function jeuRetouchable(gameId: string) {
  const jeu = await db
    .select({
      id: games.id,
      title: games.title,
      consoleSlug: games.consoleSlug,
      slug: games.slug,
      romPath: games.romPath,
      isPublished: games.isPublished,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu) return null;

  return { ...jeu, manifeste: await lireManifeste(jeu.romPath) };
}

/**
 * Manifeste du jeu, lu dans la bibliothèque.
 *
 * Il sert de référence : une valeur du formulaire identique au manifeste ne
 * devient pas une retouche, et un champ vidé revient au manifeste. Sans cette
 * comparaison, chaque enregistrement figerait tout le contenu du manifeste
 * dans la retouche, et corriger le `game.json` n'aurait plus aucun effet.
 */
async function lireManifeste(romPath: string): Promise<Manifest | null> {
  const chemin = path.join(env.LIBRARY_DIR, path.dirname(romPath), "game.json");
  try {
    const analyse = manifestSchema.safeParse(JSON.parse(await readFile(chemin, "utf8")));
    return analyse.success ? analyse.data : null;
  } catch {
    return null;
  }
}

export async function basculerPublication(gameId: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.bibliotheque;

  const jeu = await jeuRetouchable(gameId);
  if (!jeu) return { ok: false, message: t.jeuIntrouvable };

  const publie = !jeu.isPublished;

  /**
   * La bascule doit survivre au prochain scan.
   *
   * Elle n'était écrite qu'en base : le scan suivant relisait le manifeste et
   * republiait le jeu, sans rien dire. Elle passe maintenant par une retouche,
   * et n'est posée que si elle contredit le manifeste.
   */
  try {
    const retouche = await lireRetouche(jeu.consoleSlug, jeu.slug);
    if (publie === (jeu.manifeste?.publie ?? true)) delete retouche.publie;
    else retouche.publie = publie;
    await ecrireRetouche(jeu.consoleSlug, jeu.slug, retouche);
  } catch {
    return { ok: false, message: t.retouchesImpossibles };
  }

  db.update(games)
    .set({ isPublished: publie, updatedAt: new Date() })
    .where(eq(games.id, gameId))
    .run();

  revalidatePath("/admin/bibliotheque");
  revalidatePath("/", "layout");
  return { ok: true, message: publie ? t.publie(jeu.title) : t.retire(jeu.title) };
}

/**
 * Corrige les informations d'un jeu depuis l'administration.
 *
 * La saisie va dans une retouche à côté de la bibliothèque, puis la base est
 * mise à jour dans la foulée : attendre un scan pour voir sa correction
 * donnerait l'impression qu'il ne s'est rien passé. Le scan suivant relira la
 * même retouche et retrouvera le même résultat.
 */
export async function enregistrerRetouches(
  gameId: string,
  donnees: FormData,
): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminActions.bibliotheque;

  const jeu = await jeuRetouchable(gameId);
  if (!jeu) return { ok: false, message: t.jeuIntrouvable };

  const saisie: Record<string, unknown> = {};
  for (const champ of CHAMPS_RETOUCHABLES) {
    const brut = donnees.get(champ);
    const valeur = typeof brut === "string" ? brut.trim() : "";
    if (valeur === "") continue;
    saisie[champ] = champ === "annee" ? Number(valeur) : valeur;
  }

  const analyse = retoucheSchema.safeParse(saisie);
  if (!analyse.success) {
    const probleme = analyse.error.issues[0];
    return { ok: false, message: t.champInvalide(probleme?.path.join("."), probleme?.message) };
  }

  // On repart de la retouche existante pour ne pas effacer `publie`, qui se
  // règle par le bouton et non par ce formulaire.
  const retouche = await lireRetouche(jeu.consoleSlug, jeu.slug);
  for (const champ of CHAMPS_RETOUCHABLES) {
    const valeur = analyse.data[champ];
    // Vidé, ou identique au manifeste : ce n'est pas une retouche. Le champ
    // repart du manifeste, qui redevient seul maître de cette valeur.
    if (valeur === undefined || valeur === jeu.manifeste?.[champ]) delete retouche[champ];
    else Object.assign(retouche, { [champ]: valeur });
  }

  // La case « solo » n'est proposée que pour les consoles à câble link, et une
  // case décochée n'envoie rien : `soloPropose` dit qu'elle était à l'écran.
  // Comme le reste, elle n'est une retouche que si elle contredit le manifeste.
  if (donnees.get("soloPropose") === "1") {
    const solo = donnees.get("solo") === "on";
    if (solo === (jeu.manifeste?.solo ?? false)) delete retouche.solo;
    else retouche.solo = solo;
  }

  try {
    await ecrireRetouche(jeu.consoleSlug, jeu.slug, retouche);
  } catch {
    return { ok: false, message: t.retouchesImpossibles };
  }

  const colonnes = manifestToColumns(
    appliquerRetouche(jeu.manifeste ?? { titre: jeu.title, publie: true, officiel: false, solo: false }, retouche),
  );

  db.update(games)
    .set({
      title: colonnes.title,
      description: colonnes.description,
      author: colonnes.author,
      version: colonnes.version,
      language: colonnes.language,
      baseGame: colonnes.baseGame,
      year: colonnes.year,
      isSolo: colonnes.isSolo,
      // Le texte de recherche est dérivé : le laisser en arrière ferait
      // chercher un titre corrigé sans jamais le trouver.
      searchText: normalizeForSearch(
        [colonnes.title, colonnes.author, colonnes.baseGame].filter(Boolean).join(" "),
      ),
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))
    .run();

  revalidatePath("/admin/bibliotheque");
  revalidatePath("/", "layout");

  const nombre = Object.keys(retouche).filter((cle) => cle !== "publie").length;
  return {
    ok: true,
    message:
      nombre === 0 ? t.suitSonManifeste(colonnes.title) : t.enregistre(colonnes.title, nombre),
  };
}
