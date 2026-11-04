/**
 * Copie le cœur mGBA dans `public/mgba/`.
 *
 *   npm run core:install
 *
 * Le cœur n'est pas versionné : `public/mgba/` est ignoré par git. Le dépôt
 * décrit comment installer mGBA, il ne le redistribue pas — c'est un projet
 * séparé, sous MPL-2.0, qui a sa propre histoire et ses propres versions.
 *
 * Il est servi depuis notre domaine et non depuis un CDN : le lecteur tourne
 * sous isolation cross-origin (COOP/COEP), qui exige que le script du worker
 * vienne de la même origine. Un CDN serait bloqué.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** `mgba.wasm.map` est volontairement absent : 450 Ko de débogage inutiles. */
const FICHIERS = ["mgba.js", "mgba.wasm"];

const source = path.dirname(require.resolve("@thenick775/mgba-wasm/dist/mgba.js"));
const destination = path.resolve("./public/mgba");

await fs.mkdir(destination, { recursive: true });

for (const fichier of FICHIERS) {
  const depuis = path.join(source, fichier);
  const vers = path.join(destination, fichier);
  await fs.copyFile(depuis, vers);
  const { size } = await fs.stat(vers);
  console.log(`  ${fichier.padEnd(12)} ${(size / 1024).toFixed(0)} Ko`);
}

const version = require("@thenick775/mgba-wasm/package.json").version as string;
console.log(`\nmGBA ${version} installé dans public/mgba/.`);
