import type { Dictionnaire } from "../dictionnaires";

/** « 2nd », « 3rd », « 11th », « 22nd » : l'ordinal anglais, sans exposant. */
function ordinal(nombre: number): string {
  const dizaines = nombre % 100;
  if (dizaines >= 11 && dizaines <= 13) return `${nombre}th`;
  return `${nombre}${["th", "st", "nd", "rd"][nombre % 10] ?? "th"}`;
}

export const activite: Dictionnaire["activite"] = {
  titreOnglet: "Activity",
  accueil: {
    connexion: "Connecting to Discord…",
    partieGardee: (pseudo: string) => `Your progress is saved under ${pseudo}.`,
    jouerSeul: "Play solo",
    /** « two-player », le mot des jaquettes ; « Play » en tête, pour que « the next “Play” » vaille pour les deux boutons. */
    jouerADeux: "Play two-player",
    explicationADeux:
      "Two-player: with someone in this voice channel, over the link cable. " +
      "Each player's progress is the one on their own account, solo or two-player.",
    astuce: "Tip:",
    isolation: (isolee: boolean) => `Cross-origin isolation: ${isolee ? "yes" : "no"}`,
  },

  lancement: {
    partie: "Loading your progress…",
    jeu: (mio: string) => `Downloading the game (${mio} MiB)…`,
    console: "Starting the console…",
  },

  pause: {
    titre: "Pause",
    ouvrir: "Pause",
    fermer: "Resume",
    reprendre: "Resume game",
    explication:
      "A save state is the exact moment you took it: it follows your account, like your progress. " +
      "Five slots you fill whenever you like.",
  },

  /**
   * « room » pour le salon du câble link, et « the game server » pour le
   * serveur du site : dans Discord, « the server is full » se lirait comme le
   * serveur Discord, et « channel » comme le salon vocal.
   */
  duo: {
    titre: (jeu: string) => `${jeu} — two-player`,
    /** Pas d'exposant en anglais : aucun accent circonflexe. */
    file: (rang: number, salons: number) =>
      `The game server is full. You are ${ordinal(rang)} in the queue${salons > 1 ? ` (${salons} rooms are waiting)` : ""}.`,
    fileConseil: "A room opens as soon as a game ends; stay on this screen, it will update by itself.",
    premiers: "The game server is full. You are first in the queue.",
    premiersConseil: "A room opens as soon as a game ends.",
    ouverture: "Opening the room…",
    retour: "Back",
    pleine: (spectateurs: number) => `The game is full: two players and ${spectateurs} spectators.`,
    nonOuvert: (code: number) => `The room could not be opened (${code}).`,
    sansReponse: "The server is not responding.",
  },

  partie: {
    telecharger: "Download my progress",
    remplacer: "Replace with a file",
    /** Et non « In progress… », qui se lirait comme la partie. */
    enCours: "Working…",
    repartirDeZero: "Start from scratch",
    rienATelecharger: "There is no progress to download yet.",
    telechargee: (octets: number) =>
      `Progress sent for download (${octets} bytes). ` +
      "If nothing arrives, Discord blocked it: get it from the website instead, it is the same one.",
    telechargementEchoue: "The download failed.",
    fichierVide: "This file is empty.",
    confirmer: {
      remplacer: (tailleInhabituelle: number | null) =>
        (tailleInhabituelle === null ? "" : `Unusual size for a save file (${tailleInhabituelle} bytes). `) +
        "Replace your current progress with this file? The previous version is kept as a backup.",
      repartirDeZero:
        "Start from scratch? Your current progress is set aside with the previous versions, " +
        "and the game will start as it did the first time. Your save states are kept.",
    },
    tropGros: "This file is too big to be a save file.",
    refusee: "The server refused this save file.",
    remplacee: "Progress replaced. It will be loaded the next time you press “Play”.",
    envoiEchoue: "The upload failed.",
    miseDeCote: "Progress set aside. The next “Play” starts from the beginning.",
    rienAMettreDeCote: "There was no progress to set aside.",
    echec: "That didn't work.",
  },

  sauvegarde: {
    envoi: "Saving…",
    ok: "Progress saved",
    echec: "Save not sent; it will retry at the next one",
    conflit: "Newer progress on the server: this one is not sent",
    court: {
      envoi: "Saving…",
      ok: "Saved",
    },
  },

  reglages: {
    titre: "Keys and controller",
    fermer: "Close",
    explication:
      "Saved to your account: the same settings apply on the website and in the Activity, solo or two-player.",
    refuse: (code: number) => `Could not save this setting (${code}).`,
    sansReponse: "The server is not responding: this setting will only last for this session.",
  },

  erreurs: {
    reessayer: "Try again",
    horsDiscord: "This page opens from Discord, by launching the Activity.",
    connexion: "Could not connect to Discord.",
    connexionImpossible: (code: number) => `Could not connect (${code}).`,
    nonReconnu: "Discord did not accept this connection.",
    tropDeTentatives: "Too many attempts. Try again in a moment.",
    jeuIntrouvable: "This Activity's game could not be found.",
    partieNonRecuperee: (code: number) => `Your progress could not be loaded (${code}).`,
    jeuIndisponible: (code: number) => `Game unavailable (${code}).`,
    coeur: "The emulation core could not start.",
    demarrage: "The game could not start.",
    reponse: (code: number) => `The server answered ${code}.`,
  },

  serveur: {
    requeteIllisible: "Unreadable request.",
    actionInconnue: "Unknown action.",
    codeManquant: "Missing authorization code.",
    essaiLocalDesactive: "Local testing is turned off.",
    horsServeur: "This Activity can only be played in its own Discord server.",
    sansRole: "This Activity is restricted to certain roles in this server, and you have none of them.",
    rolesInverifiables:
      "Your roles in this server could not be checked. Try again in a moment; if it keeps happening, tell the people who run the server.",
    compteDesactive: "This account has been disabled.",
    emplacementInvalide: "Invalid slot.",
    etatVide: "Empty save state.",
    pasUneVignette: "This is not a thumbnail.",
    pasDEtat: "There is no save state in this slot.",
    etatTropGros: "This save state is too large.",
    sauvegardeVide: "Empty save file.",
    sauvegardeTropGrosse: "This file is too large to be a save file.",
    revisionInvalide: "Invalid revision.",
    conflit: "This game was saved somewhere else since you started. Your save was not overwritten.",
  },
};
