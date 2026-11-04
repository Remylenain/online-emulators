import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * À appeler en tête de toute page ou action réservée aux comptes connectés.
 *
 * Le middleware écarte déjà les requêtes sans cookie, mais il ne peut pas
 * vérifier la session en base : c'est ici que se joue le vrai contrôle, et
 * c'est ici qu'un compte désactivé est repoussé.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Pour les pages de connexion : un visiteur déjà connecté n'a rien à y faire. */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect("/");
}
