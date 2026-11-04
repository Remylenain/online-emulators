import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Les jetons (session, réinitialisation) suivent le même principe : la valeur
 * en clair ne quitte jamais le serveur qu'une seule fois, vers le navigateur ou
 * vers l'e-mail. La base n'en conserve que l'empreinte, afin qu'une fuite de
 * la base ne permette pas d'usurper une session.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparaison à temps constant, pour les secrets comparés hors base. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
