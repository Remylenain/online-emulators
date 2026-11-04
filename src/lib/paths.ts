import path from "node:path";
import { env } from "./env";

/**
 * Résolution des chemins de stockage.
 *
 * La base ne contient que des chemins relatifs : déplacer la bibliothèque ou
 * les données ne demande que de changer LIBRARY_DIR / DATA_DIR.
 */

const libraryRoot = path.resolve(env.LIBRARY_DIR);
const dataRoot = path.resolve(env.DATA_DIR);

/**
 * Empêche une traversée de répertoire : un chemin venu de la base ou d'une
 * requête ne doit jamais sortir de sa racine.
 */
function resolveWithin(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error(`Chemin hors de la racine autorisée : ${relativePath}`);
  }
  return resolved;
}

export const paths = {
  libraryRoot,
  dataRoot,

  /** Fichier de la bibliothèque (ROM, jaquette d'origine). */
  library: (relativePath: string) => resolveWithin(libraryRoot, relativePath),

  /** Fichier généré (sauvegarde, savestate, avatar, miniature). */
  data: (relativePath: string) => resolveWithin(dataRoot, relativePath),

  saveFile: (userId: string, gameId: string) =>
    path.posix.join("saves", userId, gameId, "current.sav"),

  saveBackup: (userId: string, gameId: string, revision: number) =>
    path.posix.join("saves", userId, gameId, `backup-${revision}.sav`),

  saveState: (userId: string, gameId: string, slot: number) =>
    path.posix.join("states", userId, gameId, `slot-${slot}.state`),

  saveStateThumb: (userId: string, gameId: string, slot: number) =>
    path.posix.join("states", userId, gameId, `slot-${slot}.png`),

  avatar: (userId: string) => path.posix.join("avatars", `${userId}.webp`),

  cover: (consoleSlug: string, gameSlug: string, size: "sm" | "lg") =>
    path.posix.join("covers", consoleSlug, `${gameSlug}-${size}.webp`),
};
