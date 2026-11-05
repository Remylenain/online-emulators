import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import {
  ETATS,
  isEtatKey,
  isTypeAdmin,
  PAR_PAGE,
  type ComptesBibliotheque,
  type EtatKey,
  type FiltresBibliotheque,
} from "@/lib/admin/filtres-bibliotheque";
import { CONSOLE_SLUGS } from "@/lib/consoles";
import { lireRetouche, listerRetouches, retouchesPossibles } from "@/lib/library/retouches";
import { normalizeForSearch } from "@/lib/validation";
import { Bibliotheque } from "./bibliotheque";

export const metadata: Metadata = { title: "Bibliothèque" };

/**
 * La bibliothèque vue par l'administration : recherche, filtres, cinquante
 * jeux par page.
 *
 * Les filtres vivent dans l'adresse, comme ceux du catalogue : ils survivent
 * au rafraîchissement qui suit chaque enregistrement, et une liste de jeux à
 * corriger se retrouve d'un clic sur « précédent ».
 *
 * Tout est filtré ici, en mémoire, et non en SQL : la table tient en quelques
 * centaines de lignes, et les nombres affichés à côté de chaque filtre
 * demandent de toute façon de passer sur toutes. Seule la page affichée part
 * vers le navigateur — avec les descriptions, la liste entière pesait lourd.
 */
export default async function BibliothequePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const adresse = await searchParams;
  const lu = (cle: string) => {
    const valeur = adresse[cle];
    return typeof valeur === "string" ? valeur.trim() : "";
  };
  const type = lu("type");
  const etat = lu("etat");
  const filtres: FiltresBibliotheque = {
    q: lu("q").slice(0, 100),
    console: CONSOLE_SLUGS.includes(lu("console")) ? lu("console") : "",
    type: isTypeAdmin(type) ? type : "",
    etat: isEtatKey(etat) ? etat : "",
    page: Math.max(1, Number.parseInt(lu("page"), 10) || 1),
  };

  const lignes = await db
    .select({
      id: games.id,
      title: games.title,
      consoleSlug: games.consoleSlug,
      slug: games.slug,
      description: games.description,
      author: games.author,
      version: games.version,
      language: games.language,
      baseGame: games.baseGame,
      year: games.year,
      isPublished: games.isPublished,
      isOfficial: games.isOfficial,
      coverPath: games.coverPath,
      romSize: games.romSize,
      searchText: games.searchText,
    })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all();
  type Ligne = (typeof lignes)[number];

  const retouches = await listerRetouches();
  const cle = (jeu: Ligne) => `${jeu.consoleSlug}/${jeu.slug}`;

  // Mot à mot, tous exigés, comme la recherche du catalogue : « pokemon
  // violette » doit trouver « Pokémon Version Violette ».
  const mots = normalizeForSearch(filtres.q)
    .split(/\s+/)
    .filter((mot) => mot.length > 0);

  const selonRecherche = (jeu: Ligne) => mots.every((mot) => jeu.searchText.includes(mot));
  const selonConsole = (jeu: Ligne) => !filtres.console || jeu.consoleSlug === filtres.console;
  const selonType = (jeu: Ligne) => !filtres.type || jeu.isOfficial === (filtres.type === "officiels");
  const dansEtat: Record<EtatKey, (jeu: Ligne) => boolean> = {
    "sans-jaquette": (jeu) => !jeu.coverPath,
    "sans-description": (jeu) => !jeu.description,
    "sans-langue": (jeu) => !jeu.language,
    retires: (jeu) => !jeu.isPublished,
    retouches: (jeu) => retouches.has(cle(jeu)),
  };
  const selonEtat = (jeu: Ligne) => !filtres.etat || dansEtat[filtres.etat](jeu);

  const cherches = lignes.filter(selonRecherche);
  const horsConsole = cherches.filter((jeu) => selonType(jeu) && selonEtat(jeu));
  const horsType = cherches.filter((jeu) => selonConsole(jeu) && selonEtat(jeu));
  const horsEtat = cherches.filter((jeu) => selonConsole(jeu) && selonType(jeu));
  const trouves = horsEtat.filter(selonEtat);

  const pages = Math.max(1, Math.ceil(trouves.length / PAR_PAGE));
  // Un filtre resserré depuis la page 7 n'en laisse parfois que deux : on
  // retombe sur la dernière plutôt que sur une page vide.
  filtres.page = Math.min(filtres.page, pages);

  const comptes: ComptesBibliotheque = {
    total: lignes.length,
    publies: lignes.filter((jeu) => jeu.isPublished).length,
    trouves: trouves.length,
    pages,
    toutesConsoles: horsConsole.length,
    consoles: Object.fromEntries(
      CONSOLE_SLUGS.map((slug) => [slug, horsConsole.filter((jeu) => jeu.consoleSlug === slug).length]),
    ),
    tousTypes: horsType.length,
    types: {
      hacks: horsType.filter((jeu) => !jeu.isOfficial).length,
      officiels: horsType.filter((jeu) => jeu.isOfficial).length,
    },
    etats: Object.fromEntries(
      (Object.keys(ETATS) as EtatKey[]).map((nom) => [nom, horsEtat.filter(dansEtat[nom]).length]),
    ) as Record<EtatKey, number>,
  };

  /**
   * Chaque jeu affiché est accompagné de la liste des champs qu'il retouche.
   *
   * L'interface marque ces champs : sans cela, rien ne distinguerait une
   * valeur qui vient du `game.json` d'une valeur saisie ici, et on
   * corrigerait le manifeste sans comprendre pourquoi l'affichage ne bouge
   * pas.
   */
  const debut = (filtres.page - 1) * PAR_PAGE;
  const jeux = await Promise.all(
    trouves.slice(debut, debut + PAR_PAGE).map(async ({ searchText: _recherche, ...jeu }) => ({
      ...jeu,
      retouches: retouches.has(`${jeu.consoleSlug}/${jeu.slug}`)
        ? Object.keys(await lireRetouche(jeu.consoleSlug, jeu.slug))
        : [],
    })),
  );

  return (
    <Bibliotheque
      jeux={jeux}
      filtres={filtres}
      comptes={comptes}
      inscriptible={await retouchesPossibles()}
    />
  );
}
