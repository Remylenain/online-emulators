import type { Dictionnaire } from "../dictionnaires";

export const connexion: Dictionnaire["connexion"] = {
  accesReserve: "This site is for account holders only.",

  champs: {
    email: "Email address",
    pseudo: "Username",
    aidePseudo: "3 to 24 characters: letters, digits, spaces, hyphens and underscores.",
    motDePasse: "Password",
    aideMotDePasse: "At least 10 characters. A sentence you remember beats a complicated word.",
    /** Le libellé habituel du second champ, plutôt qu'un « Confirmation » sec. */
    confirmation: "Confirm password",
  },

  dejaUnCompte: "I already have an account",
  boiteMail: "Check your inbox",
  envoi: "Sending…",

  erreurs: {
    tropDeTentatives: "Too many attempts. Try again later.",
    tropDeDemandes: "Too many requests. Try again in an hour.",
    captcha: "The anti-bot check failed. Reload the page.",
    envoiMail: "The email could not be sent. Let the site administrator know: the problem is on their end.",
    pseudoPris: (pseudo: string) => `The username “${pseudo}” is already taken.`,
    inscriptionsFermees: "Sign-ups are closed: accounts are created by invitation.",
  },

  entree: {
    titre: "Sign in",
    identifiant: "Username or email address",
    enCours: "Signing in…",
    motDePasseOublie: "Forgot your password?",
    pasDeCompte: "No account yet? Sign up",
    tropDeTentatives: (minutes: number) =>
      `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    /** « Identifiant » couvre le pseudo et l'adresse : l'anglais nomme les deux. */
    identifiantsIncorrects: "Incorrect username, email address or password.",
    compteDesactive: "This account is disabled. Contact the site administrator.",
  },

  inscription: {
    onglet: "Sign up",
    titre: "Create your account",
    creer: "Create my account",
    creation: "Creating…",

    explicationInvitation:
      "Choose the username you'll play under, and your password. You'll be signed in right away.",
    lienPerime:
      "This link is no longer valid: it has expired, or it has already been used. Ask the administrator for a new one.",

    explicationOuverte:
      "A confirmation link will be sent to your address. The account is only created once that link is opened.",
    recevoirLeLien: "Send me the confirmation link",
    mailParti:
      "If this address is available, a confirmation email has just been sent to it. It is valid for one hour. Check your spam folder too.",

    surInvitation: {
      titre: "Sign-up by invitation",
      explication:
        "Accounts are created by invitation: you need a link from the administrator. " +
        "If you received one and it looks cut off, copy it in full.",
    },
  },

  confirmation: {
    onglet: "Confirmation",
    titre: "Confirm your sign-up",
    explication: (pseudo: string, email: string) =>
      `The account *${pseudo}* will be created with the address *${email}*, and you'll be signed in right away.`,
    lienInvalide: {
      titre: "Invalid link",
      explication:
        "This link is no longer valid: it has expired, it has already been used, or sign-ups are closed. " +
        "You can sign up again.",
      refaire: "Sign up again",
    },
    lienIncomplet: "Incomplete link.",
    erreurs: {
      lienPerime: "This link is no longer valid: it has expired, or it has already been used. Sign up again.",
      pseudoPris: "This username has been taken in the meantime. Sign up again with a different one.",
      adressePrise: "An account already exists with this address. Sign in, or request a new password.",
    },
  },

  oubli: {
    titre: "Forgot password",
    explication: "Enter your account's email address: a reset link, valid for one hour, will be sent to it.",
    sansAdresse: "No email address on your account? Ask the administrator to give you a new password.",
    envoyer: "Send the link",
    retour: "Back to sign in",
    sansMail:
      "Ask the site administrator: they will give you a new password, which you can then change from your account.",
    demandeAdministrateur: "Ask the administrator to give you a new password.",
    lienParti:
      "If an account matches this address, a reset link has just been sent to it. It is valid for one hour.",
  },

  reinitialisation: {
    onglet: "Password",
    titre: "New password",
    changer: "Change password",
    enCours: "Saving…",
    fait: "All done",
    modifie: "Password changed. You can now sign in.",
    lienPerime: "This link is no longer valid: it has expired, or it has already been used. Request a new one.",
    lienIncomplet: {
      titre: "Incomplete link",
      explication:
        "This link has no reset token. Your email client may have cut it off: " +
        "copy it in full, or request a new one.",
      demander: "Request a new link",
    },
    bienvenue: {
      titre: "Choose your password",
      explication: "Your account is ready. All it needs is the password you'll sign in with.",
      enregistrer: "Save and continue",
      fait: "Welcome",
      enregistre: "Your password is saved. You can sign in and start playing.",
    },
  },
};
