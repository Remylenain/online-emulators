import type { Dictionnaire } from "../dictionnaires";

export const catalogue: Dictionnaire["catalogue"] = {
  nombreDeJeux: (nombre: number) => (nombre === 0 ? "no games" : nombre === 1 ? "1 game" : `${nombre} games`),

  accueil: {
    salut: (pseudo: string) => `Hi ${pseudo}`,
    aucunePartie: "You haven't started a game yet. Pick a console to get going.",
    consoles: "Consoles",
    favoris: "Your favorites",
    recents: "Recently played",
    nouveautes: "New arrivals",
    aucuneNouveaute: (langue: string) => `Nothing new in ${langue} for now.`,

    reprendre: {
      etiquette: "Continue",
      jaquette: (titre: string) => `Cover of ${titre}`,
      tempsDeJeu: "Play time",
      dernierePartie: "Last played",
      sauvegarde: "Save file",
      aucuneSauvegarde: "none yet",
      jouer: "Play",
      voirLaFiche: "View game page",
    },

    enCeMoment: {
      titre: "Playing now",
      joue: "{joueur} is playing {jeu}",
      auCableLink: (avec: string | null) => (avec ? ` with ${avec}, over link cable` : ", over link cable"),
      regarder: "Watch",
    },

    salons: {
      titre: "Link cable",
      tienEnAttente: "Your room for {jeu} is waiting for a second player",
      tienEnCours: "Your room for {jeu} is in progress",
      prive: "private",
      retourner: "Return",
      attend: "{joueur} is waiting to play {jeu}",
      depuis: (date: string) => `since ${date}`,
      rejoindre: "Join",
      jouent: "{premier} and {second} are playing {jeu}",
      spectateurs: (nombre: number) => `${nombre} spectator${nombre === 1 ? "" : "s"}`,
      regarder: "Watch",
    },
  },

  console: {
    ecran: (largeur: number, hauteur: number, gachettes: boolean) =>
      `${largeur}×${hauteur} pixels${gachettes ? ", with L and R shoulder buttons" : ""}`,
    rienNeCorrespond: (recherche: string) => `Nothing matches “${recherche}”.`,
    aucunDansLaLangue: (langue: string) => `No games in ${langue} on this console.`,
    aucunJeu: "No games on this console yet.",
    autresMasques: (nombre: number) =>
      nombre === 1
        ? "1 other game in another language, or with no language set."
        : `${nombre} other games in other languages, or with no language set.`,
  },

  filtres: {
    rechercher: "Search for a game",
    indication: "Search…",
    langue: "Language",
    toutesLesLangues: "All languages",
    type: "Game type",
    types: {
      hacks: "ROM hacks and translations",
      officiels: "Official games",
      tous: "All games",
    },
    trierPar: "Sort by",
    tris: {
      note: "Top rated",
      titre: "Alphabetical",
      parties: "Most played",
    },
    affichage: "View",
    vues: {
      grille: "Grid",
      liste: "List",
    },
  },

  langues: {
    fr: "French",
    en: "English",
    es: "Spanish",
    de: "German",
    it: "Italian",
    ja: "Japanese",
    pt: "Portuguese",
  },

  cartes: {
    pasDeJaquette: "no cover",
    enCours: "in progress",
    dansTesFavoris: "In your favorites",
    partiesDUnEnsemble: (nombre: number) => (nombre === 1 ? "1 part" : `${nombre} parts`),
    pasDeNote: "no rating",
    partiesJouees: (nombre: number) =>
      nombre === 0 ? "never played" : nombre === 1 ? "played once" : `played ${nombre} times`,
  },

  favori: {
    dansTesFavoris: "In your favorites",
    ajouter: "Add to favorites",
  },

  notes: {
    taNote: "Your rating",
    surCinq: (valeur: number) => `${valeur} out of 5`,
    personne: "No one has rated this game yet.",
    moyenne: (moyenne: string, nombre: number) =>
      `${moyenne} out of 5 — ${nombre} rating${nombre === 1 ? "" : "s"}`,
    laTienne: (note: number) => `your rating: ${note}`,
    erreurs: {
      invalide: "Invalid rating.",
      jeuIntrouvable: "Game not found.",
    },
  },
};
