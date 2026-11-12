import { z } from "zod";

/**
 * Format du fichier `game.json` qui accompagne chaque jeu de la bibliothèque.
 *
 * C'est la seule source de vérité du catalogue : la base n'est qu'un cache
 * reconstruit par `npm run library:scan`. Rien ne se saisit dans une interface
 * d'administration, et supprimer la base ne perd aucune métadonnée.
 *
 * Seul `titre` est obligatoire. Tout le reste s'omet, parce qu'un rom hack
 * n'a pas toujours d'auteur identifié, de version numérotée ni de date.
 */
export const manifestSchema = z.object({
  titre: z.string().trim().min(1, "Le titre est obligatoire.").max(120),

  /**
   * Identifiant d'URL. Déduit du titre s'il est absent, mais à renseigner dès
   * qu'on tient à une adresse stable : renommer un jeu changerait sinon son
   * URL, et les liens déjà partagés tomberaient.
   */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Minuscules, chiffres et tirets seulement.")
    .max(80)
    .optional(),

  description: z.string().trim().max(4000).optional(),

  /** L'auteur du hack ou de la traduction, pas l'éditeur d'origine. */
  auteur: z.string().trim().max(120).optional(),
  version: z.string().trim().max(40).optional(),

  /** Code de langue court : « fr », « en », « fr-FR »… */
  langue: z.string().trim().max(10).optional(),

  /** Le jeu de base dont le hack dérive, ex. « Pokémon Cristal ». */
  jeuDeBase: z.string().trim().max(120).optional(),

  annee: z.number().int().min(1989).max(2100).optional(),

  /**
   * Date de publication de cette version. Sert à classer les nouveautés : sans
   * elle, c'est la date d'apparition dans la bibliothèque qui compte, ce qui
   * remonterait un vieux jeu ajouté tardivement en tête des nouveautés.
   */
  sortieLe: z.iso.date().optional(),

  /**
   * Noms de fichiers, relatifs au dossier du jeu. À renseigner seulement pour
   * lever une ambiguïté : le scanner trouve seul la ROM à l'extension de la
   * console et la jaquette nommée `cover`.
   */
  rom: z.string().trim().max(255).optional(),
  jaquette: z.string().trim().max(255).optional(),

  /** Étiquette de cartouche. Trouvée seule si le fichier s'appelle `etiquette`. */
  etiquette: z.string().trim().max(255).optional(),

  /**
   * Rattache cette entrée à un ensemble, pour les titres qui n'existent qu'en
   * morceaux — une vidéo découpée en huit ROMs, par exemple.
   *
   * Le catalogue n'affiche alors qu'une carte, au titre du groupe, et sa fiche
   * liste les parties. Chaque partie reste un jeu à part entière, avec sa ROM
   * et sa propre sauvegarde.
   */
  groupe: z
    .object({
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Minuscules, chiffres et tirets seulement.")
        .max(80),
      titre: z.string().trim().min(1).max(120),
      partie: z.number().int().min(1).max(999),
    })
    .optional(),

  /** Retire le jeu du catalogue sans supprimer son dossier. */
  publie: z.boolean().default(true),

  /** Jeu du commerce tel qu'il est sorti, et non un rom hack ou une traduction. */
  officiel: z.boolean().default(false),

  /**
   * Jeu à un seul joueur : la cartouche n'a rien à échanger par le câble link.
   * Le site ne propose alors pas de salon sur sa fiche, et une Activité Discord
   * qui sert ce jeu n'offre pas de jouer à deux.
   */
  solo: z.boolean().default(false),
});

export type Manifest = z.infer<typeof manifestSchema>;

/**
 * Le manifeste est en français, comme le reste du projet, mais la base suit
 * les conventions SQL anglaises héritées du schéma. La traduction se fait ici,
 * en un seul endroit.
 */
export function manifestToColumns(manifest: Manifest) {
  return {
    title: manifest.titre,
    description: manifest.description ?? null,
    author: manifest.auteur ?? null,
    version: manifest.version ?? null,
    language: manifest.langue ?? null,
    baseGame: manifest.jeuDeBase ?? null,
    year: manifest.annee ?? null,
    // `sortieLe` est une date sans heure : interprétée à midi UTC, elle tombe
    // le bon jour quel que soit le fuseau d'affichage.
    releasedAt: manifest.sortieLe ? new Date(`${manifest.sortieLe}T12:00:00Z`) : null,
    groupSlug: manifest.groupe?.slug ?? null,
    groupTitle: manifest.groupe?.titre ?? null,
    partNumber: manifest.groupe?.partie ?? null,
    isPublished: manifest.publie,
    isOfficial: manifest.officiel,
    isSolo: manifest.solo,
  };
}
