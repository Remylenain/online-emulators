import type { Dictionnaire } from "../dictionnaires";

export const mesJeux: Dictionnaire["mesJeux"] = {
  titre: "My games",

  onglets: {
    temps: "Play time",
    favoris: "Favorites",
    notes: "My ratings",
    sauvegardes: "Saves",
  },

  titrePartie: (titre: string, numero: number) => `${titre} · part ${numero}`,

  temps: {
    vide: "You haven't played any games yet.",
    total: (duree: string, jeux: number) =>
      `${duree} played in total, across ${jeux} game${jeux === 1 ? "" : "s"}.`,
    /** « sessions » : des séances de jeu, comptées — « progress » ne se compte pas. */
    parties: (parties: number, derniere: string) =>
      `${parties} session${parties === 1 ? "" : "s"} · last on ${derniere}`,
  },

  favoris: {
    vide: "No favorites yet. The star is on each game's page.",
  },

  notes: {
    vide: "You haven't rated any games. Ratings are given on each game's page.",
    /** « highest first » et non « favorites first » : les favoris sont un autre onglet. */
    explication: "The games you rated, highest first.",
    sur5: (note: number) => `${note} out of 5`,
    noteLe: (date: string) => `rated on ${date}`,
  },

  sauvegardes: {
    vide: "No saves yet: they show up as soon as a game saves.",
    resume: (jeux: number) =>
      `${jeux} game${jeux === 1 ? "" : "s"} with a save file. ` +
      "Backup copies keep the last five writes, and one per day for thirty days.",
    toutTelecharger: "Download all (zip)",
    details: (taille: string, modifiee: string, pointsDeReprise: number) =>
      `${taille} · modified on ${modifiee} · ` +
      `${pointsDeReprise} save state${pointsDeReprise === 1 ? "" : "s"}`,
    telecharger: "Download",
    pasDeCopie: "No backup copies",
    copies: (copies: number) => `${copies} backup cop${copies === 1 ? "y" : "ies"}`,
    copie: (revision: number, taille: string) => `rev. ${revision} · ${taille}`,
    telechargerCopie: "download",
    restaurer: "restore",
    confirmerRestauration: (quand: string, titre: string) =>
      `Put the copy from ${quand} back in place of your save file for ${titre}? ` +
      "The current version will be kept among the copies.",
    restauree: "Copy restored. It will be loaded the next time you open the game.",
    copieDisparue: "This copy no longer exists.",
  },

  reponses: {
    nonAutorise: "Unauthorized",
    introuvable: "Not found",
    emplacementInvalide: "Invalid slot",
    romAbsente: "ROM missing from disk",
    erreurs: {
      jeuIntrouvable: "Game not found.",
      emplacementInvalide: "Invalid slot.",
      sauvegardeVide: "Empty save file.",
      sauvegardeTropGrosse: "This file is too large to be a save file.",
      revisionInvalide: "Invalid revision.",
      etatVide: "Empty save state.",
      etatTropVolumineux: "Save state too large.",
    },
  },
};
