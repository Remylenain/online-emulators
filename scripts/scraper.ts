/**
 * Complète les fiches du catalogue : description, année et jaquette des jeux
 * officiels qui n'en ont pas.
 *
 *   node --env-file=.env scripts/scraper.ts [--console gbc] [--tout] [--sans-scan]
 *
 * Lancé depuis Administration → Bibliothèque, comme le scan : il tourne dans
 * un processus à part et écrit un journal que l'interface relit.
 *
 * Deux sources, dans cet ordre :
 *
 * 1. **ScreenScraper** (screenscraper.fr), si un compte est renseigné dans
 *    Administration → Réglages. La ROM est reconnue par son empreinte SHA-1 :
 *    peu importe comment le fichier s'appelle. On en tire la description
 *    (en français si elle existe, sinon en anglais), l'année de sortie et la
 *    jaquette. L'API exige, en plus du compte, des identifiants développeur
 *    que ScreenScraper délivre sur demande.
 * 2. **Les vignettes de libretro** (thumbnails.libretro.com), sans compte,
 *    pour la jaquette seulement. Elles sont rangées sous le nom No-Intro du
 *    jeu, qu'on retrouve de trois façons (voir `_libretro.ts`) :
 *    - par l'empreinte SHA-1 de la ROM, dans la base No-Intro : une ROM
 *      intacte est reconnue quel que soit le nom de son fichier ;
 *    - par le nom du fichier, s'il est déjà le nom No-Intro ;
 *    - par le titre, rapproché de la liste complète du système — celui de la
 *      fiche, du fichier, et en dernier recours celui que la cartouche porte
 *      dans son en-tête. Un rapprochement qui n'est pas lettre pour lettre est
 *      marqué « ≈ » dans le journal.
 *
 * Seuls les jeux marqués `officiel` sont interrogés : un rom hack n'est dans
 * aucune de ces bases, et chaque ROM inconnue compte contre le quota du
 * compte. Rien n'est jamais écrasé : une description ou une année déjà
 * présente — dans le `game.json` ou saisie dans l'administration — est
 * gardée, et un jeu qui a sa jaquette n'en reçoit pas d'autre. Ce qui est
 * trouvé va dans les retouches (DATA_DIR/retouches) et les jaquettes dans
 * DATA_DIR/jaquettes : la bibliothèque reste en lecture seule. Le scan est
 * relancé à la fin pour publier le tout.
 *
 * `--console` ne complète que les jeux d'une console, et le scan final ne
 * relit qu'elle ; `--tout` reprend aussi les jeux déjà complets (pour
 * rafraîchir une jaquette) ; `--sans-scan` saute le scan final.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { ecrireRetouche, lireRetouche } from "../src/lib/library/retouches.ts";
import { openDatabase, schema } from "./_db.ts";
import { adresseJaquette, chercherJaquetteLibretro, nomNoIntro, titreDeLEnTete } from "./_libretro.ts";

const libraryDir = path.resolve(process.env.LIBRARY_DIR ?? "./library");
const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
const tout = process.argv.includes("--tout");
const sansScan = process.argv.includes("--sans-scan");
/** La seule console à compléter, ou `undefined` pour toutes. */
const seule = process.argv.includes("--console") ? process.argv[process.argv.indexOf("--console") + 1] : undefined;

const SYSTEMES: Record<string, { screenscraper: number; libretro: string }> = {
  gb: { screenscraper: 9, libretro: "Nintendo - Game Boy" },
  gbc: { screenscraper: 10, libretro: "Nintendo - Game Boy Color" },
  gba: { screenscraper: 12, libretro: "Nintendo - Game Boy Advance" },
};

if (seule !== undefined && !SYSTEMES[seule]) {
  console.error(`Console inconnue : ${seule ?? "(rien)"}. Attendu : ${Object.keys(SYSTEMES).join(", ")}.`);
  process.exit(2);
}

const { db, sqlite } = openDatabase();
const reglage = (cle: string) =>
  db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, cle)).get()?.value?.trim() ?? "";

const compte = {
  devId: reglage("ss_devid"),
  devPassword: reglage("ss_devpassword"),
  ssId: reglage("ss_id"),
  ssPassword: reglage("ss_password"),
};
const avecScreenScraper = Boolean(compte.devId && compte.devPassword);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- ScreenScraper ----------------------------------------------------------

type Trouve = { description?: string; annee?: number; jaquette?: string };

/** Le texte d'une liste « par langue » ou « par région », dans l'ordre de préférence donné. */
function choisir(liste: unknown, cle: "langue" | "region", preferences: string[]): string | undefined {
  if (!Array.isArray(liste)) return undefined;
  const entrees = liste as { langue?: string; region?: string; text?: string }[];
  for (const preference of preferences) {
    const trouvee = entrees.find((entree) => entree[cle] === preference && entree.text);
    if (trouvee?.text) return trouvee.text;
  }
  return entrees.find((entree) => entree.text)?.text;
}

let screenScraperArrete: string | null = null;

async function interrogerScreenScraper(jeu: {
  consoleSlug: string;
  romSha1: string;
  romSize: number;
  nomRom: string;
}): Promise<Trouve | null> {
  if (!avecScreenScraper || screenScraperArrete) return null;
  const parametres = new URLSearchParams({
    devid: compte.devId,
    devpassword: compte.devPassword,
    softname: "online-emulators",
    output: "json",
    systemeid: String(SYSTEMES[jeu.consoleSlug]!.screenscraper),
    romtype: "rom",
    sha1: jeu.romSha1.toUpperCase(),
    romnom: jeu.nomRom,
    romtaille: String(jeu.romSize),
  });
  if (compte.ssId) {
    parametres.set("ssid", compte.ssId);
    parametres.set("sspassword", compte.ssPassword);
  }

  let reponse: Response;
  try {
    reponse = await fetch(`https://api.screenscraper.fr/api2/jeuInfos.php?${parametres}`, {
      signal: AbortSignal.timeout(30_000),
    });
  } catch (erreur) {
    console.warn(`  ! ScreenScraper injoignable (${(erreur as Error).message}).`);
    return null;
  }

  if (reponse.status === 404) return null; // ROM inconnue de la base.
  if (!reponse.ok) {
    const texte = (await reponse.text().catch(() => "")).trim().slice(0, 200);
    // Identifiants refusés, API fermée, quota du jour atteint : inutile d'insister
    // pour les jeux suivants, on finit avec libretro.
    if ([401, 403, 423, 426, 430, 431].includes(reponse.status)) {
      screenScraperArrete = `ScreenScraper a répondu ${reponse.status} : ${texte || "refus"}`;
      console.warn(`  ! ${screenScraperArrete}. Suite sans lui.`);
    } else {
      console.warn(`  ! ScreenScraper : ${reponse.status} ${texte}`);
    }
    return null;
  }

  let corps: { response?: { jeu?: Record<string, unknown> } };
  try {
    corps = (await reponse.json()) as typeof corps;
  } catch {
    return null;
  }
  const fiche = corps.response?.jeu;
  if (!fiche) return null;

  const trouve: Trouve = {};
  const synopsis = choisir(fiche.synopsis, "langue", ["fr", "en"]);
  if (synopsis) trouve.description = synopsis.replace(/\r\n/g, "\n").trim().slice(0, 4000);
  const date = choisir(fiche.dates, "region", ["fr", "eu", "wor", "us", "jp"]);
  const annee = date ? Number(date.slice(0, 4)) : NaN;
  if (Number.isInteger(annee) && annee >= 1989 && annee <= 2100) trouve.annee = annee;

  if (Array.isArray(fiche.medias)) {
    const boites = (fiche.medias as { type?: string; region?: string; url?: string }[]).filter(
      (media) => media.type === "box-2D" && media.url,
    );
    for (const region of ["fr", "eu", "wor", "us", "jp"]) {
      const boite = boites.find((media) => media.region === region);
      if (boite?.url) {
        trouve.jaquette = boite.url;
        break;
      }
    }
    trouve.jaquette ??= boites[0]?.url;
  }
  return trouve;
}

// --- libretro ---------------------------------------------------------------

/** libretro remplace par un tiret bas les caractères interdits dans un nom de fichier. */
function adresseLibretro(consoleSlug: string, nomRom: string): string {
  const nom = nomRom.replace(/\.[^.]+$/, "").replace(/[&*/:`<>?\\|"]/g, "_");
  return `https://thumbnails.libretro.com/${encodeURIComponent(SYSTEMES[consoleSlug]!.libretro)}/Named_Boxarts/${encodeURIComponent(nom)}.png`;
}

async function telecharger(adresse: string, destination: string): Promise<boolean> {
  try {
    const reponse = await fetch(adresse, { signal: AbortSignal.timeout(30_000) });
    if (!reponse.ok) return false;
    const octets = Buffer.from(await reponse.arrayBuffer());
    // Une image fait au moins quelques centaines d'octets ; en dessous, c'est une page d'erreur.
    if (octets.length < 500) return false;
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, octets);
    return true;
  } catch {
    return false;
  }
}

/** Le titre que la cartouche porte dans son en-tête, ou une chaîne vide si la ROM ne se lit pas. */
function enTeteDe(romPath: string, consoleSlug: string): string {
  try {
    const fichier = fs.openSync(path.join(libraryDir, romPath), "r");
    try {
      const debut = Buffer.alloc(512);
      fs.readSync(fichier, debut, 0, debut.length, 0);
      return titreDeLEnTete(debut, consoleSlug);
    } finally {
      fs.closeSync(fichier);
    }
  } catch {
    return "";
  }
}

// --- Passage ---------------------------------------------------------------

const jeux = db
  .select({
    id: schema.games.id,
    titre: schema.games.title,
    consoleSlug: schema.games.consoleSlug,
    slug: schema.games.slug,
    description: schema.games.description,
    annee: schema.games.year,
    coverPath: schema.games.coverPath,
    romPath: schema.games.romPath,
    romSha1: schema.games.romSha1,
    romSize: schema.games.romSize,
  })
  .from(schema.games)
  .where(eq(schema.games.isOfficial, true))
  .all()
  .filter((jeu) => SYSTEMES[jeu.consoleSlug])
  .filter((jeu) => !seule || jeu.consoleSlug === seule)
  .filter((jeu) => tout || !jeu.description || !jeu.coverPath || !jeu.annee);
sqlite.close();

console.log(
  `${jeux.length} jeu${jeux.length > 1 ? "x" : ""} officiel${jeux.length > 1 ? "s" : ""} à compléter${seule ? ` (${SYSTEMES[seule]!.libretro} seulement)` : ""}. ` +
    (avecScreenScraper
      ? `ScreenScraper${compte.ssId ? ` (compte ${compte.ssId})` : " (sans compte membre)"}, puis libretro pour les jaquettes.`
      : "Pas d'identifiants ScreenScraper dans les réglages : jaquettes libretro seulement."),
);

let descriptions = 0;
let annees = 0;
let jaquettes = 0;
let rien = 0;

for (const [index, jeu] of jeux.entries()) {
  // La ROM est un lien dans la bibliothèque : son vrai nom est celui de la cible.
  let nomRom = path.basename(jeu.romPath);
  try {
    nomRom = path.basename(fs.realpathSync(path.join(libraryDir, jeu.romPath)));
  } catch {
    // Lien mort : le nom du lien fera l'affaire pour ScreenScraper, qui lit l'empreinte.
  }

  const acquis: string[] = [];
  const trouve = await interrogerScreenScraper({ ...jeu, nomRom });
  if (avecScreenScraper && !screenScraperArrete) await pause(1200); // un fil, sans presser le serveur

  // Description et année : dans les retouches, et seulement là où rien n'existe.
  if (trouve && ((trouve.description && !jeu.description) || (trouve.annee && !jeu.annee))) {
    const retouche = await lireRetouche(jeu.consoleSlug, jeu.slug);
    if (trouve.description && !jeu.description && retouche.description === undefined) {
      retouche.description = trouve.description;
      descriptions++;
      acquis.push("description");
    }
    if (trouve.annee && !jeu.annee && retouche.annee === undefined) {
      retouche.annee = trouve.annee;
      annees++;
      acquis.push(String(trouve.annee));
    }
    await ecrireRetouche(jeu.consoleSlug, jeu.slug, retouche);
  }

  // Jaquette : ScreenScraper d'abord, libretro ensuite.
  let reconnue = "";
  if (!jeu.coverPath || tout) {
    const destination = path.join(dataDir, "jaquettes", jeu.consoleSlug, `${jeu.slug}.png`);
    let prise = false;
    if (trouve?.jaquette) prise = await telecharger(trouve.jaquette, destination);
    let precision = "";
    // La ROM reconnue par son empreinte : son nom No-Intro est celui de sa jaquette.
    const noIntro = prise ? null : await nomNoIntro(jeu.consoleSlug, jeu.romSha1);
    if (noIntro) {
      reconnue = noIntro.nom;
      prise = await telecharger(adresseJaquette(noIntro.consoleSlug, noIntro.nom), destination);
      if (prise) precision = ` (${noIntro.nom})`;
      await pause(150);
    }
    if (!prise && !noIntro) {
      prise = await telecharger(adresseLibretro(jeu.consoleSlug, nomRom), destination);
      await pause(150);
    }
    if (!prise) {
      // Pas d'image à ce nom exact : on rapproche le titre de la liste de libretro.
      const titres = noIntro ? [noIntro.nom, jeu.titre] : [jeu.titre];
      let proche = await chercherJaquetteLibretro(jeu.consoleSlug, nomRom, titres);
      if (!proche && !noIntro) {
        // ROM inconnue de No-Intro, donc modifiée : le titre de son en-tête,
        // lui, est souvent resté celui du jeu. Toujours signalé « ≈ ».
        const enTete = enTeteDe(jeu.romPath, jeu.consoleSlug);
        const parEnTete = enTete ? await chercherJaquetteLibretro(jeu.consoleSlug, enTete, []) : null;
        if (parEnTete) proche = { ...parEnTete, approchee: true };
      }
      if (proche) {
        prise = await telecharger(proche.adresse, destination);
        if (prise) precision = ` (${proche.approchee ? "≈ " : ""}${proche.nom})`;
        await pause(150);
      }
    }
    if (prise) {
      jaquettes++;
      acquis.push(`jaquette${precision}`);
    }
  }

  if (acquis.length === 0) rien++;
  // Un jeu reconnu mais sans image dit au moins sous quel nom la chercher ailleurs.
  const bilan = acquis.join(", ") || (reconnue ? `rien trouvé (reconnu : ${reconnue}, sans jaquette chez libretro)` : "rien trouvé");
  console.log(`  ${String(index + 1).padStart(3)}/${jeux.length}  ${jeu.titre} [${jeu.consoleSlug}] : ${bilan}`);
}

console.log(
  `\n${descriptions} description${descriptions > 1 ? "s" : ""}, ${annees} année${annees > 1 ? "s" : ""}, ${jaquettes} jaquette${jaquettes > 1 ? "s" : ""} ; ${rien} jeu${rien > 1 ? "x" : ""} sans rien de neuf.` +
    (screenScraperArrete ? `\n${screenScraperArrete}` : ""),
);

if (!sansScan && (descriptions > 0 || annees > 0 || jaquettes > 0)) {
  console.log("\nScan de la bibliothèque, pour publier ce qui vient d'être trouvé :\n");
  const script = path.join(process.cwd(), "scripts", "scan-library.ts");
  const scan = spawnSync(process.execPath, [script, ...(seule ? ["--console", seule] : [])], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  process.exit(scan.status ?? 0);
}
