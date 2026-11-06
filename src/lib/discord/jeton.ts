import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/auth/tokens";
import { env } from "@/lib/env";

/**
 * Le jeton de l'Activité Discord : qui joue, et jusqu'à quand.
 *
 * Dans Discord, la page vit dans une iframe servie par leur proxy. Un cookie
 * y serait un cookie tiers, que les navigateurs refusent ou cloisonnent à leur
 * guise. La page garde donc ce jeton en mémoire et le renvoie en en-tête
 * `Authorization` ; elle en redemande un à chaque lancement, puisque Discord
 * la réauthentifie de toute façon.
 *
 * Signé, pas stocké : rien à ranger en base ni à purger. Il ne donne accès
 * qu'aux routes `/api/discord`, jamais au reste du site — ce n'est pas une
 * session.
 */
const DUREE_MS = 12 * 60 * 60 * 1000;

function signature(charge: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`activite-discord:${charge}`).digest("base64url");
}

export function signerJeton(userId: string): string {
  const charge = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + DUREE_MS })).toString("base64url");
  return `${charge}.${signature(charge)}`;
}

/** L'identifiant du compte, ou `null` si le jeton est faux, abîmé ou périmé. */
export function lireJeton(jeton: string): string | null {
  const [charge, signe, ...reste] = jeton.split(".");
  if (!charge || !signe || reste.length > 0) return null;
  if (!safeEqual(signe, signature(charge))) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(charge, "base64url").toString("utf8")) as { u?: unknown; e?: unknown };
    if (typeof u !== "string" || typeof e !== "number" || e <= Date.now()) return null;
    return u;
  } catch {
    return null;
  }
}
