import type { Dictionnaire } from "../dictionnaires";

/*
 * Les libellés de l'onglet que d'autres textes citent, comme dans le
 * français. Ce sont les mots de `docs/discord/README.en.md` : « Step-by-step »
 * pour la marche à suivre d'une application, « walkthrough » pour le pas à
 * pas complet, « Offered by » pour « Proposée par ».
 */
const NOUVELLE = "New application";
const ESSAYER = "Test against Discord";
const MARCHE = "Step-by-step";
const MODIFIER = "Edit";
const PROPOSEE_PAR = "Offered by";
const CONTACT = "Contact";

export const adminDiscord: Dictionnaire["adminDiscord"] = {
  titre: "Discord Activities",
  presentation:
    "One of the site's games, playable inside Discord. An Activity is a Discord application and serves a single game. " +
    "It answers on its own hostname, where nothing else from the site is served — or on the site's, alongside it. " +
    "The player needs neither an account nor a password: their progress follows their Discord account.",
  nouvelle: NOUVELLE,
  aucune: "No application declared.",

  repli: {
    /** « Locked », le verrou ; « restricted » est gardé pour les comptes. */
    annonce: (jeu: string, verrou: boolean) =>
      `The server's environment also sets up an Activity (${jeu}${verrou ? ", locked to one server" : ""}):`,
    portee: (hote: string) => `it answers on \`${hote}\` and on any host with no application below.`,
  },

  carte: {
    hoteDuSite: "(the site's host)",
    jeuIntrouvable: "game not found",
    resume: (application: string, serveurs: string[], jetonManquant: boolean) =>
      `Application ${application}` +
      (serveurs.length === 0
        ? " · playable in any server where Discord allows it"
        : serveurs.length === 1
          ? ` · restricted to server ${serveurs[0]}`
          : ` · restricted to ${serveurs.length} servers: ${serveurs.join(", ")}`) +
      (serveurs.length > 0 && jetonManquant ? " · no bot token!" : ""),
    modifier: MODIFIER,
    essayer: ESSAYER,
    essaiEnCours: "Testing…",
    marche: MARCHE,
    masquerMarche: "Hide the step-by-step",
    supprimer: "Delete",
    confirmerSuppression: (nom: string, hote: string) =>
      `Delete the application “${nom}”? The Activity will stop answering on ${hote}.`,
  },

  essai: {
    /** « ID », le mot de Discord pour ses identifiants (Application ID, Server ID). */
    identifiants: "ID and secret",
    bot: "Bot token",
    serveur: "Server for the lock",
    roles: "Restricted roles",
    verdicts: {
      rolesReserves: (noms: string[]) => `Only these roles can play: ${noms.join(", ")}.`,
      rolesDisparus: (noms: string[], disparus: number) =>
        `${disparus === 1 ? "One restricted role no longer exists" : `${disparus} restricted roles no longer exist`} in the server. ` +
        `Remaining: ${noms.join(", ")}.`,
      rolesTousDisparus:
        "None of the restricted roles exist in the server any more: nobody can get in. Choose others, or restrict to none.",
      rolesBotAbsent:
        "The bot is not in the server: Discord tells it nothing about roles, and nobody can get in. Invite it from “Restricted roles”.",
      rolesIllisibles: "Discord did not return the server's roles: as long as this lasts, nobody can get in.",
      identifiantsAcceptes: "ID and secret accepted by Discord.",
      identifiantsRefuses: "Discord rejects the ID or the secret (invalid_client). The secret is not the Public Key.",
      reponse: (code: number) => `Discord answered ${code}.`,
      injoignable: "Discord cannot be reached from the server.",
      jetonRefuse: "Discord rejects this bot token.",
      jetonAccepte: (nom: string) => `Bot token accepted (${nom}).`,
      jetonDUneAutre: "This bot token belongs to a different application than this ID.",
      serveurTrouve: (nom: string) => `Server found: ${nom}.`,
      serveurInvisible:
        "Discord does not show this server to this bot: wrong ID, or bot not invited. " +
        "The lock may work anyway; try it in Discord.",
    },
  },

  roles: {
    titre: "Restricted roles",
    explication: "Among the server's members, who can play.",
    tous: "All members of the server can play.",
    reserves: (nombre: number) =>
      nombre === 1 ? "Restricted to one role in the server." : `Restricted to ${nombre} roles in the server.`,
    choisir: "Choose the roles",
    chargement: "Reading the roles…",
    consigne:
      "Tick the roles that give the right to play: a player needs only one of them. No box ticked: all members of the server.",
    aucunRole: "This server has no role other than “@everyone”.",
    disparu: "role deleted from the server",
    enregistrer: "Save the roles",
    fermer: "Close",
    inviter: "Invite the bot to the server",
    apresInvitation:
      "It needs no permission at all: it only has to be there. Once it is invited, come back here and read the roles again.",
    relire: "Read the roles again",
    quand: "Roles are checked each time the Activity is launched: a role that is removed takes effect at the next launch.",
  },
  commande: {
    titre: "Launch command",
    explication: "What launches the Activity from a channel.",
    voir: "Show the command",
    chargement: "Reading the command…",
    fermer: "Close",
    consigne:
      "Discord creates this command for every Activity, under the name “launch”. It is the Activity's button in " +
      "the App Launcher, in any channel, voice or not. An application has only one.",
    nom: "Name",
    aideNom: "Lowercase, with no space or slash: letters, digits, hyphens. 32 characters at most.",
    description: "Description",
    aideDescription: "Shown under the command's name.",
    renommer: "Rename the command",
    traduite:
      "Discord still shows this command under a translated name, depending on each player's language — “/lancer” in " +
      "French. Click “Rename the command” to make the name below apply in every language.",
    delai: "A change can take a few minutes to reach players; restarting Discord speeds it up.",
    relire: "Read the command again",
    tapee: {
      titre: "Typing it in a channel",
      inactive: (nom: string) =>
        `For now the command is only in the App Launcher: typing /${nom} in a channel offers nothing. The site can ` +
        "add a command of the same name that can be typed, and answer it by launching the Activity. Discord will " +
        "notify the site each time, at an address on this site.",
      active: (nom: string) =>
        `Players can type /${nom} in a channel: Discord notifies the site, which launches the Activity. ` +
        "Renaming the command renames this one too.",
      sansJeton:
        "The application's bot token is needed for the command to be typed: it is what lets Discord be told where " +
        `to send its notifications. It is entered along with the lock, with “${MODIFIER}”, on the application's card.`,
      activer: (nom: string) => `Allow typing /${nom}`,
      desactiver: "Stop allowing it to be typed",
      enCours: "Discord is checking…",
    },
    invitation: {
      titre: "The invite in the channel",
      postee:
        "When the Activity is launched from the App Launcher button, Discord posts a “game invite” in the channel, " +
        "every time. The site can answer that button itself, as it does for the typed command: Discord then posts " +
        "nothing. In return, other members no longer get a card to join from, and the button launches nothing when " +
        "the site is unreachable.",
      masquee:
        "The site answers the App Launcher button itself: Discord posts no invite in the channel. If the site is " +
        "unreachable, the button launches nothing.",
      orpheline:
        "The App Launcher button goes through the site, but Discord no longer knows where to notify it: it launches " +
        "nothing. Hand the launch back to Discord, or allow the command to be typed again.",
      masquer: "Stop posting the invite",
      retablir: "Let Discord post the invite",
    },
  },
  astuces: {
    accueil: "Welcome message:",
    sansAccueil: `No welcome message: “${MODIFIER}” to write one.`,
    titre: "Tips",
    explication: "Word of the day, advice, reminder: one at random at every launch.",
    aucune: "None yet.",
    retirer: "Remove",
    exemple: "One more tip…",
    nouvelle: "New tip",
    ajouter: "Add",
  },

  marche: {
    hote: {
      enPlace: (hote: string) =>
        `*The hostname.* Nothing to do: \`${hote}\` is the site's host, already in place. ` +
        "The site keeps answering there; Discord, for its part, finds the Activity there.",
      /** Le chemin est celui de la version anglaise du même document. */
      aPreparer: (hote: string, commande: string) =>
        `*The hostname.* \`${hote}\` must answer over HTTPS and relay to this site, which is set up neither here nor ` +
        "at Discord. First the DNS, at your registrar: point it at this server. " +
        `Then on the server, as root: \`${commande}\` — the script writes the Apache vhost and requests the certificate; ` +
        "put your own address after `--mail`. " +
        "Until that is done, Discord cannot reach the Activity and the typed command cannot be enabled. " +
        "The details are in step 6 of the walkthrough.",
      adresseExemple: "you@example.com",
    },
    portail: {
      titre: (application: string) => `*The Discord portal* (discord.com/developers, application ${application}):`,
      redirects: "OAuth2 → Redirects: `https://127.0.0.1` (required, never used).",
      activites: "Activities → Settings: tick “Enable Activities”, and the platforms you want (iOS, Android).",
      mappings: (hote: string) => `Activities → URL Mappings: prefix \`/\`, target \`${hote}\` (without https://).`,
      bot:
        "Bot: the token saved here must be this application's. The bot doesn't need to be invited " +
        "to the server: the lock queries the Activity's instance, not the server.",
    },
    pages: {
      titre:
        "*The legal pages*, which Discord asks for to verify the application (General Information in the portal). " +
        "The addresses below lead to the English version; `?lang=fr` gives the French one:",
      confidentialite: (hote: string) => `Privacy Policy URL: \`https://${hote}/discord/confidentialite?lang=en\``,
      conditions: (hote: string) => `Terms of Service URL: \`https://${hote}/discord/conditions?lang=en\``,
      incompletes:
        `“${PROPOSEE_PAR}” or “${CONTACT}” is empty: for now these pages refer to the people in charge ` +
        `of the Discord server. “${MODIFIER}” to fill them in.`,
    },
    /** « Try it », l'essai en vrai — pas « Test », déjà pris par le bouton qui interroge Discord. */
    essayer:
      "*Try it.* In Discord, with developer mode on: join a voice channel, open the activity launcher. " +
      "An unverified application only launches in a server of fewer than 25 members, and only for " +
      "its owner, their team and their testers.",
  },

  formulaire: {
    titreNouvelle: NOUVELLE,
    titreModifier: (nom: string) => `Edit “${nom}”`,
    nom: { libelle: "Name", aide: "For you only." },
    hote: {
      libelle: "Hostname",
      aide: (hoteDuSite: string) =>
        "Without https:// or a path. A host of its own: nothing else from the site will be served there. " +
        `Or ${hoteDuSite}, the site's: the Activity is added to it, and the site keeps answering there.`,
    },
    jeu: {
      libelle: "Game served",
      aide: "This Activity's only game. For another game, another application.",
      choisir: "Choose a game…",
      option: (console: string, titre: string, publie: boolean) =>
        `${console} — ${titre}${publie ? "" : " (unpublished)"}`,
    },
    identifiant: {
      /** Le libellé du portail lui-même : en anglais, le champ et sa source portent le même nom. */
      libelle: "Application ID",
      aide: "Application ID, on the portal's General Information tab.",
    },
    secret: {
      libelle: "Client Secret",
      aide: "OAuth2 tab → Reset Secret. Not the Public Key.",
    },
    dejaEnregistre: "Saved. Leave empty to keep it.",
    accueil: {
      libelle: "Welcome message",
      aide:
        "Shown at every launch, under the game's title: an introduction, an instruction for testers. " +
        "Empty: nothing. Tips, for their part, are added on the application's card.",
    },
    editeur: {
      libelle: PROPOSEE_PAR,
      aide: "A name or a pseudonym, shown on the Activity's privacy and terms pages.",
    },
    contact: {
      libelle: CONTACT,
      aide:
        "Shown on those same pages: an email address, or how to reach you on Discord. " +
        "This is how a player asks for their data to be deleted.",
    },
    verrou: "Restrict the Activity to certain Discord servers",
    serveur: {
      libelle: "Server IDs",
      /** « Copy Server ID », le libellé du client Discord en anglais. */
      aide: (maximum: number) =>
        `One per line, ${maximum} at most. Right-click the server → Copy Server ID (with developer mode on). ` +
        "Restricted roles are then chosen server by server, on the application's card.",
    },
    jetonBot: {
      libelle: "Bot token",
      aide: "Bot tab → Reset Token. With it, the site asks Discord where the Activity is running.",
    },
    enregistrement: "Saving…",
    enregistrerNouvelle: "Save the application",
    enregistrerChangements: "Save changes",
    fermer: "Close",
    annuler: "Cancel",
  },

  /**
   * Phrase pour phrase le pas à pas français : rien d'ajouté, rien d'omis.
   * « Voice channel » pour le salon vocal, le mot de Discord ; « game room »
   * pour le salon de jeu.
   */
  tutoriel: {
    titre: "Adding an Activity: the complete walkthrough",
    resume: "Everything there is to do at Discord, then here, then on the server. Allow half an hour the first time.",
    lire: "Read the walkthrough",
    replier: "Collapse",

    avant: {
      titre: "0. What you need before you start",
      points: [
        "A Discord account, and *a Discord server of your own* (or one you administer) with *fewer than 25 members*: " +
          "as long as the application isn't verified by Discord, it only launches in a server of that size, " +
          "and only for you, your team and your testers.",
        "*Developer mode* in Discord: User Settings → Advanced → Developer Mode. " +
          "It adds “Copy ID” to right-click menus.",
        "A *hostname* for the Activity (for example `prism.exemple.com`), different from the site's, " +
          "that you can point at this server at your registrar.",
        "The game already present in the site's library (published or not).",
      ],
    },

    creer: {
      titre: "1. Create the application at Discord",
      points: [
        "Open `discord.com/developers/applications` and click *New Application*. The name is the one players " +
          "will see in the launcher — the name of the game, for example. Accept the terms.",
        "*General Information* tab: copy the *Application ID* (an 18- or 19-digit number). " +
          "This is the “application ID” asked for here. Add an icon and a description: " +
          "they are shown in the activity launcher.",
        "Don't copy the *Public Key*: it isn't used here, and mistaking it for the secret gives the `invalid_client` error.",
      ],
    },

    secret: {
      titre: "2. The secret and the redirect address (OAuth2 tab)",
      points: [
        "*Client Secret* → *Reset Secret* → copy it right away: Discord only shows it once. " +
          "Regenerating it later invalidates the old one, everywhere it is stored.",
        "*Redirects* → Add Redirect → `https://127.0.0.1` → Save Changes. " +
          "Discord requires a redirect address; the Activity never uses it.",
      ],
    },

    bot: {
      titre: "3. The bot token (only to restrict the Activity to one server)",
      points: [
        "*Bot* tab → *Reset Token* → copy it right away, for the same reason as the secret.",
        "Nothing else: the bot doesn't need to be invited to the server, nor does it need any permission. " +
          "With this token, the site only asks Discord where the Activity is running and who is in it.",
        "The server ID: in Discord, right-click the server's name → *Copy Server ID*.",
      ],
    },

    activer: {
      titre: "4. Enable the Activity (Activities tab)",
      points: [
        "*Getting Started* → *Enable Activities*. Discord creates the application's launch command.",
        "*Settings*: tick the platforms you want (desktop, iOS, Android). For a Game Boy game, " +
          "the “portrait” orientation on phones works well; in landscape the screen is small.",
        "*URL Mappings*: a single row, prefix `/`, target the Activity's hostname *without* `https://` or a path " +
          "(for example `prism.exemple.com`). Discord will route everything the page requests through its proxy to that host.",
      ],
    },

    declarer: {
      titre: "5. Declare the Activity here, in the site",
      points: [
        `*${NOUVELLE}* button: the name (for you), the hostname, the game, the Application ID, the Client Secret, ` +
          "and, if you want the lock, the server ID and the bot token.",
        `*${ESSAYER}*: the credentials must be accepted before going any further.`,
        `*${MARCHE}* is a reminder, for this application, of what is left to copy into the portal.`,
        "Optional: a *welcome message* in the form (shown at every launch under the game's title), " +
          "and *tips* on the application's card — word of the day, advice, reminder. " +
          "The home screen shows one at random, and the pause menu cycles through them.",
      ],
    },

    hote: {
      titre: "6. The hostname, on the server side",
      points: [
        "At the registrar: an `A` (or `CNAME`) record pointing the hostname at this server. " +
          "Wait until it is visible (`nslookup`).",
        "On the server, as root, from the site's working tree: " +
          "`sudo ./deploiement/scripts/hote-activite.sh --domaine prism.exemple.com --mail toi@exemple.com`. " +
          "The script sets up the Apache vhost and requests the certificate. On a named instance, add " +
          "`--instance <name>`: without it, the host would relay to the default instance. " +
          `The application's “${MARCHE}” gives the command fully written out for this server.`,
        "This step is done neither here nor at Discord, and nothing works without it: the Activity stays blank, " +
          "and the typed command refuses to be enabled (“Discord could not verify the site's address”).",
        // Le premier texte cité est celui de `activite.erreurs.horsDiscord` ; le second, la réponse brute
        // du site (`src/proxy.ts`), qui reste en français : d'où sa glose.
        "Check in a browser: `https://prism.exemple.com/` must display the Activity " +
          "(the “This page opens from Discord” page) and `https://prism.exemple.com/connexion` must answer “Introuvable” (not found).",
      ],
    },

    lancer: {
      titre: "7. Launch it in Discord",
      points: [
        "Join a voice channel in the server.",
        "Open the *activity launcher* (the rocket icon in the voice channel, or the “Activities” button) " +
          "and search for the application by name.",
        "On first launch, Discord asks for permission to know your identity: accept. " +
          "The site then creates your account, restricted to this game.",
        "For a friend to try it before verification: *App Testers* tab of the portal, invite their account (50 at most).",
      ],
    },

    depannage: {
      titre: "8. When it doesn't work",
      points: [
        "*White or black screen*: the URL Mapping doesn't point to the right host, the DNS isn't visible yet, " +
          "or the vhost and the certificate are missing (step 6). Open the host in a browser to see which.",
        "*“Discord could not verify the site's address”*, when enabling the typed command: same cause, " +
          "the host does not answer over HTTPS yet (step 6).",
        "`invalid_client` in the server log: wrong ID, or the Public Key put in place of the secret. " +
          "`invalid_grant`: expired code, relaunch the Activity.",
        "“This Activity can only be played in the Discord servers it is restricted to”: the lock is refusing; check the server ID " +
          `and the bot token with “${ESSAYER}”.`,
        "The application doesn't appear in the launcher: Activities → Settings, the platform isn't ticked; " +
          "or the server has 25 members or more; or the account is neither the owner, nor on the team, nor a tester.",
        "Players don't see each other in two-player: they must be in the *same voice channel* — " +
          "it is what makes the game room.",
      ],
    },

    verification: {
      titre: "9. Beyond 25 members: verification",
      intro:
        "Discord asks for *verification of the application*, and therefore of its owner's identity, " +
        "and a commitment to its developer terms — including respect for third parties' rights. " +
        "This is a decision to make before opening the Activity to a large server: it attaches an identity to the application.",
      points: [
        "The application must belong to a *team* (portal → Teams, then General Information → transfer " +
          "the application to the team). It is the team owner's identity that Discord has checked, by Stripe.",
        `Fill in *${PROPOSEE_PAR}* and *${CONTACT}* in the application's form, then paste into ` +
          `General Information the two addresses from its “${MARCHE}”: the privacy policy and ` +
          "the terms of use, which the site serves on the Activity's host.",
        "*App Verification* tab: the list of requirements, then the “Verify App” button once all are met.",
        "Once verified, the application stays public: anyone can add it to their server. " +
          "The per-server lock is then what keeps the game for yours.",
      ],
    },
  },

  actions: {
    nomInvalide: "The name must be 1 to 60 characters long.",
    accueilTropLong: (maximum: number) => `The welcome message can be at most ${maximum} characters long.`,
    editeurTropLong: (maximum: number) => `“${PROPOSEE_PAR}” can be at most ${maximum} characters long.`,
    contactTropLong: (maximum: number) => `The contact can be at most ${maximum} characters long.`,
    hoteInvalide: "The hostname is invalid: letters, digits, hyphens and dots, with no scheme or port.",
    /** Sans la parenthèse du français : elle donne le libellé du portail, qui est ici le nom même du champ. */
    identifiantInvalide: "The Application ID is a 17- to 20-digit number.",
    serveurInvalide: "A server ID is a 17- to 20-digit number: one per line.",
    serveursTrop: (maximum: number) => `The lock can hold at most ${maximum} servers.`,
    valeurTropLongue: "One of the values is too long.",
    jeuManquant: "Choose the game this Activity serves.",
    hoteDejaPris: "Another application already has this hostname.",
    secretObligatoire: "The Client Secret is required (OAuth2 tab of the portal).",
    jetonObligatoire: "The server lock requires the bot token (Bot tab of the portal).",
    applicationDisparue: "This application no longer exists.",
    modifiee: "Application updated.",
    enregistreeSurLeSite: "Application saved on the site's host. The Discord portal still has to be set up.",
    enregistree: "Application saved. The Discord portal and the hostname still have to be set up.",
    supprimee: "Application deleted. The accounts created through this Activity remain.",
    rolesSansVerrou:
      "Restricting roles requires this server to be in the lock, with the bot token: reload the page if the lock has just changed.",
    rolesBotAbsent: "Discord does not show this server to the bot: it has not been invited, or the server ID is wrong.",
    rolesJetonRefuse: "Discord rejects the saved bot token.",
    rolesInjoignable: "Discord did not return the server's roles. Try again in a moment.",
    rolesInvalides: "The list of roles is invalid.",
    rolesReserves: (nombre: number) =>
      nombre === 1
        ? "Activity restricted to one role. Takes effect at the next launch."
        : `Activity restricted to ${nombre} roles. Takes effect at the next launch.`,
    rolesOuverts: "No restricted roles any more: all members of the server can play.",
    commandeIdentifiants: "Discord rejects the saved credentials: the command could not be read.",
    commandeAbsente:
      "This application has no launch command: enable Activities in the portal (Activities → Settings), and Discord will create it.",
    commandeInjoignable: "Discord did not answer. Try again in a moment.",
    commandeRefusee: (detail?: string) =>
      detail ? `Discord rejects this name or description: ${detail}` : "Discord rejects this name or description.",
    commandeNomInvalide: "The name is invalid: lowercase letters, digits and hyphens, no spaces, 32 characters at most.",
    commandeDescriptionInvalide: (max: number) => `The description must be 1 to ${max} characters long.`,
    commandeRenommee: (nom: string) => `The command is now called /${nom}.`,
    commandeTapeeSansJeton:
      "The application's bot token is needed: it is what lets Discord be told where to send its interactions.",
    commandeTapeeAdressePrise:
      "This application already sends its interactions to another address (Interactions Endpoint URL, in the portal): " +
      "a bot handles them. The site does not replace it — clear that field in the portal if that is no longer the case.",
    commandeTapeeAutresCommandes: (nombre: number) =>
      (nombre === 1
        ? "This application already has another command"
        : `This application already has ${nombre} other commands`) +
      ": a bot most likely answers them. Plugging the site in would take everything that bot receives; nothing was changed.",
    commandeTapeeAdresseRefusee: (detail?: string, adresse?: string) =>
      "Discord could not verify the site's address" +
      (adresse ? ` (${adresse})` : "") +
      ". It must answer from the internet, over HTTPS, under the application's host name. " +
      `For a new host name, what is missing is most often the vhost and the certificate: see “${MARCHE}”, first item.` +
      (detail ? ` Discord says: ${detail}` : ""),
    commandeTapeeActivee: (nom: string) =>
      `/${nom} can now be typed in a channel. Discord may take a few minutes to offer it; restarting Discord speeds it up.`,
    commandeTapeeDesactivee: "The command can no longer be typed. It stays in the App Launcher.",
    lanceurSansBranchement:
      "First allow the command to be typed: Discord notifies the site at that same address.",
    lanceurConfie:
      "The site now answers the App Launcher button: Discord no longer posts an invite in the channel.",
    lanceurRendu: "Discord launches the Activity itself again, and posts its invite in the channel.",
    astuceVide: "The tip is empty.",
    astuceTropLongue: (maximum: number) => `A tip can be at most ${maximum} characters long.`,
    astuceAjoutee: "Tip added.",
    astuceDisparue: "This tip no longer exists.",
    astuceSupprimee: "Tip removed.",
  },
};
