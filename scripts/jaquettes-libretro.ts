/**
 * Va chercher les jaquettes qui manquent dans la collection de vignettes de
 * libretro (thumbnails.libretro.com), pour les jeux dont la ROM porte un nom
 * No-Intro.
 *
 *   node scripts/jaquettes-libretro.ts --bibliotheque "<LIBRARY_DIR>" [--console gb] [--essai]
 *
 * Pour chaque dossier de jeu sans fichier `cover.*`, le nom de la jaquette
 * est celui du fichier vers lequel pointe le lien `rom.*` — c'est ainsi que
 * libretro range ses images : « Nintendo - Game Boy/Named_Boxarts/<nom
 * No-Intro>.png ». Un jeu dont la ROM a été renommée à la main ne sera pas
 * trouvé, et le script le dit ; rien n'est deviné.
 *
 * L'image est écrite telle quelle dans le dossier du jeu (`cover.png`) ; le
 * scan suivant la redimensionne et la publie. Aucune clé ni compte : la
 * collection est publique. Le script fait une pause entre deux demandes pour
 * ne pas peser sur le serveur de libretro. `--essai` ne télécharge rien et
 * compte seulement ce qui existe.
 */
import fs from "node:fs";
import path from "node:path";

const SYSTEMES: Record<string, string> = {
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  gba: "Nintendo - Game Boy Advance",
};

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const bibliotheque = argument("bibliotheque") ?? process.env.LIBRARY_DIR;
const seule = argument("console");
const essai = process.argv.includes("--essai");
if (!bibliotheque) {
  console.error('Usage : node scripts/jaquettes-libretro.ts --bibliotheque "<LIBRARY_DIR>" [--console gb] [--essai]');
  process.exit(2);
}

/** libretro remplace par un tiret bas les caractères interdits dans un nom de fichier. */
function nomLibretro(nom: string): string {
  return nom.replace(/[&*/:`<>?\\|"]/g, "_");
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let trouvees = 0;
let absentes = 0;
let dejaLa = 0;
for (const [consoleSlug, systeme] of Object.entries(SYSTEMES)) {
  if (seule && seule !== consoleSlug) continue;
  const dossierConsole = path.join(bibliotheque, consoleSlug);
  if (!fs.existsSync(dossierConsole)) continue;

  for (const entree of fs.readdirSync(dossierConsole, { withFileTypes: true })) {
    if (!entree.isDirectory()) continue;
    const dossier = path.join(dossierConsole, entree.name);
    const fichiers = fs.readdirSync(dossier);
    if (fichiers.some((f) => /^cover\./i.test(f))) {
      dejaLa++;
      continue;
    }
    const rom = fichiers.find((f) => /^rom\./i.test(f));
    if (!rom) continue;
    let origine: string;
    try {
      origine = fs.realpathSync(path.join(dossier, rom));
    } catch {
      continue;
    }
    const nom = path.basename(origine).replace(/\.[^.]+$/, "");
    const adresse = `https://thumbnails.libretro.com/${encodeURIComponent(systeme)}/Named_Boxarts/${encodeURIComponent(nomLibretro(nom))}.png`;

    const reponse = await fetch(adresse, { method: essai ? "HEAD" : "GET" });
    if (!reponse.ok) {
      absentes++;
      console.log(`absente : ${consoleSlug}/${entree.name}  (${nom})`);
    } else {
      trouvees++;
      if (!essai) {
        fs.writeFileSync(path.join(dossier, "cover.png"), Buffer.from(await reponse.arrayBuffer()));
      }
    }
    await pause(150);
  }
}

console.log(
  `\n${trouvees} jaquette${trouvees > 1 ? "s" : ""} ${essai ? "disponibles" : "téléchargées"}, ${absentes} introuvables, ${dejaLa} jeux en avaient déjà une.` +
    (essai || trouvees === 0 ? "" : " Relance le scan de la bibliothèque pour les publier."),
);
