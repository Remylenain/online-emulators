"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";
import { sendPasswordReset, sendRegistrationConfirmation } from "@/lib/mail";
import { inscriptionsOuvertes, mailActif } from "@/lib/parametres";
import { rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/turnstile";
import { fieldErrors, schemasDeValidation } from "@/lib/validation";
import { confirmerInscription, demanderInscription } from "./inscription-ouverte";
import { inscrireAvecJeton } from "./invitations";
import { hashPassword, verifyPassword } from "./password";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  destroyAllSessions,
  destroyCurrentSession,
  setSessionCookie,
  voirComme,
} from "./session";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  done?: boolean;
};

/**
 * Empreinte factice, calculée une seule fois, servant de leurre quand aucun
 * compte ne correspond à l'identifiant saisi : la vérification coûte alors le
 * même temps qu'un vrai échec de mot de passe.
 */
let decoyHashPromise: Promise<string> | null = null;
function decoyHash(): Promise<string> {
  decoyHashPromise ??= hashPassword(randomUUID());
  return decoyHashPromise;
}

async function requestContext(): Promise<{ ip: string; userAgent: string | null }> {
  const list = await headers();
  // Derrière nginx, l'adresse réelle arrive dans X-Forwarded-For.
  const forwarded = list.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || list.get("x-real-ip") || "inconnue";
  return { ip, userAgent: list.get("user-agent") };
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = await textes();
  const parsed = schemasDeValidation(t.validation).loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { ip, userAgent } = await requestContext();

  // Deux limites : l'une par compte visé, l'autre par origine. La première
  // protège un compte précis du bourrinage, la seconde empêche de balayer
  // plusieurs comptes depuis la même machine.
  const identifier = parsed.data.identifier.toLowerCase();
  const perAccount = rateLimit(`login:id:${identifier}`, {
    limit: 8,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });
  const perIp = rateLimit(`login:ip:${ip}`, {
    limit: 25,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });

  if (!perAccount.allowed || !perIp.allowed) {
    const wait = Math.max(perAccount.retryAfter, perIp.retryAfter);
    return { message: t.connexion.entree.tropDeTentatives(Math.ceil(wait / 60)) };
  }

  const user = await db
    .select()
    .from(users)
    .where(sql`lower(${users.pseudo}) = ${identifier} or lower(${users.email}) = ${identifier}`)
    .get();

  // Message identique dans tous les cas d'échec : le formulaire ne doit pas
  // révéler si un pseudo ou une adresse existe.
  const invalid = { message: t.connexion.entree.identifiantsIncorrects };

  if (!user) {
    // Vérification contre une empreinte factice mais réelle : sans elle, une
    // réponse immédiate trahirait qu'aucun compte ne porte cet identifiant.
    await verifyPassword(await decoyHash(), parsed.data.password);
    return invalid;
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) return invalid;

  if (!user.isActive) {
    return { message: t.connexion.entree.compteDesactive };
  }

  const { token, expiresAt } = await createSession(user.id, { ip, userAgent });
  await setSessionCookie(token, expiresAt);

  redirect(safeNext(formData.get("suite")));
}

/**
 * Destination après connexion. N'accepte qu'un chemin interne : sans ce
 * filtre, « /connexion?suite=https://ailleurs » ferait du formulaire un
 * tremplin de redirection vers un site tiers.
 */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/")) return "/";
  // « //ailleurs » et « /\ailleurs » sont lus comme des URLs absolues.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
  redirect("/connexion");
}

/** Fin de « voir comme » : l'administrateur retrouve son propre compte. */
export async function revenirAMonCompte(): Promise<void> {
  await voirComme(null);
  redirect("/admin/comptes");
}

// ---------------------------------------------------------------------------
// Inscription par lien
// ---------------------------------------------------------------------------

export async function register(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = await textes();
  const parsed = schemasDeValidation(t.validation).registerSchema.safeParse({
    token: formData.get("token"),
    pseudo: formData.get("pseudo"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { ip, userAgent } = await requestContext();
  const limit = rateLimit(`inscription:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return { message: t.connexion.erreurs.tropDeTentatives };
  }

  // Le mot de passe est haché avant la transaction : le hachage est lent, et
  // la base ne doit pas rester verrouillée pendant ce temps.
  const passwordHash = await hashPassword(parsed.data.password);
  const inscription = inscrireAvecJeton(parsed.data.token, parsed.data.pseudo, passwordHash);

  if (!inscription.ok) {
    return inscription.raison === "pseudo"
      ? { errors: { pseudo: t.connexion.erreurs.pseudoPris(parsed.data.pseudo) } }
      : { message: t.connexion.inscription.lienPerime };
  }

  // Le compte vient d'être créé par la personne elle-même : elle est connectée
  // dans la foulée, sans repasser par le formulaire de connexion.
  const { token, expiresAt } = await createSession(inscription.userId, { ip, userAgent });
  await setSessionCookie(token, expiresAt);
  redirect("/");
}

// ---------------------------------------------------------------------------
// Inscription ouverte : demande, puis confirmation par mail
// ---------------------------------------------------------------------------

export async function requestRegistration(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const langue = await langueDeLaRequete();
  const t = dictionnaire(langue);
  if (!inscriptionsOuvertes()) return { message: t.connexion.erreurs.inscriptionsFermees };

  // « Si cette adresse est libre… » : la même réponse que la demande ait
  // abouti ou non, pour ne rien révéler.
  const mailParti = t.connexion.inscription.mailParti;

  const parsed = schemasDeValidation(t.validation).openRegisterSchema.safeParse({
    email: formData.get("email"),
    pseudo: formData.get("pseudo"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    captchaToken: formData.get("cf-turnstile-response") ?? undefined,
    siteweb: formData.get("siteweb") ?? undefined,
  });
  if (!parsed.success) {
    // Le piège à robots rempli : on fait comme si tout allait bien, sans
    // rien enregistrer ni envoyer. Un robot n'a pas à savoir qu'il est vu.
    if (parsed.error.issues.some((issue) => issue.path[0] === "siteweb")) {
      return { done: true, message: mailParti };
    }
    return { errors: fieldErrors(parsed.error) };
  }

  const { ip } = await requestContext();
  // Par origine et par adresse : la première coupe les rafales, la seconde
  // empêche de harceler une boîte mail de confirmations.
  const perIp = rateLimit(`inscription-ouverte:ip:${ip}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  const perEmail = rateLimit(`inscription-ouverte:email:${parsed.data.email}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (!perIp.allowed || !perEmail.allowed) {
    return { message: t.connexion.erreurs.tropDeDemandes };
  }

  const captchaOk = await verifyCaptcha(parsed.data.captchaToken ?? null, ip);
  if (!captchaOk) {
    return { errors: { captcha: t.connexion.erreurs.captcha } };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const demande = demanderInscription(parsed.data.email, parsed.data.pseudo, passwordHash);

  if (!demande.ok) {
    // Un pseudo pris se dit : il est visible de tous sur le site. Une adresse
    // déjà inscrite ne se dit pas, pour ne pas révéler qui a un compte.
    if (demande.raison === "pseudo") {
      return { errors: { pseudo: t.connexion.erreurs.pseudoPris(parsed.data.pseudo) } };
    }
    return { done: true, message: mailParti };
  }

  const url = `${env.PUBLIC_URL}/inscription/confirmer?token=${encodeURIComponent(demande.token)}`;
  try {
    await sendRegistrationConfirmation(parsed.data.email, parsed.data.pseudo, url, langue);
  } catch (error) {
    console.error("[inscription] envoi du mail impossible", error);
    return { message: t.connexion.erreurs.envoiMail };
  }

  return { done: true, message: mailParti };
}

export async function confirmRegistration(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await textes();
  // Fermées entre la demande et la confirmation : la porte est fermée.
  if (!inscriptionsOuvertes()) return { message: t.connexion.erreurs.inscriptionsFermees };

  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) return { message: t.connexion.confirmation.lienIncomplet };

  const { ip, userAgent } = await requestContext();
  const limit = rateLimit(`inscription-confirmer:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { message: t.connexion.erreurs.tropDeTentatives };

  const confirmation = confirmerInscription(token);
  if (!confirmation.ok) {
    return {
      message:
        confirmation.raison === "jeton"
          ? t.connexion.confirmation.erreurs.lienPerime
          : confirmation.raison === "pseudo"
            ? t.connexion.confirmation.erreurs.pseudoPris
            : t.connexion.confirmation.erreurs.adressePrise,
    };
  }

  const session = await createSession(confirmation.userId, { ip, userAgent });
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/");
}

// ---------------------------------------------------------------------------
// Mot de passe oublié
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Sans serveur de mail, aucun lien ne peut partir : la page l'annonce déjà,
  // l'action ne fait pas semblant d'avoir envoyé quelque chose.
  const langue = await langueDeLaRequete();
  const t = dictionnaire(langue);
  if (!mailActif()) return { message: t.connexion.oubli.demandeAdministrateur };

  const parsed = schemasDeValidation(t.validation).forgotPasswordSchema.safeParse({
    email: formData.get("email"),
    captchaToken: formData.get("cf-turnstile-response") ?? undefined,
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { ip } = await requestContext();

  const limit = rateLimit(`reset:ip:${ip}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { message: t.connexion.erreurs.tropDeDemandes };
  }

  const captchaOk = await verifyCaptcha(parsed.data.captchaToken ?? null, ip);
  if (!captchaOk) {
    return { errors: { captcha: t.connexion.erreurs.captcha } };
  }

  const user = await db.select().from(users).where(eq(users.email, parsed.data.email)).get();

  // Réponse identique qu'un compte existe ou non : sinon le formulaire devient
  // un moyen de savoir qui est inscrit.
  if (user && user.isActive && user.email) {
    const token = await createPasswordResetToken(user.id);
    const url = `${env.PUBLIC_URL}/reinitialiser?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordReset(user.email, user.pseudo, url, langue);
    } catch (error) {
      console.error("[reset] envoi du mail impossible", error);
      return { message: t.connexion.erreurs.envoiMail };
    }
  }

  return { done: true, message: t.connexion.oubli.lienParti };
}

export async function resetPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await textes();
  const parsed = schemasDeValidation(t.validation).resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { ip } = await requestContext();
  const limit = rateLimit(`reset-use:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return { message: t.connexion.erreurs.tropDeTentatives };
  }

  const userId = await consumePasswordResetToken(parsed.data.token);
  if (!userId) {
    return { message: t.connexion.reinitialisation.lienPerime };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Un mot de passe change souvent parce qu'il a fuité : on coupe toutes les
  // sessions existantes, y compris celle d'un éventuel intrus.
  await destroyAllSessions(userId);

  return { done: true, message: t.connexion.reinitialisation.modifie };
}
