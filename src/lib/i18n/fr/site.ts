/**
 * La coquille du site côté compte : l'en-tête et la barre du bas, le menu du
 * compte, la recherche globale, le pied de page, le bandeau « Voir comme »,
 * et les mises en forme que tous les écrans partagent (durées, tailles).
 */
export const site = {
  navigation: {
    /** Le nom de la barre du bas, sur téléphone, pour les lecteurs d'écran. */
    principale: "Navigation principale",
    /** Le nom de la rangée des consoles de l'en-tête, pour les lecteurs d'écran. */
    consoles: "Consoles",
    accueil: "Accueil",
    /** Le même libellé dans l'en-tête, la barre du bas et le menu du compte. */
    mesJeux: "Mes jeux",
  },

  /** Le menu derrière l'avatar. Le sélecteur de langue y prend son nom dans `commun.langue`. */
  menu: {
    monCompte: "Mon compte",
    administration: "Administration",
    deconnexion: "Déconnexion",
  },

  /** La recherche globale : le bouton de l'en-tête et la fenêtre qu'il ouvre. */
  recherche: {
    /** Le nom du bouton, de la fenêtre et du champ, pour les lecteurs d'écran. */
    titre: "Rechercher un jeu",
    bouton: "Rechercher",
    /** Dans le champ vide : ce sur quoi porte la recherche. */
    indication: "Titre, auteur, jeu de base…",
    aide: "Tape au moins deux lettres. Flèches pour choisir, Entrée pour ouvrir, Échap pour fermer.",
    enCours: "Recherche…",
    rien: (saisie: string) => `Rien ne correspond à « ${saisie} ».`,
    /** Sous la liste, dès qu'il y a au moins un résultat. */
    resultats: (nombre: number) => `${nombre} jeu${nombre > 1 ? "x" : ""}`,
    /** La réponse du serveur à une recherche faite sans session. */
    nonConnecte: "Non connecté.",
  },

  piedDePage: "Bibliothèque privée. Les sauvegardes sont attachées à ton compte.",

  /** Le bandeau montré à un administrateur qui regarde le site comme un autre compte. */
  voirComme: {
    /** L'accolade marque la place du pseudo, que le bandeau pose en gras. */
    vuComme: "Tu vois le site comme {compte}",
    /**
     * La suite de la phrase, en plus pâle : qui est réellement connecté, et ce
     * que cela implique. Elle commence par sa propre espace.
     */
    precision: (connecte: string) => ` (connecté : ${connecte}). Ce que tu fais ici compte pour ce compte.`,
    revenir: "Revenir à mon compte",
  },

  /** Ce que `src/lib/format.ts` écrit : durées et tailles de fichiers. */
  format: {
    duree: {
      moinsDUneMinute: "moins d'une minute",
      minutes: (minutes: number) => `${minutes} min`,
      heures: (heures: number) => `${heures} h`,
      /** Les minutes arrivent sur deux chiffres : « 3 h 05 ». */
      heuresEtMinutes: (heures: number, minutes: string) => `${heures} h ${minutes}`,
    },
    /** Les valeurs arrivent déjà mises en forme : seule l'unité change d'une langue à l'autre. */
    taille: {
      octets: (valeur: string) => `${valeur} o`,
      kio: (valeur: string) => `${valeur} Kio`,
      mio: (valeur: string) => `${valeur} Mio`,
    },
  },
};
