/**
 * Le lecteur : ses commandes, ses messages, et le rappel fait à un invité qui
 * s'en va. Les panneaux qu'il affiche ont leurs propres dictionnaires
 * (`partie`, `commandes`).
 */
export const lecteur = {
  quitter: "Quitter",
  menu: "Menu",
  fermer: "Fermer",
  pause: "Pause",
  reprendre: "Reprendre",
  /**
   * Et non « Réinitialiser » : le jeu repart de son écran-titre et recharge
   * la sauvegarde, comme si on éteignait et rallumait la console.
   */
  redemarrer: "Redémarrer la console",
  /** Et non « Enregistrer » : ce bouton transmet la sauvegarde du jeu, il ne la fait pas. */
  envoyerAuServeur: "Envoyer au serveur",
  /**
   * Le bouton qui coupe ou rétablit la vibration de la cartouche (téléphone,
   * manette), pour les jeux qui en ont une. Son libellé dit l'état : le
   * bouton est allumé quand la vibration l'est.
   */
  vibration: { allumee: "Vibration activée", coupee: "Vibration coupée" },
  pleinEcran: "Plein écran",
  quitterPleinEcran: "Quitter le plein écran",

  chargement: {
    partie: "Récupération de ta partie…",
    jeu: (mio: string) => `Téléchargement du jeu (${mio} Mio)…`,
    console: "Démarrage de la console…",
  },

  erreurs: {
    isolation:
      "Ce navigateur ne permet pas l'isolation cross-origin, que le cœur d'émulation exige. " +
      "Essaie un autre navigateur, ou désactive une extension qui modifierait les en-têtes des pages.",
    jeuIndisponible: (code: number) => `Jeu indisponible (${code}).`,
    coeurArrete: "Le cœur d'émulation s'est arrêté. Recharge la page pour reprendre.",
    demarrage: "Démarrage impossible.",
  },

  sauvegarde: {
    /** Tant que rien n'a été enregistré : où va la sauvegarde. L'emphase porte sur « dans ». */
    explication:
      "La sauvegarde du jeu — celle que tu fais *dans* le jeu — remonte toute seule sur le serveur, et quand tu quittes. " +
      "Pour reprendre n'importe quand, utilise plutôt un point de reprise ci-dessous.",
    explicationLocale:
      "La sauvegarde du jeu — celle que tu fais *dans* le jeu — est gardée dans ce navigateur, sur aucun serveur. " +
      "Pour en avoir une copie ou continuer ailleurs, télécharge-la ci-dessous.",
    envoi: "Enregistrement…",
    enregistree: (heure: string) => `Partie enregistrée à ${heure}`,
    enregistreeLocale: (heure: string) => `Partie enregistrée dans ce navigateur à ${heure}`,
    refusee: (code: number) => `Enregistrement refusé (${code}).`,
    refuseeLocale:
      "Le navigateur a refusé d'enregistrer ta partie (stockage plein, ou désactivé). " +
      "Télécharge ta sauvegarde ci-dessous pour ne pas la perdre.",
    sansReponse: "Le serveur n'a pas répondu. La partie continue, réessai au prochain changement.",
    conflit: "Cette partie a été sauvegardée ailleurs depuis que tu as commencé. Ta sauvegarde n'a pas été écrasée.",
    conflitLocal:
      "Cette partie a été enregistrée depuis un autre onglet. La sauvegarde de l'autre onglet n'a pas été écrasée.",
    garderCelleCi: "Garder cette partie-ci et remplacer l'autre",
  },

  /** Le rappel fait à un invité qui quitte sans avoir téléchargé sa sauvegarde. */
  depart: {
    titre: "Avant de partir",
    /** L'emphase porte sur « dans ce navigateur ». */
    explication:
      "Tu joues sans compte : ta partie n'est enregistrée que *dans ce navigateur*, sur aucun serveur. " +
      "Elle disparaît si tu vides ses données, et ne te suit pas sur un autre appareil.",
    conseil: "Télécharge ta sauvegarde pour en garder une copie, ou pour continuer ailleurs.",
    telecharger: "Télécharger ma sauvegarde",
    quitterSans: "Quitter sans télécharger",
    rester: "Rester",
    titreEmportee: "Sauvegarde téléchargée",
    emportee:
      "Garde ce fichier : c'est ta partie. Pour la reprendre ici ou dans un autre navigateur, " +
      "lance le jeu puis choisis « Remplacer par un fichier ».",
  },
};
