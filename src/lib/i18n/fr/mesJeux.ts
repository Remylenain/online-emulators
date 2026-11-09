import { TITRE_PARTIE } from "../../jeu-resume";

/**
 * « Mes jeux » : ce que le compte a fait sur le site — son temps de jeu, ses
 * favoris, ses notes, ses sauvegardes et leurs copies de secours — et ce que
 * répondent les routes qui servent ces fichiers.
 *
 * Trois mots à ne pas confondre : la **sauvegarde** est le fichier que le jeu
 * écrit lui-même ; une **copie de secours** en est une version antérieure,
 * gardée par le site ; un **point de reprise** est une photographie de la
 * console prise par le lecteur (voir `partie`).
 */
export const mesJeux = {
  /** Le titre de la page, de son onglet et de sa barre d'onglets. */
  titre: "Mes jeux",

  onglets: {
    temps: "Temps de jeu",
    favoris: "Favoris",
    notes: "Mes notes",
    sauvegardes: "Sauvegardes",
  },

  /**
   * Le nom d'un morceau d'un jeu en plusieurs fichiers, pour `titreComplet`.
   * Le français est écrit dans `src/lib/jeu-resume.ts`, dont il est la valeur
   * par défaut ; il est repris ici tel quel, pour que les autres langues en
   * suivent la forme.
   */
  titrePartie: TITRE_PARTIE,

  temps: {
    vide: "Tu n'as encore lancé aucun jeu.",
    total: (duree: string, jeux: number) =>
      `${duree} de jeu en tout, sur ${jeux} jeu${jeux > 1 ? "x" : ""}.`,
    /** Sous la durée d'un jeu : le nombre de parties, et la date de la dernière. */
    parties: (parties: number, derniere: string) =>
      `${parties} partie${parties > 1 ? "s" : ""} · dernière le ${derniere}`,
  },

  favoris: {
    vide: "Aucun favori pour l'instant. L'étoile est sur la fiche de chaque jeu.",
  },

  notes: {
    vide: "Tu n'as noté aucun jeu. Les notes se donnent sur la fiche de chaque jeu.",
    explication: "Tes jeux notés, les préférés en premier.",
    /** Ce que les étoiles disent à un lecteur d'écran. */
    sur5: (note: number) => `${note} sur 5`,
    noteLe: (date: string) => `noté le ${date}`,
  },

  sauvegardes: {
    vide: "Aucune sauvegarde pour l'instant : elles apparaissent dès qu'un jeu enregistre.",
    resume: (jeux: number) =>
      `${jeux} jeu${jeux > 1 ? "x" : ""} avec une sauvegarde. ` +
      "Les copies de secours gardent les cinq dernières écritures et une par jour pendant trente jours.",
    toutTelecharger: "Tout télécharger (zip)",
    /** Sous le titre d'un jeu, après le nom de sa console. */
    details: (taille: string, modifiee: string, pointsDeReprise: number) =>
      `${taille} · modifiée le ${modifiee} · ${pointsDeReprise} point${pointsDeReprise > 1 ? "s" : ""} de reprise`,
    telecharger: "Télécharger",
    /** Le bouton qui déplie les copies d'un jeu ; sans copie, il est grisé. */
    pasDeCopie: "Pas de copie",
    copies: (copies: number) => `${copies} copie${copies > 1 ? "s" : ""} de secours`,
    /** À côté de la date d'une copie : son numéro de révision et sa taille. */
    copie: (revision: number, taille: string) => `rév. ${revision} · ${taille}`,
    /** Les deux gestes d'une copie, en minuscules : des liens dans une ligne. */
    telechargerCopie: "télécharger",
    restaurer: "restaurer",
    /** La question posée avant de restaurer (`window.confirm`). */
    confirmerRestauration: (quand: string, titre: string) =>
      `Remettre la copie du ${quand} à la place de ta sauvegarde de ${titre} ? ` +
      "La version actuelle sera gardée dans les copies.",
    restauree: "Copie restaurée. Elle sera chargée à la prochaine ouverture du jeu.",
    copieDisparue: "Cette copie n'existe plus.",
  },

  /**
   * Ce que répondent les routes des sauvegardes, des points de reprise et des
   * fichiers d'un jeu (`/api/save`, `/api/state`, `/api/rom`, `/api/cover`…)
   * quand elles refusent. Le lecteur du site choisit son propre texte d'après
   * le code HTTP ; ceux-ci sont pour qui lit le corps de la réponse.
   */
  reponses: {
    /** Les corps en texte brut : quelques mots, sans point, à la manière d'un statut HTTP. */
    nonAutorise: "Non autorisé",
    introuvable: "Introuvable",
    emplacementInvalide: "Emplacement invalide",
    romAbsente: "ROM absente du disque",
    /**
     * Le champ `erreur` des réponses JSON : des phrases. Le refus d'écraser
     * une sauvegarde plus récente reprend `lecteur.sauvegarde.conflit`.
     */
    erreurs: {
      jeuIntrouvable: "Jeu introuvable.",
      emplacementInvalide: "Emplacement invalide.",
      sauvegardeVide: "Sauvegarde vide.",
      sauvegardeTropGrosse: "Ce fichier est trop gros pour être une sauvegarde.",
      revisionInvalide: "Révision invalide.",
      /** « État » : un point de reprise, tel que le lecteur l'envoie. */
      etatVide: "État vide.",
      etatTropVolumineux: "État trop volumineux.",
    },
  },
};
