import type { Dictionnaire } from "../dictionnaires";

export const adminReglages: Dictionnaire["adminReglages"] = {
  titreOnglet: "Settings",
  titre: "Settings",

  enregistrement: "Saving…",
  revenirAuServeur: "Go back to the server configuration",

  identite: {
    titre: "Site identity",
    nom: "Site name",
    aideNom: "Shown in the header, in browser tabs and on the sign-in page.",
    /** « Tagline » : la phrase sous le nom, pas un message de bienvenue. */
    phraseDAccueil: "Tagline",
    aidePhraseDAccueil: "Below the name, on the sign-in page.",
    application: "Installed app name",
    aideApplication:
      "Below the icon, when the site is added to a phone's home screen. Empty: the site name. " +
      "A phone only shows a dozen characters or so.",
    langue: "Default language",
    aideLangue:
      "Each visitor sees the site in their browser's language, or in the one they choose. " +
      "This one is used for everyone else.",
    enregistrer: "Save",
  },

  vitrine: {
    titre: "Showcase: play without an account",
    explication:
      "When open, the home page shows a visitor without an account one button per game chosen below, and " +
      "nothing else. They play as a guest: their save, save states and settings stay in their browser. The " +
      "rest of the site still requires an account.",
    ouvrir: "Open these games to visitors without an account",
    bouton: (rang: number) => `Button ${rang}`,
    aideBouton: "Empty: the game's title.",
    jeuLance: "Game it starts",
    aucun: "None",
    depublie: (jeu: string) => `${jeu} (unpublished)`,
    enregistrer: "Save the showcase",
    retours: {
      libelleTropLong: (maximum: number) => `A button label cannot be longer than ${maximum} characters.`,
      jeuEnDouble: "The same game is chosen twice.",
      jeuDisparu: "One of the chosen games no longer exists.",
      jeuDepublie: (titre: string) =>
        `“${titre}” is not published: a guest could not start it. Publish it first.`,
      aucunJeu: "Choose at least one game before opening the showcase.",
      ouverte: "Showcase open: these games start without an account. Takes effect within a few seconds.",
      fermee: "Showcase closed: the whole site requires an account.",
    },
  },

  cableLink: {
    titre: "Link cable",
    processeur: "Processor",
    coeurs: (coeurs: number, pourLeCable: string, part: number) =>
      `${coeurs} core${coeurs === 1 ? "" : "s"}, ${pourLeCable} of them for the link cable at ${part}%`,
    salonGb: "One GB / GBC room",
    salonGba: "One GBA room",
    pasMesure: "not measured",
    /** Toujours au pluriel : en anglais, un nombre à virgule le prend (« 0.25 cores »). */
    cout: (coeur: string) => `${coeur} cores`,
    enCeMoment: "Right now",
    aucunSalon: "no room open",
    salonsOuverts: (salons: number, pris: string) =>
      `${salons} room${salons === 1 ? "" : "s"} open, ${pris} cores in use`,
    encore: (gb: number | null, gba: number | null) =>
      `room for ${gb ?? "∞"} more GB / GBC room${gb === 1 ? "" : "s"} or ${gba ?? "∞"} GBA`,
    sansLimite:
      "No limit for now. To set one, run `npm run link:capacite -- --appliquer` on the server: it measures " +
      "what a room of each console costs and saves it here.",
    part: "Share of the processor reserved for the link cable",
    aidePart: "In percent. The rest goes to the site itself. 60 to 70% leaves some headroom.",
    /** « margin », comme les réponses du serveur (`adminActions.reglages.link`). */
    enregistrer: "Save the margin",
  },

  mail: {
    titre: "Outgoing email",
    provenance: {
      reglages: "The relay is set here. It takes precedence over the server configuration.",
      serveur: "The relay comes from the server configuration. Saving this form replaces it, without a restart.",
      aucune: "The relay is not configured.",
    },
    hote: "SMTP host",
    exempleHote: "smtp-relay.example.com",
    port: "Port",
    /** Le mot des relais SMTP, plutôt que « ID ». */
    identifiant: "Username",
    aideIdentifiant: "The one the relay gives you, not necessarily the account's email address.",
    motDePasse: "SMTP password or key",
    motDePasseEnregistre: "A password is saved. Leave empty to keep it.",
    aucunMotDePasse: "No password saved.",
    expediteur: "Sender",
    aideExpediteur: "As it appears in messages. The address must be on a domain the relay accepts.",
    exempleExpediteur: "My site <games@example.com>",
    enregistrer: "Save the relay",
    destinataireDuTest: "Send a test email to",
    envoyerLeTest: "Send the test",
    envoi: "Sending…",
  },

  captcha: {
    titre: "Captcha (Cloudflare Turnstile)",
    provenance: {
      reglages: "The captcha is set here. It takes precedence over the server configuration.",
      serveur: "The captcha comes from the server configuration. Saving this form replaces it, without a restart.",
      aucune: "The captcha is not configured.",
    },
    explication:
      "It protects “Forgot password” and open sign-up. Both keys can be created for free in the Cloudflare " +
      "dashboard, under Turnstile.",
    cleDuSite: "Site key",
    aideCleDuSite: "Public: it is sent with the page.",
    cleSecrete: "Secret key",
    cleSecreteEnregistree: "A secret key is saved. Leave empty to keep it.",
    aucuneCleSecrete: "No secret key saved.",
    enregistrer: "Save the keys",
  },

  scraper: {
    titre: "Scraper (ScreenScraper)",
    explication:
      "Fills in the entries of official games from screenscraper.fr: description in French, year, cover. The " +
      "button is in Library. The API asks for two sets of credentials: the *member* one (your account), and " +
      "the *software* one, known as “developer”, which ScreenScraper issues on request through its forum. " +
      "Without the second, only libretro covers are looked up — they already cover most games.",
    identifiantDuCompte: "Account username",
    motDePasseDuCompte: "Account password",
    /** « ID », comme le paramètre `devid` de l'API. */
    identifiantDeveloppeur: "Developer ID",
    motDePasseDeveloppeur: "Developer password",
    motDePasseEnregistre: "Saved. Empty: unchanged.",
    aucunMotDePasse: "None saved.",
    enregistrer: "Save the account",
    effacer: "Clear the account",
  },
};
