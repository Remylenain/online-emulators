import fs from "node:fs/promises";
import path from "node:path";
import { asc } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/db";
import { games } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { CONSOLES, findConsole } from "@/lib/consoles";
import { ecrireGamelist, type FicheGamelist } from "@/lib/library/gamelist";
import { paths } from "@/lib/paths";
import { fluxZip, type EntreeZip } from "@/lib/zip";

/**
 * Export des fiches au format EmulationStation : une archive zip contenant,
 * par console, un `gamelist.xml` et un dossier `images/`.
 *
 *   GET /api/admin/gamelist[?console=gbc][&tout=1]
 *
 * Chaque fiche est rattachée au **nom du fichier ROM d'origine** — celui vers
 * lequel pointe le lien de la bibliothèque — parce que c'est sous ce nom que
 * la ROM existe sur les autres appareils. Les images portent le même nom que
 * la ROM : c'est la convention que suivent les frontaux qui ne lisent pas la
 * balise `<image>`.
 *
 * Sans `tout`, seuls les rom hacks et traductions partent : les jeux
 * officiels se retrouvent dans n'importe quel scraper, pas eux. Aucune ROM
 * n'est jamais mise dans l'archive.
 */
export const dynamic = "force-dynamic";

const LISEZ_MOI = `Fiches de jeux au format EmulationStation
(Recalbox, Batocera, RetroPie, ES-DE).

Un dossier par console. Chacun contient :
  gamelist.xml   titre, description, année, auteur et langue de chaque jeu
  images/        les jaquettes, au nom du fichier ROM

Recalbox, Batocera, RetroPie : copier le contenu du dossier dans le dossier
des ROMs de la console (roms/gb, roms/gbc, roms/gba), à côté des ROMs. Si un
gamelist.xml existe déjà, fusionner les blocs <game> plutôt que l'écraser.

ES-DE : copier gamelist.xml dans ES-DE/gamelists/<console>/ et les images
dans ES-DE/downloaded_media/<console>/covers/.

Les fiches sont rattachées aux ROMs par leur nom de fichier : une ROM
renommée ne retrouvera pas la sienne.
`;

export async function GET(requete: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });
  if (viewer.role !== "ADMIN") return new NextResponse("Interdit", { status: 403 });

  const demandee = requete.nextUrl.searchParams.get("console");
  if (demandee && !findConsole(demandee)) return new NextResponse("Console inconnue", { status: 400 });
  const tout = requete.nextUrl.searchParams.get("tout") === "1";

  const lignes = db
    .select({
      titre: games.title,
      consoleSlug: games.consoleSlug,
      slug: games.slug,
      description: games.description,
      auteur: games.author,
      langue: games.language,
      annee: games.year,
      romPath: games.romPath,
      coverPath: games.coverPath,
      officiel: games.isOfficial,
      publie: games.isPublished,
    })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all()
    .filter((jeu) => jeu.publie && (tout || !jeu.officiel) && (!demandee || jeu.consoleSlug === demandee));

  const modifie = new Date();
  async function* entrees(): AsyncGenerator<EntreeZip> {
    yield { nom: "LISEZ-MOI.txt", donnees: Buffer.from(LISEZ_MOI, "utf8"), modifie };

    for (const { slug: consoleSlug } of CONSOLES) {
      const jeux = lignes.filter((jeu) => jeu.consoleSlug === consoleSlug);
      if (jeux.length === 0) continue;

      const fiches: FicheGamelist[] = [];
      const noms = new Set<string>();
      for (const jeu of jeux) {
        // Le vrai nom de la ROM est celui de la cible du lien. Une ROM posée
        // telle quelle dans la bibliothèque s'appelle « rom.gbc » : on lui
        // donne alors le nom de sa fiche, faute de mieux.
        let fichier = path.basename(jeu.romPath);
        try {
          fichier = path.basename(await fs.realpath(paths.library(jeu.romPath)));
        } catch {
          // Lien mort : le nom du lien fera l'affaire.
        }
        if (/^rom\.[a-z0-9]+$/i.test(fichier)) fichier = `${jeu.slug}${path.extname(fichier)}`;
        if (noms.has(fichier.toLowerCase())) continue;
        noms.add(fichier.toLowerCase());

        const fiche: FicheGamelist = {
          fichier,
          nom: jeu.titre,
          description: jeu.description ?? undefined,
          annee: jeu.annee ?? undefined,
          developpeur: jeu.auteur ?? undefined,
          langue: jeu.langue ?? undefined,
        };

        if (jeu.coverPath) {
          try {
            // JPEG : lu partout, là où le WebP du site ne l'est pas toujours.
            const image = await sharp(paths.data(`${jeu.coverPath}-lg.webp`))
              .flatten({ background: "#ffffff" })
              .jpeg({ quality: 88 })
              .toBuffer();
            const nomImage = `${fichier.replace(/\.[^.]+$/, "")}.jpg`;
            fiche.image = `./images/${nomImage}`;
            yield { nom: `${consoleSlug}/images/${nomImage}`, donnees: image, modifie };
          } catch {
            // Miniature absente ou illisible : la fiche part sans image.
          }
        }
        fiches.push(fiche);
      }
      yield { nom: `${consoleSlug}/gamelist.xml`, donnees: Buffer.from(ecrireGamelist(fiches), "utf8"), modifie };
    }
  }

  const nom = `fiches-emulationstation${demandee ? `-${demandee}` : ""}.zip`;
  return new NextResponse(fluxZip(entrees()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "no-store",
    },
  });
}
