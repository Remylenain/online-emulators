/**
 * L'onglet « Comptes » de l'administration : la liste, ce qu'on fait d'un
 * compte une fois sa ligne dépliée, puis les trois façons d'en faire naître
 * de nouveaux (création directe, lien d'inscription, inscriptions ouvertes).
 *
 * Les messages de réussite et d'échec qui s'affichent en haut de la page ne
 * sont pas ici : ils viennent des actions serveur (`adminActions`).
 *
 * Les dates arrivent déjà mises en forme ; les nombres, tels quels.
 */

const s = (n: number) => (n > 1 ? "s" : "");

export const adminComptes = {
  titre: "Comptes",

  /** Une ligne de la liste, repliée. */
  ligne: {
    /** Les étiquettes, en minuscules, à côté du pseudo. */
    admin: "admin",
    desactive: "désactivé",
    /** Un compte rattaché à Discord : venu de l'Activité, son pseudo est son nom Discord. */
    discord: "discord",
    /** Pour un compte restreint ou testeur ; `mode` est son libellé, pris dans `modes`. */
    mode: (mode: string, jeux: number) => `${mode.toLowerCase()} · ${jeux} jeu${jeux > 1 ? "x" : ""}`,
    /**
     * Sous le pseudo. Les « parties sauvegardées » sont les fichiers de
     * sauvegarde du compte : un par jeu auquel il a joué.
     */
    resume: (email: string | null, parties: number, depuis: string) =>
      `${email ?? "sans adresse e-mail"} · ${parties} partie${s(parties)} sauvegardée${s(parties)} · depuis le ${depuis}`,
    gerer: "Gérer",
    fermer: "Fermer",
  },

  /**
   * Les modes d'accès au catalogue, dans la forme qu'attend `modesAcces()`
   * (`src/lib/modes-acces.ts`). Le détail complète une phrase : pas de
   * majuscule, pas de point.
   */
  modes: {
    normal: { libelle: "Normal", detail: "tout le catalogue publié" },
    restreint: { libelle: "Restreint", detail: "seulement les jeux cochés" },
    testeur: { libelle: "Testeur", detail: "le catalogue publié, plus les jeux cochés" },
  },

  acces: {
    titre: "Accès au catalogue",
    /** Un choix de la liste déroulante ; `mode` est son libellé, pris dans `modes`. */
    option: (mode: string) => `Accès ${mode.toLowerCase()}`,
    jeuxAttribues: (n: number) => `Jeux attribués (${n})`,
  },

  connexion: {
    titre: "Connexion",
    /** Redonne au compte un lien où choisir son mot de passe. */
    lienAcces: "Lien d'accès",
    nouveauMotDePasse: "Nouveau mot de passe",
    voirComme: (pseudo: string) => `Voir le site comme ${pseudo}`,
  },

  sauvegardes: {
    titre: "Sauvegardes",
    importer: "Importer une sauvegarde",
    remettreAZero: "Remettre à zéro",
    /** Question posée avant d'agir (`window.confirm`) : dit ce qui part et ce qui reste. */
    confirmerRemiseAZero: (pseudo: string) =>
      `Remettre à zéro le compte de ${pseudo} ? Sauvegardes, copies de secours, ` +
      "points de reprise, temps de jeu et notes seront effacés. Le compte et son mot de passe restent.",
  },

  compte: {
    titre: "Compte",
    retirerAdmin: "Retirer admin",
    passerAdmin: "Passer admin",
    desactiver: "Désactiver",
    reactiver: "Réactiver",
    supprimer: "Supprimer définitivement",
    /** Question posée avant d'agir (`window.confirm`) : la seule action qui ne se défait pas. */
    confirmerSuppression: (pseudo: string) =>
      `Supprimer définitivement le compte de ${pseudo} ? ` +
      "Le compte, ses sauvegardes, copies de secours, points de reprise, temps de jeu, " +
      "notes, favoris et réglages seront effacés. C'est irréversible.",
    /** À la place des boutons, sur son propre compte. */
    cEstToi: "C'est toi.",
    /** L'identifiant du compte, qui est aussi le nom de son dossier sur le serveur. */
    dossier: (identifiant: string) => `dossier ${identifiant}`,
    dossierInfobulle: "Nom du dossier de ses sauvegardes sur le serveur",
  },

  /** Les jeux attribués à un compte restreint ou testeur. */
  attribution: {
    testeur: "Jeux non publiés que ce testeur peut voir, en plus du catalogue.",
    restreint: "Les seuls jeux que ce compte verra.",
    aucunJeu: "Aucun jeu à proposer.",
    nonPublie: "non publié",
    enregistrement: "Enregistrement…",
    enregistrer: "Enregistrer",
    fermer: "Fermer",
  },

  /** Le dépôt d'un fichier de sauvegarde sur le compte de quelqu'un. */
  importation: {
    /** L'emphase porte sur le pseudo. */
    explication: (pseudo: string) =>
      `Sauvegarde à déposer sur le compte de *${pseudo}*. ` +
      "Sa sauvegarde actuelle pour ce jeu, s'il en a une, part dans les copies de secours.",
    /** Les noms des deux champs, pour les lecteurs d'écran. */
    jeu: "Jeu",
    fichier: "Fichier de sauvegarde",
    choisirLeJeu: "Choisir le jeu…",
    enCours: "Import…",
    importer: "Importer",
    fermer: "Fermer",
  },

  /** Créer soi-même le compte de quelqu'un. */
  creation: {
    /** Coiffe les trois panneaux du bas de la page. */
    nouveauxComptes: "Nouveaux comptes",
    titre: "Créer un compte",
    pseudo: "Pseudo",
    email: "Adresse e-mail (facultative)",
    administrateur: "Administrateur",
    enCours: "Création…",
    creer: "Créer le compte",
  },

  /**
   * Ce qu'on transmet à la personne une fois son compte créé ou son accès
   * refait : un lien, ou un mot de passe provisoire. Affiché une seule fois.
   */
  transmission: {
    lienEnvoye: "Lien envoyé par mail. À transmettre aussi en direct si besoin — pense aux indésirables.",
    lienATransmettre: "Lien à transmettre : la personne y choisira son mot de passe. Valable une semaine.",
    motDePasse: "Ou ce mot de passe, à donner de vive voix. Il ne sera plus affiché.",
    copier: "copier",
    copie: "copié",
  },

  /** Les liens d'inscription : chacun y crée son propre compte. */
  liens: {
    titre: "Ou laisser les gens s'inscrire",
    explication:
      "Un lien à donner : chacun y choisit son pseudo et son mot de passe. Il expire au bout " +
      "de la durée choisie ici et vaut pour le nombre de comptes choisi ici. Qui a le lien peut créer " +
      "un compte : plus il vit longtemps, plus il a le temps de circuler. S'il circule trop, révoque-le, " +
      "les comptes qu'il a donnés sont listés dessous.",
    /** Précède la liste déroulante, qui finit la phrase : « Pour 5 comptes au plus ». */
    pour: "Pour",
    plafond: (n: number) => (n === 1 ? "un seul compte" : `${n} comptes au plus`),
    /** Le nom de la liste déroulante, pour les lecteurs d'écran. */
    nombreDeComptes: "Nombre de comptes",
    /** Précède la seconde liste déroulante, qui finit la phrase : « valable 7 jours ». */
    valable: "valable",
    duree: (jours: number) => (jours === 1 ? "24 heures" : `${jours} jours`),
    /** Le nom de cette liste, pour les lecteurs d'écran. */
    dureeDeValidite: "Durée de validité",
    creer: "Créer un lien d'inscription",
    /** Un lien déjà créé : sa date, puis combien de comptes il a donnés sur combien. */
    lien: (creeLe: string, utilises: number, maximum: number) =>
      `Lien du ${creeLe} · ${utilises}/${maximum} compte${s(maximum)}`,
    valableJusquAu: (date: string) => `valable jusqu'au ${date}`,
    epuise: "épuisé",
    /** Les deux ne se distinguent pas ici : un lien révoqué est un lien qu'on a fait expirer. */
    expire: "expiré ou révoqué",
    /** Les pseudos des comptes nés de ce lien. */
    aDonne: (pseudos: string[]) => `A donné : ${pseudos.join(", ")}`,
    revoquer: "Révoquer",
  },

  /** Inscriptions fermées (sur invitation) ou ouvertes à tous. */
  inscriptions: {
    titre: "Inscriptions",
    explication:
      "Fermées, un compte ne naît que d'une invitation. Ouvertes, n'importe qui peut " +
      "s'inscrire avec une adresse e-mail confirmée, derrière un captcha — et accéder à " +
      "tout le catalogue.",
    prerequis:
      "L'ouverture demande un serveur de mail (SMTP) et un captcha Turnstile configurés " +
      "dans l'environnement du serveur. Sans eux, les inscriptions restent fermées.",
    fermees: "Fermées, sur invitation",
    ouvertes: "Ouvertes à tous, avec e-mail confirmé et captcha",
  },
};
