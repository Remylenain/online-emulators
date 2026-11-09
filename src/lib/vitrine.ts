import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { ecrireParametre, lireParametre } from "@/lib/parametres";
import { ENTREES_MAX, type EntreeVitrine, type Vitrine } from "@/lib/vitrine-limites";

export { ENTREES_MAX, LIBELLE_MAX, type EntreeVitrine, type Vitrine } from "@/lib/vitrine-limites";

/**
 * La vitrine : le site ouvert aux visiteurs sans compte, réduit à quelques
 * jeux choisis par l'administrateur.
 *
 * Éteinte, rien ne change : tout le site reste derrière la connexion. Allumée,
 * un visiteur sans compte arrive sur une page d'accueil qui ne propose que
 * les jeux listés ici — un bouton chacun —, et y joue en **invité** : sa
 * partie, ses points de reprise et ses réglages restent dans son navigateur,
 * le serveur n'en garde rien (voir `src/lib/invite/stockage.ts`).
 *
 * Seuls ces jeux-là sortent sans session : leur ROM, et les habillages
 * d'écran. Le reste du catalogue, s'il y en a un, demande toujours un compte.
 *
 * C'est un réglage et non une variable d'environnement, comme le reste de ce
 * que l'administrateur décide : il se change sans SSH ni redémarrage.
 */

const ACTIVE = "vitrine_active";
const ENTREES = "vitrine_entrees";

function lireEntrees(): EntreeVitrine[] {
  try {
    const lues: unknown = JSON.parse(lireParametre(ENTREES) ?? "[]");
    if (!Array.isArray(lues)) return [];
    return lues
      .filter(
        (e): e is EntreeVitrine =>
          Boolean(e) && typeof e.libelle === "string" && typeof e.jeu === "string" && e.jeu.length > 0,
      )
      .slice(0, ENTREES_MAX);
  } catch {
    // Un réglage illisible vaut une vitrine vide, donc éteinte.
    return [];
  }
}

/** Le réglage tel qu'il est enregistré, pour l'administration. */
export function vitrine(): Vitrine {
  return { active: lireParametre(ACTIVE) === "1", entrees: lireEntrees() };
}

export function definirVitrine(active: boolean, entrees: EntreeVitrine[]): void {
  ecrireParametre(ACTIVE, active ? "1" : "0");
  ecrireParametre(ENTREES, JSON.stringify(entrees.slice(0, ENTREES_MAX)));
}

/** Allumée *et* garnie : une vitrine sans jeu n'ouvrirait que sur une page vide. */
export function vitrineOuverte(): boolean {
  return lireParametre(ACTIVE) === "1" && lireEntrees().length > 0;
}

/** Les identifiants des jeux qu'un invité peut lancer ; vide si la vitrine est éteinte. */
function jeuxOuverts(): string[] {
  return lireParametre(ACTIVE) === "1" ? lireEntrees().map((e) => e.jeu) : [];
}

/**
 * Le jeu est-il ouvert aux invités ? Dépublier un jeu le retire aussi d'ici :
 * la publication reste l'interrupteur général.
 */
export async function jeuInvite(gameId: string): Promise<boolean> {
  if (!jeuxOuverts().includes(gameId)) return false;
  const ligne = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.isPublished, true)))
    .get();
  return Boolean(ligne);
}

/** La fiche d'un jeu de la vitrine, pour le lecteur de l'invité. */
export async function jeuInviteParSlug(consoleSlug: string, slug: string) {
  const ouverts = jeuxOuverts();
  if (ouverts.length === 0) return undefined;
  return db
    .select()
    .from(games)
    .where(
      and(
        eq(games.consoleSlug, consoleSlug),
        eq(games.slug, slug),
        eq(games.isPublished, true),
        inArray(games.id, ouverts),
      ),
    )
    .get();
}

export type BoutonVitrine = { libelle: string; titre: string; consoleSlug: string; slug: string };

/**
 * Les boutons de la page d'accueil, dans l'ordre choisi. Une entrée dont le
 * jeu a disparu ou n'est plus publié est passée sous silence plutôt que de
 * mener à une page introuvable.
 */
export async function boutonsDeLaVitrine(): Promise<BoutonVitrine[]> {
  if (lireParametre(ACTIVE) !== "1") return [];
  const entrees = lireEntrees();
  if (entrees.length === 0) return [];
  const lignes = await db
    .select({ id: games.id, title: games.title, consoleSlug: games.consoleSlug, slug: games.slug })
    .from(games)
    .where(and(eq(games.isPublished, true), inArray(games.id, entrees.map((e) => e.jeu))))
    .all();
  const parId = new Map(lignes.map((l) => [l.id, l]));
  return entrees.flatMap((entree) => {
    const jeu = parId.get(entree.jeu);
    if (!jeu) return [];
    return [{ libelle: entree.libelle || jeu.title, titre: jeu.title, consoleSlug: jeu.consoleSlug, slug: jeu.slug }];
  });
}
