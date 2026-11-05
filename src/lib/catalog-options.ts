/**
 * Options d'affichage du catalogue : tris et modes de vue.
 *
 * Volontairement séparées de `catalog.ts`, qui ouvre la base : les contrôles
 * de recherche et de tri sont un composant client, et importer le module de
 * requêtes y entraînerait `better-sqlite3` — un binaire natif — dans le
 * paquet envoyé au navigateur. La construction échoue alors, à juste titre.
 */

/** Le premier est le tri par défaut du catalogue. */
export const SORTS = {
  note: "Mieux notés",
  titre: "Alphabétique",
  parties: "Plus joués",
} as const;

export const TRI_PAR_DEFAUT: SortKey = "note";

export type SortKey = keyof typeof SORTS;

export function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && value in SORTS;
}

/**
 * Ce qu'on regarde : les rom hacks et traductions, les jeux du commerce, ou
 * tout. Le premier est le choix par défaut.
 */
export const TYPES = {
  tous: "Tous les jeux",
  hacks: "Rom hacks et traductions",
  officiels: "Jeux officiels",
} as const;

export type TypeKey = keyof typeof TYPES;

export const TYPE_PAR_DEFAUT: TypeKey = "tous";

export function isTypeKey(value: string | undefined): value is TypeKey {
  return value !== undefined && value in TYPES;
}

export const VIEWS = ["grille", "liste"] as const;

export type ViewMode = (typeof VIEWS)[number];

export function isViewMode(value: string | undefined): value is ViewMode {
  return value !== undefined && (VIEWS as readonly string[]).includes(value);
}

/**
 * Langues, telles qu'affichées dans le filtre.
 *
 * Les codes viennent des manifestes de la bibliothèque, qui suivent l'usage
 * courant (« fr », « en »…). Une langue absente de cette table s'affiche par
 * son code plutôt que de disparaître.
 */
const NOMS_DE_LANGUE: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  de: "Allemand",
  it: "Italien",
  ja: "Japonais",
  pt: "Portugais",
};

export function nomDeLangue(code: string): string {
  const court = code.toLowerCase().split("-")[0] ?? code;
  return NOMS_DE_LANGUE[court] ?? code;
}

/**
 * Langue retenue par défaut.
 *
 * Le site est fait pour des francophones : montrer d'abord ce qu'ils peuvent
 * lire évite de faire défiler des jeux qu'ils écarteraient de toute façon. Le
 * filtre reste à un clic pour voir le reste.
 */
export const LANGUE_PAR_DEFAUT = "fr";

/** Valeur du filtre signifiant « ne pas filtrer ». */
export const TOUTES_LANGUES = "toutes";
