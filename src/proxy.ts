import { NextResponse, type NextRequest } from "next/server";
import { attributsCookieSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/cookie";
import { hoteDeLaRequete, hotesDesActivites } from "@/lib/discord/applications";
import { vitrineOuverte } from "@/lib/vitrine";

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
const PUBLIC_PATHS = [
  "/connexion",
  "/mot-de-passe-oublie",
  "/reinitialiser",
  "/inscription",
  // L'Activité Discord tourne dans une iframe, sans cookie : ses routes
  // contrôlent elles-mêmes un jeton porté en en-tête (`src/lib/discord`).
  "/discord",
  "/api/discord",
];

/**
 * Ce que la vitrine ouvre aux visiteurs sans compte, quand l'administrateur
 * l'a allumée (`src/lib/vitrine.ts`) : sa page d'accueil, le lecteur de
 * l'invité, et ce qu'il lui faut pour jouer. Les routes décident elles-mêmes
 * de ce qu'elles servent — une ROM hors vitrine reste refusée.
 */
const CHEMINS_VITRINE = ["/accueil", "/partie", "/api/rom", "/api/bezel"];

/**
 * Les hôtes réservés à une Activité Discord et l'état de la vitrine, relus de
 * temps en temps : un réglage de l'administration prend effet en quelques
 * secondes, sans que chaque requête du site passe par la base.
 */
const RELECTURE_MS = 5_000;
let hotesActivite = new Set<string>();
let vitrine = false;
let relecture = 0;

function relire(): void {
  if (Date.now() < relecture) return;
  hotesActivite = new Set(hotesDesActivites());
  vitrine = vitrineOuverte();
  relecture = Date.now() + RELECTURE_MS;
}

function hoteReserve(hote: string): boolean {
  relire();
  return hotesActivite.has(hote);
}

function correspond(chemins: string[], pathname: string): boolean {
  return chemins.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Ce qu'un hôte d'Activité sert, et rien d'autre. */
const CHEMINS_ACTIVITE = ["/discord", "/api/discord"];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  /*
   * Discord n'ouvre jamais `/discord` : son iframe charge toujours la racine
   * de l'URL Mapping, avec `frame_id` (et le reste de son contexte) dans
   * l'adresse. Sans ce renvoi, la racine envoyait à la page de connexion, que
   * le site interdit d'afficher dans un cadre — écran blanc dans Discord.
   *
   * Les paramètres suivent : le SDK les lit dans l'adresse de la page. Next
   * rend ce renvoi en adresse relative, ce qu'il faut ici — la requête arrive
   * par le proxy de Discord, et une adresse absolue ferait sortir l'iframe de
   * `discordsays.com`.
   *
   * Sur un hôte réservé à une Activité, la racine renvoie vers `/discord`
   * même sans `frame_id` : cet hôte n'a rien d'autre à montrer.
   */
  const reserve = hoteReserve(hoteDeLaRequete(request.headers));
  if (pathname === "/" && (reserve || request.nextUrl.searchParams.has("frame_id"))) {
    const activite = request.nextUrl.clone();
    activite.pathname = "/discord";
    return NextResponse.redirect(activite);
  }

  /*
   * Un hôte réservé à une Activité ne sert que l'Activité : ni la connexion,
   * ni le catalogue. Ce que ses joueurs lisent de cet hôte ne dit rien du
   * site qui l'héberge.
   */
  if (reserve && !correspond(CHEMINS_ACTIVITE, pathname)) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const jeton = request.cookies.get(SESSION_COOKIE)?.value;

  /*
   * Vitrine allumée : sans compte, la racine montre l'accueil de la vitrine
   * au lieu de renvoyer à la connexion. Une réécriture et non un renvoi :
   * l'adresse reste celle du site. Avec un cookie, la racine reste le
   * catalogue du compte.
   */
  if (vitrine && !jeton && pathname === "/") {
    const accueil = request.nextUrl.clone();
    accueil.pathname = "/accueil";
    return NextResponse.rewrite(accueil);
  }

  if (correspond(PUBLIC_PATHS, pathname) || (vitrine && correspond(CHEMINS_VITRINE, pathname))) {
    return NextResponse.next();
  }

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
