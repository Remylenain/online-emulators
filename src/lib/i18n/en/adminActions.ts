import type { Dictionnaire } from "../dictionnaires";

export const adminActions: Dictionnaire["adminActions"] = {
  comptes: {
    voirComme: {
      nonConnecte: "Not signed in.",
      reserve: "Administrators only.",
      dejaToi: "This is already your account.",
      introuvable: "Account not found.",
      desactive: "This account has been deactivated.",
    },
    introuvable: "Account not found.",
    pseudoInvalide: "Invalid username.",
    adresseInvalide: "Invalid email address.",
    adresseDejaPrise: (adresse: string) => `An account already uses the address ${adresse}.`,
    pseudoDejaPris: (pseudo: string) => `The username “${pseudo}” is already taken.`,
    cree: (pseudo: string) => `Account created for ${pseudo}.`,
    nouveauLien: (pseudo: string) => `New link for ${pseudo}.`,
    nouveauMotDePasse: (pseudo: string) => `New password for ${pseudo}.`,

    modeInconnu: "Unknown mode.",
    /** « Checked » : les jeux cochés dans la liste du même écran. */
    acces: {
      normal: "Normal access: the whole published catalog.",
      restreint: "Restricted access: only the checked games.",
      testeur: "Tester access: the published catalog, plus the checked games.",
    },
    jeuxAttribues: (nombre: number) => `${nombre} game${nombre === 1 ? "" : "s"} assigned.`,

    remisAZero: (pseudo: string) => `${pseudo}'s account has been reset.`,
    actif: (pseudo: string) => `${pseudo} is now active.`,
    /** « Deactivated », pas « disabled » : le même mot que le bouton, et que `desactiverDAbord`. */
    desactive: (pseudo: string) => `${pseudo} is now deactivated.`,
    administrateur: (pseudo: string) => `${pseudo} is now an administrator.`,
    plusAdministrateur: (pseudo: string) => `${pseudo} is no longer an administrator.`,
    desactiverDAbord: (pseudo: string) =>
      `Deactivate ${pseudo}'s account first: only a deactivated account can be deleted.`,
    supprime: (pseudo: string) => `${pseudo}'s account has been deleted, along with all its data.`,

    surSoi: {
      supprimer: "You cannot delete your own account.",
      desactiver: "You cannot deactivate your own account.",
      retirerDroits: "You cannot remove your own administrator rights.",
    },
  },

  invitations: {
    plafondInvalide: "Invalid number of accounts.",
    /** « Sign-up link » : la personne crée son compte elle-même, pseudo compris. */
    cree: "Sign-up link created.",
    aTransmettre: (plafond: number) =>
      "Link to pass on: the person will choose their username and password there. " +
      `Valid for 24 hours, for ${plafond === 1 ? "a single account" : `up to ${plafond} accounts`}.`,
    revoque: "Link revoked: it will not create any more accounts.",
    dejaRevoque: "This link was already revoked, or does not exist.",

    ouvertureImpossible: "Cannot open sign-ups: a mail server and a captcha must be configured first.",
    ouvertes: "Sign-ups are open: the sign-in page offers to create an account.",
    fermees: "Sign-ups are closed: only invitation links create accounts.",
  },

  sauvegardes: {
    choisirJeu: "Choose a game.",
    choisirFichier: "Choose a save file.",
    tropGros: "This file is too large to be a save file.",
    dejaLaMeme: (pseudo: string, jeu: string) =>
      `${pseudo} already had exactly this save file for ${jeu}.`,
    importee: (jeu: string, pseudo: string) =>
      `Save file for ${jeu} imported for ${pseudo}. The previous one, if any, is in the backup copies.`,
  },

  bibliotheque: {
    jeuIntrouvable: "Game not found.",
    /** Retouche → « edit », comme dans `adminBibliotheque` : une valeur saisie ici, face à celle du `game.json`. */
    retouchesImpossibles: "Cannot write to the edits folder on the server.",
    publie: (titre: string) => `${titre} is now published.`,
    retire: (titre: string) => `${titre} has been removed from the catalog.`,
    champInvalide: (champ: string | undefined, raison: string | undefined) =>
      `${champ ?? "Field"}: ${raison ?? "invalid value"}`,
    suitSonManifeste: (titre: string) => `${titre} follows its game.json entirely.`,
    enregistre: (titre: string, nombre: number) =>
      `${titre} saved — ${nombre} field${nombre === 1 ? "" : "s"} edited.`,
  },

  reglages: {
    identite: {
      nom: (min: number, max: number) => `The name must be between ${min} and ${max} characters long.`,
      description: (max: number) => `The description cannot exceed ${max} characters.`,
      application: (max: number) => `The application name cannot exceed ${max} characters.`,
      langueInconnue: "Unknown language.",
      enregistree: "Settings saved.",
    },

    valeurTropLongue: "One of the values is too long.",
    efface: "Setting cleared: the site goes back to the server's configuration.",

    /** Relais d'e-mails → « email relay », le mot des hébergeurs pour un serveur SMTP d'envoi. */
    mail: {
      hoteObligatoire: "The relay host is required.",
      port: (min: number, max: number) => `The port must be a number between ${min} and ${max}.`,
      enregistre: "Relay saved. Send yourself a test email to check it.",
      destinataireInvalide: "Invalid recipient address.",
      aucunRelais: "No email relay is configured.",
      test: {
        objet: "Test email",
        texte: "If you are reading this message, the site's email relay works.\n",
      },
      refus: (reponse: string | undefined) => `The relay refused: ${reponse ?? "unknown error"}`,
      envoye: (destinataire: string) => `Email sent to ${destinataire}. Check your spam folder too.`,
    },

    captcha: {
      cleObligatoire: (max: number) => `Site key required, ${max} characters at most.`,
      enregistre: "Keys saved.",
    },

    scraper: {
      /**
       * Cite le bouton (`adminBibliotheque.taches.completerLesFiches`) et
       * l'onglet de l'administration dans leur traduction : à tenir d'accord
       * avec eux.
       */
      enregistre: "Account saved. Run “Fill in the entries” from Library.",
      sansIdentifiant:
        "Saved, but without a developer ID ScreenScraper will not answer: only libretro covers will be looked up.",
      efface: "Account cleared.",
    },

    /** Sans espace avant « % » en anglais. */
    link: {
      marge: (min: number, max: number) => `The margin must be a whole number between ${min} and ${max}%.`,
      enregistree: "Margin saved: the limit applies right away.",
    },
  },
};
