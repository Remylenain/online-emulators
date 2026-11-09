import type { Dictionnaire } from "../dictionnaires";

/** En anglais, tout prend le pluriel sauf un : « 0 accounts », « 1 account ». */
const s = (n: number) => (n === 1 ? "" : "s");

export const adminComptes: Dictionnaire["adminComptes"] = {
  titre: "Accounts",

  ligne: {
    admin: "admin",
    desactive: "deactivated",
    mode: (mode: string, jeux: number) => `${mode.toLowerCase()} · ${jeux} game${s(jeux)}`,
    /** « save files » : ce qui est compté, ce sont les fichiers de sauvegarde du compte. */
    resume: (email: string | null, parties: number, depuis: string) =>
      `${email ?? "no email address"} · ${parties} save file${s(parties)} · since ${depuis}`,
    gerer: "Manage",
    fermer: "Close",
  },

  modes: {
    normal: { libelle: "Normal", detail: "the whole published catalog" },
    restreint: { libelle: "Restricted", detail: "only the checked games" },
    testeur: { libelle: "Tester", detail: "the published catalog, plus the checked games" },
  },

  acces: {
    titre: "Catalog access",
    /** Le libellé garde sa majuscule : il ouvre le texte. */
    option: (mode: string) => `${mode} access`,
    jeuxAttribues: (n: number) => `Assigned games (${n})`,
  },

  connexion: {
    titre: "Sign-in",
    lienAcces: "Access link",
    nouveauMotDePasse: "New password",
    voirComme: (pseudo: string) => `View the site as ${pseudo}`,
  },

  sauvegardes: {
    titre: "Saves",
    importer: "Import a save file",
    /** « Reset account », comme la question qui suit, et non « Reset » seul, qu'on prendrait pour le mot de passe. */
    remettreAZero: "Reset account",
    confirmerRemiseAZero: (pseudo: string) =>
      `Reset ${pseudo}'s account? Save files, backup copies, ` +
      "save states, play time and ratings will be erased. The account and its password are kept.",
  },

  compte: {
    titre: "Account",
    retirerAdmin: "Remove admin",
    passerAdmin: "Make admin",
    desactiver: "Deactivate",
    reactiver: "Reactivate",
    supprimer: "Delete permanently",
    confirmerSuppression: (pseudo: string) =>
      `Permanently delete ${pseudo}'s account? ` +
      "The account, its save files, backup copies, save states, play time, " +
      "ratings, favorites and settings will be erased. This cannot be undone.",
    cEstToi: "That's you.",
    dossier: (identifiant: string) => `folder ${identifiant}`,
    dossierInfobulle: "Name of the folder holding this account's saves on the server",
  },

  attribution: {
    testeur: "Unpublished games this tester can see, on top of the catalog.",
    restreint: "The only games this account will see.",
    aucunJeu: "No games to offer.",
    nonPublie: "unpublished",
    enregistrement: "Saving…",
    enregistrer: "Save",
    fermer: "Close",
  },

  importation: {
    explication: (pseudo: string) =>
      `Save file to put on *${pseudo}*'s account. ` +
      "Their current save for this game, if there is one, goes to the backup copies.",
    jeu: "Game",
    fichier: "Save file",
    choisirLeJeu: "Choose the game…",
    enCours: "Importing…",
    importer: "Import",
    fermer: "Close",
  },

  creation: {
    nouveauxComptes: "New accounts",
    titre: "Create an account",
    pseudo: "Username",
    email: "Email address (optional)",
    administrateur: "Administrator",
    enCours: "Creating…",
    creer: "Create account",
  },

  transmission: {
    lienEnvoye: "Link sent by email. Pass it on directly too if needed — and mention the spam folder.",
    lienATransmettre: "Link to pass on: the person will choose their password there. Valid for one week.",
    motDePasse: "Or this password, to give in person. It will not be shown again.",
    copier: "copy",
    copie: "copied",
  },

  /** « sign-up link », d'après « sign up » ; le lien d'invitation, lui, est celui d'un compte déjà créé. */
  liens: {
    titre: "Or let people sign up",
    explication:
      "A link to hand out: each person picks their own username and password there. It expires after " +
      "24 hours and is good for the number of accounts chosen here. Anyone with the link can create " +
      "an account: if it spreads too far, revoke it — the accounts it created are listed below.",
    pour: "For",
    plafond: (n: number) => (n === 1 ? "a single account" : `up to ${n} accounts`),
    nombreDeComptes: "Number of accounts",
    creer: "Create a sign-up link",
    lien: (creeLe: string, utilises: number, maximum: number) =>
      `Link created ${creeLe} · ${utilises}/${maximum} account${s(maximum)}`,
    valableJusquAu: (date: string) => `valid until ${date}`,
    epuise: "used up",
    expire: "expired or revoked",
    aDonne: (pseudos: string[]) => `Accounts created: ${pseudos.join(", ")}`,
    revoquer: "Revoke",
  },

  inscriptions: {
    titre: "Sign-ups",
    explication:
      "When closed, an account can only come from an invitation. When open, anyone can " +
      "sign up with a confirmed email address, behind a captcha — and access " +
      "the whole catalog.",
    prerequis:
      "Opening sign-ups requires a mail server (SMTP) and a Turnstile captcha configured " +
      "in the server's environment. Without them, sign-ups stay closed.",
    fermees: "Closed, by invitation only",
    ouvertes: "Open to everyone, with confirmed email and captcha",
  },
};
