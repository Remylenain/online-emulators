import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "../src/db/schema.ts";

/**
 * Connexion pour les scripts en ligne de commande.
 *
 * Volontairement distincte de `src/db/index.ts` : Node exécute ces fichiers
 * directement, sans le résolveur de modules de Next, donc sans les alias de
 * chemins ni les imports sans extension. Une vingtaine de lignes dupliquées
 * valent mieux qu'une chaîne d'imports qui ne tient que dans un des deux
 * contextes.
 */
export function openDatabase() {
  const file = path.resolve(process.env.DATABASE_PATH ?? "./data/app.db");
  const sqlite = new Database(file);
  // `busy_timeout` en premier, comme dans src/db/index.ts : le passage en WAL
  // demande un verrou exclusif, et un script lancé pendant que le service
  // tourne échouerait aussitôt au lieu d'attendre son tour.
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export { schema };
