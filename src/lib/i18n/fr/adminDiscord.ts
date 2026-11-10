/**
 * L'onglet Discord de l'administration : les Activités déclarées, leur
 * formulaire, la marche à suivre de chacune, le pas à pas complet, et les
 * messages des actions du serveur.
 *
 * Deux sortes de mots anglais restent tels quels dans les deux langues : les
 * libellés du **portail développeur de Discord** (« General Information »,
 * « URL Mappings », « Reset Secret »…), qui n'existe qu'en anglais, et les
 * codes d'erreur (`invalid_client`).
 *
 * Les paragraphes longs portent leur mise en forme dans le texte : l'emphase
 * entre astérisques, comme partout, et le `code` entre accents graves. C'est
 * `Prose`, dans `admin/discord/tutoriel.tsx`, qui leur donne leurs balises.
 * Une valeur saisie librement (un titre de jeu, le nom d'une application)
 * ne passe donc jamais dans un de ces paragraphes.
 */

/*
 * Les libellés de l'onglet que d'autres textes citent : écrits une fois, pour
 * qu'une citation ne puisse pas s'écarter du bouton qu'elle désigne.
 */
const NOUVELLE = "Nouvelle application";
const ESSAYER = "Essayer auprès de Discord";
const MARCHE = "Marche à suivre";
const MODIFIER = "Modifier";
const PROPOSEE_PAR = "Proposée par";
const CONTACT = "Contact";

/**
 * Une liste de paragraphes dont le **nombre** fait partie de la forme du
 * dictionnaire : une étape oubliée ou en trop dans une traduction est une
 * erreur de compilation, comme un texte oublié.
 */
function liste<T extends string[]>(...paragraphes: T): { [Rang in keyof T]: string } {
  // Le type rendu oublie le texte de chaque paragraphe et n'en garde que le nombre.
  return paragraphes as { [Rang in keyof T]: string };
}

export const adminDiscord = {
  /** L'en-tête de l'onglet. */
  titre: "Activités Discord",
  presentation:
    "Un jeu du site, jouable dans Discord. Une Activité est une application Discord et ne sert qu'un jeu. " +
    "Elle répond sur son propre nom d'hôte, où rien d'autre du site n'est servi — ou sur celui du site, à côté de lui. " +
    "Le joueur n'a besoin ni de compte ni de mot de passe : sa partie suit son compte Discord.",
  nouvelle: NOUVELLE,
  aucune: "Aucune application déclarée.",

  /**
   * L'Activité que configure l'environnement du serveur (`.env`). Deux
   * propositions qui se suivent : la première porte le titre du jeu, saisi
   * librement, et s'affiche telle quelle ; la seconde passe par `Prose`.
   */
  repli: {
    annonce: (jeu: string, verrou: boolean) =>
      `L'environnement du serveur configure aussi une Activité (${jeu}${verrou ? ", verrouillée sur un serveur" : ""}) :`,
    portee: (hote: string) => `elle répond sur \`${hote}\` et sur tout hôte sans application ci-dessous.`,
  },

  /** La carte d'une application déclarée. */
  carte: {
    /** Après le nom d'hôte, quand c'est celui du site. */
    hoteDuSite: "(l'hôte du site)",
    /** À la place du titre du jeu, en minuscules : une étiquette, pas une phrase. */
    jeuIntrouvable: "jeu introuvable",
    /** La ligne de détail : l'application chez Discord, et où elle se joue. */
    resume: (application: string, serveur: string, jetonManquant: boolean) =>
      `Application ${application}` +
      (serveur ? ` · réservée au serveur ${serveur}` : " · jouable dans tout serveur où Discord l'accepte") +
      (serveur && jetonManquant ? " · sans jeton de bot !" : ""),
    modifier: MODIFIER,
    essayer: ESSAYER,
    essaiEnCours: "Essai…",
    marche: MARCHE,
    masquerMarche: "Masquer la marche à suivre",
    supprimer: "Supprimer",
    /** La question posée avant de supprimer (`window.confirm`). */
    confirmerSuppression: (nom: string, hote: string) =>
      `Supprimer l'application « ${nom} » ? L'Activité cessera de répondre sur ${hote}.`,
  },

  /** Le résultat de « Essayer auprès de Discord » : une ligne par question posée. */
  essai: {
    identifiants: "Identifiant et secret",
    bot: "Jeton de bot",
    /** Le serveur Discord auquel le verrou réserve l'Activité. */
    serveur: "Serveur du verrou",
    /** Les rôles du serveur qui donnent le droit de jouer. */
    roles: "Rôles réservés",
    /**
     * Le détail de chaque verdict. Ces textes attendent leur raccord : c'est
     * `src/lib/discord/essai.ts` qui les écrit aujourd'hui, en français.
     */
    verdicts: {
      rolesReserves: (noms: string[]) => `Seuls ces rôles peuvent jouer : ${noms.join(", ")}.`,
      rolesDisparus: (noms: string[], disparus: number) =>
        `${disparus === 1 ? "Un rôle réservé n'existe plus" : `${disparus} rôles réservés n'existent plus`} dans le serveur. ` +
        `Restent : ${noms.join(", ")}.`,
      rolesTousDisparus:
        "Aucun des rôles réservés n'existe plus dans le serveur : personne ne peut entrer. Choisis-en d'autres, ou n'en réserve aucun.",
      rolesBotAbsent:
        "Le bot n'est pas dans le serveur : Discord ne lui dit rien des rôles, et personne ne peut entrer. Invite-le depuis « Rôles réservés ».",
      rolesIllisibles: "Discord n'a pas donné les rôles du serveur : tant que cela dure, personne ne peut entrer.",
      identifiantsAcceptes: "Identifiant et secret acceptés par Discord.",
      identifiantsRefuses:
        "Discord refuse l'identifiant ou le secret (invalid_client). Le secret n'est pas la Public Key.",
      /** Une réponse inattendue, sans autre explication que son code. */
      reponse: (code: number) => `Discord a répondu ${code}.`,
      injoignable: "Discord est injoignable depuis le serveur.",
      jetonRefuse: "Discord refuse ce jeton de bot.",
      jetonAccepte: (nom: string) => `Jeton de bot accepté (${nom}).`,
      jetonDUneAutre: "Ce jeton de bot appartient à une autre application que cet identifiant.",
      serveurTrouve: (nom: string) => `Serveur trouvé : ${nom}.`,
      /** Un échec qui n'en est pas forcément un : le verrou n'a pas besoin que le bot soit membre. */
      serveurInvisible:
        "Discord ne montre pas ce serveur à ce bot : identifiant faux, ou bot non invité. " +
        "Le verrou peut marcher quand même ; à essayer dans Discord.",
    },
  },

  /** Le mot d'accueil et les astuces, au bas de la carte. */
  /**
   * Les rôles réservés : sous le verrou de serveur, qui dit où l'Activité se
   * joue, ils disent qui a le droit d'y jouer.
   */
  roles: {
    titre: "Rôles réservés",
    explication: "Parmi les membres du serveur, qui peut jouer.",
    tous: "Tous les membres du serveur peuvent jouer.",
    reserves: (nombre: number) =>
      nombre === 1 ? "Réservée à un rôle du serveur." : `Réservée à ${nombre} rôles du serveur.`,
    choisir: "Choisir les rôles",
    chargement: "Lecture des rôles…",
    /** Au-dessus des cases : ce que cocher veut dire. */
    consigne:
      "Coche les rôles qui donnent le droit de jouer : un seul suffit au joueur. Aucune case cochée : tous les membres du serveur.",
    aucunRole: "Ce serveur n'a aucun rôle à part « @everyone ».",
    /** Un rôle enregistré que le serveur n'a plus : il ne sert à rien, autant le dire. */
    disparu: "rôle supprimé du serveur",
    enregistrer: "Enregistrer les rôles",
    fermer: "Fermer",
    /** Le bot doit être dans le serveur pour que Discord réponde sur ses membres. */
    inviter: "Inviter le bot dans le serveur",
    apresInvitation:
      "Aucune permission à lui donner : il n'a qu'à y être. Une fois invité, reviens ici et relis les rôles.",
    relire: "Relire les rôles",
    /** Vérifié à chaque lancement seulement : dit ici pour ne pas le découvrir plus tard. */
    quand: "Les rôles sont vérifiés à chaque lancement de l'Activité : un rôle retiré prend effet au lancement suivant.",
  },
  /**
   * La commande de lancement : celle que Discord crée pour toute Activité,
   * `/launch` par défaut. La renommer la rend plus parlante — `/prism`.
   */
  commande: {
    titre: "Commande de lancement",
    explication: "Ce que les joueurs tapent dans un salon pour lancer l'Activité.",
    voir: "Voir la commande",
    chargement: "Lecture de la commande…",
    fermer: "Fermer",
    /** Au-dessus du formulaire : d'où vient cette commande, et où elle sert. */
    consigne:
      "Discord crée cette commande pour toute Activité, sous le nom « launch ». Elle apparaît dans le lanceur " +
      "d'applications et se tape dans n'importe quel salon, vocal ou non. Une application n'en a qu'une.",
    nom: "Nom",
    aideNom: "En minuscules, sans espace ni barre oblique : lettres, chiffres, tirets. 32 caractères au plus.",
    description: "Description",
    aideDescription: "Affichée à côté de la commande quand un joueur la tape.",
    renommer: "Renommer la commande",
    /**
     * La commande par défaut porte un nom par langue (« lancer » en français) :
     * tant qu'ils sont là, le nom ci-dessous ne s'affiche chez personne.
     */
    traduite:
      "Discord affiche encore cette commande sous un nom traduit, selon la langue de chaque joueur — « /lancer » en " +
      "français. Clique « Renommer la commande » pour imposer le nom ci-dessous dans toutes les langues.",
    /** Discord met un moment à répandre un changement de commande. */
    delai: "Un changement peut mettre quelques minutes à apparaître chez les joueurs ; relancer Discord l'accélère.",
    relire: "Relire la commande",
  },
  astuces: {
    /** Suivi du mot d'accueil lui-même ; la ponctuation est celle de la langue. */
    accueil: "Mot d'accueil :",
    sansAccueil: `Pas de mot d'accueil : « ${MODIFIER} » pour en écrire un.`,
    titre: "Astuces",
    explication: "Mot du jour, conseil, rappel : une au hasard à chaque lancement.",
    aucune: "Aucune pour l'instant.",
    retirer: "Retirer",
    /** Le texte du champ vide. */
    exemple: "Une astuce de plus…",
    /** Le nom du champ, pour les lecteurs d'écran. */
    nouvelle: "Nouvelle astuce",
    ajouter: "Ajouter",
  },

  /**
   * La marche à suivre d'une application : ce qui se règle ailleurs que dans
   * la page, avec les valeurs à recopier. Chaque entrée est un paragraphe
   * pour `Prose`.
   */
  marche: {
    hote: {
      /** L'Activité est sur l'hôte du site. */
      enPlace: (hote: string) =>
        `*Le nom d'hôte.* Rien à faire : \`${hote}\` est l'hôte du site, déjà en place. ` +
        "Le site continue d'y répondre ; Discord, lui, y trouve l'Activité.",
      aPreparer: (hote: string) =>
        `*Le nom d'hôte.* Faire pointer \`${hote}\` vers ce serveur (DNS), puis lui donner un certificat et un vhost ` +
        "qui relaie vers le site, comme l'hôte principal — voir `docs/discord/README.md`. " +
        "Tant que ce n'est pas fait, Discord n'atteint pas l'Activité.",
    },
    portail: {
      titre: (application: string) => `*Le portail Discord* (discord.com/developers, application ${application}) :`,
      redirects: "OAuth2 → Redirects : `https://127.0.0.1` (exigé, jamais utilisé).",
      activites: "Activities → Settings : cocher « Enable Activities », et les plateformes voulues (iOS, Android).",
      mappings: (hote: string) => `Activities → URL Mappings : préfixe \`/\`, cible \`${hote}\` (sans https://).`,
      /** Seulement quand l'Activité est réservée à un serveur. */
      bot:
        "Bot : le jeton enregistré ici doit être celui de cette application. Le bot n'a pas besoin d'être invité " +
        "dans le serveur : le verrou interroge l'instance de l'Activité, pas le serveur.",
    },
    pages: {
      /**
       * `?lang=en` : chaque langue a son adresse, et c'est l'anglaise qu'on
       * donne à Discord, dont le relecteur n'a ni le navigateur ni les
       * préférences du joueur. `?lang=fr` donne la française.
       */
      titre:
        "*Les pages légales*, que Discord demande pour vérifier l'application (General Information du portail). " +
        "Les adresses ci-dessous mènent à la version anglaise ; `?lang=fr` donne la française :",
      confidentialite: (hote: string) => `Privacy Policy URL : \`https://${hote}/discord/confidentialite?lang=en\``,
      conditions: (hote: string) => `Terms of Service URL : \`https://${hote}/discord/conditions?lang=en\``,
      /** L'avertissement, tant que l'un des deux champs du formulaire est vide. */
      incompletes:
        `« ${PROPOSEE_PAR} » ou « ${CONTACT} » est vide : ces pages renvoient pour l'instant aux responsables ` +
        `du serveur Discord. « ${MODIFIER} » pour les remplir.`,
    },
    essayer:
      "*Essayer.* Dans Discord, mode développeur activé : entrer dans un salon vocal, ouvrir le lanceur d'activités. " +
      "Une application non vérifiée ne se lance que dans un serveur de moins de 25 membres, et seulement pour " +
      "son propriétaire, son équipe et ses testeurs.",
  },

  /** Le formulaire d'une application, nouvelle ou modifiée. */
  formulaire: {
    titreNouvelle: NOUVELLE,
    titreModifier: (nom: string) => `Modifier « ${nom} »`,
    nom: { libelle: "Nom", aide: "Pour toi seulement." },
    hote: {
      libelle: "Nom d'hôte",
      aide: (hoteDuSite: string) =>
        "Sans https:// ni chemin. Un hôte à elle : rien d'autre du site n'y sera servi. " +
        `Ou ${hoteDuSite}, celui du site : l'Activité s'y ajoute, et le site continue d'y répondre.`,
    },
    jeu: {
      libelle: "Jeu servi",
      aide: "Le seul jeu de cette Activité. Pour un autre jeu, une autre application.",
      choisir: "Choisir un jeu…",
      /** Une ligne de la liste : la console en capitales, le titre, et l'état du jeu s'il est dépublié. */
      option: (console: string, titre: string, publie: boolean) =>
        `${console} — ${titre}${publie ? "" : " (dépublié)"}`,
    },
    identifiant: {
      libelle: "Identifiant d'application",
      aide: "Application ID, onglet General Information du portail.",
    },
    secret: {
      /** Le libellé du portail, le même dans les deux langues. */
      libelle: "Client Secret",
      aide: "Onglet OAuth2 → Reset Secret. Pas la Public Key.",
    },
    /** L'aide d'un secret déjà enregistré, que le formulaire ne réaffiche jamais. */
    dejaEnregistre: "Enregistré. Vide : inchangé.",
    accueil: {
      libelle: "Mot d'accueil",
      aide:
        "Affiché à chaque lancement, sous le titre du jeu : une présentation, une consigne pour les testeurs. " +
        "Vide : rien. Les astuces, elles, s'ajoutent sur la carte de l'application.",
    },
    editeur: {
      libelle: PROPOSEE_PAR,
      aide: "Un nom ou un pseudonyme, affiché sur les pages de confidentialité et de conditions de l'Activité.",
    },
    contact: {
      libelle: CONTACT,
      aide:
        "Affiché sur ces mêmes pages : une adresse e-mail, ou comment te joindre sur Discord. " +
        "C'est par là qu'un joueur demande la suppression de ses données.",
    },
    verrou: "Réserver l'Activité à un seul serveur Discord",
    serveur: {
      libelle: "Identifiant du serveur",
      /** « Copier l'identifiant » est le libellé du client Discord. */
      aide: "Clic droit sur le serveur → Copier l'identifiant (mode développeur activé).",
    },
    jetonBot: {
      libelle: "Jeton de bot",
      aide: "Onglet Bot → Reset Token. Avec lui, le site demande à Discord où tourne l'Activité.",
    },
    enregistrement: "Enregistrement…",
    enregistrerNouvelle: "Enregistrer l'application",
    enregistrerChangements: "Enregistrer les changements",
    fermer: "Fermer",
    annuler: "Annuler",
  },

  /**
   * Le pas à pas complet, de zéro jusqu'à l'Activité qui se lance dans
   * Discord. Une copie en Markdown vit dans `docs/discord/README.md` (et
   * `README.en.md`) : les deux s'entretiennent ensemble.
   *
   * Chaque section a son titre et ses paragraphes, pour `Prose` ; c'est le
   * composant qui sait lesquelles sont des étapes numérotées. Les libellés de
   * Discord lui-même (« Mode développeur », « Copier l'identifiant ») sont
   * ceux du client dans la langue du texte.
   */
  tutoriel: {
    titre: "Ajouter une Activité : le pas à pas complet",
    resume: "Tout ce qu'il y a à faire chez Discord, puis ici, puis sur le serveur. Compter une demi-heure la première fois.",
    lire: "Lire le pas à pas",
    replier: "Replier",

    avant: {
      titre: "0. Ce qu'il faut avant de commencer",
      points: liste(
        "Un compte Discord, et *un serveur Discord à toi* (ou dont tu es administrateur) de *moins de 25 membres* : " +
          "tant que l'application n'est pas vérifiée par Discord, elle ne se lance que dans un serveur de cette taille, " +
          "et seulement pour toi, ton équipe et tes testeurs.",
        "Le *mode développeur* dans Discord : Paramètres utilisateur → Avancés → Mode développeur. " +
          "Il ajoute « Copier l'identifiant » aux clics droits.",
        "Un *nom d'hôte* pour l'Activité (par exemple `prism.exemple.com`), différent de celui du site, " +
          "que tu peux faire pointer vers ce serveur chez ton registrar.",
        "Le jeu déjà présent dans la bibliothèque du site (publié ou non).",
      ),
    },

    creer: {
      titre: "1. Créer l'application chez Discord",
      points: liste(
        "Ouvrir `discord.com/developers/applications`, bouton *New Application*. Le nom est celui que verront " +
          "les joueurs dans le lanceur — le nom du jeu, par exemple. Accepter les conditions.",
        "Onglet *General Information* : copier *Application ID* (un nombre de 18 ou 19 chiffres). " +
          "C'est « l'identifiant d'application » demandé ici. Ajouter une icône et une description : " +
          "elles s'affichent dans le lanceur d'activités.",
        "Ne pas copier la *Public Key* : elle ne sert pas ici, et la prendre pour le secret donne l'erreur `invalid_client`.",
      ),
    },

    secret: {
      titre: "2. Le secret et l'adresse de retour (onglet OAuth2)",
      points: liste(
        "*Client Secret* → *Reset Secret* → copier tout de suite : Discord ne le montre qu'une fois. " +
          "Le régénérer plus tard invalide l'ancien, partout où il est enregistré.",
        "*Redirects* → Add Redirect → `https://127.0.0.1` → Save Changes. " +
          "Discord exige une adresse de retour, l'Activité ne s'en sert jamais.",
      ),
    },

    bot: {
      titre: "3. Le jeton de bot (seulement pour réserver l'Activité à un serveur)",
      points: liste(
        "Onglet *Bot* → *Reset Token* → copier tout de suite, pour la même raison que le secret.",
        "Rien d'autre : le bot n'a pas besoin d'être invité dans le serveur, ni de permission. " +
          "Avec ce jeton, le site demande seulement à Discord où tourne l'Activité et qui y est.",
        "L'identifiant du serveur : dans Discord, clic droit sur le nom du serveur → *Copier l'identifiant du serveur*.",
      ),
    },

    activer: {
      titre: "4. Activer l'Activité (onglet Activities)",
      points: liste(
        "*Getting Started* → *Enable Activities*. Discord crée la commande de lancement de l'application.",
        "*Settings* : cocher les plateformes voulues (ordinateur, iOS, Android). Pour un jeu Game Boy, " +
          "l'orientation « portrait » sur téléphone convient bien ; en paysage l'écran est petit.",
        "*URL Mappings* : une seule ligne, préfixe `/`, cible le nom d'hôte de l'Activité *sans* `https://` ni chemin " +
          "(par exemple `prism.exemple.com`). Discord fera passer tout ce que la page demande par son proxy vers cet hôte.",
      ),
    },

    declarer: {
      titre: "5. Déclarer l'Activité ici, dans le site",
      points: liste(
        `Bouton *${NOUVELLE}* : le nom (pour toi), le nom d'hôte, le jeu, l'Application ID, le Client Secret, ` +
          "et si tu veux le verrou avec l'identifiant du serveur et le jeton de bot.",
        `*${ESSAYER}* : les identifiants doivent être acceptés avant d'aller plus loin.`,
        `*${MARCHE}* rappelle, pour cette application, ce qui reste à recopier dans le portail.`,
        "Facultatif : un *mot d'accueil* dans le formulaire (affiché à chaque lancement sous le titre du jeu), " +
          "et des *astuces* sur la carte de l'application — mot du jour, conseil, rappel. " +
          "L'accueil en montre une au hasard, le menu de pause les fait défiler.",
      ),
    },

    hote: {
      titre: "6. Le nom d'hôte, côté serveur",
      points: liste(
        "Chez le registrar : un enregistrement `A` (ou `CNAME`) qui fait pointer le nom d'hôte vers ce serveur. " +
          "Attendre qu'il soit visible (`nslookup`).",
        "Sur le serveur, en root, depuis le clone du dépôt : " +
          "`sudo ./deploiement/scripts/hote-activite.sh --domaine prism.exemple.com --mail toi@exemple.com`. " +
          "Le script pose le vhost Apache et demande le certificat.",
        // Les deux textes cités sont ceux que montre l'hôte : l'Activité hors de Discord, et le refus du reste du site.
        "Vérifier dans un navigateur : `https://prism.exemple.com/` doit afficher l'Activité " +
          "(page « Cette page s'ouvre depuis Discord ») et `https://prism.exemple.com/connexion` répondre « Introuvable ».",
      ),
    },

    lancer: {
      titre: "7. Lancer dans Discord",
      points: liste(
        "Entrer dans un salon vocal du serveur.",
        "Ouvrir le *lanceur d'activités* (l'icône de fusée dans le salon vocal, ou le bouton « Activités »), " +
          "chercher l'application par son nom.",
        "Au premier lancement, Discord demande l'autorisation de connaître ton identité : accepter. " +
          "Le site crée alors ton compte restreint à ce jeu.",
        "Pour qu'un ami l'essaie avant la vérification : onglet *App Testers* du portail, inviter son compte (50 au plus).",
      ),
    },

    depannage: {
      titre: "8. Quand ça ne marche pas",
      points: liste(
        "*Écran blanc ou noir* : l'URL Mapping ne pointe pas vers le bon hôte, le DNS n'est pas encore visible, " +
          "ou le certificat manque. Ouvrir l'hôte dans un navigateur pour voir lequel.",
        "`invalid_client` dans le journal du serveur : identifiant faux, ou Public Key mise à la place du secret. " +
          "`invalid_grant` : code périmé, relancer l'Activité.",
        // Le refus du verrou, tel que l'Activité l'affiche au joueur.
        "« Cette Activité ne se joue que dans son serveur Discord » : le verrou refuse ; vérifier l'identifiant " +
          `du serveur et le jeton de bot avec « ${ESSAYER} ».`,
        "L'application n'apparaît pas dans le lanceur : Activities → Settings, la plateforme n'est pas cochée ; " +
          "ou le serveur a 25 membres ou plus ; ou le compte n'est ni le propriétaire, ni dans l'équipe, ni testeur.",
        "Les joueurs ne se voient pas à deux : ils doivent être dans le *même salon vocal* — " +
          "c'est lui qui fait le salon de jeu.",
      ),
    },

    verification: {
      titre: "9. Au-delà de 25 membres : la vérification",
      /** Le paragraphe qui précède les étapes. */
      intro:
        "Discord demande la *vérification de l'application*, donc celle de l'identité de son propriétaire, " +
        "et l'engagement sur ses conditions développeur — dont le respect des droits des tiers. " +
        "C'est une décision à prendre avant d'ouvrir l'Activité à un grand serveur : elle attache une identité à l'application.",
      points: liste(
        "L'application doit appartenir à une *équipe* (portail → Teams, puis General Information → transférer " +
          "l'application à l'équipe). C'est l'identité du propriétaire de l'équipe que Discord fait contrôler, par Stripe.",
        `Remplir *${PROPOSEE_PAR}* et *${CONTACT}* dans le formulaire de l'application, puis coller dans ` +
          `General Information les deux adresses de sa « ${MARCHE} » : la politique de confidentialité et ` +
          "les conditions d'utilisation, que le site sert sur l'hôte de l'Activité.",
        "Onglet *App Verification* : la liste des conditions, puis le bouton « Verify App » quand toutes sont remplies.",
        "Une fois vérifiée, l'application reste publique : n'importe qui peut l'ajouter à son serveur. " +
          "Le verrou par serveur est alors ce qui réserve le jeu au tien.",
      ),
    },
  },

  /** Les réponses des actions du serveur (`src/lib/admin/actions-discord.ts`). */
  actions: {
    nomInvalide: "Le nom fait entre 1 et 60 caractères.",
    accueilTropLong: (maximum: number) => `Le mot d'accueil fait au plus ${maximum} caractères.`,
    editeurTropLong: (maximum: number) => `« ${PROPOSEE_PAR} » fait au plus ${maximum} caractères.`,
    contactTropLong: (maximum: number) => `Le contact fait au plus ${maximum} caractères.`,
    hoteInvalide: "Le nom d'hôte est invalide : lettres, chiffres, tirets et points, sans schéma ni port.",
    identifiantInvalide: "L'identifiant d'application est un nombre de 17 à 20 chiffres (Application ID).",
    serveurInvalide: "L'identifiant du serveur est un nombre de 17 à 20 chiffres.",
    /** Le secret ou le jeton de bot : sans dire lequel, ni rien en répéter. */
    valeurTropLongue: "Une des valeurs est trop longue.",
    jeuManquant: "Choisis le jeu que cette Activité sert.",
    hoteDejaPris: "Une autre application a déjà ce nom d'hôte.",
    secretObligatoire: "Le Client Secret est obligatoire (onglet OAuth2 du portail).",
    jetonObligatoire: "Le verrou sur un serveur demande le jeton de bot (onglet Bot du portail).",
    /** Sert aussi à la carte, quand l'essai porte sur une application supprimée entre-temps. */
    applicationDisparue: "Cette application n'existe plus.",
    modifiee: "Application modifiée.",
    enregistreeSurLeSite: "Application enregistrée sur l'hôte du site. Reste à régler le portail Discord.",
    enregistree: "Application enregistrée. Reste à régler le portail Discord et le nom d'hôte.",
    supprimee: "Application supprimée. Les comptes nés de cette Activité restent.",
    rolesSansVerrou: "Réserver des rôles demande le verrou de serveur : l'identifiant du serveur et le jeton de bot.",
    rolesBotAbsent:
      "Discord ne montre pas ce serveur au bot : il n'y est pas invité, ou l'identifiant du serveur est faux.",
    rolesJetonRefuse: "Discord refuse le jeton de bot enregistré.",
    rolesInjoignable: "Discord n'a pas donné les rôles du serveur. Réessaie dans un instant.",
    rolesInvalides: "La liste des rôles est invalide.",
    rolesReserves: (nombre: number) =>
      nombre === 1
        ? "Activité réservée à un rôle. Effet au prochain lancement."
        : `Activité réservée à ${nombre} rôles. Effet au prochain lancement.`,
    rolesOuverts: "Plus aucun rôle réservé : tous les membres du serveur peuvent jouer.",
    commandeIdentifiants: "Discord refuse les identifiants enregistrés : la commande n'a pas pu être lue.",
    commandeAbsente:
      "Cette application n'a pas de commande de lancement : active les Activités dans le portail (Activities → Settings), Discord la crée alors.",
    commandeInjoignable: "Discord n'a pas répondu. Réessaie dans un instant.",
    /** `detail` : ce que Discord en dit, en anglais — c'est lui qui sait ce qui ne va pas. */
    commandeRefusee: (detail?: string) =>
      detail ? `Discord refuse ce nom ou cette description : ${detail}` : "Discord refuse ce nom ou cette description.",
    commandeNomInvalide:
      "Le nom est invalide : des minuscules, des chiffres et des tirets, sans espace, 32 caractères au plus.",
    commandeDescriptionInvalide: (max: number) => `La description fait entre 1 et ${max} caractères.`,
    commandeRenommee: (nom: string) => `La commande s'appelle maintenant /${nom}.`,
    astuceVide: "L'astuce est vide.",
    astuceTropLongue: (maximum: number) => `Une astuce fait au plus ${maximum} caractères.`,
    astuceAjoutee: "Astuce ajoutée.",
    astuceDisparue: "Cette astuce n'existe plus.",
    astuceSupprimee: "Astuce supprimée.",
  },
};
