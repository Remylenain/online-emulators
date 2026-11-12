import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Le cœur d'émulation de l'Activité : mGBA, une console, sans threads.
 *
 * Le lecteur du site utilise un mGBA à threads, donc `SharedArrayBuffer`, donc
 * l'isolation cross-origin — que Discord ne donne pas à ses iframes. Ce
 * cœur-ci est compilé sans threads : il tourne partout, dans le fil principal.
 * C'est la variante « une console » du cœur du câble link (voir
 * `coeurs/mgba-splitscreen/LISEZMOI.md`) : même source, mais une mémoire qui
 * part de 32 Mio au lieu de 256, pour tenir sur un téléphone.
 */
const DOSSIER = path.join(/* turbopackIgnore: true */ process.cwd(), "coeurs", "mgba-splitscreen");

export const FICHIERS_COEUR = {
  "mgs.js": { fichier: "mgba-une-console.cjs", type: "text/javascript; charset=utf-8" },
  "mgs.wasm": { fichier: "mgba-une-console.wasm", type: "application/wasm" },
} as const;

export type FichierCoeur = keyof typeof FICHIERS_COEUR;

export function lireFichierCoeur(nom: FichierCoeur): Buffer {
  return fs.readFileSync(path.join(DOSSIER, FICHIERS_COEUR[nom].fichier));
}

let version: string | null = null;

function adresses(base: string): { js: string; wasm: string } {
  version ??= createHash("sha1")
    .update(lireFichierCoeur("mgs.js"))
    .update(lireFichierCoeur("mgs.wasm"))
    .digest("hex")
    .slice(0, 12);
  return { js: `${base}/mgs.js?v=${version}`, wasm: `${base}/mgs.wasm?v=${version}` };
}

/**
 * Les adresses du cœur, avec son empreinte : les fichiers sont servis avec un
 * cache d'un an, et c'est l'empreinte dans l'adresse qui fait retélécharger
 * un cœur recompilé.
 */
export function adressesCoeur(): { js: string; wasm: string } {
  return adresses("/api/discord/coeur");
}

/**
 * Le même cœur, pour le lecteur du site : il le prend pour les jeux dont la
 * cartouche vibre, ce que son cœur ordinaire ne rapporte pas. Une autre
 * adresse, parce que `/api/discord` n'est servi que sur l'hôte d'une Activité.
 */
export function adressesCoeurDuSite(): { js: string; wasm: string } {
  return adresses("/api/coeur");
}
