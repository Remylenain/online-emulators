import type { Dictionnaire } from "../dictionnaires";

export const lecteur: Dictionnaire["lecteur"] = {
  quitter: "Quit",
  menu: "Menu",
  fermer: "Close",
  pause: "Pause",
  reprendre: "Resume",
  redemarrer: "Restart the console",
  envoyerAuServeur: "Send to server",
  pleinEcran: "Full screen",
  quitterPleinEcran: "Exit full screen",

  chargement: {
    partie: "Loading your progress…",
    jeu: (mio: string) => `Downloading the game (${mio} MiB)…`,
    console: "Starting the console…",
  },

  erreurs: {
    isolation:
      "This browser does not allow cross-origin isolation, which the emulation core requires. " +
      "Try another browser, or turn off any extension that changes page headers.",
    jeuIndisponible: (code: number) => `Game unavailable (${code}).`,
    coeurArrete: "The emulation core has stopped. Reload the page to continue.",
    demarrage: "Could not start.",
  },

  sauvegarde: {
    explication:
      "The game's own save — the one you make *in* the game — is sent to the server automatically, and when you leave. " +
      "To pick up at any moment, use a save state below instead.",
    explicationLocale:
      "The game's own save — the one you make *in* the game — is kept in this browser, not on any server. " +
      "To keep a copy or continue elsewhere, download it below.",
    envoi: "Saving…",
    enregistree: (heure: string) => `Progress saved at ${heure}`,
    enregistreeLocale: (heure: string) => `Progress saved in this browser at ${heure}`,
    refusee: (code: number) => `Save refused (${code}).`,
    refuseeLocale:
      "The browser refused to save your progress (storage full, or turned off). " +
      "Download your save file below so you don't lose it.",
    sansReponse: "The server did not answer. The game goes on; it will retry at the next change.",
    conflit: "This game was saved somewhere else since you started. Your save was not overwritten.",
    conflitLocal: "This game was saved from another tab. The other tab's save was not overwritten.",
    garderCelleCi: "Keep this one and replace the other",
  },

  depart: {
    titre: "Before you go",
    explication:
      "You are playing without an account: your progress is saved *in this browser only*, not on any server. " +
      "It is lost if you clear the browser's data, and it does not follow you to another device.",
    conseil: "Download your save file to keep a copy, or to continue elsewhere.",
    telecharger: "Download my save file",
    quitterSans: "Quit without downloading",
    rester: "Stay",
    titreEmportee: "Save file downloaded",
    emportee:
      "Keep this file: it is your progress. To continue here or in another browser, " +
      "start the game and choose “Replace with a file”.",
  },
};
