/**
 * L'Activité Discord : ses écrans propres. Les panneaux qu'elle partage avec
 * le lecteur sont dans `partie` et `commandes`.
 *
 * Trois mots à ne pas confondre ici. La **partie** est la progression du
 * joueur, celle que porte son compte ; dans le jeu à deux, c'est aussi la
 * séance en cours (« la partie est pleine »). Le **salon** est celui du câble
 * link, où l'on joue à deux — pas le **salon vocal** de Discord, qui le
 * désigne. Le **serveur** est celui du site, jamais le serveur Discord, qui
 * est toujours nommé en entier.
 */
export const activite = {
  /** Le titre de l'onglet, quand la page est ouverte hors de Discord : rien qui nomme le site. */
  titreOnglet: "Activité",
  /** L'accueil : qui joue, puis seul, à deux, ou régler ses touches. */
  accueil: {
    /** Pendant la poignée de main avec Discord, avant tout autre écran. */
    connexion: "Connexion à Discord…",
    /** La partie est celle du compte Discord : le dire avec son pseudo, pour qu'il sache où elle est. */
    partieGardee: (pseudo: string) => `Ta partie est gardée pour ${pseudo}.`,
    jouerSeul: "Jouer seul",
    jouerADeux: "Jouer à deux",
    explicationADeux:
      "À deux : avec quelqu'un de ce salon vocal, par le câble link. " +
      "La partie de chacun est celle de son compte, seul comme à deux.",
    /** Devant chaque astuce de l'administrateur, à l'accueil comme en pause. L'astuce, elle, s'affiche telle quelle. */
    astuce: "Astuce :",
    /** Un constat technique en pied d'écran, hérité du prototype : Discord n'isole pas ses iframes. */
    isolation: (isolee: boolean) => `Isolation cross-origin : ${isolee ? "oui" : "non"}`,
  },

  /** Le lancement d'une partie en solo : les trois temps du chargement. */
  lancement: {
    partie: "Récupération de ta partie…",
    /** `mio` est déjà écrit dans la langue du joueur : « 3,5 ». */
    jeu: (mio: string) => `Téléchargement du jeu (${mio} Mio)…`,
    console: "Démarrage de la console…",
  },

  /** Le menu de pause, par-dessus le jeu, et le bouton qui l'ouvre. */
  pause: {
    titre: "Pause",
    /** Le bouton du pied d'écran : son libellé dit ce qu'un appui fera. */
    ouvrir: "Pause",
    fermer: "Reprendre",
    /** Lever la pause depuis le menu — à ne pas confondre avec `partie.etats.reprendre`, qui revient à un point de reprise. */
    reprendre: "Reprendre la partie",
    /** Ici, pas de reprises automatiques : cinq emplacements, posés à la main seulement. */
    explication:
      "Une reprise est l'instant exact où tu l'as prise : elle suit ton compte, comme ta partie. " +
      "Cinq emplacements, que tu remplis quand tu veux.",
  },

  /**
   * Jouer à deux : l'attente d'un salon de câble link. Le « vous » s'adresse à
   * tout le salon vocal, qui attend ensemble — ce n'est pas un vouvoiement.
   */
  duo: {
    titre: (jeu: string) => `${jeu} — à deux`,
    /**
     * Le rang dans la file, à partir du deuxième ; `salons` est le nombre de
     * salons qui attendent. L'exposant de l'ordinal s'écrit entre accents
     * circonflexes, « 2^e^ » : c'est l'écran qui lui donne sa balise.
     */
    file: (rang: number, salons: number) =>
      `Le serveur est au complet. Vous êtes ${rang}^e^ dans la file${salons > 1 ? ` (${salons} salons attendent)` : ""}.`,
    fileConseil:
      "Un salon s'ouvre dès qu'une partie se termine ; reste sur cet écran, il se mettra à jour tout seul.",
    premiers: "Le serveur est au complet. Vous êtes les premiers dans la file.",
    premiersConseil: "Un salon s'ouvre dès qu'une partie se termine.",
    ouverture: "Ouverture du salon…",
    retour: "Retour",
    /** Le salon du salon vocal existe, mais il n'y reste ni chaise ni place de spectateur. */
    pleine: (spectateurs: number) => `La partie est pleine : deux joueurs et ${spectateurs} spectateurs.`,
    /** Un refus dont le serveur n'a pas dit le motif, ou pas d'une façon que l'écran sache lire. */
    nonOuvert: (code: number) => `Le salon n'a pas pu être ouvert (${code}).`,
    sansReponse: "Le serveur ne répond pas.",
  },

  /**
   * La partie et son fichier, à l'accueil : l'emporter, en apporter une, ou
   * repartir de zéro. Même fichier que celui du lecteur du site.
   */
  partie: {
    telecharger: "Télécharger ma partie",
    remplacer: "Remplacer par un fichier",
    /** À la place de « Remplacer par un fichier », tant qu'une des trois opérations est en route. */
    enCours: "En cours…",
    repartirDeZero: "Repartir de zéro",
    rienATelecharger: "Il n'y a pas encore de partie à télécharger.",
    /** Discord peut refuser le téléchargement depuis son cadre : le dire, sans pouvoir le savoir d'ici. */
    telechargee: (octets: number) =>
      `Partie envoyée au téléchargement (${octets} octets). ` +
      "Si rien n'arrive, Discord l'a bloqué : récupère-la depuis le site, c'est la même.",
    telechargementEchoue: "Le téléchargement a échoué.",
    fichierVide: "Ce fichier est vide.",
    /** Les questions posées avant d'agir (`window.confirm`). */
    confirmer: {
      /**
       * `tailleInhabituelle` : la taille du fichier en octets quand aucune
       * console n'en produit de telle, `null` sinon. Un avertissement, pas un
       * refus — certains émulateurs ajoutent un pied de page d'horloge.
       */
      remplacer: (tailleInhabituelle: number | null) =>
        (tailleInhabituelle === null
          ? ""
          : `Taille inhabituelle pour une sauvegarde (${tailleInhabituelle} octets). `) +
        "Remplacer ta partie en cours par ce fichier ? L'ancienne version est gardée en secours.",
      repartirDeZero:
        "Repartir de zéro ? Ta partie en cours est mise de côté avec les versions précédentes, " +
        "et le jeu redémarrera comme la première fois. Tes points de reprise restent.",
    },
    /** Le refus du serveur pour un fichier trop gros (413). */
    tropGros: "Ce fichier est trop gros pour être une sauvegarde.",
    refusee: "Le serveur a refusé cette sauvegarde.",
    /** « Jouer » vaut pour les deux boutons de l'accueil, « Jouer seul » et « Jouer à deux ». */
    remplacee: "Partie remplacée. Elle sera lue au prochain « Jouer ».",
    envoiEchoue: "L'envoi a échoué.",
    /** Et non « effacée » : le serveur la garde avec les versions précédentes, et le site sait la restaurer. */
    miseDeCote: "Partie mise de côté. Le prochain « Jouer » repart du début.",
    rienAMettreDeCote: "Il n'y avait pas de partie à mettre de côté.",
    echec: "Ça n'a pas marché.",
  },

  /** L'état de la sauvegarde en cours de jeu, en pied d'écran. */
  sauvegarde: {
    envoi: "Sauvegarde en cours…",
    ok: "Partie sauvegardée",
    echec: "Sauvegarde non envoyée, nouvel essai à la prochaine",
    /** Le serveur a refusé d'écraser une partie plus récente ; l'Activité n'insiste pas. */
    conflit: "Partie plus récente sur le serveur : celle-ci n'est pas envoyée",
  },

  /** L'écran des touches et de la manette ; les deux réglages eux-mêmes sont dans `commandes`. */
  reglages: {
    /** Le bouton de l'accueil et le titre de l'écran qu'il ouvre : un seul libellé. */
    titre: "Touches et manette",
    fermer: "Fermer",
    explication:
      "Enregistrés sur ton compte : les mêmes réglages valent sur le site et dans l'Activité, seul ou à deux.",
    refuse: (code: number) => `Enregistrement refusé (${code}).`,
    /** « Cette partie » : la séance en cours, pas la progression. */
    sansReponse: "Le serveur ne répond pas : réglage gardé pour cette partie seulement.",
  },

  /** Ce qui arrête l'Activité, ou une de ses demandes au serveur. */
  erreurs: {
    reessayer: "Réessayer",
    /** La page ouverte dans un navigateur, sans Discord autour. */
    horsDiscord: "Cette page s'ouvre depuis Discord, en lançant l'Activité.",
    connexion: "La connexion à Discord a échoué.",
    connexionImpossible: (code: number) => `Connexion impossible (${code}).`,
    /** Les refus de l'ouverture de session que leur code suffit à reconnaître : 401, 429, 503. */
    nonReconnu: "Discord n'a pas reconnu cette connexion.",
    tropDeTentatives: "Trop de tentatives. Réessaie dans un instant.",
    jeuIntrouvable: "Le jeu de cette Activité est introuvable.",
    /** On s'arrête là : démarrer sans la partie existante finirait par l'écraser. */
    partieNonRecuperee: (code: number) => `Ta partie n'a pas pu être récupérée (${code}).`,
    jeuIndisponible: (code: number) => `Jeu indisponible (${code}).`,
    coeur: "Le cœur d'émulation n'a pas pu démarrer.",
    demarrage: "Le jeu n'a pas pu démarrer.",
    /** Une réponse inattendue, sans autre explication que son code. */
    reponse: (code: number) => `Le serveur a répondu ${code}.`,
  },

  /**
   * Les refus que les routes de l'Activité renvoient dans leur réponse
   * (`src/app/api/discord/`). Le serveur les écrit dans la langue de la
   * requête : l'écran peut donc les afficher tels quels quand un code HTTP ne
   * suffit pas à dire ce qui s'est passé.
   */
  serveur: {
    requeteIllisible: "Requête illisible.",
    actionInconnue: "Action inconnue.",
    codeManquant: "Code d'autorisation manquant.",
    essaiLocalDesactive: "Essai local désactivé.",
    /** L'Activité est réservée à un serveur Discord, et le joueur la lance ailleurs. */
    horsServeur: "Cette Activité ne se joue que dans son serveur Discord.",
    /** L'Activité est réservée à certains rôles du serveur, et le joueur n'en porte aucun. */
    sansRole: "Cette Activité est réservée à certains rôles de ce serveur, et tu n'en as aucun.",
    /** Les rôles n'ont pas pu être lus : un réglage à revoir, pas une faute du joueur. */
    rolesInverifiables:
      "Tes rôles dans ce serveur n'ont pas pu être vérifiés. Réessaie dans un instant ; si cela dure, préviens les responsables du serveur.",
    compteDesactive: "Ce compte est désactivé.",
    emplacementInvalide: "Emplacement invalide.",
    etatVide: "État vide.",
    pasUneVignette: "Ce n'est pas une vignette.",
    pasDEtat: "Pas d'état à cet emplacement.",
    etatTropGros: "État trop volumineux.",
    sauvegardeVide: "Sauvegarde vide.",
    sauvegardeTropGrosse: "Ce fichier est trop gros pour être une sauvegarde.",
    revisionInvalide: "Révision invalide.",
    conflit: "Cette partie a été sauvegardée ailleurs depuis que tu as commencé. Ta sauvegarde n'a pas été écrasée.",
  },
};
