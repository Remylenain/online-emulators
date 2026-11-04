/**
 * Mesure ce qu'un salon de câble link coûte au serveur, et en déduit combien
 * de salons peuvent tourner en même temps.
 *
 *   npm run link:capacite              mesure et affiche
 *   npm run link:capacite -- --appliquer   mesure, puis enregistre les coûts
 *                                       dans les réglages : la limite s'applique
 *                                       aussitôt, sans redémarrage
 *
 * À lancer sur la machine qui héberge le site, à un moment calme : la mesure
 * dure une vingtaine de secondes par famille de consoles et occupe un cœur
 * pendant ce temps. Un salon réel est lancé pour chaque famille (GB/GBC avec
 * TGB Dual, GBA avec mGBA Splitscreen), sur le premier jeu de la bibliothèque
 * qui convienne, sans sauvegarde : rien n'est écrit, et les parties des
 * comptes ne sont pas touchées.
 *
 * Le coût relevé est la part du temps que le fil de travail passe à
 * travailler (émuler deux consoles, convertir et compresser deux écrans), au
 * rythme réel de 60 images par seconde. La marge (Administration → Réglages,
 * 65 % par défaut) laisse le reste au site lui-même et aux aléas.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { paths } from "@/lib/paths";
import {
  coeursMachine,
  definirCharges,
  etatCapacite,
  margeLink,
  type Famille,
} from "@/lib/link/capacite";
import { descriptionCoeur } from "@/lib/link/salons";

const appliquer = process.argv.includes("--appliquer");
/** Secondes de chauffe (chargement, premières images) puis de mesure. */
const CHAUFFE_S = 4;
const MESURE_S = 12;

const FAMILLES: { famille: Famille; consoles: string[]; nom: string }[] = [
  { famille: "gb", consoles: ["gbc", "gb"], nom: "GB / GBC" },
  { famille: "gba", consoles: ["gba"], nom: "GBA" },
];

type Mesure = { famille: Famille; nom: string; jeu: string; charge: number };

async function jeuPour(consoles: string[]): Promise<{ titre: string; consoleSlug: string; romPath: string } | null> {
  for (const consoleSlug of consoles) {
    const jeu = db
      .select({ titre: games.title, consoleSlug: games.consoleSlug, romPath: games.romPath })
      .from(games)
      .where(eq(games.consoleSlug, consoleSlug))
      .orderBy(asc(games.title))
      .get();
    if (jeu) return jeu;
  }
  return null;
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mesurer(entree: (typeof FAMILLES)[number]): Promise<Mesure | null> {
  const jeu = await jeuPour(entree.consoles);
  if (!jeu) {
    console.log(`${entree.nom} : aucun jeu dans la bibliothèque, pas de mesure.`);
    return null;
  }
  const coeur = await descriptionCoeur(jeu.consoleSlug);
  if (!coeur) return null;
  const rom = await fs.readFile(paths.library(jeu.romPath));

  const ouvrier = new Worker(new URL("../src/lib/link/ouvrier.ts", import.meta.url));
  const messages: Record<string, unknown>[] = [];
  const attendreMessage = (t: string) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const deja = messages.find((m) => m.t === t);
      if (deja) return resolve(deja);
      const sur = (m: Record<string, unknown>) => {
        if (m.t === "erreur") {
          ouvrier.off("message", sur);
          reject(new Error(String(m.message)));
        } else if (m.t === t) {
          ouvrier.off("message", sur);
          resolve(m);
        }
      };
      ouvrier.on("message", sur);
    });
  ouvrier.on("message", (m: Record<string, unknown>) => messages.push(m));
  ouvrier.on("error", (e: Error) => console.error(`${entree.nom} : le fil de travail a planté : ${e.message}`));

  process.stdout.write(`${entree.nom} (${jeu.titre}) : chauffe ${CHAUFFE_S} s, mesure ${MESURE_S} s… `);
  const romCopie = rom.buffer.slice(rom.byteOffset, rom.byteOffset + rom.byteLength) as ArrayBuffer;
  ouvrier.postMessage(
    { t: "demarrer", coeur, rom: romCopie, nom: path.basename(jeu.romPath), saves: [null, null] },
    [romCopie, coeur.wasm],
  );
  try {
    await attendreMessage("pret");
    await attendre(CHAUFFE_S * 1000);
    messages.length = 0;
    ouvrier.postMessage({ t: "mesure" });
    await attendreMessage("mesure");
    await attendre(MESURE_S * 1000);
    messages.length = 0;
    ouvrier.postMessage({ t: "mesure" });
    const relevee = await attendreMessage("mesure");
    const charge = Number(relevee.utilisation);
    console.log(`${(charge * 100).toFixed(0)} % d'un cœur`);
    return { famille: entree.famille, nom: entree.nom, jeu: jeu.titre, charge };
  } finally {
    await ouvrier.terminate().catch(() => {});
  }
}

const coeurs = coeursMachine();
const marge = margeLink();
console.log(`Processeur : ${coeurs} cœur${coeurs > 1 ? "s" : ""} disponibles, marge réglée à ${marge} %.`);
if (process.platform === "win32") {
  console.log("(Sous Windows, la cadence plafonne vers 34 images par seconde : la mesure sous-estime le coût réel. À faire sur le serveur.)");
}

const mesures: Mesure[] = [];
for (const entree of FAMILLES) {
  const mesure = await mesurer(entree);
  if (mesure) mesures.push(mesure);
}

if (mesures.length === 0) {
  console.log("Rien mesuré.");
  process.exit(1);
}

const budget = (coeurs * marge) / 100;
console.log("");
for (const m of mesures) {
  const salons = Math.floor(budget / m.charge + 1e-9);
  console.log(`${m.nom.padEnd(9)} : ${m.charge.toFixed(2)} cœur par salon → ${salons} salon${salons > 1 ? "s" : ""} en même temps à ${marge} %`);
}

if (appliquer) {
  definirCharges(Object.fromEntries(mesures.map((m) => [m.famille, m.charge])));
  const etat = etatCapacite();
  console.log("");
  console.log(`Coûts enregistrés. Limite en vigueur : ${etat.libres.gb ?? "∞"} salons GB/GBC ou ${etat.libres.gba ?? "∞"} salons GBA, à partir de maintenant.`);
} else {
  console.log("");
  console.log("Relance avec --appliquer pour que cette limite s'applique.");
}
process.exit(0);
