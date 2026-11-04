import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "./cookie";
import { generateToken, hashToken } from "./tokens";

export { SESSION_COOKIE };

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
/** En deçà de ce reliquat, la session est prolongée à l'usage. */
const SESSION_RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * L'adresse IP n'est pas conservée en clair : seule son empreinte sert à
 * repérer une session utilisée depuis un autre réseau.
 */
function hashIp(ip: string | null): string | null {
  return ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
}

export async function createSession(
  userId: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: context.userAgent?.slice(0, 255) ?? null,
    ipHash: hashIp(context.ip ?? null),
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  pseudo: string;
  email: string | null;
  avatarPath: string | null;
  role: "USER" | "ADMIN";
  /** Ce que le compte voit du catalogue (voir `src/lib/acces.ts`). */
  accessMode: "normal" | "restreint" | "testeur";
};

/**
 * Lit la session portée par le cookie courant. Renvoie null si le cookie est
 * absent, inconnu ou expiré, ou si le compte a été désactivé entre-temps.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = hashToken(token);

  const row = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      pseudo: users.pseudo,
      email: users.email,
      avatarPath: users.avatarPath,
      role: users.role,
      isActive: users.isActive,
      accessMode: users.accessMode,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  if (!row.isActive) return null;

  // Prolongation glissante : un joueur régulier n'est jamais déconnecté.
  if (row.expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    await setSessionCookie(token, expiresAt);
  }

  return {
    id: row.id,
    pseudo: row.pseudo,
    email: row.email,
    avatarPath: row.avatarPath,
    role: row.role,
    accessMode: row.accessMode,
  };
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  await clearSessionCookie();
}

/** Déconnecte tous les appareils : appelé après un changement de mot de passe. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ---------------------------------------------------------------------------
// Jetons de réinitialisation
// ---------------------------------------------------------------------------

const RESET_TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 heure

/**
 * Un lien d'invitation vit plus longtemps qu'un lien de réinitialisation.
 *
 * Une réinitialisation répond à une demande qu'on vient de faire : une heure
 * suffit, et une fenêtre courte limite les dégâts si la boîte mail est lue par
 * quelqu'un d'autre. Une invitation, elle, attend que son destinataire s'en
 * occupe — souvent le lendemain.
 */
export const INVITATION_TOKEN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function createPasswordResetToken(
  userId: string,
  dureeMs: number = RESET_TOKEN_DURATION_MS,
): Promise<string> {
  // Une nouvelle demande invalide les précédentes : un seul lien vivant à la fois.
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + dureeMs),
  });

  return token;
}

/** Renvoie l'identifiant du compte si le jeton est valide et non consommé. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const id = hashToken(token);

  const row = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, id)).get();

  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, id));
    return null;
  }

  // Marqué consommé, et non supprimé : un second clic sur le même lien doit
  // être refusé explicitement plutôt que traité comme un jeton inconnu.
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, id), eq(passwordResetTokens.userId, row.userId)));

  return row.userId;
}

/** Purge les sessions et jetons expirés. Appelée par la tâche d'entretien. */
export async function pruneExpired(): Promise<void> {
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now));
}

export function newId(): string {
  return randomUUID();
}
