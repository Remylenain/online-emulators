import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { LANGUE_DE_REFERENCE, type Langue } from "@/lib/i18n/langues";

/**
 * Options d'affichage du catalogue : tris et modes de vue.
 *
 * Volontairement séparées de `catalog.ts`, qui ouvre la base : les contrôles
 * de recherche et de tri sont un composant client, et importer le module de
 * requêtes y entraînerait `better-sqlite3` — un binaire natif — dans le
 * paquet envoyé au navigateur. La construction échoue alors, à juste titre.
 *
 * Ce module ne porte que des clés — celles qu'on lit dans l'adresse. Leurs
 * libellés sont dans le dictionnaire, sous `catalogue.filtres` : `tris`,
 * `types` et `vues` y ont une entrée par clé d'ici.
 */

/**
 * Le premier est le tri par défaut du catalogue : par note, puis par titre,
 * puis par nombre de parties jouées.
 */
export const SORTS = ["note", "titre", "parties"] as const;

export const TRI_PAR_DEFAUT: SortKey = "note";

export type SortKey = (typeof SORTS)[number];

export function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && (SORTS as readonly string[]).includes(value);
}

/**
 * Ce qu'on regarde : les rom hacks et traductions, les jeux du commerce, ou
 * tout.
 *
 * Le site est fait pour les rom hacks : c'est sur eux que le catalogue
 * s'ouvre. Quelques centaines de jeux du commerce les noieraient, alors
 * qu'ils restent à un clic dans le filtre.
 */
export const TYPES = ["hacks", "officiels", "tous"] as const;

export type TypeKey = (typeof TYPES)[number];

export const TYPE_PAR_DEFAUT: TypeKey = "hacks";

export function isTypeKey(value: string | undefined): value is TypeKey {
  return value !== undefined && (TYPES as readonly string[]).includes(value);
}

export const VIEWS = ["grille", "liste"] as const;

export type ViewMode = (typeof VIEWS)[number];

export function isViewMode(value: string | undefined): value is ViewMode {
  return value !== undefined && (VIEWS as readonly string[]).includes(value);
}

/**
 * Le nom d'une langue de jeu, tel qu'affiché dans le filtre.
 *
 * Les codes viennent des manifestes de la bibliothèque, qui suivent l'usage
 * courant (« fr », « en »…). Les noms sont dans le dictionnaire
 * (`catalogue.langues`) ; une langue absente de cette table s'affiche par son
 * code plutôt que de disparaître.
 *
 * `langue` est la langue de l'interface, celle dans laquelle le nom est
 * écrit : « Anglais » ou « English ». Sans elle, c'est le français.
 */
export function nomDeLangue(code: string, langue: Langue = LANGUE_DE_REFERENCE): string {
  const court = code.toLowerCase().split("-")[0] ?? code;
  const noms: Record<string, string | undefined> = dictionnaire(langue).catalogue.langues;
  return noms[court] ?? code;
}

/*
 * Pas de langue de jeu par défaut ici : l'accueil et les pages des consoles
 * montrent d'abord les jeux dans la langue du visiteur (celle de l'interface,
 * `src/lib/i18n/serveur.ts`). Montrer d'abord ce qu'il peut lire lui évite de
 * faire défiler des jeux qu'il écarterait de toute façon ; le filtre reste à
 * un clic pour voir le reste.
 */

/** Valeur du filtre signifiant « ne pas filtrer ». */
export const TOUTES_LANGUES = "toutes";
