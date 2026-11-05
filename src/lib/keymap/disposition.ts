import type { Touche } from "@/lib/consoles";

/**
 * Une disposition : quel bouton de la console répond à quelle touche du
 * clavier, ou à quelle entrée de la manette.
 *
 * Module neutre, lu par le serveur comme par le lecteur : la règle qui
 * distingue « pas encore réglé » de « laissé sans touche » doit être la même
 * des deux côtés.
 *
 * - Un bouton **absent** de ce qui est enregistré prend sa valeur par défaut :
 *   c'est le cas d'un bouton apparu après l'enregistrement.
 * - Un bouton enregistré **vide** (`""`) n'a pas de touche : le joueur la lui a
 *   prise pour un autre bouton. Lui rendre sa valeur par défaut à la relecture
 *   pourrait la mettre en double avec celle qu'il vient de choisir.
 */
export type Disposition = Record<Touche, string>;

/** Relit une disposition enregistrée en JSON ; illisible ou absente, c'est le défaut. */
export function lireDisposition(defaut: Disposition, texte: string | null | undefined): Disposition {
  const disposition: Record<string, string> = { ...defaut };
  if (!texte) return disposition as Disposition;

  let lue: unknown;
  try {
    lue = JSON.parse(texte);
  } catch {
    return disposition as Disposition;
  }
  if (!lue || typeof lue !== "object") return disposition as Disposition;

  const choisies = new Set<string>();
  for (const [bouton, valeur] of Object.entries(lue)) {
    if (!(bouton in defaut) || typeof valeur !== "string") continue;
    if (valeur === "") delete disposition[bouton];
    else {
      disposition[bouton] = valeur;
      choisies.add(bouton);
    }
  }
  // Un défaut ne vient pas doubler une touche que le joueur a choisie.
  const prises = new Set([...choisies].map((bouton) => disposition[bouton]));
  for (const bouton of Object.keys(disposition)) {
    if (!choisies.has(bouton) && prises.has(disposition[bouton]!)) delete disposition[bouton];
  }
  return disposition as Disposition;
}

/** La forme enregistrée : tous les boutons, vides compris. */
export function ecrireDisposition(boutons: readonly string[], disposition: Partial<Record<string, string>>): string {
  return JSON.stringify(Object.fromEntries(boutons.map((bouton) => [bouton, disposition[bouton] ?? ""])));
}

/** Parmi ces boutons, ceux qui n'ont rien d'attribué. */
export function boutonsSansEntree<T extends Touche>(boutons: readonly T[], disposition: Partial<Disposition>): T[] {
  return boutons.filter((bouton) => !disposition[bouton]);
}

/** « « B » n'a plus … » ou « « B » et « Start » n'ont plus … » : le début de l'alerte. */
export function enumerer(noms: string[]): string {
  const cites = noms.map((nom) => `« ${nom} »`);
  if (cites.length <= 1) return cites.join("");
  return `${cites.slice(0, -1).join(", ")} et ${cites.at(-1)}`;
}
