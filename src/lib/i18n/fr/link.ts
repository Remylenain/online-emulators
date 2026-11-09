/**
 * Le câble link : la section de la fiche d'un jeu, la page d'un salon, et ce
 * que le serveur du câble link dit aux joueurs.
 *
 * Trois mots à tenir. Le **salon** est l'endroit où deux joueurs se
 * retrouvent, désigné par son **code** de six caractères. La **partie** est
 * tantôt la séance en cours (« la partie n'a pas commencé »), tantôt la
 * progression de chacun (« les deux parties sont enregistrées »). Le
 * **serveur** est celui du site, qui fait tourner les deux consoles.
 *
 * Un code de salon s'écrit entre astérisques, « *ABC123* » : c'est l'écran
 * qui lui donne sa chasse fixe (`AvecCode`), pour qu'on le recopie sans en
 * confondre les caractères.
 */

/** Le libellé du champ, que le message d'attente d'un salon privé cite mot pour mot. */
const REJOINDRE_AVEC_UN_CODE = "Rejoindre avec un code";

export const link = {
  /** Le titre de la section sur la fiche d'un jeu, et celui de l'onglet d'un salon. */
  titre: "Câble link",
  /** Le lien qui ramène d'un salon à son jeu : sous un salon complet, et à la fin d'une session. */
  retourFiche: "Retour à la fiche du jeu",

  /** La section « Câble link » de la fiche d'un jeu : ouvrir un salon, en rejoindre un, regarder. */
  fiche: {
    explication:
      "Deux joueurs, deux navigateurs : le jeu tourne sur le serveur, chacun voit sa console. " +
      "Échanges et combats comme avec un vrai câble.",
    /** Le compte a déjà un salon sur ce jeu : y retourner. */
    reprendre: (code: string) => `Reprendre mon salon ${code}`,
    complet:
      "Le serveur est au complet pour le moment : tous les salons sont pris. " +
      "Réessaie dans quelques minutes, ou rejoins un salon déjà ouvert.",
    ouvrir: "Ouvrir un salon",
    /** « Ici » : la liste des salons, sur cette fiche. */
    prive: "Privé : invisible ici, on y entre avec le code",
    spectateurs: "Visible par les spectateurs (cinq au plus)",
    dejaAilleurs: (code: string) => `Tu es déjà dans un salon sur un autre jeu (${code}).`,
    /** Ce qu'il reste de place, quand le serveur a une limite ; jamais zéro, que dit `complet`. */
    disponibles: (salons: number) =>
      salons === 1 ? "Dernier salon disponible sur le serveur" : `${salons} salons disponibles sur le serveur`,
    rejoindreAvecUnCode: REJOINDRE_AVEC_UN_CODE,
    rejoindre: "Rejoindre",
    /** Une partie en cours qu'on peut regarder. */
    enCours: (joueur1: string, joueur2: string) => `${joueur1} et ${joueur2} jouent`,
    /** À côté : les places de spectateur prises, sur celles qu'il y a. */
    places: (pris: number, max: number) => `${pris}/${max} spectateur${max > 1 ? "s" : ""}`,
    regarder: "Regarder",
    /** Un salon public qui attend son second joueur. */
    attend: (hote: string, code: string) => `${hote} attend dans le salon *${code}*`,
    creationImpossible: "Impossible de créer le salon.",
  },

  /** La page d'un salon, quand il n'y a pas de salon à montrer. */
  page: {
    introuvable: {
      titre: "Ce salon n'existe plus",
      explication:
        "Il a été fermé, ou le serveur a redémarré depuis. Les sauvegardes des joueurs n'ont pas bougé.",
      retour: "Retour à l'accueil",
    },
    /** Deux joueurs y sont déjà, et on ne peut pas y entrer en spectateur. */
    complet: {
      titre: "Ce salon est complet",
      explication: (joueur1: string, joueur2: string) =>
        `${joueur1} et ${joueur2} jouent, et l'hôte n'a pas ouvert la partie aux spectateurs.`,
    },
  },

  /** Le salon lui-même : l'écran, son bandeau, ses boutons. Le même sur le site et dans l'Activité Discord. */
  salon: {
    /** À la place du titre du jeu, tant que le serveur ne l'a pas donné. */
    sansTitre: "Salon",
    /** Dans le bandeau, en minuscules : une étiquette, pas une phrase. De même pour les quatre suivants. */
    code: (code: string) => `salon *${code}*`,
    tuRegardes: "tu regardes",
    spectateurs: (nombre: number, max: number) =>
      nombre === 0 ? `aucun spectateur (sur ${max})` : `${nombre} spectateur${nombre > 1 ? "s" : ""} (sur ${max})`,
    deconnecte: "déconnecté",
    /** La place du second joueur, tant qu'elle est vide. */
    enAttente: "— en attente —",
    /** Le joueur lui-même, dans la liste des présents. */
    toi: (pseudo: string) => `${pseudo} (toi)`,
    /** Sous l'écran d'un joueur dont le serveur n'a pas encore donné le pseudo, côté spectateur. */
    joueur: (numero: number) => `Joueur ${numero}`,

    connexionEchouee: "La connexion au salon a échoué.",

    /** Ce que lit l'hôte tant qu'il est seul. */
    attente: {
      /** Dans l'Activité Discord : pas de code, le salon vocal en tient lieu. `jouerADeux` est le libellé du bouton de l'accueil. */
      discord: (jouerADeux: string) =>
        `En attente du second joueur : il doit ouvrir l'Activité dans ce salon vocal et choisir « ${jouerADeux} ».`,
      prive: (code: string) =>
        "Salon privé : il n'apparaît pas sur la fiche du jeu. Donne ce code à ton partenaire, " +
        `il le saisira dans « ${REJOINDRE_AVEC_UN_CODE} » : *${code}*.`,
      publique: (code: string) =>
        `En attente d'un second joueur. Dis-lui d'ouvrir la fiche du jeu et de rejoindre le salon *${code}*.`,
    },

    /** La question posée avant de terminer (`window.confirm`). Le « vos » s'adresse aux deux joueurs. */
    confirmerFin: "Terminer la session ? Les deux parties seront enregistrées sur vos comptes.",
    terminer: "Terminer et enregistrer",
    /** Partir en laissant le salon ouvert : on peut y revenir, la partie continue sur le serveur. */
    quitterSansTerminer: "Quitter sans terminer",
    arreterDeRegarder: "Arrêter de regarder",
    /** Dans l'Activité Discord, à la place du lien vers la fiche. */
    retour: "Retour",

    aide:
      "Les touches sont celles de ton compte. Le jeu tourne sur le serveur : " +
      "tu peux changer d'onglet, la partie continue.",
    /** Un spectateur voit deux consoles et n'en entend qu'une ; `pseudo` manque tant que le serveur ne l'a pas donné. */
    sonSpectateur: (pseudo: string | null) =>
      `Tu entends la console de ${pseudo ?? "gauche"}. Le son démarre au premier clic.`,

    /** L'écran de fin. La raison, entre parenthèses dessous, vient de `fins`. */
    fin: {
      titre: "Session terminée",
      spectateur: "La partie est finie.",
      enregistree: "Les deux parties sont enregistrées sur vos comptes.",
      nonEnregistree:
        "Les parties n'ont pas été enregistrées : vos sauvegardes d'avant la session sont intactes.",
    },
  },

  /**
   * Les refus et les erreurs du serveur. Il les envoie sous forme de code,
   * faute de connaître la langue du joueur ; `src/lib/link/textes.ts` choisit
   * ici le texte.
   */
  erreurs: {
    nonConnecte: "Non connecté.",
    requeteIllisible: "Requête illisible.",
    methodeNonPermise: "Méthode non permise.",
    erreurInterne: "Erreur interne.",
    dejaDansLeSalon: (code: string) => `Tu es déjà dans le salon ${code}.`,
    jeuIntrouvable: "Jeu introuvable.",
    consoleSansLink: "Le câble link n'est pas encore disponible pour cette console.",
    /** Le budget de processeur réservé au câble link ne tient même pas un salon de cette console. */
    margeInsuffisante:
      "Le câble link n'a pas assez de processeur réservé pour cette console. " +
      "L'administrateur peut relever la marge dans les réglages.",
    serveurComplet: (salons: number) =>
      `Le serveur est au complet : ${salons} salon${salons > 1 ? "s" : ""} en cours. Réessaie dans quelques minutes.`,
    /** Dans l'Activité Discord, où les salons font la queue quand le serveur est plein. */
    fileDAttente: "D'autres salons attendent avant le tien.",
    salonComplet: "Ce salon est déjà complet.",
    dejaDansUnAutreSalon: "Tu es déjà dans un autre salon.",
    /** À qui tente de regarder le salon où il joue. */
    joueurDuSalon: "Tu es joueur dans ce salon.",
    spectateursFermes: "L'hôte n'a pas ouvert ce salon aux spectateurs.",
    partiePasCommencee: "La partie n'a pas commencé.",
    spectateursAuComplet: (max: number) => `Déjà ${max} spectateurs : c'est le maximum.`,
    salonNonDemarre: "Le salon n'a pas pu démarrer.",
    demarrageImpossible: "Démarrage impossible.",
  },

  /**
   * Pourquoi une session s'est terminée. S'affiche entre parenthèses sous le
   * message de fin : ni majuscule, ni point.
   */
  fins: {
    demande: (pseudo: string) => `à la demande de ${pseudo}`,
    coeurEchoue: "le cœur a échoué",
    filPlante: "le fil de travail a planté",
    /** Sans son hôte, un salon se ferme au bout de cinq minutes. */
    hoteAbsent: (pseudo: string) => `${pseudo} a quitté le salon depuis cinq minutes`,
    abandon: "salon abandonné",
  },

  /**
   * Les erreurs d'un cœur d'émulation, au démarrage. Celles du câble link
   * arrivent par un code, comme `erreurs` ; les mêmes textes servent aux
   * cœurs qui tournent dans le navigateur (`src/lib/emulator`), à qui l'on
   * passe cet objet. Le nombre entre parenthèses est la réponse du cœur,
   * quand il en donne une.
   */
  coeur: {
    jeuRefuse: (code: number | null) =>
      code === null ? "Le cœur a refusé ce jeu." : `Le cœur a refusé ce jeu (${code}).`,
    romRefusee: (code: number | null) =>
      code === null ? "Le cœur a refusé cette ROM." : `Le cœur a refusé cette ROM (${code}).`,
    sauvegardeRefusee: (code: number) => `La sauvegarde n'a pas été acceptée (${code}).`,
    sauvegardeDuJoueurRefusee: (joueur: number, code: number) =>
      `La sauvegarde du joueur ${joueur} n'a pas été acceptée (${code}).`,
    sansMemoire: (joueur: number) => `Le cœur n'a pas de mémoire de sauvegarde pour le joueur ${joueur}.`,
    /** Le fichier du cœur est arrivé, mais n'a rien installé : mauvais fichier, ou build cassé. */
    nonDeclare: "Le cœur d'émulation s'est chargé sans se déclarer.",
    nonTelecharge: "Le cœur d'émulation n'a pas pu être téléchargé.",
  },
};
