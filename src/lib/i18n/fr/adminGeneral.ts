/**
 * L'administration, hors de ses grands onglets : la coquille (titre, résumé,
 * onglets), le tableau de bord et la page « Temps de jeu ».
 *
 * Les dates, les durées et les tailles arrivent ici déjà mises en forme : ce
 * dictionnaire ne fait que les placer dans la phrase. Les nombres, eux,
 * arrivent tels quels, pour que chaque langue fasse ses accords.
 */

const s = (n: number) => (n > 1 ? "s" : "");
const jeux = (n: number) => `${n} jeu${n > 1 ? "x" : ""}`;

export const adminGeneral = {
  /** Ce que toutes les pages de l'administration partagent. */
  coquille: {
    titre: "Administration",
    /**
     * Le titre d'onglet des pages de l'administration. `%s` n'est pas à
     * traduire : Next le remplace par le titre de la page.
     */
    gabaritOnglet: "%s — Administration",
    /** `dernier` : le titre du dernier jeu publié, s'il y en a un. */
    resume: (comptes: number, publies: number, dernier: string | null) =>
      `${comptes} compte${s(comptes)} · ${jeux(publies)} au catalogue` +
      (dernier === null ? "" : ` · dernier ajout : ${dernier}`),
  },

  /** Les onglets, repris aussi par les renvois du tableau de bord. */
  onglets: {
    tableau: "Tableau de bord",
    comptes: "Comptes",
    bibliotheque: "Bibliothèque",
    temps: "Temps de jeu",
    reglages: "Réglages",
    discord: "Discord",
  },

  tableau: {
    titre: "Tableau de bord",

    /** Qui joue seul en ce moment ; les salons du câble link ont leur propre bloc. */
    maintenant: {
      titre: "En ce moment",
      personne: "Personne ne joue en solo.",
      /** Suit le pseudo, que l'écran met en gras : « **Sacha** joue à Pokémon Rouge ». */
      joueA: (jeu: string) => `joue à ${jeu}`,
    },

    link: {
      titre: "Câble link",
      aucunSalon: "Aucun salon ouvert.",
      /** Le jeu, puis ceux qui y jouent : « Pokémon Rouge — Sacha et Ondine ». */
      salon: (jeu: string, joueurs: string[]) => `${jeu} — ${joueurs.join(" et ")}`,
      /** Des étiquettes, en minuscules : l'écran les passe en capitales. */
      enAttente: "en attente",
      enJeu: "en jeu",
      prive: "privé",
      spectateurs: (n: number) => `${n} spectateur${s(n)}`,
      depuis: (date: string) => `depuis ${date}`,
      /** Le nom de la jauge, pour les lecteurs d'écran. */
      occupation: (pourcentage: number) => `Occupation ${pourcentage} %`,
      /**
       * Sous la jauge : la part de processeur que prennent les salons ouverts,
       * et ce qu'il reste de place. `gb` et `gba` valent `null` quand rien ne
       * limite cette famille de consoles.
       */
      capacite: (c: {
        enCours: number;
        budget: number;
        marge: number;
        coeurs: number;
        gb: number | null;
        gba: number | null;
      }) =>
        `${c.enCours.toFixed(2)} cœur${c.enCours >= 2 ? "s" : ""} pris sur ${c.budget.toFixed(1)} ` +
        `réservé${c.budget >= 2 ? "s" : ""} (${c.marge} % de ${c.coeurs} cœur${s(c.coeurs)}) — ` +
        `encore ${c.gb ?? "∞"} salon${s(c.gb ?? 2)} GB / GBC ou ${c.gba ?? "∞"} GBA.`,
      nonMesuree: "Capacité non mesurée : aucune limite de salons. Voir Réglages.",
    },

    /** Les quatre chiffres du milieu : un titre, une valeur, une ligne de détail. */
    comptes: {
      titre: "Comptes",
      actifs: (n: number) => `${n} ${n > 1 ? "ont" : "a"} joué ces 7 jours`,
    },
    jeux: {
      titre: "Jeux publiés",
      /** Ajouté à la liste par console : « 12 GBA · 8 GBC · 3 officiels ». */
      officiels: (n: number) => `${n} officiel${s(n)}`,
    },
    temps: {
      titre: "Temps de jeu",
      /** La valeur affichée au-dessus est celle des sept derniers jours. */
      detail: (aujourdhui: string, total: string) => `ces 7 jours · ${aujourdhui} aujourd'hui · ${total} en tout`,
    },
    sauvegardes: {
      titre: "Sauvegardes",
      /** Les fichiers de sauvegarde, leurs copies de secours, les points de reprise. */
      detail: (parties: number, copies: number, etats: number) =>
        `${parties} partie${s(parties)} · ${copies} copie${s(copies)} · ${etats} point${s(etats)} de reprise`,
    },

    connexions: {
      titre: "Dernières connexions",
      aucune: "Aucune session.",
    },

    /** Un agent utilisateur ramené à « Chrome sur Windows ». */
    appareil: {
      inconnu: "appareil inconnu",
      /** Quand le navigateur n'est pas reconnu : « navigateur sur Linux ». */
      navigateur: "navigateur",
      sur: (navigateur: string, systeme: string) => `${navigateur} sur ${systeme}`,
    },

    serveur: {
      titre: "Serveur et bibliothèque",
      service: "Service",
      demarre: (date: string, memoire: string, node: string) =>
        `démarré le ${date} · ${memoire} de mémoire · Node ${node}`,
      charge: "Charge",
      /** `moyennes` : les trois charges moyennes du système, déjà réunies. */
      chargeSur: (moyennes: string, coeurs: number) => `${moyennes} sur ${coeurs} cœur${s(coeurs)}`,
      /** Les durées sur lesquelles portent les trois moyennes, en plus discret. */
      periodes: "(1, 5 et 15 min)",
      disque: "Disque",
      disqueLibre: (libre: string, total: string) => `${libre} libres sur ${total}`,
      catalogue: "Catalogue",
      etatDuCatalogue: (sansJaquette: number, depublies: number) =>
        `${jeux(sansJaquette)} sans jaquette · ${depublies} dépublié${s(depublies)}`,
    },
  },

  temps: {
    titre: "Temps de jeu",
    resume: (total: string, comptes: number) => `${total} de jeu en tout, sur ${comptes} compte${s(comptes)}.`,
    explication:
      "Le temps est compté par battements pendant qu'un jeu tourne, plafonnés à cinq minutes : " +
      "un onglet oublié ne gonfle pas les chiffres.",
    /** Sous le pseudo d'un compte, dans la liste. */
    jamaisJoue: "n'a jamais joué",
    compte: (nombreDeJeux: number, vuLe: string) => `${jeux(nombreDeJeux)} · vu le ${vuLe}`,
    choisir: "Choisis un compte pour voir son détail par jeu.",
    detail: (pseudo: string) => `${pseudo}, jeu par jeu`,
    aucunePartie: "Aucune partie enregistrée.",
    /** Une partie est ici une session de jeu : une fois où le jeu a été lancé. */
    ligne: (parties: number, derniere: string) => `${parties} partie${s(parties)} · dernière le ${derniere}`,
  },
};
