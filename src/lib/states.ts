import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { saveStates } from "@/db/schema";
import { newId } from "@/lib/auth/session";
import { paths } from "@/lib/paths";

/**
 * Points de reprise : deux séries de cinq emplacements par compte et par jeu.
 *
 * Les **manuels** sont posés par le joueur et ne bougent que s'il le demande.
 * Les **automatiques** tournent tout seuls : le plus ancien des cinq est
 * remplacé à intervalle régulier, ce qui laisse en permanence une marge
 * arrière sans rien écraser de ce que le joueur a choisi de garder.
 *
 * Le fichier produit par mGBA est un PNG qui porte à la fois l'état de la
 * console et l'image de l'écran — il sert donc aussi de vignette. L'autre
 * cœur (mGBA Splitscreen, celui de l'Activité Discord) rend un état brut :
 * la page y joint alors une image de l'écran, rangée à part (`thumbPath`).
 */

export const EMPLACEMENTS = 5;

export type EtatResume = {
  emplacement: number;
  auto: boolean;
  taille: number;
  creeLe: Date;
};

export function emplacementValide(valeur: unknown): valeur is number {
  return (
    typeof valeur === "number" &&
    Number.isInteger(valeur) &&
    valeur >= 1 &&
    valeur <= EMPLACEMENTS
  );
}

/**
 * Décompose le segment d'URL d'un emplacement.
 *
 * « 3 » désigne le troisième emplacement manuel, « a3 » le troisième
 * automatique. Deux séries dans une seule adresse, sans paramètre à part.
 */
export function lireSegment(segment: string): { emplacement: number; auto: boolean } | null {
  const auto = segment.startsWith("a");
  const emplacement = Number(auto ? segment.slice(1) : segment);
  if (!emplacementValide(emplacement)) return null;
  return { emplacement, auto };
}

export function ecrireSegment(emplacement: number, auto: boolean): string {
  return auto ? `a${emplacement}` : String(emplacement);
}

function conditions(userId: string, gameId: string, emplacement?: number, auto?: boolean) {
  const liste = [eq(saveStates.userId, userId), eq(saveStates.gameId, gameId)];
  if (emplacement !== undefined) liste.push(eq(saveStates.slot, emplacement));
  if (auto !== undefined) liste.push(eq(saveStates.isAuto, auto));
  return and(...liste);
}

export async function listerEtats(userId: string, gameId: string): Promise<EtatResume[]> {
  const lignes = await db
    .select({
      slot: saveStates.slot,
      isAuto: saveStates.isAuto,
      size: saveStates.size,
      createdAt: saveStates.createdAt,
    })
    .from(saveStates)
    .where(conditions(userId, gameId))
    .orderBy(asc(saveStates.slot))
    .all();

  // Seuls les cinq emplacements comptent : la table a pu garder des numéros
  // plus hauts, laissés par une ancienne catégorie d'essai, qui ne sont ni
  // lisibles par mGBA ni montrés au joueur.
  return lignes
    .filter((ligne) => emplacementValide(ligne.slot))
    .map((ligne) => ({
      emplacement: ligne.slot,
      auto: ligne.isAuto,
      taille: ligne.size,
      creeLe: ligne.createdAt,
    }));
}

export async function lireEtat(
  userId: string,
  gameId: string,
  emplacement: number,
  auto: boolean,
): Promise<Uint8Array | null> {
  const ligne = await db
    .select({ path: saveStates.path })
    .from(saveStates)
    .where(conditions(userId, gameId, emplacement, auto))
    .get();

  if (!ligne) return null;

  try {
    return new Uint8Array(await fs.readFile(paths.data(ligne.path)));
  } catch {
    return null;
  }
}

export async function ecrireEtat(
  userId: string,
  gameId: string,
  emplacement: number,
  auto: boolean,
  donnees: Uint8Array,
): Promise<EtatResume> {
  const slot = emplacement;
  const relatif = paths.saveState(userId, gameId, auto ? slot + EMPLACEMENTS : slot);
  const absolu = paths.data(relatif);
  await fs.mkdir(path.dirname(absolu), { recursive: true });
  await fs.writeFile(absolu, donnees);

  // Un nouvel état n'a pas encore sa vignette : l'ancienne montrerait un
  // autre instant que celui qu'on retrouvera.
  const precedente = await db
    .select({ thumbPath: saveStates.thumbPath })
    .from(saveStates)
    .where(conditions(userId, gameId, emplacement, auto))
    .get();
  if (precedente?.thumbPath) await fs.rm(paths.data(precedente.thumbPath), { force: true });

  const maintenant = new Date();

  // Un emplacement est écrasé sans historique, contrairement aux sauvegardes :
  // c'est le propre d'un point de reprise que de se remplacer, et le joueur
  // choisit lui-même lequel des cinq il écrase.
  db.insert(saveStates)
    .values({
      id: newId(),
      userId,
      gameId,
      slot,
      isAuto: auto,
      path: relatif,
      size: donnees.length,
      createdAt: maintenant,
    })
    .onConflictDoUpdate({
      target: [saveStates.userId, saveStates.gameId, saveStates.isAuto, saveStates.slot],
      set: { path: relatif, size: donnees.length, thumbPath: null, createdAt: maintenant },
    })
    .run();

  return { emplacement, auto, taille: donnees.length, creeLe: maintenant };
}

/** L'image de l'écran jointe à un état ; `false` sans état à cet emplacement. */
export async function ecrireVignette(
  userId: string,
  gameId: string,
  emplacement: number,
  auto: boolean,
  png: Uint8Array,
): Promise<boolean> {
  const ligne = await db
    .select({ id: saveStates.id })
    .from(saveStates)
    .where(conditions(userId, gameId, emplacement, auto))
    .get();
  if (!ligne) return false;

  const relatif = paths.saveStateThumb(userId, gameId, auto ? emplacement + EMPLACEMENTS : emplacement);
  const absolu = paths.data(relatif);
  await fs.mkdir(path.dirname(absolu), { recursive: true });
  await fs.writeFile(absolu, png);
  db.update(saveStates).set({ thumbPath: relatif }).where(eq(saveStates.id, ligne.id)).run();
  return true;
}

export async function lireVignette(
  userId: string,
  gameId: string,
  emplacement: number,
  auto: boolean,
): Promise<Uint8Array | null> {
  const ligne = await db
    .select({ thumbPath: saveStates.thumbPath })
    .from(saveStates)
    .where(conditions(userId, gameId, emplacement, auto))
    .get();
  if (!ligne?.thumbPath) return null;
  try {
    return new Uint8Array(await fs.readFile(paths.data(ligne.thumbPath)));
  } catch {
    return null;
  }
}

export async function supprimerEtat(
  userId: string,
  gameId: string,
  emplacement: number,
  auto: boolean,
): Promise<boolean> {
  const ligne = await db
    .select({ id: saveStates.id, path: saveStates.path, thumbPath: saveStates.thumbPath })
    .from(saveStates)
    .where(conditions(userId, gameId, emplacement, auto))
    .get();

  if (!ligne) return false;

  await fs.rm(paths.data(ligne.path), { force: true });
  if (ligne.thumbPath) await fs.rm(paths.data(ligne.thumbPath), { force: true });
  db.delete(saveStates).where(eq(saveStates.id, ligne.id)).run();
  return true;
}
