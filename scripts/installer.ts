/**
 * Installation en une commande, pour un poste ou un petit serveur :
 *
 *   npm run installer
 *
 * Crée `.env` s'il manque (avec un secret de session tiré au hasard), copie
 * le cœur mGBA, applique les migrations, prépare les dossiers de la
 * bibliothèque et crée le premier compte administrateur s'il n'y en a pas.
 * Relançable sans risque : chaque étape vérifie ce qui existe déjà.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password.ts";
import { pseudoSchema } from "../src/lib/validation.ts";

const racine = process.cwd();
const etape = (titre: string) => console.log(`\n== ${titre}`);

// 1. Configuration --------------------------------------------------------
etape("Configuration (.env)");
const envFichier = path.join(racine, ".env");
if (fs.existsSync(envFichier)) {
  console.log("  .env existe déjà, conservé tel quel.");
} else {
  const exemple = fs.readFileSync(path.join(racine, ".env.example"), "utf8");
  const secret = randomBytes(48).toString("base64");
  fs.writeFileSync(envFichier, exemple.replace('SESSION_SECRET=""', `SESSION_SECRET="${secret}"`));
  console.log("  .env créé depuis .env.example, secret de session généré.");
  console.log("  Les chemins par défaut sont ./library (jeux) et ./data (données).");
}

// Les scripts suivants lisent .env : on le charge nous-mêmes, puisqu'il
// n'existait peut-être pas au lancement de ce script.
for (const ligne of fs.readFileSync(envFichier, "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?\s*$/.exec(ligne.trim());
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

// 2. Cœur mGBA ------------------------------------------------------------
etape("Cœur mGBA");
execSync("npm run -s core:install", { stdio: "inherit" });

// 3. Base de données --------------------------------------------------------
etape("Base de données");
fs.mkdirSync(path.dirname(path.resolve(process.env.DATABASE_PATH ?? "./data/app.db")), {
  recursive: true,
});
execSync("npm run -s db:migrate", { stdio: "inherit", env: process.env });

// 4. Dossiers de la bibliothèque ---------------------------------------------
etape("Bibliothèque");
const bibliotheque = path.resolve(process.env.LIBRARY_DIR ?? "./library");
for (const console_ of ["gb", "gbc", "gba"]) {
  fs.mkdirSync(path.join(bibliotheque, console_), { recursive: true });
}
fs.mkdirSync(path.join(bibliotheque, "bezels"), { recursive: true });
console.log(`  ${bibliotheque}/{gb,gbc,gba}/ prêts à recevoir des jeux.`);

// 5. Premier compte ---------------------------------------------------------
etape("Compte administrateur");
const { openDatabase, schema } = await import("./_db.ts");
const { db, sqlite } = openDatabase();
const existant = db.select({ n: sql<number>`count(*)` }).from(schema.users).get();

if ((existant?.n ?? 0) > 0) {
  console.log("  Des comptes existent déjà, rien à créer.");
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let pseudo = "admin";
  if (process.stdin.isTTY) {
    const saisi = (await rl.question("  Pseudo de l'administrateur [admin] : ")).trim();
    const verifie = pseudoSchema.safeParse(saisi || "admin");
    pseudo = verifie.success ? verifie.data : "admin";
  }
  rl.close();

  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const motDePasse = Array.from(randomBytes(20), (o) => alphabet[o % alphabet.length]).join("");
  db.insert(schema.users)
    .values({ id: randomUUID(), pseudo, email: null, passwordHash: await hashPassword(motDePasse), role: "ADMIN" })
    .run();
  console.log(`\n  Compte « ${pseudo} » créé. Mot de passe, affiché une seule fois :\n`);
  console.log(`      ${motDePasse}\n`);
  console.log("  À changer depuis « Mon compte » après la première connexion.");
}
sqlite.close();

// 6. Et ensuite -------------------------------------------------------------
etape("Terminé");
console.log(`
  Pour ajouter un jeu : un dossier par jeu dans ${bibliotheque}/<console>/,
  avec la ROM et un game.json (voir README.md), puis :

      npm run library:scan

  Pour lancer le site :

      npm run dev                 # développement, http://localhost:3000
      npm run build && npm start  # production

  Serveur de mail et captcha (facultatifs) : voir .env et README.md.
`);
