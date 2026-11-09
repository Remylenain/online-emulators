import type { Dictionnaire } from "../dictionnaires";

/**
 * « Fiche » se dit « entry » pour les données d'un jeu, « game page » pour sa
 * page publique. « Retouche » se dit « edit » : une valeur saisie ici, par
 * opposition à celle du `game.json`.
 */
export const adminBibliotheque: Dictionnaire["adminBibliotheque"] = {
  titreOnglet: "Library",

  console: "Console",

  taches: {
    relancerLeScan: "Run the scan again",
    scanEnCours: "Scanning…",
    completerLesFiches: "Fill in the entries",
    rechercheEnCours: "Searching…",
    portee: "Console the scan and the entry lookup apply to",
    surToutes: "On all consoles",
    surUneSeule: (nomDeLaConsole: string) => `On ${nomDeLaConsole} only`,
    publies: (publies: number, total: number) => `${publies} of ${total} published`,
    dernierScan: (date: string) => `last scan on ${date}`,
    refus: {
      consoleInconnue: "Unknown console.",
      dejaEnCours: {
        scan: "A scan is already running.",
        scraper: "The scraper is already running.",
      },
      scriptIntrouvable: {
        scan: "The scan script could not be found on the server.",
        scraper: "The scraper script could not be found on the server.",
      },
      demarrageImpossible: {
        scan: "The scan could not start.",
        scraper: "The scraper could not start.",
      },
    },
  },

  volets: {
    journalDuScan: "Scan log",
    /** Le journal de « Fill in the entries ». */
    journalDesFiches: "Entry lookup log",
    exporter: "Export the entries",
    aide: "Help",
  },

  aide: {
    scan: "“Run the scan again” reads the library folder again: new games, covers, changed manifests.",
    fiches:
      "“Fill in the entries” looks up the description, year and cover of official games that lack them, " +
      "without overwriting anything, then runs the scan again. The scraper account is set in Settings; without " +
      "it, only covers are looked up.",
    retouches:
      "Click a title to open its entry. Corrections are saved next to the library, which stays read-only for " +
      "the site; the scan applies them again on every run. Emptying a field makes it fall back to the " +
      "`game.json`.",
  },

  lectureSeule: "The server cannot write to its data folder: the corrections below will fail.",

  filtres: {
    rechercher: "Search for a game",
    rechercherDans: "Title, author, base game…",
    toutesLesConsoles: (nombre: number) => `All consoles (${nombre})`,
    typeDeJeu: "Game type",
    tousLesJeux: (nombre: number) => `All games (${nombre})`,
    types: {
      hacks: "ROM hacks and translations",
      officiels: "Official games",
    },
    toutAfficher: "Show all",
    aTraiter: "Needs attention",
    etats: {
      "sans-jaquette": "No cover",
      "sans-description": "No description",
      "sans-langue": "Language missing",
      retires: "Unpublished",
      retouches: "Edited",
    },
  },

  liste: {
    aucunJeu: "No game matches.",
    intervalle: (premier: number, dernier: number, total: number) =>
      `${premier}–${dernier} of ${total} game${total === 1 ? "" : "s"}`,
  },

  pagination: {
    pages: "Pages",
    precedente: "‹ Previous",
    suivante: "Next ›",
  },

  export: {
    titre: "Export the entries",
    toutesLesConsoles: "All consoles",
    avecLesOfficiels: "Include official games",
    telecharger: "Download (.zip)",
    explication:
      "A `gamelist.xml` and an images folder per console, in the EmulationStation format (Recalbox, Batocera, " +
      "RetroPie, ES-DE): title, description, year, author, language and cover, matched to the ROM file name. " +
      "No ROM is included in the archive.",
    nomDuLisezMoi: "README.txt",
    lisezMoi: `Game entries in the EmulationStation format
(Recalbox, Batocera, RetroPie, ES-DE).

One folder per console. Each contains:
  gamelist.xml   title, description, year, author and language of each game
  images/        the covers, named after the ROM file

Recalbox, Batocera, RetroPie: copy the contents of the folder into the
console's ROM folder (roms/gb, roms/gbc, roms/gba), next to the ROMs. If a
gamelist.xml is already there, merge the <game> blocks rather than
overwriting it.

ES-DE: copy gamelist.xml into ES-DE/gamelists/<console>/ and the images
into ES-DE/downloaded_media/<console>/covers/.

Entries are matched to ROMs by file name: a renamed ROM will not find
its own.
`,
  },

  fiche: {
    officiel: "official",
    langueARenseigner: "language missing",
    taille: (mio: string) => `${mio} MiB`,
    sansJaquette: "no cover",
    retouches: (nombre: number) => `${nombre} edit${nombre === 1 ? "" : "s"}`,
    publie: "Published",
    retire: "Unpublished",
    champs: {
      titre: "Title",
      langue: "Language",
      auteur: "Author",
      version: "Version",
      jeuDeBase: "Base game",
      annee: "Year",
      description: "Description",
    },
    retouche: "edited",
    retoucheExplication: "This value was entered here; it does not come from the game.json.",
    enregistrer: "Save",
    enregistrement: "Saving…",
    fermer: "Close",
    voirLaFiche: "View the game page →",
  },

  api: {
    nonAutorise: "Unauthorized",
    interdit: "Forbidden",
    consoleInconnue: "Unknown console",
  },
};
