import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, playSessions } from "@/db/schema";
import { conditionAcces, type Visiteur } from "./acces";
import { normalizeForSearch } from "./validation";

import { TOUTES_LANGUES, TRI_PAR_DEFAUT, type SortKey } from "./catalog-options";

/** Jeu tel qu'affiché dans une grille ou une liste. */
export type GameCard = {
  id: string;
  slug: string;
  consoleSlug: string;
  title: string;
  author: string | null;
  version: string | null;
  baseGame: string | null;
  coverPath: string | null;
  ratingAvg: number;
  ratingCount: number;
  playCount: number;
  /** Renseigné quand la carte représente un ensemble de parties. */
  parties?: number;
};

const cardColumns = {
  id: games.id,
  slug: games.slug,
  consoleSlug: games.consoleSlug,
  title: games.title,
  author: games.author,
  version: games.version,
  baseGame: games.baseGame,
  coverPath: games.coverPath,
  ratingAvg: games.ratingAvg,
  ratingCount: games.ratingCount,
  playCount: games.playCount,
  groupSlug: games.groupSlug,
  groupTitle: games.groupTitle,
  partNumber: games.partNumber,
} as const;

type LigneCarte = GameCard & {
  groupSlug: string | null;
  groupTitle: string | null;
  partNumber: number | null;
};

/**
 * Réunit sous une seule carte les entrées d'un même ensemble.
 *
 * Le regroupement se fait ici et non en SQL : une console compte quelques
 * dizaines de jeux, la requête les rapporte déjà toutes, et une agrégation
 * SQL rendrait le tri et la recherche nettement moins lisibles pour un gain
 * nul à cette échelle.
 *
 * La carte d'un ensemble emprunte la jaquette de la première partie qui en a
 * une, additionne les parties jouées et moyenne les notes.
 */
function regrouper(lignes: LigneCarte[]): GameCard[] {
  const cartes: GameCard[] = [];
  const groupes = new Map<string, GameCard>();

  for (const ligne of lignes) {
    if (!ligne.groupSlug) {
      cartes.push(ligne);
      continue;
    }

    const existant = groupes.get(ligne.groupSlug);
    if (!existant) {
      const carte: GameCard = {
        ...ligne,
        slug: ligne.groupSlug,
        title: ligne.groupTitle ?? ligne.title,
        version: null,
        parties: 1,
      };
      groupes.set(ligne.groupSlug, carte);
      cartes.push(carte);
      continue;
    }

    existant.parties = (existant.parties ?? 1) + 1;
    existant.playCount += ligne.playCount;
    existant.coverPath ??= ligne.coverPath;
    const total = existant.ratingCount + ligne.ratingCount;
    if (total > 0) {
      existant.ratingAvg =
        (existant.ratingAvg * existant.ratingCount + ligne.ratingAvg * ligne.ratingCount) /
        total;
      existant.ratingCount = total;
    }
  }

  return cartes;
}

/**
 * Ordre des cartes du catalogue.
 *
 * Après le regroupement et non en SQL : la note et le nombre de parties d'un
 * ensemble sont calculés sur toutes ses parties, que la base ne connaît pas
 * réunies. Trier avant classait un ensemble d'après sa seule première partie.
 *
 * Pour la note, deux jeux sont à égalité s'ils affichent la même note — au
 * dixième, comme sur les cartes — et se départagent alors par ordre
 * alphabétique. Les jeux sans note viennent après tous ceux qui en ont une.
 *
 * L'ordre alphabétique compare les titres sans accents ni majuscules :
 * « Éclat » doit tomber avec les E, pas après « Zelda ».
 */
function trier(cartes: GameCard[], tri: SortKey): GameCard[] {
  const titre = (carte: GameCard) => normalizeForSearch(carte.title);
  const alphabetique = (a: GameCard, b: GameCard) =>
    titre(a).localeCompare(titre(b), "fr", { numeric: true });
  const noteAffichee = (carte: GameCard) =>
    carte.ratingCount > 0 ? Math.round(carte.ratingAvg * 10) : -1;

  const comparer: Record<SortKey, (a: GameCard, b: GameCard) => number> = {
    titre: alphabetique,
    note: (a, b) => noteAffichee(b) - noteAffichee(a) || alphabetique(a, b),
    parties: (a, b) => b.playCount - a.playCount || alphabetique(a, b),
  };

  return [...cartes].sort(comparer[tri]);
}

/**
 * Nouveautés : par date de sortie déclarée si elle existe, sinon par date
 * d'ajout à la bibliothèque.
 */
export async function latestGames(
  visiteur: Visiteur,
  limit = 8,
  langue?: string,
): Promise<GameCard[]> {
  const conditions = [conditionAcces(visiteur)];

  // Les nouveautés suivent le même choix de langue que le catalogue : on ne
  // met pas en avant des jeux qu'on ne saurait pas lire.
  if (langue && langue !== TOUTES_LANGUES) {
    conditions.push(
      sql`lower(coalesce(${games.language}, '')) like ${`${langue.toLowerCase()}%`}`,
    );
  }

  // On en demande davantage que la limite : le regroupement en retire, et un
  // ensemble de huit parties viderait sinon toute la rangée des nouveautés.
  const lignes = await db
    .select(cardColumns)
    .from(games)
    .where(and(...conditions))
    .orderBy(desc(games.releasedAt), desc(games.createdAt))
    .limit(limit * 4)
    .all();

  return regrouper(lignes).slice(0, limit);
}

/** Derniers jeux ouverts par ce compte, du plus récent au plus ancien. */
export async function recentlyPlayed(visiteur: Visiteur, limit = 8): Promise<GameCard[]> {
  return db
    .select({ ...cardColumns, lastSeenAt: max(playSessions.lastSeenAt) })
    .from(playSessions)
    .innerJoin(games, eq(games.id, playSessions.gameId))
    .where(
      and(
        eq(playSessions.userId, visiteur.id),
        conditionAcces(visiteur),
      ),
    )
    .groupBy(games.id)
    .orderBy(desc(max(playSessions.lastSeenAt)))
    .limit(limit)
    .all();
}

/**
 * Jeux d'une console, filtrés et triés.
 *
 * Le filtre et le tri passent par l'URL plutôt que par un état de composant :
 * une recherche se partage, se met en favori, et survit à un rechargement.
 */
export async function listConsoleGames(options: {
  visiteur: Visiteur;
  consoleSlug: string;
  search?: string;
  sort?: SortKey;
  /** Code de langue, ou `TOUTES_LANGUES` pour ne pas filtrer. */
  langue?: string;
}): Promise<{ jeux: GameCard[]; total: number }> {
  const conditions = [
    eq(games.consoleSlug, options.consoleSlug),
    conditionAcces(options.visiteur),
  ];

  /**
   * Le filtre porte sur le code court : « fr-FR » comme « fr » sont du
   * français, et personne n'a envie de choisir entre les deux dans une liste.
   */
  const langue = options.langue ?? TOUTES_LANGUES;
  const filtreLangue =
    langue === TOUTES_LANGUES
      ? null
      : sql`lower(coalesce(${games.language}, '')) like ${`${langue.toLowerCase()}%`}`;

  /**
   * Chaque mot cherché séparément, tous exigés.
   *
   * Une seule comparaison sur la saisie entière chercherait une suite exacte :
   * « pokemon violette » ne trouverait pas « Pokémon Version Violette », alors
   * que c'est exactement ce qu'on tape pour le chercher. Mot à mot, l'ordre et
   * ce qu'il y a entre deux n'ont plus d'importance.
   */
  const mots = normalizeForSearch(options.search ?? "")
    .split(/\s+/)
    .filter((mot) => mot.length > 0);

  for (const mot of mots) {
    // `%` et `_` sont des jokers de LIKE : sans échappement, chercher « 100% »
    // ramènerait tout le catalogue. L'antislash est traité en premier, sinon
    // il annulerait les échappements posés juste après.
    const motif = mot
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_");
    conditions.push(sql`${games.searchText} like ${`%${motif}%`} escape '\\'`);
  }

  // L'ordre des parties d'un ensemble compte pour le regroupement (la carte
  // prend la jaquette de la première) ; l'ordre des cartes, lui, est décidé
  // après, par `trier`.
  const lignes = await db
    .select(cardColumns)
    .from(games)
    .where(and(...conditions))
    .orderBy(asc(games.searchText))
    .all();

  // Le total avant filtre de langue sert à dire combien de jeux sont masqués :
  // un catalogue qui rétrécit sans explication inquiète plus qu'il n'aide.
  const total = regrouper(lignes).length;

  const retenues = filtreLangue
    ? await db
        .select(cardColumns)
        .from(games)
        .where(and(...conditions, filtreLangue))
        .orderBy(asc(games.searchText))
        .all()
    : lignes;

  return { jeux: trier(regrouper(retenues), options.sort ?? TRI_PAR_DEFAUT), total };
}

/** Langues présentes dans le catalogue d'une console, pour alimenter le filtre. */
export async function languesDisponibles(visiteur: Visiteur, consoleSlug: string): Promise<string[]> {
  const lignes = await db
    .selectDistinct({ langue: games.language })
    .from(games)
    .where(
      and(eq(games.consoleSlug, consoleSlug), conditionAcces(visiteur)),
    )
    .all();

  const courtes = new Set<string>();
  for (const ligne of lignes) {
    if (!ligne.langue) continue;
    courtes.add(ligne.langue.toLowerCase().split("-")[0]!);
  }
  return [...courtes].sort();
}

/**
 * Les parties d'un ensemble, dans l'ordre, pour la fiche du groupe.
 *
 * Rend un tableau vide si le slug ne désigne aucun ensemble — c'est ainsi que
 * la fiche de jeu distingue un groupe d'un jeu ordinaire.
 */
export async function partiesDuGroupe(visiteur: Visiteur, consoleSlug: string, groupSlug: string) {
  return db
    .select()
    .from(games)
    .where(
      and(
        eq(games.consoleSlug, consoleSlug),
        eq(games.groupSlug, groupSlug),
        conditionAcces(visiteur),
      ),
    )
    .orderBy(asc(games.partNumber))
    .all();
}

/** Fiche complète d'un jeu, pour sa page de présentation. */
export async function gameBySlug(visiteur: Visiteur, consoleSlug: string, slug: string) {
  return db
    .select()
    .from(games)
    .where(
      and(
        eq(games.consoleSlug, consoleSlug),
        eq(games.slug, slug),
        conditionAcces(visiteur),
      ),
    )
    .get();
}

/**
 * Nombre de jeux publiés par console, tel que la page console l'affichera.
 *
 * Deux précautions pour que les deux chiffres concordent — un compteur qui
 * annonce vingt-six jeux et une page qui en montre onze fait douter du site :
 *
 * 1. Les parties d'un même ensemble comptent pour une. `count(distinct …)`
 *    sur le groupe, ou l'identifiant à défaut, suffit : les huit parties d'un
 *    film sont une seule entrée du catalogue.
 * 2. Le filtre de langue s'applique comme sur la page console — repli compris :
 *    une console sans aucun jeu dans la langue demandée les montre tous, donc
 *    son compteur doit les compter tous.
 */
export async function countByConsole(
  visiteur: Visiteur,
  langue?: string,
): Promise<Record<string, number>> {
  const compter = async (filtrer: boolean) => {
    const conditions = [conditionAcces(visiteur)];
    if (filtrer && langue && langue !== TOUTES_LANGUES) {
      conditions.push(
        sql`lower(coalesce(${games.language}, '')) like ${`${langue.toLowerCase()}%`}`,
      );
    }

    const lignes = await db
      .select({
        consoleSlug: games.consoleSlug,
        total: sql<number>`count(distinct coalesce(${games.groupSlug}, ${games.id}))`,
      })
      .from(games)
      .where(and(...conditions))
      .groupBy(games.consoleSlug)
      .all();

    return Object.fromEntries(lignes.map((ligne) => [ligne.consoleSlug, ligne.total]));
  };

  const tous = await compter(false);
  if (!langue || langue === TOUTES_LANGUES) return tous;

  const filtres = await compter(true);
  return Object.fromEntries(
    Object.entries(tous).map(([console_, total]) => [console_, filtres[console_] || total]),
  );
}
