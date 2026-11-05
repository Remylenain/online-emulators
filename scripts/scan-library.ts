/**
 * Met la base à jour depuis la bibliothèque sur disque.
 *
 *   npm run library:scan [-- --console gbc]
 *
 * `--console` limite le passage à une console : ses jeux et ses habillages
 * sont relus, ceux des autres ne sont ni touchés ni dépubliés. Sur une
 * bibliothèque de plusieurs centaines de jeux, c'est la différence entre
 * quelques secondes et plusieurs minutes quand on vient d'ajouter un jeu.
 *
 * La bibliothèque est la source de vérité : un dossier par console, puis un
 * dossier par jeu contenant un `game.json`, la ROM et éventuellement une
 * jaquette. La base n'est qu'un cache, reconstructible à tout moment — il n'y
 * a pas d'interface d'administration à remplir, et supprimer la base ne perd
 * aucune métadonnée.
 *
 * Les ROMs et les jaquettes peuvent être des liens symboliques vers un dossier
 * de travail situé ailleurs. C'est même la façon recommandée de publier : elle
 * oblige à désigner une ROM précise, au lieu de laisser un scan choisir parmi
 * les variantes d'un même jeu.
 */
import { createHash } from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import sharp from "sharp";
import { and, eq, notInArray } from "drizzle-orm";
import { CONSOLES } from "../src/lib/consoles.ts";
import { decoupePanneau, estJaquetteDepliee } from "../src/lib/library/jaquette.ts";
import { mesurerZoneEcran } from "../src/lib/library/bezel.ts";
import { manifestSchema, manifestToColumns } from "../src/lib/library/manifest.ts";
import { appliquerRetouche, lireRetouche } from "../src/lib/library/retouches.ts";
import { normalizeForSearch, slugify } from "../src/lib/validation.ts";
import { openDatabase, schema } from "./_db.ts";

const libraryDir = path.resolve(process.env.LIBRARY_DIR ?? "./library");
const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");

/** La seule console à relire, ou `undefined` pour toutes. */
const seule = process.argv.includes("--console") ? process.argv[process.argv.indexOf("--console") + 1] : undefined;
if (seule !== undefined && !CONSOLES.some((definition) => definition.slug === seule)) {
  console.error(`Console inconnue : ${seule ?? "(rien)"}. Attendu : ${CONSOLES.map((c) => c.slug).join(", ")}.`);
  process.exit(2);
}
const consolesARelire = CONSOLES.filter((definition) => !seule || definition.slug === seule);

/** Largeurs des miniatures : une pour la grille, une pour la fiche de jeu. */
const COVER_SIZES = { sm: 300, lg: 700 } as const;

const EXTENSIONS_IMAGE = [".webp", ".png", ".jpg", ".jpeg", ".avif"];

function nomsPossibles(base: string): string[] {
  return EXTENSIONS_IMAGE.map((extension) => base + extension);
}

const { db, sqlite } = openDatabase();

let avertissements = 0;

function avertir(message: string): void {
  console.warn(`  ! ${message}`);
  avertissements += 1;
}

/**
 * `stat` et non `lstat` : un lien symbolique doit être suivi. `readdir` avec
 * `withFileTypes` rapporte un lien comme lien et non comme fichier, et un test
 * `isFile()` écarterait silencieusement toute une bibliothèque de liens.
 */
async function estFichier(chemin: string): Promise<boolean> {
  try {
    return (await fsp.stat(chemin)).isFile();
  } catch {
    return false;
  }
}

/**
 * Signale un lien symbolique qui ne mène nulle part.
 *
 * Toute la bibliothèque est faite de liens vers un dossier de travail : une
 * cible renommée ou déplacée laisse un lien mort, et sans ce contrôle le scan
 * se contenterait de ne pas trouver le fichier. Le jeu réapparaîtrait sans sa
 * jaquette, sans que rien n'explique pourquoi.
 */
async function signalerLienMort(chemin: string, quoi: string): Promise<void> {
  try {
    const lien = await fsp.lstat(chemin);
    if (!lien.isSymbolicLink()) return;
    const cible = await fsp.readlink(chemin);
    avertir(`${path.basename(path.dirname(chemin))} : ${quoi} est un lien mort → ${cible}`);
  } catch {
    // Rien à cet emplacement : c'est simplement qu'il n'y a pas de fichier.
  }
}

async function estDossier(chemin: string): Promise<boolean> {
  try {
    return (await fsp.stat(chemin)).isDirectory();
  } catch {
    return false;
  }
}

/** Empreinte en flux : certaines ROMs GBA font 32 Mio, inutile de tout charger. */
function sha1(chemin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha1");
    createReadStream(chemin)
      .on("error", reject)
      .on("data", (morceau) => hash.update(morceau))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/** Désigne la ROM du dossier, en refusant de choisir à la place de l'auteur. */
async function trouverRom(
  dossier: string,
  extensions: readonly string[],
  demandee: string | undefined,
): Promise<string | null> {
  if (demandee) {
    const chemin = path.join(dossier, demandee);
    if (await estFichier(chemin)) return chemin;
    avertir(`${path.basename(dossier)} : la ROM « ${demandee} » du manifeste est absente.`);
    return null;
  }

  const entrees = await fsp.readdir(dossier);
  const candidats = entrees.filter((nom) =>
    extensions.includes(path.extname(nom).toLowerCase()),
  );

  if (candidats.length === 0) {
    for (const extension of extensions) {
      await signalerLienMort(path.join(dossier, `rom${extension}`), `rom${extension}`);
    }
    avertir(`${path.basename(dossier)} : aucune ROM (${extensions.join(", ")}).`);
    return null;
  }

  if (candidats.length > 1) {
    // Deux variantes du même jeu n'ont pas la même capacité de sauvegarde :
    // en désigner une au hasard publierait peut-être celle qui ne sait pas
    // sauvegarder en émulation. C'est à l'auteur du manifeste de trancher.
    avertir(
      `${path.basename(dossier)} : ${candidats.length} ROMs présentes ` +
        `(${candidats.join(", ")}). Ajouter « "rom": "…" » au manifeste.`,
    );
    return null;
  }

  return path.join(dossier, candidats[0]!);
}

/** Cherche une image par nom conventionnel, ou à l'emplacement indiqué. */
async function trouverImage(
  dossier: string,
  base: string,
  demandee: string | undefined,
): Promise<string | null> {
  if (demandee) {
    const chemin = path.join(dossier, demandee);
    if (await estFichier(chemin)) return chemin;
    avertir(`${path.basename(dossier)} : « ${demandee} » est absent.`);
    return null;
  }

  for (const nom of nomsPossibles(base)) {
    const chemin = path.join(dossier, nom);
    if (await estFichier(chemin)) return chemin;
    await signalerLienMort(chemin, nom);
  }
  return null;
}

/**
 * Produit les images servies par le site, dans DATA_DIR.
 *
 * Elles ne vont pas dans la bibliothèque : celle-ci reste en lecture seule
 * pour le service, et peut vivre sur un dossier synchronisé où des fichiers
 * générés n'ont rien à faire.
 *
 * Une jaquette dépliée — dos, tranche, face — est recadrée sur la face avant
 * pour les vignettes, et son dos est conservé à part pour la fiche de jeu.
 */
async function genererJaquette(
  source: string,
  consoleSlug: string,
  slug: string,
): Promise<{ chemin: string; avecDos: boolean } | null> {
  const dossier = path.join(dataDir, "covers", consoleSlug);
  await fsp.mkdir(dossier, { recursive: true });

  try {
    // `rotate()` sans argument applique l'orientation EXIF, qu'une photo de
    // boîte prise au téléphone porte souvent. À faire avant toute mesure :
    // sinon largeur et hauteur seraient inversées.
    const redresse = await sharp(source).rotate().toBuffer();
    const { width, height } = await sharp(redresse).metadata();
    if (!width || !height) throw new Error("dimensions illisibles");

    const depliee = estJaquetteDepliee(width, height);
    const face = depliee ? decoupePanneau(width, height, "face") : null;

    for (const [taille, largeur] of Object.entries(COVER_SIZES)) {
      const image = sharp(redresse);
      if (face) image.extract(face);
      await image
        .resize({ width: largeur, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(dossier, `${slug}-${taille}.webp`));
    }

    if (depliee) {
      await sharp(redresse)
        .extract(decoupePanneau(width, height, "dos"))
        .resize({ width: COVER_SIZES.lg, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(dossier, `${slug}-dos.webp`));
    }

    // Chemin relatif à DATA_DIR, sans le suffixe : la route des jaquettes
    // ajoute « -sm », « -lg » ou « -dos » selon ce qu'elle doit servir.
    return { chemin: path.posix.join("covers", consoleSlug, slug), avecDos: depliee };
  } catch (erreur) {
    avertir(`${slug} : jaquette illisible (${(erreur as Error).message}).`);
    return null;
  }
}

/** L'étiquette de cartouche, servie telle quelle à une seule taille. */
async function genererEtiquette(
  source: string,
  consoleSlug: string,
  slug: string,
): Promise<string | null> {
  const dossier = path.join(dataDir, "covers", consoleSlug);
  await fsp.mkdir(dossier, { recursive: true });

  try {
    await sharp(source)
      .rotate()
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(dossier, `${slug}-etiquette.webp`));
    return path.posix.join("covers", consoleSlug, `${slug}-etiquette`);
  } catch (erreur) {
    avertir(`${slug} : étiquette illisible (${(erreur as Error).message}).`);
    return null;
  }
}

// ---------------------------------------------------------------------------

console.log(`Bibliothèque : ${libraryDir}`);
if (seule) console.log(`Console : ${consolesARelire[0]!.name} seulement.`);

if (!(await estDossier(libraryDir))) {
  console.error(`\nERREUR : ${libraryDir} n'existe pas ou n'est pas un dossier.`);
  process.exit(1);
}

// Les consoles sont une liste fixe du code, mais la table doit exister : les
// jeux la référencent par clé étrangère. Les insérer ici rend le scan
// autonome, sans `db:seed` préalable.
for (const definition of CONSOLES) {
  const colonnes = {
    name: definition.name,
    shortName: definition.shortName,
    hasShoulderButtons: definition.hasShoulderButtons,
    screenWidth: definition.screenWidth,
    screenHeight: definition.screenHeight,
    sortOrder: definition.sortOrder,
  };
  db.insert(schema.consoles)
    .values({ slug: definition.slug, ...colonnes })
    .onConflictDoUpdate({ target: schema.consoles.slug, set: colonnes })
    .run();
}

const vus: string[] = [];
let ajoutes = 0;
let majs = 0;

for (const definition of consolesARelire) {
  const dossierConsole = path.join(libraryDir, definition.slug);
  if (!(await estDossier(dossierConsole))) continue;

  const entrees = (await fsp.readdir(dossierConsole)).sort();
  console.log(`\n${definition.name}`);

  for (const entree of entrees) {
    const dossierJeu = path.join(dossierConsole, entree);
    if (!(await estDossier(dossierJeu))) continue;

    const fichierManifeste = path.join(dossierJeu, "game.json");
    if (!(await estFichier(fichierManifeste))) {
      avertir(`${entree} : pas de game.json, dossier ignoré.`);
      continue;
    }

    let manifeste;
    try {
      manifeste = manifestSchema.parse(JSON.parse(await fsp.readFile(fichierManifeste, "utf8")));
    } catch (erreur) {
      avertir(`${entree} : game.json invalide — ${(erreur as Error).message.split("\n")[0]}`);
      continue;
    }

    /**
     * Adresse du jeu, par ordre de préférence : le manifeste, puis le nom du
     * dossier, puis le titre.
     *
     * Le nom du dossier passe avant le titre parce qu'il bouge moins : on
     * corrige volontiers un titre affiché, beaucoup plus rarement un dossier.
     * Une adresse qui change casse les liens déjà partagés, et laisse derrière
     * elle les sauvegardes rangées sous l'ancien identifiant.
     */
    const slug = manifeste.slug ?? slugify(entree) ?? slugify(manifeste.titre);
    if (!slug) {
      avertir(`${entree} : impossible de déduire une adresse du dossier ni du titre.`);
      continue;
    }

    /**
     * Les corrections saisies dans l'administration s'appliquent par-dessus
     * le manifeste, et après le calcul de l'adresse : le slug en est la clé,
     * et n'est donc pas retouchable.
     *
     * Elles sont lues à chaque scan plutôt qu'appliquées une fois pour toutes
     * en base : sans cela, le scan suivant les écraserait en silence avec le
     * manifeste, et une langue corrigée ne tiendrait que jusqu'au prochain
     * ajout de jeu.
     */
    const retouche = await lireRetouche(definition.slug, slug);
    const retouches = Object.keys(retouche);
    if (retouches.length > 0) {
      manifeste = appliquerRetouche(manifeste, retouche);
      console.log(`    retouché : ${retouches.join(", ")}`);
    }

    const rom = await trouverRom(dossierJeu, definition.romExtensions, manifeste.rom);
    if (!rom) continue;

    const taille = (await fsp.stat(rom)).size;
    const empreinte = await sha1(rom);

    // À défaut d'une jaquette dans la bibliothèque, celle que le scraper a
    // rangée dans DATA_DIR/jaquettes : la bibliothèque passe toujours d'abord.
    const jaquette =
      (await trouverImage(dossierJeu, "cover", manifeste.jaquette)) ??
      (await trouverImage(path.join(dataDir, "jaquettes", definition.slug), slug, undefined));
    const images = jaquette
      ? await genererJaquette(jaquette, definition.slug, slug)
      : null;

    const etiquette = await trouverImage(dossierJeu, "etiquette", manifeste.etiquette);
    const labelPath = etiquette
      ? await genererEtiquette(etiquette, definition.slug, slug)
      : null;

    /**
     * Identifiant déterministe, et c'est volontaire : les sauvegardes des
     * joueurs vivent sur disque sous `saves/<compte>/<jeu>/`. Un identifiant
     * tiré au hasard changerait à chaque reconstruction de la base et
     * orphelinerait toutes les sauvegardes.
     */
    const id = `${definition.slug}-${slug}`;
    vus.push(id);

    const colonnes = {
      ...manifestToColumns(manifeste),
      consoleSlug: definition.slug,
      slug,
      romPath: path.posix.join(definition.slug, entree, path.basename(rom)),
      romSha1: empreinte,
      romSize: taille,
      coverPath: images?.chemin ?? null,
      hasBackCover: images?.avecDos ?? false,
      labelPath,
      // Ce que la recherche interrogera : le titre, l'auteur et le jeu de base
      // réunis, sans accents. Recalculé à chaque scan, jamais saisi à la main.
      searchText: normalizeForSearch(
        [manifeste.titre, manifeste.auteur, manifeste.jeuDeBase].filter(Boolean).join(" "),
      ),
      updatedAt: new Date(),
    };

    const existant = await db
      .select({ id: schema.games.id, romSha1: schema.games.romSha1 })
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .get();

    db.insert(schema.games)
      .values({ id, ...colonnes })
      .onConflictDoUpdate({ target: schema.games.id, set: colonnes })
      .run();

    if (existant) {
      majs += 1;
      const marque = existant.romSha1 === empreinte ? " " : "*";
      console.log(`  ${marque} ${slug.padEnd(22)} ${manifeste.titre}`);
    } else {
      ajoutes += 1;
      console.log(`  + ${slug.padEnd(22)} ${manifeste.titre}`);
    }
  }
}

/**
 * Habillages d'écran : `bezels/<console>/<image>` dans la bibliothèque.
 *
 * Hors des dossiers de console, où chaque sous-dossier est un jeu : un dossier
 * d'habillages y serait pris pour un jeu sans manifeste.
 *
 * Chaque image est mesurée — où est l'écran — puis recopiée en WebP dans
 * DATA_DIR, comme les jaquettes : la bibliothèque n'est jamais servie
 * directement. Un fichier retiré du disque disparaît de la table ; le choix des
 * joueurs qui le désignait retombe sur le défaut.
 */
const habillagesVus: string[] = [];
const dossierHabillages = path.join(libraryDir, "bezels");

if (await estDossier(dossierHabillages)) {
  console.log("\nHabillages");

  for (const definition of consolesARelire) {
    const dossier = path.join(dossierHabillages, definition.slug);
    if (!(await estDossier(dossier))) continue;

    const fichiers = (await fsp.readdir(dossier))
      .filter((nom) => EXTENSIONS_IMAGE.includes(path.extname(nom).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));

    let ordre = 0;
    for (const nom of fichiers) {
      const source = path.join(dossier, nom);
      if (!(await estFichier(source))) {
        await signalerLienMort(source, nom);
        continue;
      }

      const base = path.basename(nom, path.extname(nom));
      const cle = slugify(base);
      if (!cle) {
        avertir(`habillage « ${nom} » : nom inutilisable.`);
        continue;
      }
      const id = `${definition.slug}-${cle}`;

      try {
        const { data, info } = await sharp(source)
          .ensureAlpha()
          .extractChannel("alpha")
          .raw()
          .toBuffer({ resolveWithObject: true });
        const zone = mesurerZoneEcran(
          new Uint8Array(data.buffer, data.byteOffset, data.length),
          info.width,
          info.height,
        );
        if (!zone) {
          avertir(`habillage « ${nom} » : le centre de l'image n'est pas transparent, ignoré.`);
          continue;
        }

        const relatif = path.posix.join("bezels", definition.slug, `${cle}.webp`);
        await fsp.mkdir(path.join(dataDir, "bezels", definition.slug), { recursive: true });
        await sharp(source)
          .webp({ quality: 90, alphaQuality: 100 })
          .toFile(path.join(dataDir, relatif));

        const colonnes = {
          consoleSlug: definition.slug,
          name: base,
          path: relatif,
          width: info.width,
          height: info.height,
          screenX: zone.x / info.width,
          screenY: zone.y / info.height,
          screenW: zone.largeur / info.width,
          screenH: zone.hauteur / info.height,
          hash: (await sha1(source)).slice(0, 16),
          sortOrder: ordre++,
        };
        db.insert(schema.bezels)
          .values({ id, ...colonnes })
          .onConflictDoUpdate({ target: schema.bezels.id, set: colonnes })
          .run();
        habillagesVus.push(id);

        console.log(
          `  ${definition.shortName.padEnd(4)} ${base.padEnd(20)} ` +
            `écran ${zone.largeur}×${zone.hauteur} à (${zone.x}, ${zone.y})`,
        );
      } catch (erreur) {
        avertir(`habillage « ${nom} » illisible (${(erreur as Error).message}).`);
      }
    }
  }
}

// Avec `--console`, seuls les habillages de cette console peuvent disparaître.
db.delete(schema.bezels)
  .where(
    and(
      habillagesVus.length ? notInArray(schema.bezels.id, habillagesVus) : undefined,
      seule ? eq(schema.bezels.consoleSlug, seule) : undefined,
    ),
  )
  .run();

/**
 * Un jeu disparu du disque est dépublié, jamais supprimé.
 *
 * Les sauvegardes, les savestates et les notes pointent vers lui par clé
 * étrangère en cascade : le supprimer effacerait les parties des joueurs parce
 * qu'un dossier a été déplacé par erreur. Le dépublier le retire du catalogue
 * et laisse tout en place.
 *
 * Avec `--console`, seuls les jeux de cette console sont concernés : ceux des
 * autres n'ont pas été relus, leur absence de `vus` ne dit rien.
 */
const retires = db
  .update(schema.games)
  .set({ isPublished: false, updatedAt: new Date() })
  .where(
    and(
      eq(schema.games.isPublished, true),
      vus.length ? notInArray(schema.games.id, vus) : undefined,
      seule ? eq(schema.games.consoleSlug, seule) : undefined,
    ),
  )
  .run();

const publies = db
  .select({ id: schema.games.id })
  .from(schema.games)
  .where(eq(schema.games.isPublished, true))
  .all().length;

console.log(
  `\n${ajoutes} ajouté(s), ${majs} mis à jour, ${retires.changes} dépublié(s).` +
    `\n${publies} jeu(x) au catalogue.`,
);

if (avertissements > 0) {
  console.log(`\n${avertissements} avertissement(s) ci-dessus à regarder.`);
}

sqlite.close();
