import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { CONSOLE_SLUGS } from "@/lib/consoles";
import { env } from "@/lib/env";
import { textes } from "@/lib/i18n/serveur";

/**
 * Lancement du scan de bibliothèque depuis le site.
 *
 * Le scan calcule l'empreinte d'un gigaoctet de ROMs et réencode les
 * jaquettes : bien trop long pour une requête HTTP, qui expirerait avant la
 * fin. Il tourne donc dans un processus séparé, détaché, et écrit son journal
 * dans un fichier que l'interface relit.
 *
 * Le service tourne déjà sous l'utilisateur propriétaire des données : le
 * processus fils hérite de cette identité, et le scan n'a besoin d'aucun
 * privilège supplémentaire. C'est ce qui permet de se passer de `sudo`.
 */

/**
 * Une tâche de fond : son script, son journal, son verrou. Son `nom` désigne
 * ses messages dans le dictionnaire (`adminBibliotheque.taches.refus`).
 */
type Tache = { script: string; journal: string; verrou: string; nom: "scan" | "scraper" };

const TACHES = {
  scan: { script: "scan-library.ts", journal: "scan.log", verrou: "scan.pid", nom: "scan" },
  // Le scraper complète les fiches puis relance le scan lui-même.
  scraper: { script: "scraper.ts", journal: "scraper.log", verrou: "scraper.pid", nom: "scraper" },
} as const satisfies Record<string, Tache>;

export type NomTache = keyof typeof TACHES;

const chemin = (fichier: string) => path.join(env.DATA_DIR, fichier);

export type EtatScan = {
  enCours: boolean;
  journal: string;
  termineLe: string | null;
};

/** Le processus de ce PID tourne-t-il encore ? */
function tourne(pid: number): boolean {
  try {
    // Le signal 0 ne fait rien : il ne sert qu'à tester l'existence.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pidEnCours(tache: Tache): Promise<number | null> {
  try {
    const contenu = await fs.readFile(chemin(tache.verrou), "utf8");
    const pid = Number(contenu.trim());
    if (!Number.isInteger(pid) || !tourne(pid)) return null;
    return pid;
  } catch {
    return null;
  }
}

export async function etatDeLaTache(nom: NomTache): Promise<EtatScan> {
  const tache = TACHES[nom];
  const pid = await pidEnCours(tache);

  let journal = "";
  let termineLe: string | null = null;
  try {
    journal = await fs.readFile(chemin(tache.journal), "utf8");
    const stat = await fs.stat(chemin(tache.journal));
    termineLe = pid ? null : stat.mtime.toISOString();
  } catch {
    journal = "";
  }

  return { enCours: pid !== null, journal, termineLe };
}

export type DemarrageScan = { demarre: boolean; message?: string };

/**
 * `consoleSlug` limite la tâche à une console : relire ou compléter plusieurs
 * centaines de jeux pour en avoir ajouté un seul n'a pas de sens.
 *
 * Le message d'un refus est dans la langue de la requête : cette fonction ne
 * s'appelle que depuis une route.
 */
export async function demarrerLaTache(nom: NomTache, consoleSlug?: string): Promise<DemarrageScan> {
  const refus = (await textes()).adminBibliotheque.taches.refus;

  if (consoleSlug !== undefined && !CONSOLE_SLUGS.includes(consoleSlug)) {
    return { demarre: false, message: refus.consoleInconnue };
  }

  // Le scan et le scraper écrivent les mêmes fiches : jamais les deux à la fois.
  for (const autre of Object.values(TACHES)) {
    if (await pidEnCours(autre)) {
      return { demarre: false, message: refus.dejaEnCours[autre.nom] };
    }
  }
  const tache = TACHES[nom];

  const script = path.join(process.cwd(), "scripts", tache.script);
  try {
    await fs.access(script);
  } catch {
    return { demarre: false, message: refus.scriptIntrouvable[tache.nom] };
  }

  await fs.mkdir(env.DATA_DIR, { recursive: true });
  const sortie = createWriteStream(chemin(tache.journal), { flags: "w" });
  await new Promise((resolve) => sortie.once("open", resolve));

  /**
   * `detached` et `unref` : la tâche doit survivre à la requête qui l'a
   * lancée, et au redéploiement qui pourrait suivre. Elle écrit dans la même
   * base que le service — SQLite en mode WAL supporte cet écrivain
   * concurrent, et le `busy_timeout` posé des deux côtés absorbe les attentes.
   */
  const enfant = spawn(process.execPath, [script, ...(consoleSlug ? ["--console", consoleSlug] : [])], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: ["ignore", sortie, sortie],
  });

  if (!enfant.pid) return { demarre: false, message: refus.demarrageImpossible[tache.nom] };

  await fs.writeFile(chemin(tache.verrou), String(enfant.pid), "utf8");
  enfant.unref();

  return { demarre: true };
}

export const etatDuScan = () => etatDeLaTache("scan");
export const demarrerScan = (consoleSlug?: string) => demarrerLaTache("scan", consoleSlug);
