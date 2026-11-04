import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * Premier filtre : renvoie vers la connexion toute requête sans cookie de
 * session, sans toucher à la base.
 *
 * Ce n'est pas le contrôle d'accès — un cookie quelconque suffit à passer ici.
 * La vérification réelle a lieu dans chaque page, via `requireUser()`. Le rôle
 * de ce filtre est d'éviter d'exécuter le rendu d'une page privée pour un
 * visiteur manifestement non connecté.
 */
const PUBLIC_PATHS = ["/connexion", "/mot-de-passe-oublie", "/reinitialiser", "/inscription"];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
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
