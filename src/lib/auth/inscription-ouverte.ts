import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { pendingRegistrations, users } from "@/db/schema";
import { newId } from "./session";
import { generateToken, hashToken } from "./tokens";

/**
 * Inscription ouverte : n'importe qui peut demander un compte avec son
 * adresse e-mail. Le compte n'existe qu'après confirmation du lien reçu.
 *
 * Ce qui tient la porte :
 * - l'adresse est prouvée avant qu'un compte n'existe : pas de compte vide,
 *   pas de pseudo réservé par un robot ;
 * - le lien expire vite et ne sert qu'une fois ;
 * - la confirmation se fait par un bouton, pas au simple chargement du lien :
 *   les filtres anti-hameçonnage des messageries ouvrent les liens des mails,
 *   et ne doivent pas créer le compte à la place de la personne ;
 * - le captcha, la limitation de débit et le piège à robots sont dans
 *   l'action qui reçoit le formulaire.
 */

/** Une heure : le temps d'ouvrir sa boîte mail, pas plus. */
export const CONFIRMATION_DUREE_MS = 60 * 60 * 1000;

export type Demande =
  | { ok: true; token: string }
  | { ok: false; raison: "pseudo" | "email" };

/**
 * Enregistre la demande et rend le jeton à envoyer par mail.
 *
 * Une adresse déjà inscrite est refusée ici, mais l'action appelante ne doit
 * pas le dire au formulaire : le message est le même qu'en cas de succès,
 * sinon le formulaire servirait à savoir qui a un compte.
 */
export function demanderInscription(email: string, pseudo: string, passwordHash: string): Demande {
  const maintenant = new Date();
  db.delete(pendingRegistrations).where(lt(pendingRegistrations.expiresAt, maintenant)).run();

  const pseudoPris = db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.pseudo}) = ${pseudo.toLowerCase()}`)
    .get();
  if (pseudoPris) return { ok: false, raison: "pseudo" };

  const emailPris = db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .get();
  if (emailPris) return { ok: false, raison: "email" };

  // Une nouvelle demande remplace la précédente pour la même adresse : un
  // seul lien valable à la fois, le dernier envoyé.
  db.delete(pendingRegistrations).where(eq(pendingRegistrations.email, email)).run();

  const token = generateToken();
  db.insert(pendingRegistrations)
    .values({
      id: newId(),
      email,
      pseudo,
      passwordHash,
      code: hashToken(token),
      expiresAt: new Date(maintenant.getTime() + CONFIRMATION_DUREE_MS),
    })
    .run();
  return { ok: true, token };
}

/** Ce que la page de confirmation affiche avant que la personne ne clique. */
export function apercuDemande(token: string): { pseudo: string; email: string } | null {
  return (
    db
      .select({ pseudo: pendingRegistrations.pseudo, email: pendingRegistrations.email })
      .from(pendingRegistrations)
      .where(
        and(eq(pendingRegistrations.code, hashToken(token)), gt(pendingRegistrations.expiresAt, new Date())),
      )
      .get() ?? null
  );
}

export type Confirmation =
  | { ok: true; userId: string }
  | { ok: false; raison: "jeton" | "pseudo" | "email" };

/**
 * Crée le compte et consomme la demande, en une transaction. Le pseudo et
 * l'adresse sont revérifiés : quelqu'un a pu les prendre entre la demande et
 * la confirmation.
 */
export function confirmerInscription(token: string): Confirmation {
  const code = hashToken(token);
  return db.transaction((tx) => {
    const demande = tx
      .select()
      .from(pendingRegistrations)
      .where(and(eq(pendingRegistrations.code, code), gt(pendingRegistrations.expiresAt, new Date())))
      .get();
    if (!demande) return { ok: false, raison: "jeton" } as const;

    const pseudoPris = tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.pseudo}) = ${demande.pseudo.toLowerCase()}`)
      .get();
    if (pseudoPris) return { ok: false, raison: "pseudo" } as const;

    const emailPris = tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${demande.email}`)
      .get();
    if (emailPris) return { ok: false, raison: "email" } as const;

    const userId = newId();
    tx.insert(users)
      .values({
        id: userId,
        pseudo: demande.pseudo,
        email: demande.email,
        passwordHash: demande.passwordHash,
        role: "USER",
      })
      .run();
    tx.delete(pendingRegistrations).where(eq(pendingRegistrations.id, demande.id)).run();
    return { ok: true, userId } as const;
  });
}
