# Activité Discord

Un jeu du site, jouable **dans Discord** : un membre du serveur lance
l'Activité, appuie sur « Jouer », et sa partie est gardée pour son compte
Discord. Pas d'inscription, pas de mot de passe, rien à installer.

Cette page s'adresse à qui héberge le site et veut proposer un jeu — sa rom
hack, sa traduction — dans son propre serveur Discord.

> **État : prototype.** Essayé sur une ROM Game Boy Color, en local puis dans
> Discord sur ordinateur : connexion, jeu, sauvegarde et horloge fonctionnent.
> Pas encore essayé sur téléphone, ni avec un jeu GBA. Le verrou par serveur
> est essayé sur des réponses simulées de Discord, pas sur une vraie instance.
> Le jeu à deux, les touches et la manette sont essayés en local (deux comptes
> d'essai), pas encore dans Discord.

## En deux mots

- **L'émulation tourne chez le joueur**, dans son Discord. Le serveur du site
  envoie la page, l'émulateur (≈ 900 Ko) et la ROM, puis ne fait plus que
  ranger les sauvegardes. Un petit serveur suffit, même avec du monde.
- **Une Activité = une application Discord = un jeu.** Pour un autre jeu, une
  autre application, déclarée dans l'administration avec **son propre nom
  d'hôte** : c'est l'hôte de la requête qui dit quelle Activité répond, et un
  hôte d'Activité ne sert rien d'autre du site.
- **La partie suit le compte Discord**, d'un appareil à l'autre, au même format
  que le lecteur du site, horloge temps réel comprise — seul comme à deux.
- **À deux, le salon vocal est le salon de jeu** : deux membres qui ouvrent
  l'Activité dans le même salon vocal jouent ensemble par le câble link du
  site, sans code à échanger ; les suivants regardent. Le serveur ne tient
  qu'un nombre de salons à la fois, et l'Activité fait la file.
- **Touches et manette** se règlent dans l'Activité, et sont celles du compte :
  les mêmes que sur le site.

## Comment ça marche

Trois machines, trois rôles :

| Qui | Ce qu'il fait |
| --- | --- |
| Le serveur du site | Sert la page, l'émulateur et la ROM ; dit qui joue ; range les sauvegardes |
| Discord | Affiche la page dans un cadre et fait passer tout le trafic par son proxy (`https://<identifiant d'application>.discordsays.com`) |
| L'appareil du joueur | Fait tourner l'émulateur et le jeu |

Le trajet d'un lancement :

1. Le joueur ouvre l'Activité. Discord charge la **racine** de l'adresse
   réglée dans l'URL Mapping, avec `frame_id` dans l'adresse.
2. Le site renvoie vers la page `/discord` (`src/proxy.ts`).
3. La page obtient du client Discord un code d'autorisation (périmètre
   `identify`, rien d'autre) et l'envoie à `/api/discord/session`.
4. Le serveur échange ce code auprès de Discord — c'est là que sert le secret
   de l'application —, puis demande à Discord qui est l'utilisateur. Ce que la
   page affirme n'est jamais cru sur parole.
5. Au premier lancement, un compte du site est créé : **restreint**, avec ce
   seul jeu attribué, sans mot de passe (`users.discord_id`). Les règles
   d'accès ordinaires (`src/lib/acces.ts`) s'appliquent à ce compte.
6. La page reçoit un jeton signé, valable douze heures, qu'elle renvoie en
   en-tête. Pas de cookie : dans un cadre tiers, les navigateurs les refusent.
7. Le joueur appuie sur « Jouer » — un geste est nécessaire pour que le
   navigateur laisse démarrer le son. La ROM et la sauvegarde arrivent, le jeu
   démarre. Chaque fois que le jeu écrit sa sauvegarde, elle part au serveur.

### Pourquoi un autre émulateur que celui du site

Le lecteur du site utilise un mGBA à threads, donc `SharedArrayBuffer`, donc
l'isolation cross-origin. Discord ne la donne pas à ses cadres, et a répondu
ne pas pouvoir le faire. L'Activité charge donc un mGBA compilé **sans threads**
(`coeurs/mgba-splitscreen`, variante « une console », 32 Mio de mémoire au
départ), qui tourne dans n'importe quelle page. Voir
[son LISEZMOI](../../coeurs/mgba-splitscreen/LISEZMOI.md).

## Installer : le pas à pas complet

Tout ce qu'il y a à faire chez Discord, puis dans le site, puis sur le
serveur. Le même pas à pas est affiché dans l'administration (onglet Discord,
« Lire le pas à pas ») ; les deux s'entretiennent ensemble. Les noms d'onglets
sont ceux du portail fin 2026 ; Discord les déplace parfois, les notions
restent.

### 0. Avant de commencer

- Un compte Discord et **un serveur Discord à toi** (ou dont tu es
  administrateur) de **moins de 25 membres** : tant que l'application n'est
  pas vérifiée par Discord, elle ne se lance que dans un serveur de cette
  taille, et seulement pour toi, ton équipe et tes testeurs.
- Le **mode développeur** dans Discord : Paramètres utilisateur → Avancés →
  Mode développeur. Il ajoute « Copier l'identifiant » aux clics droits.
- Un **nom d'hôte** pour l'Activité (`prism.exemple.com`), différent de celui
  du site, que tu peux faire pointer vers le serveur chez ton registrar.
- Le jeu déjà présent dans la bibliothèque du site (publié ou non).

### 1. Créer l'application chez Discord

1. <https://discord.com/developers/applications> → **New Application**. Le
   nom est celui que verront les joueurs dans le lanceur — le nom du jeu, par
   exemple.
2. Onglet **General Information** : copier **Application ID** (18 ou
   19 chiffres), c'est « l'identifiant d'application ». Ajouter une icône et
   une description, affichées dans le lanceur d'activités.
3. Ne pas copier la **Public Key** : elle ne sert pas ici, et la prendre pour
   le secret donne `invalid_client`.

### 2. Le secret et l'adresse de retour (onglet OAuth2)

1. **Client Secret** → **Reset Secret** → copier tout de suite : Discord ne le
   montre qu'une fois. Le régénérer plus tard invalide l'ancien, partout où il
   est enregistré.
2. **Redirects** → Add Redirect → `https://127.0.0.1` → Save Changes. Discord
   exige une adresse de retour ; l'Activité ne s'en sert jamais.

### 3. Le jeton de bot (seulement pour réserver l'Activité à un serveur)

1. Onglet **Bot** → **Reset Token** → copier tout de suite.
2. Rien d'autre : le bot n'a pas besoin d'être invité dans le serveur, ni de
   permission. Avec ce jeton, le site demande seulement à Discord où tourne
   l'Activité et qui y est.
3. L'identifiant du serveur : clic droit sur le nom du serveur → **Copier
   l'identifiant du serveur**.

### 4. Activer l'Activité (onglet Activities)

1. **Getting Started** → **Enable Activities**.
2. **Settings** : cocher les plateformes voulues (ordinateur, iOS, Android).
   Pour un jeu Game Boy, l'orientation « portrait » sur téléphone convient.
3. **URL Mappings** : une seule ligne, préfixe `/`, cible le nom d'hôte de
   l'Activité **sans** `https://` ni chemin. Discord fera passer tout ce que
   la page demande par son proxy vers cet hôte.

### 5. Déclarer l'Activité dans le site

Onglet **Discord** de l'administration → *Nouvelle application* : un nom, le
nom d'hôte, le jeu servi, l'identifiant et le Client Secret, et au besoin le
verrou (identifiant du serveur et jeton de bot). Puis **Essayer auprès de
Discord** : les identifiants doivent être acceptés avant d'aller plus loin.
**Marche à suivre** rappelle, pour cette application, ce qui reste à
recopier dans le portail.

Le **nom d'hôte** est un hôte à part, réservé à cette Activité : ni la page
de connexion, ni le catalogue n'y sont servis, et sa racine renvoie vers
l'Activité. L'hôte du site lui-même est refusé — le réserver fermerait le
site. Secret et jeton de bot sont rangés comme les autres secrets des
réglages : lisibles par le seul compte du service, jamais renvoyés au
navigateur, jamais dans le dépôt — les conditions de Discord interdisent de
publier ces identifiants dans un projet ouvert, identifiant d'application
compris.

**En repli, l'environnement.** Sans ligne dans l'administration pour l'hôte
demandé, le site se rabat sur `.env` — une seule Activité, qui répond sur
l'hôte du site et sur tout hôte non déclaré :

```
DISCORD_CLIENT_ID="…"       # Application ID, onglet General Information
DISCORD_CLIENT_SECRET="…"   # Client Secret, onglet OAuth2 (bouton Reset Secret)
DISCORD_JEU="…"             # identifiant du jeu en base (colonne games.id)
```

Tant qu'aucune Activité n'est configurée pour un hôte, `/discord` et
`/api/discord` y répondent 404.

### 6. Le nom d'hôte, côté serveur

1. Chez le registrar : un enregistrement `A` (ou `CNAME`) qui fait pointer le
   nom d'hôte vers le serveur. Attendre qu'il soit visible (`nslookup`).
2. Sur le serveur, en root, depuis le clone du dépôt :
   `sudo ./deploiement/scripts/hote-activite.sh --domaine prism.exemple.com --mail toi@exemple.com`
   — même gabarit de vhost que le site, tout est relayé vers le même serveur
   Next, puis certbot.
3. Vérifier : `https://prism.exemple.com/` doit afficher l'Activité (page
   « Cette page s'ouvre depuis Discord ») et `…/connexion` répondre
   « Introuvable ».

### 7. Lancer dans Discord

1. Entrer dans un salon vocal du serveur.
2. Ouvrir le **lanceur d'activités** (l'icône de fusée du salon vocal, ou le
   bouton « Activités ») et chercher l'application par son nom.
3. Au premier lancement, Discord demande l'autorisation de connaître ton
   identité : accepter. Le site crée alors ton compte restreint à ce jeu.
4. Pour qu'un ami l'essaie avant la vérification : onglet **App Testers**,
   inviter son compte (50 au plus).

### 8. Essayer sans Discord, ou sans déployer

- **Hors de Discord**, pendant le développement : `DISCORD_ESSAI_LOCAL="1"`,
  puis ouvrir `/discord` sur un hôte qui a une Activité — par exemple une
  application déclarée sur `127.0.0.1`, le site restant sur `localhost`. Un
  compte d'essai remplace l'utilisateur Discord ; `?essai=nom` en ouvre un
  autre, `?muet=1` coupe le son. Ignoré en production.
- **Dans Discord, sans rien déployer** : un tunnel vers le serveur local
  (`cloudflared tunnel --url http://localhost:3000`), et son nom d'hôte comme
  cible de l'URL Mapping. Le tunnel expose le serveur de développement sur une
  adresse publique tant qu'il tourne : couper l'essai local avant, et remettre
  le mapping en place après.

### 9. Quand ça ne marche pas

- **Écran blanc ou noir** : l'URL Mapping ne pointe pas vers le bon hôte, le
  DNS n'est pas encore visible, ou le certificat manque. Ouvrir l'hôte dans un
  navigateur pour voir lequel.
- `invalid_client` dans le journal du serveur : identifiant faux, ou Public
  Key mise à la place du secret. `invalid_grant` : code périmé, relancer
  l'Activité.
- « Cette Activité ne se joue que dans son serveur Discord » : le verrou
  refuse ; vérifier l'identifiant du serveur et le jeton de bot avec « Essayer
  auprès de Discord ».
- L'application n'apparaît pas dans le lanceur : plateforme non cochée dans
  Activities → Settings ; serveur de 25 membres ou plus ; compte ni
  propriétaire, ni dans l'équipe, ni testeur.
- Les joueurs ne se voient pas à deux : ils doivent être dans le **même salon
  vocal**, c'est lui qui fait le salon de jeu.

### 10. Au-delà de 25 membres

Discord demande la **vérification de l'application** (onglet App
Verification), donc celle de l'identité de son propriétaire, et l'engagement
sur ses conditions développeur — dont le respect des droits des tiers. C'est
une décision à prendre avant d'ouvrir l'Activité à un grand serveur.

## Jouer à deux

Seul, l'émulation tourne chez le joueur. À deux, c'est le **câble link du
site** (`src/lib/link`) : les deux consoles tournent sur le serveur, dans un
fil de travail, et chaque page ne reçoit que son écran et le son par
WebSocket — Discord laisse passer les WebSockets dans une Activité, pas
WebRTC. Le client est le même composant que sur le site (`SalonLink`), avec
le jeton de l'Activité à la place du cookie.

- **Le salon vocal est le salon de jeu.** Tous ceux qui ouvrent l'Activité
  dans le même salon vocal partagent une *instance* Discord ; la session en
  tire une clé opaque (`cleInstance`), et le serveur ouvre un salon de câble
  link par instance : privé, sans code, invisible du site. Le premier qui
  choisit « Jouer à deux » l'ouvre, le second s'y assoit, les suivants
  regardent (cinq au plus).
- **La partie de chacun est celle de son compte**, lue au départ et réécrite
  à la fin, comme sur le site : une partie commencée seule continue à deux.
- **Les places sont comptées.** Le serveur mesure ce que coûte un salon
  (réglages → câble link) et refuse au-delà. Dans Discord, plutôt que de
  refuser, l'instance prend un rang dans une file (`src/lib/link/file.ts`) ;
  l'écran dit sa position, et le salon s'ouvre à son tour. Une instance qui
  ferme sa page sort de la file en vingt secondes.
- **GB, GBC et GBA** : les mêmes cœurs que le câble link du site.
- Sans verrou par serveur, la clé d'instance est la seule porte : qui la
  connaît peut s'asseoir dans le salon. Elle ne circule qu'entre la page et
  le site, mais ce n'est pas une preuve d'appartenance au salon vocal ; le
  verrou, lui, en est une.

Pour l'essayer hors de Discord : deux onglets sur `/discord?essai=a&instance=x`
et `/discord?essai=b&instance=x` — le même `instance` tient lieu de salon
vocal.

## Touches et manette

Le bouton « Touches et manette » de l'accueil ouvre les mêmes écrans que le
lecteur du site. Ils enregistrent sur le compte Discord par
`/api/discord/touches` (jeton en en-tête) ; un réglage fait dans l'Activité
vaut sur le site, et inversement. Non vérifié : que Discord laisse l'API
Gamepad à l'iframe d'une Activité.

## Verrouiller l'Activité sur un serveur

Par défaut, l'Activité se joue partout où Discord accepte de la lancer. Pour
la réserver à **un seul serveur** : dans l'administration, cocher *Réserver
l'Activité à un seul serveur Discord*, avec l'identifiant du serveur (clic
droit → Copier l'identifiant, mode développeur activé) et le jeton de bot
(onglet Bot du portail). En repli, dans `.env` :

```
DISCORD_SERVEUR="…"     # identifiant du serveur
DISCORD_BOT_TOKEN="…"   # Token, onglet Bot du portail
```

À l'ouverture d'une session, le site demande alors à Discord où tourne
l'instance de l'Activité et qui s'y trouve (`src/lib/discord/instance.ts`).
La session n'est ouverte que si l'instance existe, qu'elle tourne dans ce
serveur, et que l'utilisateur en fait partie. Sinon : pas de jeton, donc ni
jeu ni sauvegarde.

- La page ne décide de rien : elle donne le nom de son instance, et c'est
  Discord qui répond au site. Un nom inventé ne correspond à aucune instance.
- En cas de doute (Discord injoignable, jeton de bot refusé), c'est non.
- Le jeton de bot ne sert qu'à cette question.
- `DISCORD_SERVEUR` sans `DISCORD_BOT_TOKEN` empêche le site de démarrer,
  plutôt que de laisser croire à un verrou qui ne vérifie rien.
- Le verrou est contrôlé à l'ouverture de la session, valable douze heures.

## Ce que les joueurs voient de ton serveur

- **Le joueur ne parle qu'à Discord.** Sa page vient de
  `<identifiant d'application>.discordsays.com`, et toutes ses requêtes y
  repartent. D'après la documentation de Discord, le proxy sert justement à
  masquer l'adresse IP des joueurs et celle du serveur de l'application.
- **La page ne nomme pas le site** : pas de nom, de description ni de manifeste
  dans son en-tête, aucune adresse absolue.
- **Un hôte d'Activité ne sert que l'Activité.** Déclarée dans
  l'administration avec son nom d'hôte, rien d'autre du site n'y répond — la
  page de connexion, par exemple, serait sinon lisible à la même adresse
  `discordsays.com`, et dirait ce qu'est le site. C'est le cas de l'Activité
  de repli (`.env`), qui répond sur l'hôte du site.
- **Le logiciel se reconnaît.** Ce dépôt est public : la forme des adresses
  et les textes de la page suffisent à l'identifier. Cela dit quel logiciel
  tourne, pas où.
- **Un nom de domaine n'est pas un secret.** Tout certificat TLS est inscrit
  dans des journaux publics, et un nom d'hôte mène à une adresse IP, donc aux
  autres sites hébergés derrière elle.
- Qui a accès à l'application dans le portail développeur (les membres de
  l'équipe) voit l'URL Mapping. Les testeurs invités, non.

Non vérifié : si Discord expose l'URL Mapping d'une application à ses
utilisateurs par une autre voie que le portail.

## Les limites qui ne dépendent pas du site

- Une Activité **non vérifiée** ne se lance que dans un serveur de moins de
  25 membres, et n'est visible que du propriétaire de l'application, de son
  équipe et de ses testeurs invités (50 au plus). Au-delà, Discord demande la
  vérification de l'application, donc celle de l'identité de son propriétaire.
- Les conditions développeur de Discord interdisent une application qui porte
  atteinte aux droits d'un tiers. Chacun est responsable de ce qu'il y
  propose.

## Ce qui reste à faire

- L'essai sur iOS et Android.
- L'essai du verrou sur une vraie instance.
- La GBA (le cœur la gère, rien n'a été essayé).
- Pause quand l'Activité passe en incrustation ; orientation sur téléphone.
- Points de reprise : le lecteur du site les a, l'Activité non.
- Le jeu à deux et la manette dans Discord même (essayés en local seulement) ;
  la latence du proxy de Discord sur l'image et le son.
- Rattacher un compte existant du site à son utilisateur Discord, pour y
  retrouver sa partie.
- Le bouton d'essai ne dit pas si un hôte est bien relayé jusqu'au site.

## Où est le code

| Quoi | Où |
| --- | --- |
| La page et son composant | `src/app/discord/`, `src/components/discord/activite.tsx` |
| L'adaptateur du cœur (rythme, image, son, sauvegarde) | `src/lib/emulator/mgs.ts` |
| Session, ROM, sauvegarde, cœur, touches | `src/app/api/discord/` |
| Jouer à deux : accueil, file, client du salon | `src/components/discord/duo.tsx`, `src/components/link/salon-link.tsx`, `src/lib/link/file.ts`, `serveur.ts` |
| Touches et manette dans l'Activité | `src/components/discord/reglages.tsx`, `src/lib/keymap/ecriture.ts` |
| OAuth, jeton, compte, jeu, verrou, applications par hôte | `src/lib/discord/` |
| L'onglet Discord de l'administration | `src/app/(app)/admin/discord/`, `src/lib/admin/actions-discord.ts` |
| Vhost et certificat d'un hôte d'Activité | `deploiement/scripts/hote-activite.sh` |
| Le cœur et sa recette de compilation | `coeurs/mgba-splitscreen/` |
| Le renvoi de la racine et les en-têtes | `src/proxy.ts`, `next.config.ts` |
