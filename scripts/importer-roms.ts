/**
 * Range un dossier de ROMs dans la bibliothèque du site.
 *
 *   node scripts/importer-roms.ts --source "<dossier de ROMs>" --console gb \
 *        --bibliotheque "<LIBRARY_DIR>" [--officiel] [--langue fr] \
 *        [--gamelist "<gamelist.xml>"] [--essai]
 *
 * Pour chaque ROM du dossier source (sans descendre dans les sous-dossiers),
 * crée dans la bibliothèque un dossier `<console>/<slug>/` contenant un
 * `game.json` et un lien symbolique `rom.<ext>` vers le fichier d'origine —
 * rien n'est copié, comme pour le reste de la bibliothèque (voir
 * docs/deploiement.md). Le catalogue ne change qu'au scan suivant
 * (Administration → Bibliothèque, ou `npm run library:scan`).
 *
 * Le titre, la langue et la version viennent du nom de fichier, lu selon la
 * convention No-Intro que suivent la plupart des collections :
 * « Addams Family, The (Europe) (En,Fr,De) (Rev 1).gb » donne le titre
 * « The Addams Family », la langue « fr » (le français est préféré quand il
 * est dans la liste) et la version « Rev 1 ».
 *
 * **Reprendre une installation EmulationStation** (Recalbox, Batocera,
 * RetroPie, ES-DE) : si le dossier source contient un `gamelist.xml` — ou si
 * `--gamelist` en désigne un —, ses fiches sont reprises pour les ROMs
 * qu'elles nomment : titre, description, année, auteur (`<developer>`, sauf
 * pour un jeu officiel, dont l'éditeur n'est pas l'auteur d'un hack) et
 * jaquette, par un lien `cover.<ext>` vers l'image d'origine. Rien n'est à
 * ressaisir, et rien n'est copié.
 *
 * Idempotent : un jeu déjà rangé — même slug, ou un dossier dont le lien
 * pointe déjà sur ce fichier — garde tout ce qu'il a ; le `gamelist.xml` ne
 * fait qu'y ajouter ce qui manque (une description absente, une jaquette
 * absente), sans jamais rien remplacer. `--essai` n'écrit rien et montre ce
 * qui serait fait. Aucune dépendance à la base ni au site : le
 * script se lance sous le compte propriétaire de la bibliothèque.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lireGamelist, type FicheGamelist } from "../src/lib/library/gamelist.ts";

const EXTENSIONS: Record<string, string[]> = { gb: [".gb"], gbc: [".gbc", ".gb"], gba: [".gba"] };

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const drapeau = (nom: string) => process.argv.includes(`--${nom}`);

const source = argument("source");
const consoleSlug = argument("console");
const bibliotheque = argument("bibliotheque") ?? process.env.LIBRARY_DIR;
const officiel = drapeau("officiel");
const langueForcee = argument("langue");
const essai = drapeau("essai");

if (!source || !consoleSlug || !bibliotheque || !EXTENSIONS[consoleSlug]) {
  console.error(
    'Usage : node scripts/importer-roms.ts --source "<dossier>" --console gb|gbc|gba --bibliotheque "<LIBRARY_DIR>" [--officiel] [--langue fr] [--gamelist "<gamelist.xml>"] [--essai]',
  );
  process.exit(2);
}

/** Régions No-Intro et la langue qu'elles laissent supposer, faute de liste explicite. */
const LANGUE_DE_REGION: Record<string, string> = {
  France: "fr",
  Germany: "de",
  Spain: "es",
  Italy: "it",
  Japan: "ja",
  USA: "en",
  Europe: "en",
  World: "en",
  Australia: "en",
  UK: "en",
  Canada: "en",
  Netherlands: "nl",
  Sweden: "sv",
  Brazil: "pt",
  Korea: "ko",
  China: "zh",
};

const ARTICLES = ["The", "A", "An", "Le", "La", "Les", "L'", "Der", "Die", "Das", "El", "Los", "Las", "Il", "Lo"];

type Lecture = { titre: string; langue?: string; version?: string; region?: string };

/** Ce que dit un nom de fichier No-Intro. Un nom sans parenthèses donne simplement son titre. */
export function lireNom(fichier: string): Lecture {
  const nom = fichier.replace(/\.[^.]+$/, "");
  const etiquettes = [...nom.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim());
  let titre = nom.replace(/\s*\([^)]*\)/g, "").replace(/\s*\[[^\]]*\]/g, "").trim();

  // « Addams Family, The » et « Legend of Zelda, The - Link's Awakening ».
  const article = new RegExp(`^(.*?), (${ARTICLES.map((a) => a.replace("'", "'")).join("|")})( - .*)?$`).exec(titre);
  if (article) {
    const colle = article[2]!.endsWith("'") ? "" : " ";
    titre = `${article[2]}${colle}${article[1]}${article[3] ?? ""}`;
  }
  titre = titre.replace(/\bPokemon\b/g, "Pokémon").replace(/\s{2,}/g, " ");

  let langue: string | undefined;
  let region: string | undefined;
  let version: string | undefined;
  for (const etiquette of etiquettes) {
    const morceaux = etiquette.split(",").map((m) => m.trim());
    if (morceaux.every((m) => /^[A-Z][a-z]$/.test(m))) {
      // Liste de langues : « En,Fr,De ».
      const codes = morceaux.map((m) => m.toLowerCase());
      langue = codes.includes("fr") ? "fr" : codes[0];
    } else if (morceaux.every((m) => m in LANGUE_DE_REGION)) {
      region = morceaux.join(", ");
      langue ??= morceaux.includes("France") ? "fr" : LANGUE_DE_REGION[morceaux[0]!];
    } else if (/^(Rev|v)\s?[\w.]+$/i.test(etiquette) || /^(Beta|Proto|Demo)\b/i.test(etiquette)) {
      version = etiquette;
    }
  }
  return { titre, langue, version, region };
}

export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

const dossierConsole = path.join(bibliotheque, consoleSlug);
const extensions = EXTENSIONS[consoleSlug]!;

// --- Fiches EmulationStation ------------------------------------------------

const EXTENSIONS_IMAGE = [".webp", ".png", ".jpg", ".jpeg", ".avif"];
const fichierGamelist =
  argument("gamelist") ?? (fs.existsSync(path.join(source, "gamelist.xml")) ? path.join(source, "gamelist.xml") : undefined);

/** Les fiches du `gamelist.xml`, par nom de fichier ROM en minuscules. */
const fiches = new Map<string, FicheGamelist>();
if (fichierGamelist) {
  try {
    for (const fiche of lireGamelist(fs.readFileSync(fichierGamelist, "utf8"))) {
      fiches.set(fiche.fichier.toLowerCase(), fiche);
    }
    console.log(`${fiches.size} fiche${fiches.size > 1 ? "s" : ""} lue${fiches.size > 1 ? "s" : ""} dans ${fichierGamelist}.\n`);
  } catch (erreur) {
    console.error(`gamelist illisible (${(erreur as Error).message}) : ${fichierGamelist}`);
    process.exit(2);
  }
}

/** Le fichier image d'une fiche, s'il existe et que le scan sait le lire. */
function imageDe(fiche: FicheGamelist | undefined): string | undefined {
  if (!fiche?.image || !fichierGamelist) return undefined;
  const ecrit = fiche.image.startsWith("~/") ? path.join(os.homedir(), fiche.image.slice(2)) : fiche.image;
  const chemin = path.resolve(path.dirname(fichierGamelist), ecrit);
  if (!EXTENSIONS_IMAGE.includes(path.extname(chemin).toLowerCase())) return undefined;
  try {
    return fs.statSync(chemin).isFile() ? chemin : undefined;
  } catch {
    return undefined;
  }
}

/** Ce qu'une fiche apporte à un manifeste, sans toucher à ce qu'il a déjà. Rend les champs ajoutés. */
function reprendre(manifeste: Record<string, unknown>, fiche: FicheGamelist | undefined): string[] {
  if (!fiche) return [];
  const ajouts: string[] = [];
  if (!manifeste.description && fiche.description) {
    manifeste.description = fiche.description.slice(0, 4000);
    ajouts.push("description");
  }
  if (!manifeste.annee && fiche.annee) {
    manifeste.annee = fiche.annee;
    ajouts.push(String(fiche.annee));
  }
  if (!manifeste.langue && fiche.langue) {
    manifeste.langue = fiche.langue;
    ajouts.push(`langue ${fiche.langue}`);
  }
  if (!manifeste.auteur && fiche.developpeur && !manifeste.officiel) {
    manifeste.auteur = fiche.developpeur.slice(0, 120);
    ajouts.push("auteur");
  }
  return ajouts;
}

/** Complète un jeu déjà rangé avec sa fiche. Vrai si quelque chose a été ajouté. */
function completer(dossier: string, fiche: FicheGamelist | undefined): boolean {
  if (!fiche) return false;
  const cheminManifeste = path.join(dossier, "game.json");
  let manifeste: Record<string, unknown>;
  try {
    manifeste = JSON.parse(fs.readFileSync(cheminManifeste, "utf8")) as Record<string, unknown>;
  } catch {
    return false;
  }
  const ajouts = reprendre(manifeste, fiche);
  const champs = ajouts.length;
  const image = imageDe(fiche);
  const aJaquette = Boolean(manifeste.jaquette) || fs.readdirSync(dossier).some((nom) => /^cover\./i.test(nom));
  if (image && !aJaquette) ajouts.push("jaquette");
  if (ajouts.length === 0) return false;

  console.log(`${essai ? "serait complété" : "complété"} : ${consoleSlug}/${path.basename(dossier)}  +  ${ajouts.join(", ")}`);
  if (!essai) {
    if (champs > 0) fs.writeFileSync(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);
    if (image && !aJaquette) fs.symlinkSync(image, path.join(dossier, `cover${path.extname(image).toLowerCase()}`));
  }
  return true;
}

// Ce que la bibliothèque contient déjà : les slugs pris, et les fichiers déjà liés.
const slugsPris = new Set<string>();
const dejaLies = new Map<string, string>();
if (fs.existsSync(dossierConsole)) {
  for (const entree of fs.readdirSync(dossierConsole, { withFileTypes: true })) {
    if (!entree.isDirectory()) continue;
    slugsPris.add(entree.name);
    const dossier = path.join(dossierConsole, entree.name);
    try {
      const manifeste = JSON.parse(fs.readFileSync(path.join(dossier, "game.json"), "utf8")) as { slug?: string };
      if (manifeste.slug) slugsPris.add(manifeste.slug);
    } catch {
      // Dossier sans manifeste lisible : son nom suffit à réserver le slug.
    }
    for (const fichier of fs.readdirSync(dossier)) {
      try {
        dejaLies.set(fs.realpathSync(path.join(dossier, fichier)), dossier);
      } catch {
        // Lien mort : rien à réserver.
      }
    }
  }
}

const roms = fs
  .readdirSync(source, { withFileTypes: true })
  .filter((entree) => entree.isFile() && extensions.includes(path.extname(entree.name).toLowerCase()))
  .map((entree) => entree.name)
  .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));

let crees = 0;
let ignores = 0;
let completes = 0;
for (const fichier of roms) {
  const origine = path.resolve(source, fichier);
  const fiche = fiches.get(fichier.toLowerCase());
  const dejaRange = dejaLies.get(fs.realpathSync(origine));
  if (dejaRange) {
    if (completer(dejaRange, fiche)) completes++;
    else ignores++;
    continue;
  }
  const lu = lireNom(fichier);
  // Le titre de la fiche est celui que l'admin a déjà sous les yeux ailleurs :
  // il passe avant celui qu'on devine du nom de fichier.
  if (fiche?.nom) lu.titre = fiche.nom.slice(0, 120);
  let slug = slugifier(lu.titre);
  if (!slug) {
    console.warn(`ignoré (titre illisible) : ${fichier}`);
    ignores++;
    continue;
  }
  // Deux éditions du même jeu : la région, puis un numéro, départagent.
  if (slugsPris.has(slug) && lu.region) slug = slugifier(`${lu.titre} ${lu.region}`);
  for (let n = 2; slugsPris.has(slug); n++) slug = `${slugifier(lu.titre)}-${n}`;
  slugsPris.add(slug);

  const manifeste: Record<string, unknown> = { titre: lu.titre, slug };
  const langue = langueForcee ?? lu.langue ?? fiche?.langue;
  if (langue) manifeste.langue = langue;
  if (lu.version) manifeste.version = lu.version;
  if (officiel) manifeste.officiel = true;
  const repris = reprendre(manifeste, fiche);
  const image = imageDe(fiche);
  if (image) repris.push("jaquette");

  const dossier = path.join(dossierConsole, slug);
  const lien = path.join(dossier, `rom${path.extname(fichier).toLowerCase()}`);
  console.log(
    `${essai ? "serait créé" : "créé"} : ${consoleSlug}/${slug}  ←  ${fichier}  [${langue ?? "langue ?"}${lu.version ? `, ${lu.version}` : ""}]` +
      (repris.length > 0 ? `  +  ${repris.join(", ")}` : ""),
  );
  if (!essai) {
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, "game.json"), `${JSON.stringify(manifeste, null, 2)}\n`);
    fs.symlinkSync(origine, lien);
    if (image) fs.symlinkSync(image, path.join(dossier, `cover${path.extname(image).toLowerCase()}`));
  }
  crees++;
}

console.log(
  `\n${roms.length} ROM dans ${source} : ${crees} ${essai ? "à ranger" : "rangées"}, ` +
    (fichierGamelist ? `${completes} ${essai ? "à compléter" : "complétées"} d'après le gamelist, ` : "") +
    `${ignores} déjà là ou ignorées.` +
    (essai ? "" : " Relance le scan de la bibliothèque pour les voir sur le site."),
);
