/**
 * Ce que les actions de l'administration répondent à l'écran
 * (`src/lib/admin/actions.ts`) : le message vert ou rouge affiché sous le
 * formulaire ou le bouton qui vient de servir.
 *
 * Rangé par domaine, comme les écrans : les comptes, les liens d'inscription,
 * les sauvegardes déposées sur un compte, la bibliothèque, puis les réglages.
 * Un message est une phrase entière, point compris ; ceux qui citent un
 * pseudo, un titre ou une limite sont des fonctions.
 */
export const adminActions = {
  comptes: {
    /** Les refus de « Voir comme », par code (`RefusVoirComme`, dans `src/lib/auth/session.ts`). */
    voirComme: {
      nonConnecte: "Non connecté.",
      reserve: "Réservé à l'administrateur.",
      dejaToi: "C'est déjà ton compte.",
      introuvable: "Compte introuvable.",
      desactive: "Ce compte est désactivé.",
    },
    introuvable: "Compte introuvable.",
    /**
     * Les deux replis : le schéma de validation dit d'ordinaire lui-même ce
     * qui ne va pas (dictionnaire `validation`), et ces textes ne servent que
     * s'il se tait.
     */
    pseudoInvalide: "Pseudo invalide.",
    adresseInvalide: "Adresse invalide.",
    adresseDejaPrise: (adresse: string) => `Un compte utilise déjà l'adresse ${adresse}.`,
    pseudoDejaPris: (pseudo: string) => `Le pseudo « ${pseudo} » est déjà pris.`,
    cree: (pseudo: string) => `Compte créé pour ${pseudo}.`,
    /** Un lien d'invitation refait pour un compte qui existe déjà. */
    nouveauLien: (pseudo: string) => `Nouveau lien pour ${pseudo}.`,
    nouveauMotDePasse: (pseudo: string) => `Nouveau mot de passe pour ${pseudo}.`,

    modeInconnu: "Mode inconnu.",
    /**
     * Le mode d'accès qui vient d'être donné, et ce qu'il laisse voir. Les
     * « jeux cochés » sont ceux attribués au compte, dans la liste à cocher
     * du même écran.
     */
    acces: {
      normal: "Accès normal : tout le catalogue publié.",
      restreint: "Accès restreint : seulement les jeux cochés.",
      testeur: "Accès testeur : le catalogue publié, plus les jeux cochés.",
    },
    jeuxAttribues: (nombre: number) =>
      `${nombre} jeu${nombre > 1 ? "x" : ""} attribué${nombre > 1 ? "s" : ""}.`,

    remisAZero: (pseudo: string) => `Compte de ${pseudo} remis à zéro.`,
    actif: (pseudo: string) => `${pseudo} est maintenant actif.`,
    desactive: (pseudo: string) => `${pseudo} est maintenant désactivé.`,
    administrateur: (pseudo: string) => `${pseudo} est administrateur.`,
    plusAdministrateur: (pseudo: string) => `${pseudo} n'est plus administrateur.`,
    /** Supprimer ne se défait pas : le geste n'est offert qu'après la désactivation. */
    desactiverDAbord: (pseudo: string) =>
      `Désactive d'abord le compte de ${pseudo} : seul un compte désactivé se supprime.`,
    supprime: (pseudo: string) => `Compte de ${pseudo} supprimé, avec toutes ses données.`,

    /** Ce qu'un administrateur ne peut pas se faire à lui-même. */
    surSoi: {
      supprimer: "Tu ne peux pas supprimer ton propre compte.",
      desactiver: "Tu ne peux pas désactiver ton propre compte.",
      retirerDroits: "Tu ne peux pas retirer tes propres droits.",
    },
  },

  /** Les liens d'inscription, et l'ouverture des inscriptions à tous. */
  invitations: {
    plafondInvalide: "Nombre de comptes invalide.",
    dureeInvalide: "Durée de validité invalide.",
    cree: "Lien d'inscription créé.",
    /** Affiché sous le lien tout juste créé : ce qu'il permet, et jusqu'à quand. */
    aTransmettre: (plafond: number, jours: number) =>
      "Lien à transmettre : la personne y choisira son pseudo et son mot de passe. " +
      `Valable ${jours === 1 ? "24 heures" : `${jours} jours`}, pour ${plafond === 1 ? "un seul compte" : `${plafond} comptes au plus`}.`,
    revoque: "Lien révoqué : il ne créera plus de compte.",
    dejaRevoque: "Ce lien était déjà révoqué, ou n'existe pas.",

    ouvertureImpossible: "Impossible d'ouvrir : il faut un serveur de mail et un captcha configurés.",
    ouvertes: "Inscriptions ouvertes : la page de connexion propose de créer un compte.",
    fermees: "Inscriptions fermées : seuls les liens d'invitation créent des comptes.",
  },

  /** Une sauvegarde de jeu déposée sur le compte de quelqu'un. */
  sauvegardes: {
    choisirJeu: "Choisis un jeu.",
    choisirFichier: "Choisis un fichier de sauvegarde.",
    tropGros: "Ce fichier est trop gros pour une sauvegarde.",
    dejaLaMeme: (pseudo: string, jeu: string) =>
      `${pseudo} avait déjà exactement cette sauvegarde de ${jeu}.`,
    importee: (jeu: string, pseudo: string) =>
      `Sauvegarde de ${jeu} importée pour ${pseudo}. L'éventuelle précédente est dans les copies de secours.`,
  },

  bibliotheque: {
    jeuIntrouvable: "Jeu introuvable.",
    /**
     * Une **retouche** est une correction saisie dans l'administration, gardée
     * à côté de la bibliothèque et appliquée par-dessus le `game.json` du jeu.
     */
    retouchesImpossibles: "Impossible d'écrire dans le dossier des retouches sur le serveur.",
    publie: (titre: string) => `${titre} est publié.`,
    retire: (titre: string) => `${titre} est retiré du catalogue.`,
    /**
     * Le champ refusé et la raison. Le champ est nommé par sa clé du
     * `game.json` (`annee`, `jeuDeBase`…), la raison vient du schéma ; l'un
     * comme l'autre peuvent manquer.
     */
    champInvalide: (champ: string | undefined, raison: string | undefined) =>
      `${champ ?? "Champ"} : ${raison ?? "valeur invalide"}`,
    /** Plus aucune retouche : tout vient du manifeste. Le nom du fichier ne se traduit pas. */
    suitSonManifeste: (titre: string) => `${titre} suit entièrement son game.json.`,
    enregistre: (titre: string, nombre: number) =>
      `${titre} enregistré — ${nombre} champ${nombre > 1 ? "s" : ""} retouché${nombre > 1 ? "s" : ""}.`,
  },

  reglages: {
    /** Le nom du site, sa phrase d'accueil, le nom de l'application, la langue. */
    identite: {
      nom: (min: number, max: number) => `Le nom doit faire entre ${min} et ${max} caractères.`,
      description: (max: number) => `La description ne peut pas dépasser ${max} caractères.`,
      application: (max: number) =>
        `Le nom de l'application ne peut pas dépasser ${max} caractères.`,
      langueInconnue: "Langue inconnue.",
      enregistree: "Réglages enregistrés.",
    },

    /** Commun aux formulaires du relais et de ScreenScraper. */
    valeurTropLongue: "Une des valeurs est trop longue.",
    /**
     * Un réglage fait ici passe devant celui de l'environnement du serveur ;
     * l'effacer rend la main à ce dernier. Vaut pour le relais comme pour le
     * captcha.
     */
    efface: "Réglage effacé : le site reprend la configuration du serveur.",

    /** Le relais d'e-mails : le serveur SMTP par lequel le site envoie ses messages. */
    mail: {
      hoteObligatoire: "L'hôte du relais est obligatoire.",
      port: (min: number, max: number) => `Le port doit être un nombre entre ${min} et ${max}.`,
      enregistre: "Relais enregistré. Envoie-toi un e-mail de test pour le vérifier.",
      destinataireInvalide: "Adresse de destination invalide.",
      aucunRelais: "Aucun relais d'e-mails n'est configuré.",
      /** L'e-mail de test lui-même, dans la langue de l'administrateur qui se l'envoie. */
      test: {
        objet: "E-mail de test",
        texte: "Si tu lis ce message, le relais d'e-mails du site fonctionne.\n",
      },
      /**
       * La réponse du relais (« 535 Authentication failed »…) est citée telle
       * quelle : c'est elle qui permet de corriger.
       */
      refus: (reponse: string | undefined) => `Le relais a refusé : ${reponse ?? "erreur inconnue"}`,
      envoye: (destinataire: string) =>
        `E-mail envoyé à ${destinataire}. Regarde aussi les indésirables.`,
    },

    captcha: {
      cleObligatoire: (max: number) => `Clé du site obligatoire, ${max} caractères au plus.`,
      enregistre: "Clés enregistrées.",
    },

    /** Le compte ScreenScraper dont se sert « Compléter les fiches ». */
    scraper: {
      /**
       * Cite le bouton « Compléter les fiches »
       * (`adminBibliotheque.taches.completerLesFiches`) et l'onglet
       * « Bibliothèque » de l'administration : les libellés changent ensemble.
       */
      enregistre: "Compte enregistré. Lance « Compléter les fiches » depuis Bibliothèque.",
      sansIdentifiant:
        "Enregistré, mais sans identifiant développeur ScreenScraper ne répondra pas : seules les jaquettes libretro seront cherchées.",
      efface: "Compte effacé.",
    },

    /** La part du processeur laissée au câble link. L'espace avant « % » est celle du français. */
    link: {
      marge: (min: number, max: number) => `La marge doit être un entier entre ${min} et ${max} %.`,
      enregistree: "Marge enregistrée : la limite s'applique dès maintenant.",
    },
  },
};
