import { NextResponse, type NextRequest } from "next/server";
import { attributsCookieSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/cookie";

/**
 * Premier filtre : renvoie vers la connexion toute requête sans cookie de
 * session, sans toucher à la base.
 *
 * Ce n'est pas le contrôle d'accès — un cookie quelconque suffit à passer ici.
 * La vérification réelle a lieu dans chaque page, via `requireUser()`. Le rôle
 * de ce filtre est d'éviter d'exécuter le rendu d'une page privée pour un
 * visiteur manifestement non connecté.
 *
 * Il repose aussi le cookie de session avec une échéance neuve à chaque
 * passage : c'est la moitié « navigateur » de la prolongation glissante, dont
 * la moitié « base » est dans `getCurrentUser`. Un rendu de page n'a pas le
 * droit de poser un cookie, ce filtre si. Reposer un cookie dont la session
 * est morte ne change rien : la page suivante renverra à la connexion.
 */
const PUBLIC_PATHS = ["/connexion", "/mot-de-passe-oublie", "/reinitialiser", "/inscription"];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const jeton = request.cookies.get(SESSION_COOKIE)?.value;
  if (jeton) {
    const reponse = NextResponse.next();
    reponse.cookies.set(SESSION_COOKIE, jeton, attributsCookieSession(new Date(Date.now() + SESSION_DURATION_MS)));
    return reponse;
  }

  const target = request.nextUrl.clone();
  target.pathname = "/connexion";
  target.search = "";
  // Mémorise la page demandée, pour y revenir après la connexion.
  if (pathname !== "/") {
    target.searchParams.set("suite", pathname + search);
  }
  return NextResponse.redirect(target);
}

export const config = {
  /*
   * Tout sauf les ressources internes de Next, les fichiers du cœur wasm et
   * les quelques fichiers servis à la racine.
   */
  matcher: ["/((?!_next/|mgba/|favicon|robots\\.txt|icon|manifest\\.webmanifest|apple-touch-icon).*)"],
};
