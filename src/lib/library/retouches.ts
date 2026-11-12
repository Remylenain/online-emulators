import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
// Extension explicite, et non `./manifest` : ce module est aussi chargé par
// `scripts/scan-library.ts`, que Node exécute sans le résolveur de Next. Node
// n'invente pas d'extension, et un import sans elle fait échouer le scan.
import { manifestSchema, type Manifest } from "./manifest.ts";

/**
 * Retouches de catalogue, saisies depuis l'administration.
 *
 * La bibliothèque reste la source de vérité, mais le service ne peut pas y
 * écrire : elle vit dans le dossier de travail personnel, que l'unité systemd
 * monte en lecture seule (`ProtectHome=read-only`). C'est une protection
 * voulue — un processus exposé sur le web n'a rien à faire dans un dossier de
 * ROMs — et la lever pour corriger un code de langue serait un mauvais
 * marché.
 *
 * Les corrections vont donc à côté, dans DATA_DIR, un fichier par jeu. Le scan
 * les applique par-dessus le manifeste. Une retouche ne contient que les
 * champs réellement modifiés : tout le reste continue de suivre le manifeste,
 * et un champ corrigé puis corrigé à nouveau dans le manifeste se résout en
 * retirant la retouche.
 *
 * Elles sont sauvegardées avec le reste de DATA_DIR par la sauvegarde
 * nocturne, au même titre que la base.
 */

/**
 * Champs retouchables.
 *
 * Ni `slug` ni `groupe` : le premier est l'adresse du jeu, et des liens sont
 * déjà partagés ; le second décide de quelle fiche regroupe quoi. Ces deux-là
 * se décident dans le manifeste, où la décision se voit à côté de la ROM.
 */
export const retoucheSchema = manifestSchema
  .pick({
    titre: true,
    description: true,
    auteur: true,
    version: true,
    langue: true,
    jeuDeBase: true,
    annee: true,
  })
  .partial()
  .extend({ publie: z.boolean().optional(), solo: z.boolean().optional() });

export type Retouche = z.infer<typeof retoucheSchema>;

/** Champs que l'administration propose de corriger, dans l'ordre d'affichage. */
export const CHAMPS_RETOUCHABLES = [
  "titre",
  "langue",
  "auteur",
  "version",
  "jeuDeBase",
  "annee",
  "description",
] as const;

/**
 * Dossier des retouches.
 *
 * `process.env` et non `@/lib/env` : ce module est aussi importé par
 * `scripts/scan-library.ts`, que Node exécute directement, sans le résolveur
 * de Next — donc sans les alias de chemins. Même raison que la connexion
 * séparée de `scripts/_db.ts`, et même défaut que le scan.
 */
function dossier(): string {
  return path.join(path.resolve(process.env.DATA_DIR ?? "./data"), "retouches");
}

function fichier(consoleSlug: string, slug: string): string {
  return path.join(dossier(), consoleSlug, `${slug}.json`);
}

/** Retouche d'un jeu, ou un objet vide s'il n'y en a pas. */
export async function lireRetouche(
  consoleSlug: string,
  slug: string,
): Promise<Retouche> {
  try {
    const contenu = await fs.readFile(fichier(consoleSlug, slug), "utf8");
    const analyse = retoucheSchema.safeParse(JSON.parse(contenu));
    // Une retouche illisible ne doit pas faire échouer un scan : le manifeste
    // seul reste une réponse valable, et le scan a de quoi le dire.
    return analyse.success ? analyse.data : {};
  } catch {
    return {};
  }
}

/**
 * Les jeux qui ont une retouche, sous la forme `console/slug`.
 *
 * Deux lectures de dossier au lieu d'un fichier par jeu : l'administration
 * n'ouvre les retouches que des jeux qu'elle affiche, mais doit savoir
 * lesquels en ont pour les compter et les filtrer. Un fichier n'existe que
 * s'il retouche quelque chose — `ecrireRetouche` supprime les vides.
 */
export async function listerRetouches(): Promise<Set<string>> {
  const cles = new Set<string>();
  let consoles: string[];
  try {
    consoles = await fs.readdir(dossier());
  } catch {
    return cles;
  }
  for (const consoleSlug of consoles) {
    try {
      for (const nom of await fs.readdir(path.join(dossier(), consoleSlug))) {
        if (nom.endsWith(".json")) cles.add(`${consoleSlug}/${nom.slice(0, -5)}`);
      }
    } catch {
      // Un fichier égaré à la place d'un dossier de console : rien à lister.
    }
  }
  return cles;
}

/**
 * Écrit la retouche d'un jeu. Un objet sans aucun champ supprime le fichier :
 * un jeu qui suit entièrement son manifeste ne laisse pas de trace.
 */
export async function ecrireRetouche(
  consoleSlug: string,
  slug: string,
  retouche: Retouche,
): Promise<void> {
  const chemin = fichier(consoleSlug, slug);

  if (Object.keys(retouche).length === 0) {
    await fs.rm(chemin, { force: true });
    return;
  }

  await fs.mkdir(path.dirname(chemin), { recursive: true });
  await fs.writeFile(chemin, `${JSON.stringify(retouche, null, 2)}\n`, "utf8");
}

/**
 * Applique une retouche à un manifeste.
 *
 * Seules les clés présentes dans la retouche écrasent le manifeste. Une clé
 * absente et une clé à `undefined` doivent se distinguer, sinon un champ vidé
 * dans le formulaire ne pourrait jamais revenir au manifeste.
 */
export function appliquerRetouche(manifest: Manifest, retouche: Retouche): Manifest {
  const fusion = { ...manifest };
  for (const [cle, valeur] of Object.entries(retouche)) {
    if (valeur === undefined) continue;
    Object.assign(fusion, { [cle]: valeur });
  }
  return fusion;
}

/**
 * Le dossier des retouches est-il accessible en écriture ?
 *
 * Sert à l'administration pour dire pourquoi le formulaire ne marchera pas,
 * plutôt que de laisser l'enregistrement échouer au moment du clic.
 */
export async function retouchesPossibles(): Promise<boolean> {
  try {
    await fs.mkdir(dossier(), { recursive: true });
    await fs.access(dossier(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
