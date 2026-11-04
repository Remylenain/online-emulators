import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

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

const JOURNAL = () => path.join(env.DATA_DIR, "scan.log");
const VERROU = () => path.join(env.DATA_DIR, "scan.pid");

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

async function pidEnCours(): Promise<number | null> {
  try {
    const contenu = await fs.readFile(VERROU(), "utf8");
    const pid = Number(contenu.trim());
    if (!Number.isInteger(pid) || !tourne(pid)) return null;
    return pid;
  } catch {
    return null;
  }
}

export async function etatDuScan(): Promise<EtatScan> {
  const pid = await pidEnCours();

  let journal = "";
  let termineLe: string | null = null;
  try {
    journal = await fs.readFile(JOURNAL(), "utf8");
    const stat = await fs.stat(JOURNAL());
    termineLe = pid ? null : stat.mtime.toISOString();
  } catch {
    journal = "";
  }

  return { enCours: pid !== null, journal, termineLe };
}

export type DemarrageScan = { demarre: boolean; message?: string };

export async function demarrerScan(): Promise<DemarrageScan> {
  if (await pidEnCours()) {
    return { demarre: false, message: "Un scan est déjà en cours." };
  }

  const script = path.join(process.cwd(), "scripts", "scan-library.ts");
  try {
    await fs.access(script);
  } catch {
    return { demarre: false, message: "Le script de scan est introuvable sur le serveur." };
  }

  await fs.mkdir(env.DATA_DIR, { recursive: true });
  const sortie = createWriteStream(JOURNAL(), { flags: "w" });
  await new Promise((resolve) => sortie.once("open", resolve));

  /**
   * `detached` et `unref` : le scan doit survivre à la requête qui l'a lancé,
   * et au redéploiement qui pourrait suivre. Il écrit dans la même base que le
   * service — SQLite en mode WAL supporte cet écrivain concurrent, et le
   * `busy_timeout` posé des deux côtés absorbe les attentes.
   */
  const enfant = spawn(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: ["ignore", sortie, sortie],
  });

  if (!enfant.pid) return { demarre: false, message: "Le scan n'a pas pu démarrer." };

  await fs.writeFile(VERROU(), String(enfant.pid), "utf8");
  enfant.unref();

  return { demarre: true };
}
