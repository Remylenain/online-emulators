"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env, mailEnabled } from "@/lib/env";
import { sendPasswordReset, sendRegistrationConfirmation } from "@/lib/mail";
import { inscriptionsOuvertes } from "@/lib/parametres";
import { rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/turnstile";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  openRegisterSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";
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
  const parsed = loginSchema.safeParse({
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
    return {
      message: `Trop de tentatives. Nouvel essai dans ${Math.ceil(wait / 60)} minute(s).`,
    };
  }

  const user = await db
    .select()
    .from(users)
    .where(sql`lower(${users.pseudo}) = ${identifier} or lower(${users.email}) = ${identifier}`)
    .get();

  // Message identique dans tous les cas d'échec : le formulaire ne doit pas
  // révéler si un pseudo ou une adresse existe.
  const invalid = { message: "Identifiant ou mot de passe incorrect." };

  if (!user) {
    // Vérification contre une empreinte factice mais réelle : sans elle, une
    // réponse immédiate trahirait qu'aucun compte ne porte cet identifiant.
    await verifyPassword(await decoyHash(), parsed.data.password);
    return invalid;
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) return invalid;

  if (!user.isActive) {
    return { message: "Ce compte est désactivé. Contacte l'administrateur du site." };
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
  const parsed = registerSchema.safeParse({
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
    return { message: "Trop de tentatives. Réessaie plus tard." };
  }

  // Le mot de passe est haché avant la transaction : le hachage est lent, et
  // la base ne doit pas rester verrouillée pendant ce temps.
  const passwordHash = await hashPassword(parsed.data.password);
  const inscription = inscrireAvecJeton(parsed.data.token, parsed.data.pseudo, passwordHash);

  if (!inscription.ok) {
    return inscription.raison === "pseudo"
      ? { errors: { pseudo: `Le pseudo « ${parsed.data.pseudo} » est déjà pris.` } }
      : {
          message:
            "Ce lien n'est plus valable : il a expiré, ou il a déjà servi. Demande un nouveau lien à l'administrateur.",
        };
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

const INSCRIPTIONS_FERMEES = "Les inscriptions sont fermées : les comptes se créent sur invitation.";

export async function requestRegistration(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!inscriptionsOuvertes()) return { message: INSCRIPTIONS_FERMEES };

  const parsed = openRegisterSchema.safeParse({
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
      return { done: true, message: MAIL_PARTI };
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
    return { message: "Trop de demandes. Réessaie dans une heure." };
  }

  const captchaOk = await verifyCaptcha(parsed.data.captchaToken ?? null, ip);
  if (!captchaOk) {
    return { errors: { captcha: "La vérification anti-robot a échoué. Recharge la page." } };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const demande = demanderInscription(parsed.data.email, parsed.data.pseudo, passwordHash);

  if (!demande.ok) {
    // Un pseudo pris se dit : il est visible de tous sur le site. Une adresse
    // déjà inscrite ne se dit pas, pour ne pas révéler qui a un compte.
    if (demande.raison === "pseudo") {
      return { errors: { pseudo: `Le pseudo « ${parsed.data.pseudo} » est déjà pris.` } };
    }
    return { done: true, message: MAIL_PARTI };
  }

  const url = `${env.PUBLIC_URL}/inscription/confirmer?token=${encodeURIComponent(demande.token)}`;
  try {
    await sendRegistrationConfirmation(parsed.data.email, parsed.data.pseudo, url);
  } catch (error) {
    console.error("[inscription] envoi du mail impossible", error);
    return {
      message:
        "L'envoi du mail a échoué. Préviens l'administrateur du site, le problème est de son côté.",
    };
  }

  return { done: true, message: MAIL_PARTI };
}

const MAIL_PARTI =
  "Si cette adresse est libre, un mail de confirmation vient d'y être envoyé. Il est valable une heure. Pense aux indésirables.";

export async function confirmRegistration(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Fermées entre la demande et la confirmation : la porte est fermée.
  if (!inscriptionsOuvertes()) return { message: INSCRIPTIONS_FERMEES };

  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) return { message: "Lien incomplet." };

  const { ip, userAgent } = await requestContext();
  const limit = rateLimit(`inscription-confirmer:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { message: "Trop de tentatives. Réessaie plus tard." };

  const confirmation = confirmerInscription(token);
  if (!confirmation.ok) {
    return {
      message:
        confirmation.raison === "jeton"
          ? "Ce lien n'est plus valable : il a expiré, ou il a déjà servi. Refais une demande d'inscription."
          : confirmation.raison === "pseudo"
            ? "Ce pseudo a été pris entre-temps. Refais une demande avec un autre pseudo."
            : "Un compte existe déjà avec cette adresse. Connecte-toi, ou demande un nouveau mot de passe.",
    };
  }

  const session = await createSession(confirmation.userId, { ip, userAgent });
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/");
}

// ---------------------------------------------------------------------------
// Mot de passe oublié
// ---------------------------------------------------------------------------

const SANS_MAIL = "Demande à l'administrateur de te donner un nouveau mot de passe.";

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Sans serveur de mail, aucun lien ne peut partir : la page l'annonce déjà,
  // l'action ne fait pas semblant d'avoir envoyé quelque chose.
  if (!mailEnabled) return { message: SANS_MAIL };

  const parsed = forgotPasswordSchema.safeParse({
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
    return { message: "Trop de demandes. Réessaie dans une heure." };
  }

  const captchaOk = await verifyCaptcha(parsed.data.captchaToken ?? null, ip);
  if (!captchaOk) {
    return { errors: { captcha: "La vérification anti-robot a échoué. Recharge la page." } };
  }

  const user = await db.select().from(users).where(eq(users.email, parsed.data.email)).get();

  // Réponse identique qu'un compte existe ou non : sinon le formulaire devient
  // un moyen de savoir qui est inscrit.
  if (user && user.isActive && user.email) {
    const token = await createPasswordResetToken(user.id);
    const url = `${env.PUBLIC_URL}/reinitialiser?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordReset(user.email, user.pseudo, url);
    } catch (error) {
      console.error("[reset] envoi du mail impossible", error);
      return {
        message:
          "L'envoi du mail a échoué. Préviens l'administrateur du site, le problème est de son côté.",
      };
    }
  }

  return {
    done: true,
    message:
      "Si un compte correspond à cette adresse, un lien de réinitialisation vient d'y être envoyé. Il est valable une heure.",
  };
}

export async function resetPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
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
    return { message: "Trop de tentatives. Réessaie plus tard." };
  }

  const userId = await consumePasswordResetToken(parsed.data.token);
  if (!userId) {
    return {
      message:
        "Ce lien n'est plus valable : il a expiré, ou il a déjà servi. Demandes-en un nouveau.",
    };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Un mot de passe change souvent parce qu'il a fuité : on coupe toutes les
  // sessions existantes, y compris celle d'un éventuel intrus.
  await destroyAllSessions(userId);

  return {
    done: true,
    message: "Mot de passe modifié. Tu peux te connecter.",
  };
}
