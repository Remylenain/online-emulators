/**
 * Les écrans d'avant la connexion : se connecter, s'inscrire (sur invitation
 * ou librement), confirmer son inscription, retrouver son mot de passe.
 *
 * Les messages que renvoient les actions serveur (`src/lib/auth/actions.ts`)
 * sont rangés avec l'écran qui les affiche. Ceux des schémas de validation
 * ont leur propre dictionnaire (`validation`), les e-mails aussi (`emails`).
 */
export const connexion = {
  /** Le pied de page, quand la vitrine est fermée : rien ne se joue sans compte. */
  accesReserve: "Accès réservé aux comptes du site.",

  /** Les champs que plusieurs formulaires partagent, et l'aide écrite dessous. */
  champs: {
    email: "Adresse e-mail",
    pseudo: "Pseudo",
    /** Les mêmes bornes que `pseudoSchema`, dans `src/lib/validation.ts`. */
    aidePseudo: "De 3 à 24 caractères : lettres, chiffres, espaces, tirets et soulignés.",
    motDePasse: "Mot de passe",
    /** La même borne que `passwordSchema`. */
    aideMotDePasse: "Au moins 10 caractères. Une phrase dont tu te souviens vaut mieux qu'un mot compliqué.",
    /** La seconde saisie du mot de passe. */
    confirmation: "Confirmation",
  },

  /** Ce que plusieurs écrans disent dans les mêmes termes. */
  dejaUnCompte: "J'ai déjà un compte",
  /** Le titre affiché une fois un lien parti, à la place du formulaire. */
  boiteMail: "Vérifie ta boîte mail",
  envoi: "Envoi…",

  /** Les refus que plusieurs actions partagent. */
  erreurs: {
    tropDeTentatives: "Trop de tentatives. Réessaie plus tard.",
    tropDeDemandes: "Trop de demandes. Réessaie dans une heure.",
    captcha: "La vérification anti-robot a échoué. Recharge la page.",
    envoiMail: "L'envoi du mail a échoué. Préviens l'administrateur du site, le problème est de son côté.",
    pseudoPris: (pseudo: string) => `Le pseudo « ${pseudo} » est déjà pris.`,
    inscriptionsFermees: "Les inscriptions sont fermées : les comptes se créent sur invitation.",
  },

  /** L'écran de connexion lui-même. Son bouton est `commun.seConnecter`. */
  entree: {
    /** Le titre de l'écran, et celui de l'onglet. */
    titre: "Connexion",
    identifiant: "Pseudo ou adresse e-mail",
    enCours: "Connexion…",
    motDePasseOublie: "Mot de passe oublié ?",
    pasDeCompte: "Pas encore de compte ? Inscris-toi",
    tropDeTentatives: (minutes: number) =>
      `Trop de tentatives. Nouvel essai dans ${minutes} ${minutes > 1 ? "minutes" : "minute"}.`,
    /**
     * Le même message que le pseudo existe ou non : le formulaire ne doit pas
     * révéler qui a un compte.
     */
    identifiantsIncorrects: "Identifiant ou mot de passe incorrect.",
    compteDesactive: "Ce compte est désactivé. Contacte l'administrateur du site.",
  },

  /** L'inscription : par un lien d'invitation, ou ouverte à tous avec confirmation par e-mail. */
  inscription: {
    /** Le titre de l'onglet. */
    onglet: "Inscription",
    titre: "Crée ton compte",
    creer: "Créer mon compte",
    creation: "Création…",

    /** Avec un lien d'invitation : il ne reste qu'à choisir pseudo et mot de passe. */
    explicationInvitation:
      "Choisis le pseudo sous lequel tu joueras, et ton mot de passe. Tu seras connecté dans la foulée.",
    lienPerime:
      "Ce lien n'est plus valable : il a expiré, ou il a déjà servi. Demande un nouveau lien à l'administrateur.",

    /** Inscription ouverte : le compte n'existe qu'une fois l'adresse confirmée. */
    explicationOuverte:
      "Un lien de confirmation sera envoyé à ton adresse. Le compte n'est créé qu'une fois ce lien ouvert.",
    recevoirLeLien: "Recevoir le lien de confirmation",
    /**
     * « Si cette adresse est libre » : la réponse est la même quand un compte
     * la porte déjà, pour ne pas révéler qui est inscrit.
     */
    mailParti:
      "Si cette adresse est libre, un mail de confirmation vient d'y être envoyé. Il est valable une heure. Pense aux indésirables.",

    /** Sans lien, quand les inscriptions sont fermées. */
    surInvitation: {
      titre: "Inscription sur invitation",
      explication:
        "Les comptes se créent sur invitation : il te faut un lien donné par l'administrateur. " +
        "Si tu en as reçu un et qu'il semble tronqué, copie-le en entier.",
    },
  },

  /** La dernière étape de l'inscription ouverte : le lien reçu par e-mail. */
  confirmation: {
    onglet: "Confirmation",
    titre: "Confirme ton inscription",
    /** L'emphase porte sur le pseudo et sur l'adresse. */
    explication: (pseudo: string, email: string) =>
      `Le compte *${pseudo}* sera créé avec l'adresse *${email}*, et tu seras connecté dans la foulée.`,
    lienInvalide: {
      titre: "Lien invalide",
      explication:
        "Ce lien n'est plus valable : il a expiré, il a déjà servi, ou les inscriptions sont fermées. " +
        "Tu peux refaire une demande.",
      refaire: "Refaire une demande",
    },
    /** Le formulaire envoyé sans son jeton. */
    lienIncomplet: "Lien incomplet.",
    erreurs: {
      lienPerime: "Ce lien n'est plus valable : il a expiré, ou il a déjà servi. Refais une demande d'inscription.",
      pseudoPris: "Ce pseudo a été pris entre-temps. Refais une demande avec un autre pseudo.",
      adressePrise: "Un compte existe déjà avec cette adresse. Connecte-toi, ou demande un nouveau mot de passe.",
    },
  },

  /** Mot de passe oublié : demander un lien de réinitialisation. */
  oubli: {
    /** Le titre de l'écran, et celui de l'onglet. */
    titre: "Mot de passe oublié",
    explication:
      "Indique l'adresse e-mail de ton compte : un lien de réinitialisation valable une heure y sera envoyé.",
    sansAdresse:
      "Pas d'adresse e-mail sur ton compte ? Demande à l'administrateur de te donner un nouveau mot de passe.",
    envoyer: "Envoyer le lien",
    retour: "Retour à la connexion",
    /** Sans relais d'e-mails, aucun lien ne peut partir : l'écran le dit à la place du formulaire. */
    sansMail:
      "Demande à l'administrateur du site : il te donnera un nouveau mot de passe, que tu pourras ensuite changer depuis ton compte.",
    /** La réponse de l'action dans le même cas, si le formulaire est envoyé malgré tout. */
    demandeAdministrateur: "Demande à l'administrateur de te donner un nouveau mot de passe.",
    /** « Si un compte correspond » : la réponse est la même qu'il existe ou non. */
    lienParti:
      "Si un compte correspond à cette adresse, un lien de réinitialisation vient d'y être envoyé. Il est valable une heure.",
  },

  /**
   * Choisir un mot de passe, par le lien reçu. Le même écran sert à deux
   * situations : reprendre la main sur un compte, ou en ouvrir un pour la
   * première fois (`bienvenue`) — où parler de « réinitialisation » à
   * quelqu'un qui n'a jamais eu de mot de passe serait déroutant.
   */
  reinitialisation: {
    /** Le titre de l'onglet, commun aux deux situations. */
    onglet: "Mot de passe",
    /** Le titre de l'écran, et le libellé du champ. */
    titre: "Nouveau mot de passe",
    changer: "Changer le mot de passe",
    enCours: "Enregistrement…",
    fait: "C'est fait",
    modifie: "Mot de passe modifié. Tu peux te connecter.",
    lienPerime: "Ce lien n'est plus valable : il a expiré, ou il a déjà servi. Demandes-en un nouveau.",
    lienIncomplet: {
      titre: "Lien incomplet",
      explication:
        "Ce lien ne contient pas de jeton de réinitialisation. Il a peut-être été tronqué par ton client mail : " +
        "copie-le en entier, ou demande-en un nouveau.",
      demander: "Demander un nouveau lien",
    },
    /** Le lien d'une invitation : un compte neuf, qui n'a pas encore de mot de passe. */
    bienvenue: {
      titre: "Choisis ton mot de passe",
      explication: "Ton compte est prêt. Il ne manque que le mot de passe avec lequel tu te connecteras.",
      enregistrer: "Enregistrer et continuer",
      fait: "Bienvenue",
      enregistre: "Ton mot de passe est enregistré. Tu peux te connecter et commencer à jouer.",
    },
  },
};
