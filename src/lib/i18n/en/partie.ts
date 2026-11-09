import type { Dictionnaire } from "../dictionnaires";

export const partie: Dictionnaire["partie"] = {
  etats: {
    titre: "My save states",
    explication: "Five slots you fill whenever you like.",
    titreAutos: "Automatic save states",
    explicationAutos: "One every two minutes, rotating through five slots: enough to go back ten minutes.",
    apercu: (emplacement: number) => `Preview of slot ${emplacement}`,
    vide: "empty",
    capturer: "Capture",
    remplacer: "Replace",
    /** « Load », le mot des émulateurs — « Resume » est déjà pris par la pause (`lecteur.reprendre`). */
    reprendre: "Load",
    effacer: "Delete",
    erreurs: {
      capture: "The capture failed.",
      introuvable: "This save state could not be found.",
      refusee: "The core refused this save state.",
    },
  },

  fichier: {
    titre: "Save file",
    explication: "To continue a game started elsewhere, or to take yours with you.",
    explicationLocale:
      "Your progress is in this browser only: download it to keep it or continue elsewhere, import it to pick it up again.",
    telecharger: "Download",
    remplacer: "Replace with a file",
    importEnCours: "Importing…",
    telechargee: (octets: number) => `Save file downloaded (${octets} bytes).`,
    telechargeeAGarder: "Save file downloaded. Keep this file: it is your progress.",
    rienATelecharger: "There is no save to download yet.",
    fichierVide: "This file is empty.",
    tailleInhabituelle: (octets: number) =>
      `Unusual size for a save file (${octets} bytes). ` +
      "If the game won't read it, that is probably why.",
    confirmer: {
      importer: "Import this save file?",
      remplacer: "This will replace your current progress. The previous version is kept as a backup. Continue?",
      remplacerLocale:
        "This will replace your current progress, with no backup: download it first if you want to keep it. Continue?",
    },
    refusee: "The server refused this save file.",
    refuseeLocale: "The browser refused this save file.",
  },

  vitesse: {
    libelle: "Game speed",
    normale: "Speed ×1",
    acceleree: (multiplicateur: number) => `Fast-forward ×${multiplicateur}`,
    toucheATenir: (touche: string, multiplicateur: number) =>
      `Hold ${touche} to fast-forward at ×${multiplicateur} for a moment`,
  },

  son: {
    actif: "Sound",
    coupe: "Sound off",
    volume: "Volume",
    /** Sans espace en anglais. */
    pourcentage: (valeur: number) => `${valeur}%`,
  },

  habillage: {
    titre: "Bezel",
    aucun: "None",
  },
};
