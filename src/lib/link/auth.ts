import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { hashToken } from "@/lib/auth/tokens";
import { lireJeton } from "@/lib/discord/jeton";

/**
 * Qui est derrière une requête brute — une WebSocket, ou une route servie
 * avant Next.
 *
 * `getCurrentUser()` lit le cookie par `next/headers`, qui n'existe que dans
 * une requête Next. Ici on reçoit l'en-tête `Cookie` tel quel. Même règle :
 * cookie absent, session inconnue, expirée ou compte désactivé, c'est non.
 * Pas de prolongation glissante : une session link ne dure pas trente jours.
 *
 * L'Activité Discord n'a pas de cookie : elle porte son jeton (voir
 * `src/lib/discord/jeton.ts`) en en-tête `Authorization`, ou dans l'adresse
 * de la WebSocket, qui ne peut pas porter d'en-tête.
 */
export type Compte = {
  id: string;
  pseudo: string;
  role: "USER" | "ADMIN";
  accessMode: "normal" | "restreint" | "testeur";
};

export async function compteDepuisCookie(enTete: string | undefined): Promise<Compte | null> {
  if (!enTete) return null;
  const jeton = enTete
    .split(";")
    .map((morceau) => morceau.trim())
    .find((morceau) => morceau.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!jeton) return null;

  const ligne = await db
    .select({
      expiresAt: sessions.expiresAt,
      actingAsUserId: sessions.actingAsUserId,
      id: users.id,
      pseudo: users.pseudo,
      role: users.role,
      isActive: users.isActive,
      accessMode: users.accessMode,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hashToken(decodeURIComponent(jeton))))
    .get();

  if (!ligne || !ligne.isActive || ligne.expiresAt.getTime() <= Date.now()) return null;

  // « Voir comme » (voir `getCurrentUser`) : un administrateur qui regarde le
  // site comme un autre compte entre aussi dans les salons sous ce compte.
  if (ligne.actingAsUserId && ligne.role === "ADMIN") {
    const autre = await db
      .select({ id: users.id, pseudo: users.pseudo, role: users.role, isActive: users.isActive, accessMode: users.accessMode })
      .from(users)
      .where(eq(users.id, ligne.actingAsUserId))
      .get();
    if (autre && autre.isActive) {
      return { id: autre.id, pseudo: autre.pseudo, role: autre.role, accessMode: autre.accessMode };
    }
  }
  return { id: ligne.id, pseudo: ligne.pseudo, role: ligne.role, accessMode: ligne.accessMode };
}

/** Le compte derrière un jeton de l'Activité Discord ; `null` s'il est faux, périmé, ou le compte désactivé. */
export async function compteDepuisJeton(jeton: string | null | undefined): Promise<Compte | null> {
  if (!jeton) return null;
  const userId = lireJeton(jeton);
  if (!userId) return null;
  const ligne = await db
    .select({ id: users.id, pseudo: users.pseudo, role: users.role, isActive: users.isActive, accessMode: users.accessMode })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!ligne || !ligne.isActive) return null;
  return { id: ligne.id, pseudo: ligne.pseudo, role: ligne.role, accessMode: ligne.accessMode };
}

/**
 * Qui est derrière une requête du câble link : le cookie du site, sinon le
 * jeton de l'Activité — en en-tête, ou en paramètre `jeton` pour une
 * WebSocket.
 */
export async function compteDuLink(
  entetes: { cookie?: string; authorization?: string },
  url: URL,
): Promise<Compte | null> {
  const parCookie = await compteDepuisCookie(entetes.cookie);
  if (parCookie) return parCookie;
  const porte = entetes.authorization?.startsWith("Bearer ") ? entetes.authorization.slice(7).trim() : null;
  return compteDepuisJeton(porte ?? url.searchParams.get("jeton"));
}
