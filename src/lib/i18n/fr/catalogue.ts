/**
 * Le catalogue : l'accueil d'un compte, les pages des consoles, leurs filtres
 * et leurs tris, les grilles et les listes de jeux, les favoris et les notes.
 *
 * Deux sens du mot « partie » à ne pas confondre : une **partie jouée** (un
 * lancement du jeu, ce que compte « 12 parties » dans une liste) et la
 * **partie d'un ensemble** (un jeu découpé en plusieurs volets, réunis sous
 * une seule carte du catalogue).
 *
 * Dans une phrase, un repère entre accolades — « {joueur} joue à {jeu} » —
 * marque la place d'un élément que la page pose elle-même : un pseudo en
 * gras, un lien vers la fiche d'un jeu. La phrase reste entière ici, dans
 * l'ordre des mots de sa langue.
 */
export const catalogue = {
  /** Le compte d'un catalogue, d'une console ou d'une recherche. En minuscules : une étiquette. */
  nombreDeJeux: (nombre: number) => (nombre === 0 ? "aucun jeu" : nombre === 1 ? "1 jeu" : `${nombre} jeux`),

  accueil: {
    salut: (pseudo: string) => `Salut ${pseudo}`,
    aucunePartie: "Tu n'as pas encore lancé de partie. Choisis une console pour commencer.",
    consoles: "Consoles",
    favoris: "Tes favoris",
    recents: "Joués récemment",
    nouveautes: "Nouveautés",
    /**
     * Les nouveautés ne montrent que la langue de jeu par défaut du catalogue
     * (voir `LANGUE_PAR_DEFAUT`) : son nom arrive tel que le filtre l'écrit.
     */
    aucuneNouveaute: (langue: string) => `Rien de neuf en ${langue.toLowerCase()} pour le moment.`,

    /** Le dernier jeu ouvert, en grand, en tête de l'accueil. */
    reprendre: {
      /** Au-dessus du titre du jeu, en petites capitales. */
      etiquette: "Reprendre",
      jaquette: (titre: string) => `Jaquette de ${titre}`,
      tempsDeJeu: "Temps de jeu",
      /** La date de la dernière partie jouée. */
      dernierePartie: "Dernière partie",
      /** La date de la sauvegarde du jeu, ou `aucuneSauvegarde`. */
      sauvegarde: "Sauvegarde",
      aucuneSauvegarde: "aucune encore",
      jouer: "Jouer",
      voirLaFiche: "Voir la fiche",
    },

    /** Qui joue en ce moment, et à quoi. */
    enCeMoment: {
      titre: "En ce moment",
      joue: "{joueur} joue à {jeu}",
      /**
       * La suite de la phrase, en plus pâle, quand la partie se joue dans un
       * salon : elle commence par sa propre ponctuation.
       */
      auCableLink: (avec: string | null) => (avec ? ` avec ${avec}, au câble link` : ", au câble link"),
      regarder: "Regarder",
    },

    /** Les salons de câble link ouverts, et celui du compte. */
    salons: {
      titre: "Câble link",
      tienEnAttente: "Ton salon sur {jeu} attend un second joueur",
      tienEnCours: "Ton salon sur {jeu} est en cours",
      /** Une étiquette à côté du salon, en minuscules. */
      prive: "privé",
      /** Retourner dans son propre salon — et non « Rejoindre », qui est pour celui d'un autre. */
      retourner: "Reprendre",
      attend: "{joueur} attend sur {jeu}",
      depuis: (date: string) => `depuis ${date}`,
      rejoindre: "Rejoindre",
      jouent: "{premier} et {second} jouent à {jeu}",
      spectateurs: (nombre: number) => `${nombre} spectateur${nombre > 1 ? "s" : ""}`,
      regarder: "Regarder",
    },
  },

  /** La page d'une console. */
  console: {
    /** Sous le nom de la console : la taille de son écran, et ses gâchettes si elle en a. */
    ecran: (largeur: number, hauteur: number, gachettes: boolean) =>
      `${largeur}×${hauteur} pixels${gachettes ? ", avec gâchettes L et R" : ""}`,
    rienNeCorrespond: (recherche: string) => `Rien ne correspond à « ${recherche} ».`,
    /** Le nom de la langue arrive tel que le filtre l'écrit, avec sa majuscule. */
    aucunDansLaLangue: (langue: string) => `Aucun jeu en ${langue.toLowerCase()} sur cette console.`,
    aucunJeu: "Aucun jeu sur cette console pour le moment.",
    /** Ce que le filtre de langue cache : un catalogue qui rétrécit sans explication inquiète. */
    autresMasques: (nombre: number) =>
      nombre > 1
        ? `${nombre} autres jeux dans d'autres langues, ou sans langue déclarée.`
        : `${nombre} autre jeu dans d'autres langues, ou sans langue déclarée.`,
  },

  /** La recherche, les filtres, le tri et la bascule grille / liste d'une page de console. */
  filtres: {
    rechercher: "Rechercher un jeu",
    indication: "Rechercher…",
    /** La langue des jeux, pas celle de l'interface (`commun.langue`). */
    langue: "Langue",
    toutesLesLangues: "Toutes les langues",
    type: "Type de jeu",
    types: {
      hacks: "Rom hacks et traductions",
      officiels: "Jeux officiels",
      tous: "Tous les jeux",
    },
    trierPar: "Trier par",
    tris: {
      note: "Mieux notés",
      titre: "Alphabétique",
      /** Par nombre de parties jouées. */
      parties: "Plus joués",
    },
    /** Le nom de la bascule grille / liste, pour les lecteurs d'écran. */
    affichage: "Affichage",
    vues: {
      grille: "Grille",
      liste: "Liste",
    },
  },

  /**
   * Les langues des jeux, telles que le filtre les nomme. Une langue absente
   * de cette table s'affiche par son code.
   */
  langues: {
    fr: "Français",
    en: "Anglais",
    es: "Espagnol",
    de: "Allemand",
    it: "Italien",
    ja: "Japonais",
    pt: "Portugais",
  },

  /** Ce que portent les cartes d'une grille et les lignes d'une liste. */
  cartes: {
    /** À la place d'une jaquette absente, en minuscules. */
    pasDeJaquette: "pas de jaquette",
    /** Le compte a une sauvegarde sur ce jeu. */
    enCours: "en cours",
    dansTesFavoris: "Dans tes favoris",
    /** Sous la carte d'un ensemble : le nombre de jeux qu'il réunit. */
    partiesDUnEnsemble: (nombre: number) => (nombre > 1 ? `${nombre} parties` : `${nombre} partie`),
    pasDeNote: "pas de note",
    /** Le nombre de fois où le jeu a été lancé, tous comptes confondus. */
    partiesJouees: (nombre: number) =>
      nombre === 0 ? "jamais lancé" : nombre === 1 ? "1 partie" : `${nombre} parties`,
  },

  /** L'étoile de la fiche d'un jeu. Son libellé dit l'état quand le jeu y est, l'action sinon. */
  favori: {
    dansTesFavoris: "Dans tes favoris",
    ajouter: "Ajouter aux favoris",
  },

  /** Les cinq étoiles de la fiche d'un jeu. */
  notes: {
    /** Le nom du groupe d'étoiles, pour les lecteurs d'écran. */
    taNote: "Ta note",
    surCinq: (valeur: number) => `${valeur} sur 5`,
    personne: "Personne n'a encore noté ce jeu.",
    /** La moyenne arrive déjà mise en forme (« 4,5 »). « avis » ne prend pas la marque du pluriel. */
    moyenne: (moyenne: string, nombre: number) => `${moyenne} sur 5 — ${nombre} avis`,
    /** À la suite de la moyenne, en plus pâle. */
    laTienne: (note: number) => `ta note : ${note}`,
    erreurs: {
      invalide: "Note invalide.",
      jeuIntrouvable: "Jeu introuvable.",
    },
  },
};
