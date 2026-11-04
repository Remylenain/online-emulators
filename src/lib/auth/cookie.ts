/**
 * Le cookie de session : son nom et ses attributs, isolés dans leur propre
 * module.
 *
 * Le filtre `proxy.ts` ne charge ni SQLite ni le module de session : il n'a
 * besoin que de ceci. Et comme il repose le cookie à chaque passage (voir
 * `prolongationCookie`), ses attributs doivent être exactement ceux de la
 * connexion, sans quoi le navigateur garderait deux cookies du même nom.
 */
export const SESSION_COOKIE = "oe_session";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function attributsCookieSession(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
