import type { Dictionnaire } from "../dictionnaires";

export const fiche: Dictionnaire["fiche"] = {
  jouer: "Play",
  /** « Continue », le mot des menus de jeu — « Resume » est celui de la pause (`lecteur.reprendre`). */
  reprendre: "Continue",
  par: (auteur: string) => `by ${auteur}`,
  tempsPasse: (duree: string, derniere: string | null) =>
    derniere === null ? `${duree} played` : `${duree} played · last played on ${derniere}`,

  jaquette: {
    aucune: "no cover",
    /** « Cover of », comme sur l'accueil (`catalogue.accueil.reprendre.jaquette`). */
    alt: (titre: string) => `Cover of ${titre}`,
    altEtiquette: (titre: string) => `Cartridge label for ${titre}`,
    altDos: (titre: string) => `Back of the box for ${titre}`,
    dos: "Back of the box",
  },

  details: {
    console: "Console",
    version: "Version",
    langue: "Language",
    jeuDeBase: "Base game",
    annee: "Year",
    taille: "Size",
    /** Une partie comptée est une séance de jeu : « times played », comme sur les cartes du catalogue. */
    parties: "Times played on the site",
    jamaisLance: "never played",
    noteDesJoueurs: "Players' rating",
    note: (moyenne: string, nombre: number) => `${moyenne} ★ (${nombre})`,
    aucuneNote: "none",
    techniques: "Technical details",
    identifiant: "ID",
  },

  taPartie: {
    titre: "Your progress",
    toutes: "All my saves",
    tempsDeJeu: "Play time",
    /** « Sessions », comme dans la liste de « Mes jeux » — « progress » ne se compte pas. */
    parties: "Sessions",
    sauvegarde: "Save file",
    aucuneSauvegarde: "none yet",
    copies: "Backup copies",
    aucuneCopie: "none",
  },

  tonAvis: "Your rating",

  ensemble: {
    resume: (parties: number, console: string, taille: string) =>
      `${parties} part${parties === 1 ? "" : "s"} · ${console} · ${taille} in total`,
  },
};
