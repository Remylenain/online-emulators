import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * Connexion SQLite.
 *
 * Ce module lit `DATABASE_PATH` directement, sans passer par la validation
 * d'environnement de l'application : les scripts en ligne de commande
 * (scan de la bibliothèque, création de compte) l'importent par chemin relatif,
 * hors du contexte Next et de ses alias.
 *
 * En développement, Next recharge les modules à chaque édition : sans le cache
 * global, chaque rechargement ouvrirait un descripteur de fichier de plus.
 */
const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  drizzle?: BetterSQLite3Database<typeof schema>;
};

function connect(): Database.Database {
  // Le commentaire d'exclusion est nécessaire : sans lui, Turbopack voit un
  // chemin calculé à l'exécution et embarque tout le projet — sources et
  // dossier public compris — dans la trace de déploiement.
  const file = path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH ?? "./data/app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);

  // En premier, avant tout autre pragma : sans lui, une base déjà verrouillée
  // fait échouer l'ouverture au lieu d'attendre. `next build` lance neuf
  // processus qui ouvrent le fichier en même temps, et le passage en WAL
  // ci-dessous demande un verrou exclusif — d'où un SQLITE_BUSY immédiat.
  sqlite.pragma("busy_timeout = 5000");

  // WAL : un lecteur n'est jamais bloqué par un écrivain, ce qui compte quand
  // une sauvegarde s'écrit pendant qu'une page de catalogue se charge. Le mode
  // est inscrit dans le fichier, donc on ne le repositionne pas inutilement :
  // le relire coûte moins cher que de redemander le verrou exclusif.
  const [{ journal_mode: journalMode }] = sqlite.pragma("journal_mode") as [
    { journal_mode: string },
  ];
  if (journalMode.toLowerCase() !== "wal") {
    try {
      sqlite.pragma("journal_mode = WAL");
    } catch (erreur) {
      /*
       * Une base toute neuve, lue par un compte qui n'a pas le droit d'y
       * écrire : c'est `next build` à la première installation d'une
       * instance. Les migrations viennent de créer le fichier, le service n'a
       * encore jamais tourné, et le compte qui construit ne fait que lire le
       * nom du site pour quelques pages figées. Changer de mode est une
       * écriture, qu'on laisse au service : il la fera à son premier
       * démarrage. Sur une base déjà en WAL, ce cas ne se présente pas —
       * d'où une première installation qui échouait là où les mises à jour
       * passaient.
       */
      if ((erreur as { code?: string }).code !== "SQLITE_READONLY") throw erreur;
    }
  }

  // SQLite ignore les clés étrangères par défaut, donc aussi les ON DELETE CASCADE.
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  return sqlite;
}

/**
 * Ouverture différée, et c'est essentiel : `next build` importe chaque module
 * de page pour en collecter la configuration. Une connexion ouverte au
 * chargement du module se ferait donc établir à la construction, alors que la
 * base n'a aucune raison d'exister à ce moment-là — et que le compte qui
 * construit n'est pas celui qui fait tourner le service.
 *
 * Sans ce report, la construction échouait sur `SQLITE_READONLY` : le dossier
 * de données n'appartient qu'à l'utilisateur du service, et passer la base en
 * WAL est une écriture.
 */
function connection(): Database.Database {
  globalForDb.sqlite ??= connect();
  return globalForDb.sqlite;
}

type Base = BetterSQLite3Database<typeof schema>;

function database(): Base {
  globalForDb.drizzle ??= drizzle(connection(), { schema });
  return globalForDb.drizzle;
}

/**
 * Le report porte sur l'objet Drizzle et non sur le client : `drizzle()` lit
 * des propriétés du client qu'on lui passe pour distinguer un client d'un
 * objet de configuration. Un mandataire autour du client s'ouvrirait donc dès
 * la construction, ce qui ne reporterait rien.
 */
export const db = new Proxy({} as Base, {
  get(_cible, propriete) {
    const reelle = database();
    const valeur = Reflect.get(reelle, propriete, reelle);
    return typeof valeur === "function" ? valeur.bind(reelle) : valeur;
  },
});

/** La connexion brute, pour les pragmas et la fermeture en ligne de commande. */
export function sqlite(): Database.Database {
  return connection();
}

export { schema };
