/**
 * Administration → Bibliothèque : le scan, la complétion des fiches, la liste
 * des jeux et ses filtres, les retouches, l'export.
 *
 * Deux mots à ne pas confondre : la **fiche** est ce que le site sait d'un jeu
 * (titre, description, jaquette…) ; une **retouche** est une valeur saisie
 * ici, qui prend le pas sur celle du `game.json` sans le modifier.
 *
 * Convention propre à cet écran : un passage entre accents graves, « `ainsi` »,
 * est affiché comme du code par le composant.
 */
export const adminBibliotheque = {
  /** Le titre de l'onglet du navigateur. */
  titreOnglet: "Bibliothèque",

  /** Le nom du sélecteur de console, pour les lecteurs d'écran (filtres et export). */
  console: "Console",

  /** Les deux tâches de fond lancées d'ici : le scan, et la complétion des fiches. */
  taches: {
    relancerLeScan: "Relancer le scan",
    scanEnCours: "Scan en cours…",
    completerLesFiches: "Compléter les fiches",
    rechercheEnCours: "Recherche en cours…",
    /** Le nom du sélecteur de portée, pour les lecteurs d'écran. */
    portee: "Console sur laquelle portent le scan et la complétion des fiches",
    surToutes: "Sur toutes les consoles",
    surUneSeule: (nomDeLaConsole: string) => `Sur ${nomDeLaConsole} seulement`,
    publies: (publies: number, total: number) => `${publies} publié${publies > 1 ? "s" : ""} sur ${total}`,
    /** À la suite du nombre de jeux publiés, en minuscules. */
    dernierScan: (date: string) => `dernier scan le ${date}`,
    /**
     * Les refus du serveur au lancement d'une tâche. « Scraper » est le nom du
     * script derrière « Compléter les fiches ».
     */
    refus: {
      consoleInconnue: "Console inconnue.",
      dejaEnCours: {
        scan: "Un scan est déjà en cours.",
        scraper: "Un scraper est déjà en cours.",
      },
      scriptIntrouvable: {
        scan: "Le script du scan est introuvable sur le serveur.",
        scraper: "Le script du scraper est introuvable sur le serveur.",
      },
      /** Sert aussi quand le serveur refuse sans dire pourquoi. */
      demarrageImpossible: {
        scan: "Le scan n'a pas pu démarrer.",
        scraper: "Le scraper n'a pas pu démarrer.",
      },
    },
  },

  /** Ce qui se déplie sous les boutons. Les journaux eux-mêmes restent tels que les scripts les écrivent. */
  volets: {
    journalDuScan: "Journal du scan",
    journalDesFiches: "Journal des fiches",
    exporter: "Exporter les fiches",
    aide: "Aide",
  },

  /** Le volet « Aide ». Les libellés cités sont ceux de `taches` : ils changent ensemble. */
  aide: {
    scan: "« Relancer le scan » relit le dossier de la bibliothèque : nouveaux jeux, jaquettes, manifestes modifiés.",
    fiches:
      "« Compléter les fiches » cherche la description, l'année et la jaquette des jeux officiels qui n'en ont pas, " +
      "sans rien écraser, puis relance le scan. Le compte du scraper se règle dans Réglages ; sans lui, seules les " +
      "jaquettes sont cherchées.",
    retouches:
      "Un clic sur un titre ouvre sa fiche. Les corrections sont enregistrées à côté de la bibliothèque, qui reste " +
      "en lecture seule pour le site ; le scan les réapplique à chaque passage. Vider un champ le fait repartir du " +
      "`game.json`.",
  },

  /** Quand le dossier de données n'est pas inscriptible. */
  lectureSeule: "Le serveur ne peut pas écrire dans son dossier de données : les corrections ci-dessous échoueront.",

  filtres: {
    rechercher: "Rechercher un jeu",
    /** Dans le champ vide : ce sur quoi porte la recherche. */
    rechercherDans: "Titre, auteur, jeu de base…",
    toutesLesConsoles: (nombre: number) => `Toutes les consoles (${nombre})`,
    typeDeJeu: "Type de jeu",
    tousLesJeux: (nombre: number) => `Tous les jeux (${nombre})`,
    types: {
      hacks: "Rom hacks et traductions",
      officiels: "Jeux officiels",
    },
    toutAfficher: "Tout afficher",
    /** Le nom du groupe de pastilles, pour les lecteurs d'écran. */
    aTraiter: "À traiter",
    /** Les pastilles : ce qu'il reste à faire sur un jeu. */
    etats: {
      "sans-jaquette": "Sans jaquette",
      "sans-description": "Sans description",
      "sans-langue": "Langue à renseigner",
      retires: "Retirés",
      retouches: "Retouchés",
    },
  },

  liste: {
    aucunJeu: "Aucun jeu ne correspond.",
    /** « 51–100 sur 340 jeux ». */
    intervalle: (premier: number, dernier: number, total: number) =>
      `${premier}–${dernier} sur ${total} jeu${total > 1 ? "x" : ""}`,
  },

  pagination: {
    /** Le nom de la navigation, pour les lecteurs d'écran. */
    pages: "Pages",
    precedente: "‹ Précédente",
    suivante: "Suivante ›",
  },

  /** L'export au format EmulationStation, et le mode d'emploi glissé dans l'archive. */
  export: {
    titre: "Exporter les fiches",
    toutesLesConsoles: "Toutes les consoles",
    avecLesOfficiels: "Avec les jeux officiels",
    telecharger: "Télécharger (.zip)",
    explication:
      "Un `gamelist.xml` et un dossier d'images par console, au format d'EmulationStation (Recalbox, Batocera, " +
      "RetroPie, ES-DE) : titre, description, année, auteur, langue et jaquette, rattachés au nom du fichier ROM. " +
      "Aucune ROM n'est dans l'archive.",
    /** Le nom du mode d'emploi, à la racine de l'archive. */
    nomDuLisezMoi: "LISEZ-MOI.txt",
    lisezMoi: `Fiches de jeux au format EmulationStation
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
`,
  },

  /** Une ligne de la liste, et le formulaire qui se déplie dessous. */
  fiche: {
    /** Les détails à droite du titre, en minuscules et séparés par des points médians. */
    officiel: "officiel",
    langueARenseigner: "langue à renseigner",
    /** La taille de la ROM, en mébioctets. */
    taille: (mio: string) => `${mio} Mio`,
    sansJaquette: "sans jaquette",
    retouches: (nombre: number) => `${nombre} retouche${nombre > 1 ? "s" : ""}`,
    /** Le bouton de publication : son libellé dit l'état, un clic le renverse. */
    publie: "Publié",
    retire: "Retiré",
    champs: {
      titre: "Titre",
      langue: "Langue",
      auteur: "Auteur",
      version: "Version",
      jeuDeBase: "Jeu de base",
      annee: "Année",
      description: "Description",
    },
    /** L'étiquette d'un champ qui s'écarte du manifeste, et son infobulle. */
    retouche: "retouché",
    retoucheExplication: "Cette valeur est saisie ici, elle ne vient pas du game.json.",
    enregistrer: "Enregistrer",
    enregistrement: "Enregistrement…",
    fermer: "Fermer",
    voirLaFiche: "Voir la fiche du jeu →",
  },

  /** Les refus des routes d'administration, en texte brut. */
  api: {
    nonAutorise: "Non autorisé",
    interdit: "Interdit",
    consoleInconnue: "Console inconnue",
  },
};
