/**
 * La page d'un jeu : ce qu'il est (jaquette, fiche technique) et ce que le
 * compte en a fait (sa partie, sa note).
 *
 * Deux sens de « partie » à ne pas confondre : une **partie** est d'ordinaire
 * une séance de jeu, celle que le site compte ; dans un **ensemble**, c'est
 * l'un des morceaux d'un jeu en plusieurs fichiers.
 *
 * Les durées, les dates et les tailles sont mises en forme par
 * `src/lib/format.ts` ; les textes d'ici les reçoivent déjà écrites.
 */
export const fiche = {
  /** Le bouton qui lance le jeu. */
  jouer: "Jouer",
  /** Le même bouton, dès qu'une sauvegarde existe. */
  reprendre: "Reprendre",
  /** Sous le titre : l'auteur d'un rom hack. */
  par: (auteur: string) => `par ${auteur}`,
  /** À côté du bouton : le temps passé, et la date de la dernière partie s'il y en a une. */
  tempsPasse: (duree: string, derniere: string | null) =>
    derniere === null ? `${duree} de jeu` : `${duree} de jeu · dernière partie le ${derniere}`,

  jaquette: {
    /** À la place de l'image, en minuscules : une étiquette, pas une phrase. */
    aucune: "pas de jaquette",
    /** Les textes de remplacement des trois images de la page. */
    alt: (titre: string) => `Jaquette de ${titre}`,
    altEtiquette: (titre: string) => `Étiquette de cartouche de ${titre}`,
    altDos: (titre: string) => `Dos de la boîte de ${titre}`,
    dos: "Dos de la boîte",
  },

  /** La fiche technique, sous la jaquette. */
  details: {
    console: "Console",
    version: "Version",
    langue: "Langue",
    /** Le jeu du commerce dont un rom hack est tiré. */
    jeuDeBase: "Jeu de base",
    annee: "Année",
    taille: "Taille",
    /** Le nombre de fois où le jeu a été lancé, tous comptes confondus. */
    parties: "Parties sur le site",
    jamaisLance: "jamais lancé",
    noteDesJoueurs: "Note des joueurs",
    /** La moyenne, puis le nombre de notes entre parenthèses. */
    note: (moyenne: string, nombre: number) => `${moyenne} ★ (${nombre})`,
    aucuneNote: "aucune",
    /** Repliés : l'empreinte de la ROM et l'identifiant du jeu. */
    techniques: "Détails techniques",
    identifiant: "Identifiant",
  },

  /** Ce que le compte a fait sur ce jeu. */
  taPartie: {
    titre: "Ta partie",
    toutes: "Toutes mes sauvegardes",
    tempsDeJeu: "Temps de jeu",
    parties: "Parties",
    sauvegarde: "Sauvegarde",
    aucuneSauvegarde: "aucune encore",
    copies: "Copies de secours",
    aucuneCopie: "aucune",
  },

  /** Au-dessus des étoiles : la note que le compte donne au jeu. */
  tonAvis: "Ton avis",

  /** La page d'un ensemble : un jeu en plusieurs morceaux, présentés ensemble. */
  ensemble: {
    resume: (parties: number, console: string, taille: string) =>
      `${parties} partie${parties > 1 ? "s" : ""} · ${console} · ${taille} en tout`,
  },
};
