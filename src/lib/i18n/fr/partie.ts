/**
 * La partie du joueur, telle que le menu du lecteur la présente : ses points
 * de reprise, son fichier de sauvegarde, et les réglages que le site partage
 * avec l'Activité Discord (vitesse, son, habillage).
 *
 * Deux mots à ne pas confondre : la **sauvegarde** est le fichier que le jeu
 * écrit lui-même ; un **point de reprise** est une photographie de la console
 * prise par le lecteur.
 */
export const partie = {
  /** Les points de reprise : cinq manuels, cinq automatiques. */
  etats: {
    titre: "Mes points de reprise",
    explication: "Cinq emplacements que tu remplis quand tu veux.",
    titreAutos: "Reprises automatiques",
    /**
     * Les automatiques remplacent toujours le plus ancien des cinq : c'est ce
     * roulement qui laisse en permanence dix minutes de marge arrière.
     */
    explicationAutos:
      "Une toutes les deux minutes, en roulement sur cinq emplacements : de quoi revenir dix minutes en arrière.",
    /** Le texte de remplacement de la vignette : l'image de l'écran à l'instant capturé. */
    apercu: (emplacement: number) => `Aperçu de l'emplacement ${emplacement}`,
    /** À la place de la vignette, en minuscules : une étiquette, pas une phrase. */
    vide: "vide",
    capturer: "Capturer",
    /** Capturer dans un emplacement déjà rempli. */
    remplacer: "Remplacer",
    /** Revenir à l'instant capturé — à ne pas confondre avec `lecteur.reprendre`, qui lève la pause. */
    reprendre: "Reprendre",
    effacer: "Effacer",
    erreurs: {
      capture: "La capture a échoué.",
      introuvable: "Cette reprise est introuvable.",
      refusee: "Le cœur a refusé cette reprise.",
    },
  },

  /** Le fichier de sauvegarde : l'emporter, ou le remplacer par un autre. */
  fichier: {
    titre: "Fichier de sauvegarde",
    explication: "Pour reprendre une partie venue d'ailleurs, ou emporter la tienne.",
    explicationLocale:
      "Ta partie n'est que dans ce navigateur : télécharge-la pour la garder ou continuer ailleurs, importe-la pour la reprendre.",
    telecharger: "Télécharger",
    /** Libellé cité tel quel par `lecteur.depart.emportee` : les deux changent ensemble. */
    remplacer: "Remplacer par un fichier",
    importEnCours: "Import en cours…",
    telechargee: (octets: number) => `Sauvegarde téléchargée (${octets} octets).`,
    /** Quand le lecteur se charge lui-même du téléchargement : la taille n'est pas connue ici. */
    telechargeeAGarder: "Sauvegarde téléchargée. Garde ce fichier : c'est ta partie.",
    rienATelecharger: "Il n'y a pas encore de sauvegarde à télécharger.",
    fichierVide: "Ce fichier est vide.",
    /**
     * Un avertissement, pas un refus : certains émulateurs ajoutent un en-tête
     * ou complètent le fichier, et la sauvegarde peut rester valable.
     */
    tailleInhabituelle: (octets: number) =>
      `Taille inhabituelle pour une sauvegarde (${octets} octets). ` +
      "Si le jeu ne la reconnaît pas, c'est sans doute de là que ça vient.",
    /** Les questions posées avant d'importer (`window.confirm`). */
    confirmer: {
      importer: "Importer cette sauvegarde ?",
      remplacer: "Cela remplacera ta partie en cours. L'ancienne version est gardée en secours. Continuer ?",
      remplacerLocale:
        "Cela remplacera ta partie en cours, sans copie de secours : télécharge-la d'abord si tu veux la garder. Continuer ?",
    },
    refusee: "Le serveur a refusé cette sauvegarde.",
    refuseeLocale: "Le navigateur a refusé cette sauvegarde.",
  },

  vitesse: {
    /** Le nom du réglage, pour les lecteurs d'écran. */
    libelle: "Vitesse de jeu",
    normale: "Vitesse ×1",
    acceleree: (multiplicateur: number) => `Accéléré ×${multiplicateur}`,
    /** L'infobulle : la touche à tenir pour accélérer, et ce qu'elle donne. */
    toucheATenir: (touche: string, multiplicateur: number) =>
      `Maintiens ${touche} pour passer en ×${multiplicateur} le temps d'un instant`,
  },

  son: {
    /** Le bouton qui coupe le son : son libellé dit l'état, pas l'action. */
    actif: "Son",
    coupe: "Son coupé",
    /** Le nom du curseur, pour les lecteurs d'écran. */
    volume: "Volume",
    /** L'espace avant « % » est celle du français. */
    pourcentage: (valeur: number) => `${valeur} %`,
  },

  /** L'image d'une console dessinée autour du jeu. */
  habillage: {
    titre: "Habillage",
    aucun: "Aucun",
  },
};
