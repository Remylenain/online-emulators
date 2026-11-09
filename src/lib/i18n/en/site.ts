import type { Dictionnaire } from "../dictionnaires";

export const site: Dictionnaire["site"] = {
  navigation: {
    principale: "Main navigation",
    consoles: "Consoles",
    accueil: "Home",
    mesJeux: "My games",
  },

  menu: {
    monCompte: "My account",
    administration: "Administration",
    deconnexion: "Sign out",
  },

  recherche: {
    titre: "Search for a game",
    bouton: "Search",
    indication: "Title, author, base game…",
    aide: "Type at least two letters. Arrow keys to choose, Enter to open, Esc to close.",
    enCours: "Searching…",
    rien: (saisie: string) => `Nothing matches “${saisie}”.`,
    resultats: (nombre: number) => `${nombre} game${nombre === 1 ? "" : "s"}`,
    nonConnecte: "Not signed in.",
  },

  piedDePage: "Private library. Save files are tied to your account.",

  voirComme: {
    vuComme: "You are viewing the site as {compte}",
    precision: (connecte: string) => ` (signed in as ${connecte}). Anything you do here counts for that account.`,
    revenir: "Back to my account",
  },

  format: {
    duree: {
      moinsDUneMinute: "less than a minute",
      minutes: (minutes: number) => `${minutes} min`,
      heures: (heures: number) => `${heures} h`,
      heuresEtMinutes: (heures: number, minutes: string) => `${heures} h ${minutes} min`,
    },
    taille: {
      octets: (valeur: string) => `${valeur} B`,
      kio: (valeur: string) => `${valeur} KiB`,
      mio: (valeur: string) => `${valeur} MiB`,
    },
  },
};
