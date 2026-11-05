/**
 * Range un dossier de ROMs dans la bibliothèque du site.
 *
 *   node scripts/importer-roms.ts --source "<dossier de ROMs>" --console gb \
 *        --bibliotheque "<LIBRARY_DIR>" [--officiel] [--langue fr] [--essai]
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
 * Idempotent : un jeu déjà rangé — même slug, ou un dossier dont le lien
 * pointe déjà sur ce fichier — est laissé tel quel. `--essai` n'écrit rien
 * et montre ce qui serait fait. Aucune dépendance à la base ni au site : le
 * script se lance sous le compte propriétaire de la bibliothèque.
 */
import fs from "node:fs";
import path from "node:path";

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
    'Usage : node scripts/importer-roms.ts --source "<dossier>" --console gb|gbc|gba --bibliotheque "<LIBRARY_DIR>" [--officiel] [--langue fr] [--essai]',
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

// Ce que la bibliothèque contient déjà : les slugs pris, et les fichiers déjà liés.
const slugsPris = new Set<string>();
const dejaLies = new Set<string>();
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
        dejaLies.add(fs.realpathSync(path.join(dossier, fichier)));
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
for (const fichier of roms) {
  const origine = path.resolve(source, fichier);
  if (dejaLies.has(fs.realpathSync(origine))) {
    ignores++;
    continue;
  }
  const lu = lireNom(fichier);
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
  const langue = langueForcee ?? lu.langue;
  if (langue) manifeste.langue = langue;
  if (lu.version) manifeste.version = lu.version;
  if (officiel) manifeste.officiel = true;

  const dossier = path.join(dossierConsole, slug);
  const lien = path.join(dossier, `rom${path.extname(fichier).toLowerCase()}`);
  console.log(`${essai ? "serait créé" : "créé"} : ${consoleSlug}/${slug}  ←  ${fichier}  [${langue ?? "langue ?"}${lu.version ? `, ${lu.version}` : ""}]`);
  if (!essai) {
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, "game.json"), `${JSON.stringify(manifeste, null, 2)}\n`);
    fs.symlinkSync(origine, lien);
  }
  crees++;
}

console.log(
  `\n${roms.length} ROM dans ${source} : ${crees} ${essai ? "à ranger" : "rangées"}, ${ignores} déjà là ou ignorées.` +
    (essai ? "" : " Relance le scan de la bibliothèque pour les voir sur le site."),
);
