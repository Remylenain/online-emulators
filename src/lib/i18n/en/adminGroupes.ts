import type { Dictionnaire } from "../dictionnaires";

/**
 * « Groupe » se dit « group », « règle » ne se dit pas : on dit ce que le
 * groupe ouvre (« what it opens »). « Rom hack » reste tel quel, comme dans
 * le catalogue.
 */

const s = (n: number) => (n === 1 ? "" : "s");

export const adminGroupes: Dictionnaire["adminGroupes"] = {
  titreOnglet: "Groups",
  titre: "Access groups",
  intro:
    "A group opens part of the catalog. An account can belong to several groups: it sees everything they open, " +
    "combined. With no group, it only sees the games assigned to it individually, in the Accounts tab. " +
    "An administrator sees the whole catalog, whatever their groups.",

  regles: {
    liste: { libelle: "A list of games", detail: "the games ticked for this group" },
    romhacks: {
      libelle: "All rom hacks",
      detail: "every published game that is not an official game, with no list to maintain",
    },
    tout: { libelle: "The whole library", detail: "the whole published catalog, with no list to maintain" },
  },

  nouveau: {
    titre: "New group",
    nom: "Name",
    regle: "What it opens",
    creer: "Create the group",
    creation: "Creating…",
  },

  aucun: "No group yet: only administrators see the catalog.",

  carte: {
    parDefaut: "default",
    resume: (membres: number, jeux: number | null) =>
      `${membres} member${s(membres)}` + (jeux === null ? "" : ` · ${jeux} game${s(jeux)}`),
    gerer: "Manage",
    fermer: "Close",
  },

  reglages: {
    titre: "Group settings",
    nom: "Name",
    regle: "What it opens",
    enregistrer: "Save",
    rendreParDefaut: "Make it the default group",
    plusParDefaut: "No longer the default group",
    aideParDefaut:
      "Every new account joins the default group: invitation link, open sign-up, account created here, " +
      "account born from a Discord Activity. One group at a time.",
    supprimer: "Delete the group",
    confirmerSuppression: (nom: string, membres: number) =>
      `Delete “${nom}”? ` +
      (membres > 0 ? `Its ${membres} member${s(membres)} lose what it opened to them.` : "It has no members."),
  },

  jeux: {
    titre: "Games of the group",
    sansListe: (detail: string) => `Nothing to tick: this group opens ${detail}.`,
    chercher: "Search for a game",
    toutesConsoles: "All consoles",
    tousTypes: "Rom hacks and official games",
    romhacks: "Rom hacks only",
    officiels: "Official games only",
    seulementCoches: "Ticked only",
    cocherAffiches: (n: number) => `Tick the ${n} shown`,
    decocherAffiches: (n: number) => `Untick the ${n} shown`,
    compte: (coches: number, total: number) => `${coches} ticked out of ${total}`,
    tronque: (montres: number, trouves: number) =>
      `${montres} games shown out of ${trouves}: narrow the search to see the others.`,
    aucun: "No game matches.",
    nonPublie: "unpublished",
    officiel: "official",
    enregistrer: "Save the list",
    enregistrement: "Saving…",
    nonEnregistre: "Unsaved changes.",
  },

  membres: {
    titre: "Members",
    chercher: "Search for an account",
    seulementCoches: "Members only",
    cocherSansGroupe: (n: number) => `Tick the ${n} account${s(n)} with no group`,
    compte: (coches: number, total: number) => `${coches} member${s(coches)} out of ${total} account${s(total)}`,
    aucun: "No account matches.",
    admin: "admin",
    discord: "discord",
    desactive: "disabled",
    enregistrer: "Save the members",
    enregistrement: "Saving…",
    nonEnregistre: "Unsaved changes.",
  },

  actions: {
    nomInvalide: "The name is between 1 and 60 characters long.",
    nomPris: "Another group already has this name.",
    regleInconnue: "Unknown rule.",
    introuvable: "This group no longer exists.",
    compteIntrouvable: "Account not found.",
    cree: (nom: string) => `Group “${nom}” created.`,
    modifie: (nom: string) => `Group “${nom}” saved.`,
    supprime: (nom: string) => `Group “${nom}” deleted.`,
    parDefaut: (nom: string) => `“${nom}” is now the default group: new accounts join it.`,
    plusParDefaut: (nom: string) => `“${nom}” is no longer the default group: a new account joins no group.`,
    jeux: (nom: string, nombre: number) => `“${nom}”: ${nombre} game${s(nombre)} in the list.`,
    membres: (nom: string, nombre: number) => `“${nom}”: ${nombre} member${s(nombre)}.`,
    groupesDuCompte: (pseudo: string, nombre: number) =>
      nombre === 0
        ? `${pseudo} is no longer in any group: they only see the games assigned to them.`
        : `${pseudo}: ${nombre} group${s(nombre)}.`,
  },
};
