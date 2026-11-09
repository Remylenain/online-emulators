import type { Dictionnaire } from "../dictionnaires";

/** En anglais, tout prend le pluriel sauf un : « 0 accounts », « 1 account ». */
const s = (n: number) => (n === 1 ? "" : "s");

export const adminGeneral: Dictionnaire["adminGeneral"] = {
  coquille: {
    titre: "Administration",
    gabaritOnglet: "%s — Administration",
    resume: (comptes: number, publies: number, dernier: string | null) =>
      `${comptes} account${s(comptes)} · ${publies} game${s(publies)} in the catalog` +
      (dernier === null ? "" : ` · latest addition: ${dernier}`),
  },

  onglets: {
    tableau: "Dashboard",
    comptes: "Accounts",
    bibliotheque: "Library",
    temps: "Play time",
    reglages: "Settings",
    discord: "Discord",
  },

  tableau: {
    titre: "Dashboard",

    maintenant: {
      titre: "Right now",
      personne: "Nobody is playing solo.",
      joueA: (jeu: string) => `is playing ${jeu}`,
    },

    link: {
      titre: "Link cable",
      aucunSalon: "No open rooms.",
      salon: (jeu: string, joueurs: string[]) => `${jeu} — ${joueurs.join(" and ")}`,
      enAttente: "waiting",
      enJeu: "playing",
      prive: "private",
      spectateurs: (n: number) => `${n} spectator${s(n)}`,
      depuis: (date: string) => `since ${date}`,
      /** Sans espace avant « % » en anglais. */
      occupation: (pourcentage: number) => `${pourcentage}% of capacity in use`,
      /** « cores » : les cœurs du processeur, pas les cœurs d'émulation. */
      capacite: (c: {
        enCours: number;
        budget: number;
        marge: number;
        coeurs: number;
        gb: number | null;
        gba: number | null;
      }) =>
        `${c.enCours.toFixed(2)} core${s(c.enCours)} in use out of ${c.budget.toFixed(1)} reserved ` +
        `(${c.marge}% of ${c.coeurs} core${s(c.coeurs)}) — ` +
        `enough left for ${c.gb ?? "∞"} more GB / GBC room${s(c.gb ?? 2)} or ${c.gba ?? "∞"} GBA.`,
      nonMesuree: "Capacity not measured: no limit on rooms. See Settings.",
    },

    comptes: {
      titre: "Accounts",
      actifs: (n: number) => `${n} played in the past 7 days`,
    },
    jeux: {
      titre: "Published games",
      officiels: (n: number) => `${n} official`,
    },
    temps: {
      titre: "Play time",
      detail: (aujourdhui: string, total: string) => `past 7 days · ${aujourdhui} today · ${total} in all`,
    },
    sauvegardes: {
      titre: "Saves",
      /** « saves » et non « progress », qui ne se compte pas. */
      detail: (parties: number, copies: number, etats: number) =>
        `${parties} save${s(parties)} · ${copies} backup cop${copies === 1 ? "y" : "ies"} · ` +
        `${etats} save state${s(etats)}`,
    },

    connexions: {
      titre: "Latest sign-ins",
      aucune: "No sessions.",
    },

    appareil: {
      inconnu: "unknown device",
      navigateur: "browser",
      sur: (navigateur: string, systeme: string) => `${navigateur} on ${systeme}`,
    },

    serveur: {
      titre: "Server and library",
      service: "Service",
      demarre: (date: string, memoire: string, node: string) =>
        `started ${date} · ${memoire} of memory · Node ${node}`,
      charge: "Load",
      chargeSur: (moyennes: string, coeurs: number) => `${moyennes} on ${coeurs} core${s(coeurs)}`,
      periodes: "(1, 5 and 15 min)",
      disque: "Disk",
      disqueLibre: (libre: string, total: string) => `${libre} free of ${total}`,
      catalogue: "Catalog",
      etatDuCatalogue: (sansJaquette: number, depublies: number) =>
        `${sansJaquette} game${s(sansJaquette)} without a cover · ${depublies} unpublished`,
    },
  },

  temps: {
    titre: "Play time",
    resume: (total: string, comptes: number) =>
      `${total} of play time in all, across ${comptes} account${s(comptes)}.`,
    explication:
      "Play time is counted in heartbeats while a game is running, each capped at five minutes: " +
      "a forgotten tab does not inflate the numbers.",
    jamaisJoue: "has never played",
    compte: (nombreDeJeux: number, vuLe: string) => `${nombreDeJeux} game${s(nombreDeJeux)} · last seen ${vuLe}`,
    choisir: "Pick an account to see its breakdown by game.",
    detail: (pseudo: string) => `${pseudo}, game by game`,
    aucunePartie: "No play time recorded.",
    /** « sessions » : ici une partie est une fois où le jeu a été lancé, pas une progression. */
    ligne: (parties: number, derniere: string) => `${parties} session${s(parties)} · last on ${derniere}`,
  },
};
