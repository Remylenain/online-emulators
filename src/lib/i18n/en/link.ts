import type { Dictionnaire } from "../dictionnaires";

const REJOINDRE_AVEC_UN_CODE = "Join with a code";

/**
 * « room » pour le salon, comme dans l'Activité Discord. « game » pour la
 * séance en cours, « progress » pour ce que chacun en garde sur son compte.
 */
export const link: Dictionnaire["link"] = {
  titre: "Link cable",
  retourFiche: "Back to the game page",

  fiche: {
    explication:
      "Two players, two browsers: the game runs on the server, and each player sees their own console. " +
      "Trades and battles, just like with a real cable.",
    reprendre: (code: string) => `Back to my room ${code}`,
    complet:
      "The server is full for now: every room is taken. " +
      "Try again in a few minutes, or join a room that is already open.",
    ouvrir: "Open a room",
    prive: "Private: hidden here, joined with the code",
    spectateurs: "Open to spectators (five at most)",
    dejaAilleurs: (code: string) => `You are already in a room for another game (${code}).`,
    disponibles: (salons: number) =>
      salons === 1 ? "Last room available on the server" : `${salons} rooms available on the server`,
    rejoindreAvecUnCode: REJOINDRE_AVEC_UN_CODE,
    rejoindre: "Join",
    enCours: (joueur1: string, joueur2: string) => `${joueur1} and ${joueur2} are playing`,
    places: (pris: number, max: number) => `${pris}/${max} spectator${max === 1 ? "" : "s"}`,
    regarder: "Watch",
    attend: (hote: string, code: string) => `${hote} is waiting in room *${code}*`,
    creationImpossible: "The room could not be created.",
  },

  page: {
    introuvable: {
      titre: "This room no longer exists",
      explication: "It was closed, or the server has restarted since. The players' saves are untouched.",
      retour: "Back to the home page",
    },
    complet: {
      titre: "This room is full",
      explication: (joueur1: string, joueur2: string) =>
        `${joueur1} and ${joueur2} are playing, and the host has not opened the game to spectators.`,
    },
  },

  salon: {
    sansTitre: "Room",
    code: (code: string) => `room *${code}*`,
    tuRegardes: "you are watching",
    /** « max », plus court que « out of » dans un bandeau. */
    spectateurs: (nombre: number, max: number) =>
      nombre === 0 ? `no spectators (max ${max})` : `${nombre} spectator${nombre === 1 ? "" : "s"} (max ${max})`,
    deconnecte: "disconnected",
    enAttente: "— waiting —",
    toi: (pseudo: string) => `${pseudo} (you)`,
    joueur: (numero: number) => `Player ${numero}`,

    connexionEchouee: "Could not connect to the room.",

    attente: {
      /** « voice channel », le mot de Discord pour le salon vocal. */
      discord: (jouerADeux: string) =>
        `Waiting for the second player: they need to open the Activity in this voice channel and choose “${jouerADeux}”.`,
      prive: (code: string) =>
        "Private room: it is not listed on the game page. Give this code to your partner, " +
        `who will enter it under “${REJOINDRE_AVEC_UN_CODE}”: *${code}*.`,
      publique: (code: string) =>
        `Waiting for a second player. Tell them to open the game page and join room *${code}*.`,
    },

    confirmerFin: "End the session? Both players' progress will be saved to your accounts.",
    terminer: "End and save",
    terminerCourt: "End",
    quitterSansTerminer: "Leave without ending",
    arreterDeRegarder: "Stop watching",
    retour: "Back",

    aide:
      "The keys are the ones set on your account. The game runs on the server: " +
      "you can switch tabs, the game keeps going.",
    /** Sans pseudo, « the left console » ; avec, pas de possessif, qui tournerait mal après un pseudo en « s ». */
    sonSpectateur: (pseudo: string | null) =>
      `${pseudo === null ? "You are hearing the left console." : `You are hearing the console of ${pseudo}.`} ` +
      "Sound starts on your first click.",

    fin: {
      titre: "Session ended",
      spectateur: "The game is over.",
      enregistree: "Both players' progress has been saved to your accounts.",
      nonEnregistree: "Progress was not saved: your saves from before the session are untouched.",
    },
  },

  /**
   * « the game server », et non « the server » : ces textes s'affichent aussi
   * dans l'Activité Discord, où « the server » se lirait comme le serveur
   * Discord.
   */
  erreurs: {
    nonConnecte: "You are not signed in.",
    requeteIllisible: "The request could not be read.",
    methodeNonPermise: "Method not allowed.",
    erreurInterne: "Internal error.",
    dejaDansLeSalon: (code: string) => `You are already in room ${code}.`,
    jeuIntrouvable: "Game not found.",
    consoleSansLink: "The link cable is not available for this console yet.",
    jeuSolo: "This is a single-player game: it has no link cable.",
    /** « CPU », plus courant que « processor » ; « margin », le nom du réglage dans l'administration. */
    margeInsuffisante:
      "The link cable does not have enough CPU set aside for this console. " +
      "The administrator can raise the margin in the settings.",
    serveurComplet: (salons: number) =>
      `The game server is full: ${salons} room${salons === 1 ? "" : "s"} in use. Try again in a few minutes.`,
    fileDAttente: "Other rooms are waiting ahead of yours.",
    salonComplet: "This room is already full.",
    dejaDansUnAutreSalon: "You are already in another room.",
    joueurDuSalon: "You are a player in this room.",
    spectateursFermes: "The host has not opened this room to spectators.",
    partiePasCommencee: "The game has not started.",
    spectateursAuComplet: (max: number) => `Already ${max} spectators: that is the maximum.`,
    salonNonDemarre: "The room could not start.",
    demarrageImpossible: "Could not start.",
  },

  fins: {
    /** « at the request of », pour la même raison que plus haut : pas de possessif après un pseudo. */
    demande: (pseudo: string) => `at the request of ${pseudo}`,
    coeurEchoue: "the core failed",
    filPlante: "the worker thread crashed",
    hoteAbsent: (pseudo: string) => `${pseudo} has been gone from the room for five minutes`,
    abandon: "room abandoned",
  },

  /** « core », le mot des émulateurs, déjà celui du lecteur. */
  coeur: {
    jeuRefuse: (code: number | null) =>
      code === null ? "The core refused this game." : `The core refused this game (${code}).`,
    romRefusee: (code: number | null) =>
      code === null ? "The core refused this ROM." : `The core refused this ROM (${code}).`,
    sauvegardeRefusee: (code: number) => `The save file was not accepted (${code}).`,
    sauvegardeDuJoueurRefusee: (joueur: number, code: number) =>
      `Player ${joueur}'s save file was not accepted (${code}).`,
    sansMemoire: (joueur: number) => `The core has no save memory for player ${joueur}.`,
    nonDeclare: "The emulation core loaded without registering itself.",
    nonTelecharge: "The emulation core could not be downloaded.",
  },
};
