**Français** · [English](README.en.md)

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
- **En solo, un menu de pause** : cinq points de reprise posés à la main, les
  astuces de l'administrateur qui défilent ; la vitesse et le son se règlent
  en bas de l'écran.
- **Un mot d'accueil et des astuces** par application, écrits dans
  l'administration : le mot à chaque lancement, une astuce au hasard.

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
   d'accès ordinaires (`src/lib/acces.ts`) s'appliquent à ce compte. Son
   pseudo est le nom Discord du joueur, et le suit s'il en change. Dans
   l'administration, le compte porte l'étiquette « discord », et son temps de
   jeu se compte comme sur le site (Temps de jeu, « qui joue ») : l'Activité
   signale la partie chaque minute (`/api/discord/partie`), et le serveur du
   câble link le fait pour les deux joueurs d'un salon.
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

Le formulaire a aussi un **mot d'accueil** (affiché à chaque lancement sous
le titre du jeu : une présentation, une consigne aux testeurs), et la carte
de l'application des **astuces** à ajouter une par une : mot du jour,
conseil, rappel. L'accueil en montre une au hasard, et le menu de pause les
fait toutes défiler.

Enfin **Proposée par** et **Contact** : un nom ou un pseudonyme, et un moyen
de te joindre. Ils s'affichent sur les pages légales de l'Activité (voir
« Les pages légales ») et ne sont écrits nulle part dans le dépôt.

Le **nom d'hôte** est, au choix :

- **un hôte à part, réservé à cette Activité** : ni la page de connexion, ni
  le catalogue n'y sont servis, et sa racine renvoie vers l'Activité. C'est
  ce qu'il faut quand l'Activité ne doit rien dire du site qui l'héberge —
  une bibliothèque privée, par exemple ;
- **l'hôte du site lui-même** : l'Activité s'y ajoute sans rien réserver. Le
  site continue d'y répondre, et Discord, qui ouvre la racine avec
  `frame_id`, y trouve l'Activité. C'est ce qu'il faut pour un site public
  consacré au jeu que l'Activité sert (une [vitrine](../vitrine.md)) : une
  seule adresse, ni DNS ni vhost de plus. En contrepartie, tout le site
  devient joignable à travers le proxy de Discord — il refuse toujours de
  s'afficher dans un cadre, l'Activité exceptée.

Secret et jeton de bot sont rangés comme les autres secrets des
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
   Next, puis certbot. Sur une instance nommée (voir
   [deploiement.md](../deploiement.md#une-seconde-instance-sur-le-même-serveur)),
   ajouter `--instance <nom>` : sans lui, l'hôte relaierait vers l'instance
   par défaut.
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
- « Cette Activité ne se joue que dans les serveurs Discord qui lui sont
  réservés » : le verrou refuse ; vérifier l'identifiant du serveur et le
  jeton de bot avec « Essayer auprès de Discord ».
- L'application n'apparaît pas dans le lanceur : plateforme non cochée dans
  Activities → Settings ; serveur de 25 membres ou plus ; compte ni
  propriétaire, ni dans l'équipe, ni testeur.
- Les joueurs ne se voient pas à deux : ils doivent être dans le **même salon
  vocal**, c'est lui qui fait le salon de jeu.

### 10. Au-delà de 25 membres : la vérification

Discord demande la **vérification de l'application**, donc celle de
l'identité de son propriétaire, et l'engagement sur ses conditions
développeur — dont le respect des droits des tiers. C'est une décision à
prendre avant d'ouvrir l'Activité à un grand serveur : elle attache une
identité à l'application.

D'après les pages d'aide de Discord (novembre 2026) :

1. L'application doit appartenir à une **équipe** (portail → Teams, puis
   General Information → transférer l'application à l'équipe). C'est
   l'identité du propriétaire de l'équipe que Discord fait contrôler, par
   Stripe.
2. Les **pages légales** : coller dans General Information les deux adresses
   que donne la « Marche à suivre » de l'application —
   `https://<hôte>/discord/confidentialite?lang=en` (Privacy Policy URL) et
   `https://<hôte>/discord/conditions?lang=en` (Terms of Service URL) — la
   version anglaise, celle que lira Discord.
3. L'onglet **App Verification** liste les conditions ; quand toutes sont
   remplies, le bouton « Verify App ».

Une fois vérifiée, l'application reste **publique** : Discord ne laisse plus
désactiver le réglage « Public Bot », et n'importe qui peut l'ajouter à son
serveur. Le verrou par serveur est alors ce qui réserve le jeu au tien. La
découverte (annuaire, lanceur des autres serveurs) reste un réglage à part,
désactivé tant qu'on ne l'active pas.

Non vérifié : la liste exacte de l'onglet App Verification, que seul le
propriétaire de l'application voit.

## Les pages légales

Chaque Activité sert, sur son nom d'hôte, une **politique de
confidentialité** (`/discord/confidentialite`) et des **conditions
d'utilisation** (`/discord/conditions`). Discord en demande les adresses dans
le portail, et ses conditions développeur exigent la première.

- Elles nomment le jeu, et ce que l'administrateur a saisi dans « Proposée
  par » et « Contact ». Sans ces deux champs, elles renvoient aux
  responsables du serveur Discord où l'Activité est lancée. Rien n'y nomme
  le site qui héberge l'Activité.
- La politique de confidentialité **décrit ce que le code fait** : ce qu'il
  reçoit de Discord, ce qu'il enregistre, ce qu'il journalise. Qui change
  l'un relit l'autre, et met à jour `MISE_A_JOUR` dans
  `src/lib/discord/mentions.ts`.
- Elle promet la suppression d'un compte sur demande : c'est le bouton
  « Supprimer » de l'onglet Comptes, qui retire le compte, sa partie, ses
  reprises et ses réglages.
- Elle ne dit pas combien de temps le serveur web garde son journal : cela
  dépend de l'hébergement, pas du site.
- Les textes existent en français et en anglais, chacun à son adresse
  (`?lang=fr`, `?lang=en`) ; le français fait référence. Ils valent pour
  n'importe quel jeu : ils ne disent rien des droits sur celui que l'Activité
  sert.

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

## Sa partie : l'emporter, en apporter une

À l'accueil, « Télécharger ma partie » donne le fichier de sauvegarde
(`.sav`, le format du lecteur du site, lisible par mGBA ou une vraie
cartouche) et « Remplacer par un fichier » en importe un, après confirmation ;
le serveur garde les versions précédentes. C'est la même partie que sur le
site, portée par le compte.

Ce qui est importé finit dans un cœur d'émulation — chez le joueur en solo,
**sur le serveur** à deux. Ce qui le contient : une sauvegarde est de la
mémoire de cartouche lue par le jeu émulé, jamais du code exécuté ; les
cœurs sont du WebAssembly, sans accès au système ; chaque salon tourne dans
son fil de travail, borné en mémoire, dont le plantage ferme le salon sans
rien écrire ; et le serveur refuse au-delà de 132 Kio
(`TAILLE_MAX_SAUVEGARDE`), la plus grande cartouche plus un pied de page
d'horloge — pour le site comme pour l'Activité. Le pire cas est un salon qui
tombe, ou une partie trafiquée qui gêne l'autre joueur.

« Repartir de zéro » met la partie de côté de la même façon : elle rejoint
les versions précédentes (le site sait la restaurer), et le prochain
« Jouer » démarre comme la première fois. Les points de reprise restent.

Non vérifié : que le client Discord laisse l'iframe déclencher un
téléchargement. Le repli est le site, même compte, même partie.

## Le menu de pause : reprises, astuces, vitesse, son

En solo, « Pause » en bas de l'écran arrête la console et ouvre le menu :

- **Cinq points de reprise**, posés à la main seulement — pas de rotation
  automatique comme sur le site. Même stockage que le lecteur du site
  (`/api/discord/etat`, jeton en en-tête) : une reprise prise dans Discord
  s'y retrouve. Le cœur de l'Activité rend un état brut, sans image : la
  page y joint une capture de l'écran (`?vignette=1`), rangée à part.
- **Les astuces** de l'application défilent, une toutes les sept secondes.
- **La vitesse** (×1 à ×5, et la touche d'accélération par-dessus) et **le
  son** (bouton et curseur, retenu dans le navigateur) sont en bas de
  l'écran, pendant le jeu.
- **La vibration**, pour un jeu dont la cartouche a un moteur (Pokémon
  Pinball et ses dérivés, par exemple) : un bouton l'allume ou la coupe,
  retenu dans le navigateur. Voir ci-dessous.

### La vibration des cartouches

Le cœur rapporte, image par image, la part du temps où le moteur de la
cartouche a tourné (`mgs_get_rumble`) ; `src/lib/emulator/vibration.ts` en
fait vibrer ce que le joueur tient :

- **le téléphone**, par `navigator.vibrate` : sur Android. iOS ne propose cet
  appel dans aucun navigateur ; rien ne vibre, rien ne casse ;
- **la manette branchée**, quand le navigateur sait commander ses moteurs
  (`vibrationActuator`).

Le bouton du menu de pause n'apparaît que si le jeu vibre — l'en-tête d'une
cartouche Game Boy l'annonce (MBC5 à moteur), une cartouche GBA se reconnaît
à sa première vibration — et s'il y a de quoi vibrer : un écran tactile qui
connaît `navigator.vibrate`, ou une manette à moteurs. Solo seulement : à
deux, l'émulation tourne sur le serveur, qui ne transmet que l'image et le
son.

Le lecteur du site vibre de la même façon, pour ces mêmes jeux : il prend
alors ce cœur à la place du sien (voir `docs/decisions.md`, point 1).

Essayé dans un navigateur avec Pokémon Pinball Generations, les appels à
`navigator.vibrate` relevés un à un. **Jamais senti sur un vrai téléphone ni
dans l'application Discord**, où l'Activité tourne dans une vue web dont on
ne sait pas si elle laisse vibrer ; la manette et la GBA n'ont pas été
essayées non plus.

## Touches et manette

Le bouton « Touches et manette » de l'accueil ouvre les mêmes écrans que le
lecteur du site. En solo, le menu de pause a le même bouton : on règle ses
touches sans quitter la partie, console en pause, et « Fermer » ramène au
menu de pause. Ils enregistrent sur le compte Discord par
`/api/discord/touches` (jeton en en-tête) ; un réglage fait dans l'Activité
vaut sur le site, et inversement. Non vérifié : que Discord laisse l'API
Gamepad à l'iframe d'une Activité.

## La commande de lancement

Dès qu'une application active les Activités, Discord lui crée une commande
d'entrée, nommée `launch`. C'est le bouton de l'Activité dans le lanceur
d'applications : Discord la lance lui-même, le site n'a rien à recevoir.
Toutes les Activités portant ce même nom par défaut, la renommer la rend plus
facile à trouver.

**Elle ne se tape pas.** La liste qui s'ouvre quand on tape « / » dans un
salon ne la propose pas, et l'écrire en entier ne lance rien — constaté sur
une vraie application, renommée, sans restriction de permissions. La
documentation de Discord la range d'ailleurs parmi les commandes « d'interface »,
à côté de celles des menus contextuels. Pour qu'un joueur tape `/prism`, voir
« La taper dans un salon », plus bas.

Sur la carte de l'application, **Commande de lancement → Voir la commande**
lit son nom et sa description auprès de Discord, et permet de les changer —
`prism` au lieu de `launch`. Le nom n'est pas enregistré dans le site :
Discord est la seule source (`src/lib/discord/commande.ts`).

- Une application n'a qu'une commande d'entrée : on la renomme, on n'en
  ajoute pas.
- Le nom suit les règles de Discord : minuscules, chiffres et tirets, sans
  espace, 32 caractères au plus.
- Le site s'adresse à Discord avec le jeton de bot s'il y en a un, sinon avec
  l'identifiant et le secret de l'application.
- La commande par défaut porte un nom par langue — « lancer » dans un Discord
  en français — et c'est lui que voient les joueurs. Renommer efface ces
  traductions : le nouveau nom vaut alors pour toutes les langues, et Discord
  ne le traduit plus.
- Un changement peut mettre quelques minutes à apparaître chez les joueurs.
- L'Activité se lance aussi depuis un salon textuel, par le lanceur
  d'applications de la barre de message : pas besoin d'être dans un salon
  vocal. Discord poste alors dans le salon un message qui annonce la partie,
  d'où les autres membres peuvent la rejoindre. Constaté à l'usage ; la
  documentation de Discord ne dit pas dans quels types de salons. Pour ne
  plus l'avoir, voir « L'invitation dans le salon », plus bas.
- Le verrou de serveur et les rôles réservés s'appliquent de la même façon,
  quel que soit le salon.

### La taper dans un salon

Pour que `/prism` s'écrive dans un salon, comme les commandes des Activités
de Discord lui-même, il faut une seconde commande, ordinaire celle-là, du même
nom. Discord ne la lance pas tout seul : à chaque fois qu'un joueur la tape,
il le signale à l'application, à l'adresse qu'elle lui a déclarée
(*Interactions Endpoint URL*), et attend sa réponse. Le site répond « lance
l'Activité » (`LAUNCH_ACTIVITY`), et Discord l'ouvre comme depuis le lanceur.

Dans le même panneau, **La taper dans un salon → Permettre de taper /prism**
fait les trois gestes nécessaires, dans cet ordre :

1. lire la clé publique de l'application auprès de Discord et la retenir
   (`discord_apps.public_key`) — c'est avec elle que le site vérifie que ce
   qu'il reçoit vient bien de Discord ;
2. déclarer à Discord l'adresse `https://<hôte de l'application>/api/discord/interactions`.
   Discord l'essaie sur-le-champ, avec une requête bien signée et une autre
   mal signée : le site doit donc être joignable depuis internet, en HTTPS ;
3. créer la commande, avec le nom et la description de la commande d'entrée.

**Ne plus permettre de la taper** défait les trois, dans l'ordre inverse.
Renommer la commande renomme les deux.

- Il faut le **jeton de bot** : Discord ne laisse ni lire la clé ni déclarer
  l'adresse avec l'identifiant et le secret. Il se saisit avec le verrou ; une
  fois la commande tapée activée, lever le verrou ne l'efface plus.
- Le site refuse de se brancher sur une application qui a déjà une adresse
  d'interactions, ou d'autres commandes : un bot s'en occupe, et lui déclarer
  une adresse détournerait vers le site tout ce que ce bot reçoit.
- La route (`src/app/api/discord/interactions`) ne lit du message de Discord
  que l'application visée et le type d'interaction. Discord y joint qui a tapé
  la commande et dans quel salon : rien n'en est lu, gardé ni journalisé. La
  page de confidentialité de l'Activité le dit, dès que la commande tapée est
  activée.
- Les droits du joueur — verrou, rôles — ne sont pas vérifiés à ce moment-là,
  mais à l'ouverture de l'Activité, comme pour un lancement depuis le lanceur.
- Une signature fausse vaut un 401. Discord en envoie exprès de temps en
  temps, et retire l'adresse d'une application qui les accepterait.
- Pour une Activité configurée par l'environnement, sans administration :
  `DISCORD_CLE_PUBLIQUE` (« Public Key », onglet *General Information*), puis
  l'adresse et la commande à la main, dans le portail et par l'API.
- Constaté sur une vraie application : la commande apparaît dans la liste
  « / » et ouvre l'Activité. La liste peut mettre quelques minutes à la
  proposer, et relancer Discord l'accélère.

### L'invitation dans le salon

Quand Discord lance lui-même l'Activité — depuis le bouton du lanceur
d'applications — il poste dans le salon une « invitation de jeu », à chaque
fois : une carte avec un bouton « Jouer », qui reste après la partie. Aucun
réglage du portail ne l'empêche.

La commande tapée, elle, n'en poste pas : c'est le site qui répond, et Discord
se contente d'ouvrir l'Activité. Constaté sur une vraie application. Le
bouton du lanceur peut passer par le même chemin : la commande d'entrée porte
un réglage, `handler`, qui dit à Discord de ne plus la lancer lui-même et de
prévenir l'application à la place.

Dans le même panneau, une fois la commande tapée activée, **L'invitation dans
le salon → Ne plus poster l'invitation** change ce réglage ; **Laisser Discord
poster l'invitation** le remet comme à l'origine.

- Il faut la commande tapée : c'est à la même adresse que Discord prévient le
  site. « Ne plus permettre de la taper » rend d'abord le lancement à Discord,
  pour que le bouton ne reste pas sans réponse.
- En contrepartie, les autres membres du salon n'ont plus de carte d'où
  rejoindre la partie, et le bouton du lanceur ne lance rien quand le site est
  injoignable — Discord, lui, lançait l'Activité sans rien demander.
- Rien n'est enregistré dans le site : le réglage se lit auprès de Discord,
  comme le nom de la commande.
- Essayé contre un faux Discord. Que l'invitation disparaisse aussi pour le
  bouton du lanceur reste à constater sur une vraie application : la
  documentation de Discord ne le dit pas.

## Verrouiller l'Activité sur un serveur

Par défaut, l'Activité se joue partout où Discord accepte de la lancer. Pour
la réserver à **certains serveurs** : dans l'administration, cocher *Réserver
l'Activité à certains serveurs Discord*, avec leurs identifiants, un par ligne
(clic droit sur le serveur → Copier l'identifiant, mode développeur activé),
et le jeton de bot (onglet Bot du portail). Un seul serveur ou plusieurs,
vingt au plus (`discord_app_servers`). En repli, dans `.env`, pour un seul
serveur :

```
DISCORD_SERVEUR="…"     # identifiant du serveur
DISCORD_BOT_TOKEN="…"   # Token, onglet Bot du portail
```

À l'ouverture d'une session, le site demande alors à Discord où tourne
l'instance de l'Activité et qui s'y trouve (`src/lib/discord/instance.ts`).
La session n'est ouverte que si l'instance existe, qu'elle tourne dans l'un
de ces serveurs, et que l'utilisateur en fait partie. Sinon : pas de jeton,
donc ni jeu ni sauvegarde.

- La page ne décide de rien : elle donne le nom de son instance, et c'est
  Discord qui répond au site. Un nom inventé ne correspond à aucune instance.
- En cas de doute (Discord injoignable, jeton de bot refusé), c'est non.
- Le jeton de bot ne sert qu'à cette question, et à celle des rôles
  ci-dessous.
- `DISCORD_SERVEUR` sans `DISCORD_BOT_TOKEN` empêche le site de démarrer,
  plutôt que de laisser croire à un verrou qui ne vérifie rien.
- Le verrou est contrôlé à l'ouverture de la session, valable douze heures.

### Réserver à certains rôles

Le verrou dit **où** l'Activité se joue ; les rôles disent **qui**, parmi les
membres d'un serveur, a le droit d'y jouer. Sur la carte de l'application,
**Rôles réservés → Choisir les rôles** lit les rôles du serveur auprès de
Discord et les propose par leur nom. Un seul rôle coché suffit au joueur ;
aucune case cochée, et tous les membres du serveur jouent, comme avant.

**Les rôles se choisissent serveur par serveur** : avec plusieurs serveurs
dans le verrou, la carte montre un panneau par serveur, à son identifiant. Un
rôle n'existe que dans son serveur ; ceux d'un serveur ne comptent pas dans un
autre, et l'un peut être ouvert à tous ses membres quand l'autre est réservé.

En repli, dans `.env`, pour le serveur de `DISCORD_SERVEUR` :

```
DISCORD_ROLES="…,…"     # identifiants des rôles, séparés par des virgules
```

À l'ouverture d'une session, après le contrôle du lieu, le site demande à
Discord la fiche de membre du joueur dans le serveur où l'Activité tourne et
y regarde ses rôles (`src/lib/discord/roles.ts`). Sans l'un des rôles réservés
de ce serveur-là : pas de jeton.

- **Le bot doit être invité dans chaque serveur où des rôles sont réservés.** Discord ne répond sur les
  membres d'un serveur qu'à un bot qui en fait partie — ce que le verrou
  seul ne demandait pas. Aucune permission à lui donner. Si le bot n'y est
  pas, l'écran de choix des rôles le dit et donne le lien d'invitation.
- En cas de doute (bot absent, Discord injoignable), c'est non pour tout le
  monde. **Essayer auprès de Discord** vérifie d'avance que le bot lit les
  rôles et que ceux qui sont réservés existent encore.
- Deux refus distincts pour le joueur : il n'a aucun des rôles, ou ses rôles
  n'ont pas pu être vérifiés.
- Les rôles sont contrôlés à l'ouverture de la session, comme le verrou : un
  rôle retiré prend effet au lancement suivant.
- Retirer un serveur du verrou, ou lever le verrou, oublie ses rôles
  réservés : ils n'existent pas ailleurs. Les autres serveurs gardent les
  leurs, et un serveur ajouté s'ouvre à tous ses membres en attendant qu'on
  lui choisisse des rôles.
- L'Activité reste visible dans le lanceur de Discord pour tous les membres ;
  c'est en l'ouvrant qu'un membre sans rôle est refusé.
- La politique de confidentialité de l'Activité le dit dès qu'un rôle est
  réservé : la fiche de membre est lue, pas conservée.

## Ce que les joueurs voient de ton serveur

- **Le joueur ne parle qu'à Discord.** Sa page vient de
  `<identifiant d'application>.discordsays.com`, et toutes ses requêtes y
  repartent. D'après la documentation de Discord, le proxy sert justement à
  masquer l'adresse IP des joueurs et celle du serveur de l'application.
- **La page ne nomme pas le site** : pas de nom, de description ni de manifeste
  dans son en-tête, aucune adresse absolue.
- **Un hôte réservé à l'Activité ne sert que l'Activité.** Déclarée dans
  l'administration avec un nom d'hôte à elle, rien d'autre du site n'y répond — la
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
| Télécharger, importer, repartir de zéro | `src/components/discord/partie.tsx` |
| Points de reprise et vignettes | `src/app/api/discord/etat/`, `src/components/player/savestates.tsx`, `src/lib/states.ts` |
| Vitesse et son, partagés avec le lecteur du site | `src/components/player/commandes.tsx` |
| Mot d'accueil et astuces | `src/lib/discord/applications.ts` (`discord_tips`), `src/lib/admin/actions-discord.ts` |
| OAuth, jeton, compte, jeu, verrou, applications par hôte | `src/lib/discord/` |
| Rôles réservés | `src/lib/discord/roles.ts` |
| Commande de lancement | `src/lib/discord/commande.ts` |
| Commande tapée : interactions reçues de Discord | `src/lib/discord/interactions.ts`, `src/app/api/discord/interactions/route.ts` |
| Pages légales (confidentialité, conditions) | `src/app/discord/confidentialite/`, `src/app/discord/conditions/`, `src/components/discord/mentions.tsx`, `src/lib/discord/mentions.ts` |
| L'onglet Discord de l'administration | `src/app/(app)/admin/discord/`, `src/lib/admin/actions-discord.ts` |
| Vhost et certificat d'un hôte d'Activité | `deploiement/scripts/hote-activite.sh` |
| Le cœur et sa recette de compilation | `coeurs/mgba-splitscreen/` |
| Le renvoi de la racine et les en-têtes | `src/proxy.ts`, `next.config.ts` |
