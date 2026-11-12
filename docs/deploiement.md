**Français** · [English](deploiement.en.md)

# Mise en ligne

Le dépôt ne contient aucune valeur propre à une installation : pas de domaine,
pas de secret, pas de chemin absolu. Tout passe par `/etc/online-emulators.env`,
créé sur le serveur. Ce document explique comment installer le site sur un
serveur Debian 12 qui fait déjà tourner d'autres sites derrière Apache.

## Ce que l'installation met en place

| Chemin | Rôle | Propriétaire |
| --- | --- | --- |
| `/opt/online-emulators.git` | dépôt nu, cible des `git push` | le pousseur |
| `/opt/online-emulators` | arbre de travail, construit par le hook | pousseur:jeux |
| `/var/lib/online-emulators` | base SQLite, sauvegardes de jeu, avatars | jeux:jeux |
| `/var/backups/online-emulators` | archives quotidiennes | root, `700` |
| `/etc/online-emulators.env` | configuration et secrets | root:jeux, `640` |

Le serveur applicatif tourne sous un utilisateur système `jeux`, sans shell ni
répertoire personnel, et n'écoute que sur `127.0.0.1`. Apache est seul exposé.

Ce sont les noms de l'instance par défaut. Le même serveur peut en porter une
autre, dont tous les noms reçoivent un suffixe : voir
[Une seconde instance sur le même serveur](#une-seconde-instance-sur-le-même-serveur).

## Prérequis

- Debian 12, Apache 2.4.47 ou plus récent (pour `upgrade=websocket`)
- Node 22.18 ou plus récent, `npm`, `git` — les scripts du projet sont en
  TypeScript, que Node exécute tel quel à partir de cette version
- `certbot` et son plugin Apache : `apt install certbot python3-certbot-apache`
- un enregistrement DNS A du domaine vers le serveur, déjà en place

## Installation

Depuis son poste, cloner le dépôt dans le répertoire personnel du compte qui
poussera les mises à jour, puis lancer le script une seule fois :

```sh
git clone <dépôt> ~/online-emulators
cd ~/online-emulators
sudo ./deploiement/scripts/installation.sh \
    --domaine jeux.exemple.com \
    --mail admin@exemple.com
```

Options : `--port` (3100 par défaut), `--bibliotheque` pour placer les jeux
ailleurs que dans `/var/lib/online-emulators/library`, `--pousseur` si le compte
qui poussera n'est pas celui qui lance `sudo`, `--instance` pour installer une
instance de plus à côté de la première (voir plus bas).

Le script est **idempotent** : on peut le relancer après une modification des
gabarits. Une exception : le vhost HTTPS (`<domaine>-le-ssl.conf`) est généré
**une seule fois** par certbot, à partir du vhost `:80`, au moment où il délivre
le certificat. Modifier `apache-vhost.conf.gabarit` ensuite ne le met pas à jour
— il faut reporter le changement à la main dans les deux fichiers. Il ne régénère jamais `SESSION_SECRET`, ce qui déconnecterait tous les
comptes, et il vérifie la configuration Apache avant tout rechargement — une
erreur de syntaxe couperait les autres sites du serveur.

Le premier déploiement est déclenché par le script lui-même : il pousse le clone
local vers le dépôt nu, ce qui exécute le hook.

## Mises à jour

```sh
git remote add serveur ssh://<serveur>/opt/online-emulators.git
git push serveur main
```

Le hook `post-receive` enchaîne : `git checkout`, `npm ci`, migrations Drizzle,
installation du cœur d'émulation, `next build`, puis redémarrage du service. Le serveur n'a **aucun accès à la
forge** : rien à configurer côté GitHub, aucune clé de déploiement à lui confier.

Le hook installé dans `/opt/online-emulators.git/hooks/` est une **copie** faite
par `installation.sh` : modifier `deploiement/scripts/post-receive` dans le dépôt
ne change rien au déploiement suivant. C'est délibéré — un hook qui se réécrit
lui-même pendant qu'il tourne est une mauvaise surprise le jour où il est cassé.

Le dépôt nu appartient au compte qui pousse, donc rafraîchir la copie **ne
demande pas** `sudo` :

```sh
install -m 755 /opt/online-emulators/deploiement/scripts/post-receive \
               /opt/online-emulators.git/hooks/post-receive
```

Le fichier est le même pour toutes les instances et ne contient aucun chemin :
une fois copié, il déduit son instance du nom du dépôt nu dans lequel il se
trouve (`/opt/online-emulators.git`, ou `/opt/online-emulators-<nom>.git`), et
de là l'arbre de travail, le fichier d'environnement, le service et
l'utilisateur. Il refuse donc de tourner depuis un autre endroit.

**Un hook copié avant l'arrivée des instances n'a pas à être remplacé.** Il
porte en dur les noms de l'instance par défaut, qui n'ont pas changé, et le
`migrer.sh` qu'il appelle retrouve seul son instance. Le rafraîchir par la
commande ci-dessus reste possible, et ne change rien à ce qu'il fait.

Les migrations sont appliquées sous l'identité du service, par
`deploiement/scripts/migrer.sh` via `sudo`. Le hook, lui, tourne sous le compte
qui pousse, et `/var/lib/online-emulators` n'est écrivable que par `jeux` :
SQLite a besoin d'écrire dans le **dossier**, et pas seulement dans le fichier,
pour y créer `app.db-wal` et `app.db-shm`.

Le site est indisponible quelques secondes pendant le redémarrage, et la
construction remplace `.next` sous le processus en cours : un joueur qui navigue
pile à ce moment peut voir une erreur et devra recharger. Avec une poignée de
joueurs, cela n'a pas paru valoir la complexité d'un déploiement sans coupure.

## Après l'installation

### Créer un compte

L'inscription est fermée tant qu'on ne l'ouvre pas. Une fois le premier
administrateur en place, tout se fait dans **Administration → Comptes** :
créer un compte directement, donner un lien d'invitation (valable un jour, une
semaine ou un mois, pour un ou plusieurs comptes), ou ouvrir les inscriptions
à tous — ce qui demande le relais SMTP et le captcha décrits plus bas. La
ligne de commande sert au premier compte, et de secours.

```sh
cd /opt/online-emulators
sudo -u jeux node --env-file=/etc/online-emulators.env \
    scripts/create-user.ts --pseudo Untel --email untel@exemple.com --admin
```

Le mot de passe est tiré au hasard et affiché une seule fois. Passer par
`sudo -u jeux` et non par root : root laisserait des fichiers `app.db-wal`
appartenant à root, que le service ne pourrait plus écrire ensuite.

### Renseigner le relais SMTP

Le plus simple est de le faire depuis le site : **Administration → Réglages →
Envoi d'e-mails**, avec un bouton pour s'envoyer un message de test. Ce qui est
saisi là l'emporte sur le fichier d'environnement et prend effet aussitôt, sans
redémarrage. Le fichier d'environnement, décrit ci-dessous, reste la solution
quand on préfère ne rien ranger de tel dans la base.

Tant que `SMTP_HOST` est vide, les liens de réinitialisation de mot de passe
sont écrits dans le journal du service au lieu d'être envoyés — la
fonctionnalité est donc inutilisable par les joueurs.

**Un serveur de mail installé sur le serveur lui-même finira en indésirables**
chez Gmail et Outlook : l'IP d'un hébergeur n'a aucune réputation, et un lien de
réinitialisation qui n'arrive pas vaut une fonctionnalité absente. Mieux vaut un
relais externe (Brevo, Mailjet, Postmark…) : le code parle à n'importe quel SMTP,
c'est une affaire de quatre lignes dans `/etc/online-emulators.env`.

```sh
SMTP_HOST="smtp-relay.exemple.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASSWORD="..."
MAIL_FROM="Online Emulators <noreply@jeux.exemple.com>"
```

Puis `sudo systemctl restart online-emulators`.

### Activer le captcha

Même choix que pour le relais : les deux clés se saisissent dans
**Administration → Réglages → Captcha**, ou dans le fichier d'environnement.

Le formulaire de mot de passe oublié accepte un captcha Cloudflare Turnstile,
et les inscriptions ouvertes l'exigent : sans les deux clés, elles restent
fermées. Tant que `TURNSTILE_SECRET_KEY` est vide, le captcha du mot de passe
oublié est contourné. Renseigner les deux clés depuis le tableau de bord
Cloudflare suffit à l'activer.

Les en-têtes d'isolation cross-origin (`COOP`/`COEP`) ne couvrent que le
lecteur (`/jouer`, `/partie` pour les invités) et son cœur (`/mgba`),
précisément pour que le widget Turnstile, chargé depuis Cloudflare, reste
autorisé sur les pages d'authentification.

### Déposer les jeux

`LIBRARY_DIR` attend un dossier par console, puis un dossier par jeu. Le service
ne fait que le **lire** : il peut donc vivre dans `/home`, où
`ProtectHome=read-only` autorise la lecture sans donner le droit d'écrire.

### Des liens symboliques plutôt que des copies

Un dossier de travail contient rarement une seule ROM. Pour une même version de
jeu on y trouve souvent la build de référence et plusieurs variantes destinées
aux cartouches — dont des versions *batteryless*, qui écrivent leur sauvegarde
dans la mémoire flash de la cartouche. **Cette flash n'existe pas en émulation :
la sauvegarde échoue ou se corrompt.** Un scan automatique du dossier de travail
publierait l'une ou l'autre au hasard.

La bibliothèque est donc un dossier à part, hors de l'arborescence de travail,
où chaque jeu est un **vrai répertoire** contenant des **liens symboliques** vers
les fichiers précisément choisis :

```
bibliotheque-jeux/
  gbc/
    mon-rom-hack/
      game.json                 fichier réel, propre à la publication
      rom.gbc    -> .../Mon rom hack/Mon rom hack 1.2.gbc
      cover.webp -> .../Mon rom hack/jaquette.webp
```

Rien n'est dupliqué, le dossier de travail n'est pas pollué par des métadonnées
de site, et publier une nouvelle version revient à refaire pointer un lien.

Deux conséquences à ne pas perdre de vue :

- **Le scan doit suivre les liens.** `readdir` avec `withFileTypes` rapporte un
  lien symbolique comme tel, pas comme un fichier : un test `isFile()` écarterait
  silencieusement toute la bibliothèque. Il faut un `stat` (qui déréférence) et
  non un `lstat`.
- **Ce dossier ne doit pas être synchronisé.** Les liens contiennent des chemins
  absolus propres au serveur ; synchronisés vers un autre poste, ils pointeraient
  dans le vide. Le dossier de travail, lui, peut rester synchronisé.

### Publier les jeux déposés

Le catalogue ne se met pas à jour tout seul : déposer un dossier ne suffit pas,
il faut relancer le scan. **Le plus simple est de le faire depuis le site**,
dans la page Administration — le service tourne déjà sous l'utilisateur
propriétaire des données, donc aucun privilège n'est nécessaire.

En ligne de commande, si le site est inaccessible :

```sh
cd /opt/online-emulators
sudo -u jeux node --env-file=/etc/online-emulators.env scripts/scan-library.ts
```

Sous `jeux` et non root, pour la même raison que la création de compte : root
laisserait derrière lui des fichiers que le service ne pourrait plus écrire. Le
scan est idempotent, et chaque avertissement qu'il affiche désigne un dossier
qu'il a écarté — ROM absente, ambiguë, lien symbolique mort, ou `game.json`
invalide.

### Les jeux à un seul joueur

Le câble link est proposé pour tout jeu Game Boy, Game Boy Color ou Game Boy
Advance : rien dans une ROM ne dit si elle s'en sert. Pour un jeu qui se joue
seul — un flipper, par exemple —, on le dit soi-même :

- dans son `game.json`, `"solo": true`, puis un scan ;
- ou dans **Administration → Bibliothèque**, en ouvrant le jeu : la case
  « Jeu à un seul joueur ». Elle s'applique tout de suite et tient au scan
  suivant, comme les autres retouches.

Un jeu solo n'a plus de section « Câble link » sur sa fiche, le serveur refuse
d'y ouvrir un salon, et une Activité Discord qui le sert ne montre que
« Jouer » (voir [l'Activité Discord](discord/README.md#jouer-à-deux)).

### Compléter les fiches des jeux officiels

Un jeu du commerce rangé dans la bibliothèque (`"officiel": true` dans son
`game.json`, ce que fait `scripts/importer-roms.ts --officiel`) n'a ni
description ni jaquette. **Administration → Bibliothèque → Compléter les
fiches** va les chercher, sans rien écraser de ce qui existe, puis relance le
scan :

- sur **ScreenScraper** (screenscraper.fr) si un compte est renseigné dans
  Administration → Réglages — la ROM est reconnue par son empreinte, et la
  description arrive en français quand elle existe. L'API demande, en plus
  du compte membre, des identifiants « développeur » que ScreenScraper
  délivre sur demande ;
- sinon, ou pour ce que ScreenScraper n'a pas, dans la collection publique de
  vignettes de **libretro**, pour la jaquette seulement. Elle est rangée
  sous le nom No-Intro de chaque jeu. Une ROM intacte est reconnue par son
  empreinte dans la base No-Intro, quel que soit le nom de son fichier : il
  n'y a rien à renommer. Les autres (traduction, fichier patché) sont
  rapprochées par leur titre dans la liste complète du système — celui de
  la fiche, du fichier, puis celui que la cartouche porte dans son en-tête.
  Un rapprochement qui n'est pas lettre pour lettre est marqué « ≈ » dans
  le journal, pour être vérifié ; un jeu reconnu mais sans image chez
  libretro y est nommé, pour savoir sous quel nom la chercher ailleurs.

Le scan comme la complétion des fiches peuvent se limiter à une console : le
menu à côté des deux boutons (« Sur toutes les consoles », ou une seule) suit
le filtre de la liste. Après l'ajout d'un jeu, relire sa seule console prend
quelques secondes au lieu de plusieurs minutes ; les jeux des autres consoles
ne sont ni relus ni dépubliés. En ligne de commande : `--console gbc` sur
`scripts/scan-library.ts` et `scripts/scraper.ts`.

Ce qui est trouvé va dans `DATA_DIR/retouches` (description, année) et
`DATA_DIR/jaquettes` : la bibliothèque reste en lecture seule, et une
correction faite ensuite dans l'administration l'emporte.

### Fiches EmulationStation : reprendre les siennes, exporter celles du site

Le site lit et écrit le format `gamelist.xml` d'EmulationStation — celui de
Recalbox, Batocera, RetroPie et ES-DE.

**Reprendre une installation existante.** Qui a déjà un dossier de ROMs
scrapé n'a rien à ressaisir : `scripts/importer-roms.ts` lit le
`gamelist.xml` du dossier source (ou celui que désigne `--gamelist`) et en
reprend, pour chaque ROM qu'il nomme, le titre, la description, l'année,
l'auteur (`<developer>`, sauf avec `--officiel`) et la jaquette, par un lien
`cover.<ext>` vers l'image d'origine.

```bash
node scripts/importer-roms.ts --source /chemin/roms/gbc --console gbc \
     --bibliotheque "$LIBRARY_DIR" --essai
```

Un jeu déjà rangé garde tout ce qu'il a : le `gamelist.xml` n'y ajoute que
ce qui manque. `--essai` montre ce qui serait fait sans rien écrire ; le scan
publie ensuite le résultat.

**Exporter les fiches du site.** Administration → Bibliothèque → « Exporter
les fiches » télécharge une archive zip : par console, un `gamelist.xml` et
un dossier `images/`, les deux rattachés au nom du fichier ROM d'origine
(celui vers lequel pointe le lien de la bibliothèque). Par défaut seuls les
rom hacks partent — les jeux officiels se retrouvent dans n'importe quel
scraper. Un `LISEZ-MOI.txt` dans l'archive dit où poser les fichiers selon le
frontal. Aucune ROM n'est jamais dans l'archive.

### Limiter le nombre de salons de câble link

Chaque salon fait tourner deux consoles sur le serveur, à 60 images par
seconde. Pour que le site ne s'écroule pas si tout le monde ouvre un salon en
même temps, on mesure une fois ce qu'un salon coûte, et le serveur refuse
d'en ouvrir au-delà de ce que le processeur peut tenir :

```sh
cd /opt/online-emulators
sudo -u jeux node --env-file=/etc/online-emulators.env     --import ./outils/node/charge-ts.mjs scripts/capacite-link.ts --appliquer
```

Le script lance un salon GB/GBC puis un salon GBA sur un jeu de la
bibliothèque, pendant une quinzaine de secondes chacun, sans toucher aux
sauvegardes, et enregistre le coût relevé dans les réglages : la limite
s'applique aussitôt. La part du processeur laissée au câble link (65 % par
défaut) se règle dans Administration → Réglages, qui montre aussi combien de
salons restent possibles à l'instant. À refaire après un changement de
machine ou de cœur d'émulation.

### Proposer un jeu dans Discord

Un jeu de la bibliothèque peut se jouer dans Discord, comme Activité : voir
[discord/README.md](discord/README.md), qui donne le pas à pas complet.
L'essentiel se règle dans **Administration → Discord** et dans le portail de
Discord. Une seule étape revient au serveur, et c'est celle qu'on oublie :
chaque Activité a son nom d'hôte, auquel il faut un DNS, un vhost et un
certificat.

```sh
cd /opt/online-emulators
sudo ./deploiement/scripts/hote-activite.sh \
    --domaine prism.exemple.com --mail admin@exemple.com
```

Sur une instance nommée, depuis son arbre de travail et avec `--instance
<nom>` (voir [Au quotidien](#au-quotidien)). L'administration écrit la
commande exacte dans la « Marche à suivre » de chaque application. Une
Activité déclarée sur l'hôte du site lui-même n'en a pas besoin.

## Sauvegardes

Le timer `sauvegarde-online-emulators.timer` tourne chaque nuit à 04:30 et garde
14 jours d'archives dans `/var/backups/online-emulators`. Le dossier n'est
lisible que par root : une archive contient une copie de la base, donc les
comptes.

La base n'est pas copiée avec `cp` : en mode WAL, une copie brute prise pendant
une écriture donne un fichier incohérent. Le script passe par l'API de
sauvegarde de SQLite, qui produit un instantané propre **sans arrêter le
service** — les joueurs ne sont jamais coupés.

```sh
sudo systemctl start sauvegarde-online-emulators.service   # à la demande
sudo tail -20 /var/backups/online-emulators/sauvegarde.log
```

Les archives restent sur le même disque que les données : elles protègent d'une
fausse manœuvre ou d'une migration ratée, pas d'une panne du serveur. Les
recopier ailleurs reste à faire.

## Une seconde instance sur le même serveur

Le cas visé : une bibliothèque privée, réservée à quelques comptes, et à côté
un site public réduit à une poignée de jeux — une vitrine. Les deux font
tourner le même code, sur le même serveur, sans partager la moindre donnée :
ce qui est publié sur l'un n'existe pas sur l'autre, et un compte de l'un
n'ouvre rien sur l'autre.

Ouvrir les jeux de cette seconde instance aux visiteurs sans compte est un
réglage de son administration, une fois installée : voir
[vitrine.md](vitrine.md).

### Installer

Le nom d'hôte de la seconde instance doit déjà pointer vers le serveur. Puis,
depuis le même clone que pour la première :

```sh
cd ~/online-emulators
sudo ./deploiement/scripts/installation.sh \
    --instance vitrine \
    --port 3101 \
    --domaine vitrine.exemple.com \
    --mail admin@exemple.com
```

`--instance` prend un nom court, en minuscules, chiffres et tirets. Il rend
`--port` obligatoire : il n'y a pas de port par défaut qui ne soit déjà celui
d'une autre instance, et le script refuse un port qu'une autre occupe. Il
refuse aussi un `--domaine` déjà servi par un autre site : pour reprendre un
nom d'hôte qui relayait vers la première instance, retirer d'abord son vhost
(`a2dissite`, puis supprimer le fichier de `sites-available`) ; son certificat,
lui, est gardé et réinstallé. `--bibliotheque`
reste disponible pour ranger les jeux de cette instance ailleurs que dans
`/var/lib/online-emulators-vitrine/library`.

Tout ce que l'installation met en place porte alors le nom de l'instance :

| Instance par défaut | Instance `vitrine` |
| --- | --- |
| utilisateur `jeux` | utilisateur `jeux-vitrine` |
| `/opt/online-emulators.git` | `/opt/online-emulators-vitrine.git` |
| `/opt/online-emulators` | `/opt/online-emulators-vitrine` |
| `/var/lib/online-emulators` | `/var/lib/online-emulators-vitrine` |
| `/var/backups/online-emulators` | `/var/backups/online-emulators-vitrine` |
| `/etc/online-emulators.env` | `/etc/online-emulators-vitrine.env` |
| `/etc/sudoers.d/online-emulators` | `/etc/sudoers.d/online-emulators-vitrine` |
| service `online-emulators` | service `online-emulators-vitrine` |
| `sauvegarde-online-emulators.timer`, 04:30 | `sauvegarde-online-emulators-vitrine.timer`, 04:45 |
| journaux Apache `online-emulators-*.log` | journaux Apache `online-emulators-vitrine-*.log` |

**Sans `--instance`, rien ne change de nom** : relancer `installation.sh` sur
la première instance ne déplace rien, et installer la seconde ne touche à
aucun fichier de la première.

### Pousser

Chaque instance a son dépôt nu, donc sa remote :

```sh
git remote add serveur-vitrine ssh://<serveur>/opt/online-emulators-vitrine.git
git push serveur-vitrine main
```

### Ce qui est partagé, ce qui ne l'est pas

Partagé : le **code** (le même dépôt, poussé deux fois), **Apache** et son
certbot, **Node**, et le compte qui pousse.

Propre à chaque instance : la **base**, donc les **comptes** et les réglages
saisis dans l'administration, le dossier de **données** (sauvegardes de jeu,
avatars, jaquettes), la **bibliothèque** de jeux, le **secret de session** — un
cookie de l'une ne vaut rien sur l'autre —, le relais SMTP et le captcha, les
archives de sauvegarde, et l'**utilisateur système** qui fait tourner le
service.

Ce dernier point est ce qui cloisonne vraiment. Un site public est plus exposé
qu'un site privé : s'il est compromis, son processus tourne sous
`jeux-vitrine`, qui n'appartient pas au groupe `jeux` et ne peut donc lire ni
`/etc/online-emulators.env`, ni `/var/lib/online-emulators`, ni
`/opt/online-emulators`, ni les archives de `/var/backups/online-emulators`.
Trois limites à connaître :

- Le cloisonnement porte sur les **fichiers**, pas sur le réseau local : un
  processus de l'une peut toujours s'adresser en HTTP au port de l'autre sur
  `127.0.0.1`, comme n'importe quel visiteur le fait à travers Apache.
- Une bibliothèque rangée hors de `/var/lib` (dans `/home`, par exemple) est
  protégée par ses propres droits, pas par l'installation : si elle est lisible
  par tous, elle l'est par l'utilisateur de l'autre instance. À l'inverse,
  celle de la vitrine doit rester lisible par `jeux-vitrine`.
- Le compte qui pousse appartient aux deux groupes — il lui faut lire les deux
  fichiers d'environnement pour construire — et les dépôts nus, qui ne
  contiennent que le code, sont lisibles par tous sur le serveur.

### Mettre à jour les deux

Un push par dépôt nu. Chacun ne déploie que son instance : l'autre continue
de tourner sur la version qu'elle avait, sans coupure.

```sh
git push serveur main            # la première instance
git push serveur-vitrine main    # la seconde
```

Rien n'oblige à les garder au même commit, mais les laisser diverger
longtemps, c'est entretenir deux versions du site.

### Au quotidien

Les commandes de ce document valent pour une instance nommée, en y remplaçant
trois choses : l'arbre de travail, l'utilisateur et le fichier d'environnement.

```sh
cd /opt/online-emulators-vitrine
sudo -u jeux-vitrine node --env-file=/etc/online-emulators-vitrine.env \
    scripts/create-user.ts --pseudo Untel --email untel@exemple.com --admin

sudo systemctl status online-emulators-vitrine
sudo journalctl -u online-emulators-vitrine -f
sudo systemctl start sauvegarde-online-emulators-vitrine.service
sudo tail -40 /var/log/apache2/online-emulators-vitrine-error.log
```

Un nom d'hôte d'Activité Discord appartient à l'instance dont
l'administration le déclare. `hote-activite.sh` le relaie vers la première
instance à moins qu'on lui en nomme une autre, dont il relit alors le port
dans l'unité systemd :

```sh
sudo ./deploiement/scripts/hote-activite.sh --instance vitrine \
    --domaine prism.exemple.com --mail admin@exemple.com
```

### Sur un serveur déjà installé

Ajouter une instance ne demande rien à la première : ni réinstallation, ni
remplacement de son hook, ni modification de sa règle `sudoers`. Une seule
précaution, **avant** d'installer la seconde : fermer le dossier des archives
de la première, que les premières versions de l'installation laissaient lisible
par tous.

```sh
sudo chmod 700 /var/backups/online-emulators
```

Sans cela, l'utilisateur de la nouvelle instance pourrait y lire une copie de
la base de l'autre. Le script de sauvegarde le fait désormais de lui-même à
chaque passage, et `installation.sh` aussi quand on le relance ; la commande
ci-dessus évite seulement d'attendre.

## HSTS

L'application envoie `Strict-Transport-Security: max-age=31536000`. Le
navigateur n'utilisera plus que HTTPS pour ce domaine pendant un an, même si
l'adresse est tapée sans `https://` — sans quoi la première requête part en
clair, et la redirection d'Apache arrive trop tard pour protéger le cookie de
session.

Pas de `includeSubDomains` (le site n'a pas de sous-domaine) et pas de
`preload`, qui suppose une inscription auprès des éditeurs de navigateurs et ne
se défait quasiment pas.

**Faire marche arrière demande de la patience.** Retirer l'en-tête ne suffit
pas : les navigateurs l'ont mémorisé. Il faut servir `max-age=0` et attendre
que le cache des visiteurs expire. À garder en tête avant de toucher au
certificat ou de déplacer le domaine.

## Diagnostic

```sh
sudo systemctl status online-emulators
sudo journalctl -u online-emulators -f
sudo tail -40 /var/log/apache2/online-emulators-error.log
```

Deux pièges déjà rencontrés :

- **`SQLITE_BUSY` à la construction.** `next build` lance autant de processus
  que de cœurs, qui ouvrent tous la base. Le passage en WAL demande un verrou
  exclusif : `busy_timeout` doit être positionné *avant*, sinon les ouvertures
  concurrentes échouent au lieu d'attendre. Corrigé dans `src/db/index.ts`.
- **Next écoute sur toutes les interfaces** par défaut, ce qui rend
  l'application joignable en clair sur son port, par-dessus Apache et sans
  HTTPS. D'où le `-H 127.0.0.1` dans l'unité systemd.
