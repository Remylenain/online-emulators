/**
 * Administration → Réglages : l'identité du site, la vitrine, le câble link,
 * l'envoi d'e-mails, le captcha et le compte du scraper.
 *
 * L'administrateur est tutoyé, comme le reste du site. Deux conventions pour
 * les passages mis en valeur : entre astérisques, de l'emphase (`Accentue`) ;
 * entre accents graves, une commande à taper, affichée comme du code.
 */
export const adminReglages = {
  /** Le titre de l'onglet du navigateur, et celui de la page. */
  titreOnglet: "Réglages",
  titre: "Réglages",

  /** Le bouton d'un formulaire pendant qu'il part. */
  enregistrement: "Enregistrement…",
  /** Sous un réglage enregistré ici, qui recouvre celui du serveur : l'oublier. */
  revenirAuServeur: "Revenir à la configuration du serveur",

  identite: {
    titre: "Identité du site",
    nom: "Nom du site",
    aideNom: "Affiché dans l'en-tête, les onglets et sur la page de connexion.",
    phraseDAccueil: "Phrase d'accueil",
    aidePhraseDAccueil: "Sous le nom, sur la page de connexion.",
    application: "Nom de l'application installée",
    aideApplication:
      "Sous l'icône, quand le site est ajouté à l'écran d'accueil d'un téléphone. Vide : le nom du site. " +
      "Un téléphone n'affiche qu'une douzaine de caractères.",
    langue: "Langue par défaut",
    /** L'ordre du choix d'une langue : voir `docs/langues.md`. */
    aideLangue:
      "Chaque visiteur voit le site dans la langue de son navigateur, ou dans celle qu'il choisit. " +
      "Celle-ci sert pour les autres.",
    enregistrer: "Enregistrer",
  },

  /** La vitrine : quelques jeux ouverts aux visiteurs sans compte. */
  vitrine: {
    titre: "Vitrine : jouer sans compte",
    explication:
      "Ouverte, l'accueil du site montre à un visiteur sans compte un bouton par jeu choisi ci-dessous, et rien " +
      "d'autre. Il joue en invité : sa sauvegarde, ses points de reprise et ses réglages restent dans son " +
      "navigateur. Le reste du site demande toujours un compte.",
    ouvrir: "Ouvrir ces jeux aux visiteurs sans compte",
    /** Le libellé d'un bouton de l'accueil, que l'administrateur écrit lui-même. */
    bouton: (rang: number) => `Bouton ${rang}`,
    aideBouton: "Vide : le titre du jeu.",
    jeuLance: "Jeu lancé",
    aucun: "Aucun",
    /** Dans la liste des jeux, à la suite d'un jeu qu'un invité ne pourrait pas lancer. */
    depublie: (jeu: string) => `${jeu} (dépublié)`,
    enregistrer: "Enregistrer la vitrine",
    /** Les réponses du serveur à l'enregistrement. */
    retours: {
      libelleTropLong: (maximum: number) => `Un libellé ne peut pas dépasser ${maximum} caractères.`,
      jeuEnDouble: "Le même jeu est choisi deux fois.",
      jeuDisparu: "Un des jeux choisis n'existe plus.",
      jeuDepublie: (titre: string) =>
        `« ${titre} » n'est pas publié : un invité ne pourrait pas le lancer. Publie-le d'abord.`,
      aucunJeu: "Choisis au moins un jeu avant d'ouvrir la vitrine.",
      ouverte: "Vitrine ouverte : ces jeux se lancent sans compte. Effet en quelques secondes.",
      fermee: "Vitrine fermée : tout le site demande un compte.",
    },
  },

  /**
   * Combien de salons le serveur accepte à la fois. La « part » est le
   * pourcentage du processeur laissé au câble link ; les nombres à virgule
   * arrivent déjà écrits dans la langue.
   */
  cableLink: {
    titre: "Câble link",
    processeur: "Processeur",
    coeurs: (coeurs: number, pourLeCable: string, part: number) =>
      `${coeurs} cœur${coeurs > 1 ? "s" : ""}, dont ${pourLeCable} pour le câble link à ${part} %`,
    salonGb: "Un salon GB / GBC",
    salonGba: "Un salon GBA",
    pasMesure: "pas mesuré",
    /** Ce que coûte un salon, en fraction de cœur. */
    cout: (coeur: string) => `${coeur} cœur`,
    enCeMoment: "En ce moment",
    aucunSalon: "aucun salon ouvert",
    salonsOuverts: (salons: number, pris: string) =>
      `${salons} salon${salons > 1 ? "s" : ""} ouvert${salons > 1 ? "s" : ""}, ${pris} cœur pris`,
    /** À la suite, après un tiret : la place qui reste. `null` : aucune limite pour cette console. */
    encore: (gb: number | null, gba: number | null) =>
      `encore ${gb ?? "∞"} salon${(gb ?? 2) > 1 ? "s" : ""} GB / GBC ou ${gba ?? "∞"} GBA`,
    /** La commande, entre accents graves, se tape telle quelle. */
    sansLimite:
      "Aucune limite pour l'instant. Pour en poser une, lance sur le serveur " +
      "`npm run link:capacite -- --appliquer` : il mesure ce que coûte un salon de chaque console et " +
      "l'enregistre ici.",
    part: "Part du processeur réservée au câble link",
    aidePart: "En pour cent. Le reste sert au site lui-même. 60 à 70 % laisse de quoi voir venir.",
    enregistrer: "Enregistrer la marge",
  },

  /** Le relais SMTP : invitations, mots de passe oubliés, confirmations d'inscription. */
  mail: {
    titre: "Envoi d'e-mails",
    /** D'où vient le réglage en vigueur. */
    provenance: {
      reglages: "Le relais réglé ici. Il l'emporte sur la configuration du serveur.",
      serveur:
        "Le relais vient de la configuration du serveur. Enregistrer ce formulaire le remplace, sans redémarrage.",
      aucune: "Le relais n'est pas configuré.",
    },
    hote: "Hôte SMTP",
    exempleHote: "smtp-relay.exemple.com",
    port: "Port",
    identifiant: "Identifiant",
    aideIdentifiant: "Celui que donne le relais, pas forcément l'adresse du compte.",
    motDePasse: "Mot de passe ou clé SMTP",
    motDePasseEnregistre: "Un mot de passe est enregistré. Laisse vide pour le garder.",
    aucunMotDePasse: "Aucun mot de passe enregistré.",
    expediteur: "Expéditeur",
    aideExpediteur:
      "Tel qu'il apparaît dans les messages. L'adresse doit être sur un domaine que le relais accepte.",
    exempleExpediteur: "Mon site <jeux@exemple.com>",
    enregistrer: "Enregistrer le relais",
    destinataireDuTest: "Envoyer un e-mail de test à",
    envoyerLeTest: "Envoyer le test",
    envoi: "Envoi…",
  },

  /** Les clés Turnstile : sans elles, les inscriptions ouvertes restent fermées. */
  captcha: {
    titre: "Captcha (Cloudflare Turnstile)",
    provenance: {
      reglages: "Le captcha réglé ici. Il l'emporte sur la configuration du serveur.",
      serveur:
        "Le captcha vient de la configuration du serveur. Enregistrer ce formulaire le remplace, sans redémarrage.",
      aucune: "Le captcha n'est pas configuré.",
    },
    /** « Mot de passe oublié » est le libellé du lien de la page de connexion. */
    explication:
      "Il protège « Mot de passe oublié » et l'inscription ouverte. Les deux clés se créent gratuitement dans " +
      "le tableau de bord Cloudflare, rubrique Turnstile.",
    cleDuSite: "Clé du site",
    aideCleDuSite: "Publique : elle part dans la page.",
    cleSecrete: "Clé secrète",
    cleSecreteEnregistree: "Une clé secrète est enregistrée. Laisse vide pour la garder.",
    aucuneCleSecrete: "Aucune clé secrète enregistrée.",
    enregistrer: "Enregistrer les clés",
  },

  /** Le compte ScreenScraper, qui sert à « Compléter les fiches » dans Bibliothèque. */
  scraper: {
    titre: "Scraper (ScreenScraper)",
    /** L'emphase porte sur les deux paires d'identifiants : « membre » et « logiciel ». */
    explication:
      "Pour remplir les fiches des jeux officiels depuis screenscraper.fr : description en français, année, " +
      "jaquette. Le bouton est dans Bibliothèque. L'API demande deux paires d'identifiants : celle du *membre* " +
      "(ton compte), et celle du *logiciel*, dite « développeur », que ScreenScraper délivre sur demande depuis " +
      "son forum. Sans la seconde, seules les jaquettes de libretro sont cherchées — elles couvrent déjà la " +
      "plupart des jeux.",
    identifiantDuCompte: "Identifiant du compte",
    motDePasseDuCompte: "Mot de passe du compte",
    identifiantDeveloppeur: "Identifiant développeur",
    motDePasseDeveloppeur: "Mot de passe développeur",
    /** Sous un champ de mot de passe, qui ne s'affiche jamais. */
    motDePasseEnregistre: "Enregistré. Vide : inchangé.",
    aucunMotDePasse: "Aucun enregistré.",
    enregistrer: "Enregistrer le compte",
    effacer: "Effacer le compte",
  },
};
