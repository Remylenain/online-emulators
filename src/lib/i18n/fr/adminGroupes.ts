/**
 * L'onglet « Groupes » de l'administration : ce que chaque groupe ouvre du
 * catalogue, et qui en fait partie. La règle d'accès elle-même est dans
 * `src/lib/acces.ts`.
 */

const s = (n: number) => (n > 1 ? "s" : "");

export const adminGroupes = {
  titreOnglet: "Groupes",
  titre: "Groupes d'accès",
  intro:
    "Un groupe ouvre une partie du catalogue. Un compte peut appartenir à plusieurs groupes : il voit la réunion de " +
    "ce qu'ils ouvrent. Sans groupe, il ne voit que les jeux qu'on lui a attribués en propre, dans l'onglet Comptes. " +
    "Un administrateur voit tout le catalogue, quels que soient ses groupes.",

  /** Ce qu'un groupe ouvre. Le détail complète une phrase : pas de majuscule, pas de point. */
  regles: {
    liste: { libelle: "Une liste de jeux", detail: "les jeux cochés pour ce groupe" },
    romhacks: {
      libelle: "Toutes les rom hacks",
      detail: "tous les jeux publiés qui ne sont pas des jeux officiels, sans liste à tenir",
    },
    tout: { libelle: "Toute la bibliothèque", detail: "tout le catalogue publié, sans liste à tenir" },
  },

  nouveau: {
    titre: "Nouveau groupe",
    nom: "Nom",
    regle: "Ce qu'il ouvre",
    creer: "Créer le groupe",
    creation: "Création…",
  },

  aucun: "Aucun groupe pour l'instant : seuls les administrateurs voient le catalogue.",

  carte: {
    parDefaut: "par défaut",
    /** `jeux` : le nombre de jeux cochés, ou `null` quand la règle n'a pas de liste. */
    resume: (membres: number, jeux: number | null) =>
      `${membres} membre${s(membres)}` + (jeux === null ? "" : ` · ${jeux} jeu${jeux > 1 ? "x" : ""}`),
    gerer: "Gérer",
    fermer: "Fermer",
  },

  reglages: {
    titre: "Réglages du groupe",
    nom: "Nom",
    regle: "Ce qu'il ouvre",
    enregistrer: "Enregistrer",
    rendreParDefaut: "En faire le groupe par défaut",
    plusParDefaut: "Ne plus en faire le groupe par défaut",
    aideParDefaut:
      "Tout nouveau compte entre dans le groupe par défaut : lien d'invitation, inscription ouverte, " +
      "compte créé ici, compte né d'une Activité Discord. Un seul groupe à la fois.",
    supprimer: "Supprimer le groupe",
    confirmerSuppression: (nom: string, membres: number) =>
      `Supprimer « ${nom} » ? ` +
      (membres > 0 ? `Ses ${membres} membre${s(membres)} perdent ce qu'il leur ouvrait.` : "Il n'a aucun membre."),
  },

  jeux: {
    titre: "Jeux du groupe",
    /** À la place de la liste, pour une règle qui n'en a pas. `detail` : celui de la règle. */
    sansListe: (detail: string) => `Rien à cocher : ce groupe ouvre ${detail}.`,
    chercher: "Chercher un jeu",
    toutesConsoles: "Toutes les consoles",
    tousTypes: "Rom hacks et jeux officiels",
    romhacks: "Rom hacks seulement",
    officiels: "Jeux officiels seulement",
    seulementCoches: "Cochés seulement",
    cocherAffiches: (n: number) => `Cocher les ${n} affichés`,
    decocherAffiches: (n: number) => `Décocher les ${n} affichés`,
    compte: (coches: number, total: number) => `${coches} coché${s(coches)} sur ${total}`,
    /** Quand le filtre laisse plus de jeux que la liste n'en montre. */
    tronque: (montres: number, trouves: number) =>
      `${montres} jeux affichés sur ${trouves} : préciser la recherche pour voir les autres.`,
    aucun: "Aucun jeu ne correspond.",
    nonPublie: "non publié",
    officiel: "officiel",
    enregistrer: "Enregistrer la liste",
    enregistrement: "Enregistrement…",
    /** Rappel tant que des cases ont bougé sans être enregistrées. */
    nonEnregistre: "Modifications non enregistrées.",
  },

  membres: {
    titre: "Membres",
    chercher: "Chercher un compte",
    seulementCoches: "Membres seulement",
    cocherSansGroupe: (n: number) => `Cocher les ${n} compte${s(n)} sans groupe`,
    compte: (coches: number, total: number) => `${coches} membre${s(coches)} sur ${total} compte${s(total)}`,
    aucun: "Aucun compte ne correspond.",
    admin: "admin",
    discord: "discord",
    desactive: "désactivé",
    enregistrer: "Enregistrer les membres",
    enregistrement: "Enregistrement…",
    nonEnregistre: "Modifications non enregistrées.",
  },

  /** Les réponses des actions du serveur (`src/lib/admin/actions-groupes.ts`). */
  actions: {
    nomInvalide: "Le nom fait entre 1 et 60 caractères.",
    nomPris: "Un autre groupe porte déjà ce nom.",
    regleInconnue: "Règle inconnue.",
    introuvable: "Ce groupe n'existe plus.",
    compteIntrouvable: "Compte introuvable.",
    cree: (nom: string) => `Groupe « ${nom} » créé.`,
    modifie: (nom: string) => `Groupe « ${nom} » enregistré.`,
    supprime: (nom: string) => `Groupe « ${nom} » supprimé.`,
    parDefaut: (nom: string) => `« ${nom} » est maintenant le groupe par défaut : les nouveaux comptes y entrent.`,
    plusParDefaut: (nom: string) =>
      `« ${nom} » n'est plus le groupe par défaut : un nouveau compte n'entre dans aucun groupe.`,
    jeux: (nom: string, nombre: number) => `« ${nom} » : ${nombre} jeu${nombre > 1 ? "x" : ""} dans la liste.`,
    membres: (nom: string, nombre: number) => `« ${nom} » : ${nombre} membre${s(nombre)}.`,
    groupesDuCompte: (pseudo: string, nombre: number) =>
      nombre === 0
        ? `${pseudo} n'est plus dans aucun groupe : il ne voit que les jeux qui lui sont attribués.`
        : `${pseudo} : ${nombre} groupe${s(nombre)}.`,
  },
};
