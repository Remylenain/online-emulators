import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/paths";

/**
 * Les images de disque PlayStation posées sur le serveur pour la page d'essai
 * de l'administration.
 *
 * Elles se rangent à plat dans `LIBRARY_DIR/psx/` — des fichiers ou des liens
 * symboliques, comme le reste de la bibliothèque. Le scan ne regarde pas ce
 * dossier : ces disques ne sont pas au catalogue.
 */
const DOSSIER = "psx";
const EXTENSIONS = new Set([".chd", ".pbp", ".iso", ".bin", ".img"]);

export type DisquePsx = { nom: string; taille: number };

/** Les images du dossier, liens suivis. Dossier absent : aucune. */
export async function listerDisquesPsx(): Promise<DisquePsx[]> {
  const dossier = paths.library(DOSSIER);
  let noms: string[];
  try {
    noms = await fs.readdir(dossier);
  } catch {
    return [];
  }
  const disques: DisquePsx[] = [];
  for (const nom of noms.sort((a, b) => a.localeCompare(b, "fr"))) {
    if (!EXTENSIONS.has(path.extname(nom).toLowerCase())) continue;
    try {
      // `stat` et non `lstat` : un lien vers l'image compte comme l'image.
      const etat = await fs.stat(path.join(dossier, nom));
      if (etat.isFile()) disques.push({ nom, taille: etat.size });
    } catch {
      // Lien mort : le disque n'est pas là, on ne le propose pas.
    }
  }
  return disques;
}

/** Le chemin d'une image, à ne construire que pour un nom rendu par `listerDisquesPsx`. */
export function cheminDisquePsx(disque: DisquePsx): string {
  return path.join(paths.library(DOSSIER), disque.nom);
}
