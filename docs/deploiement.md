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
| `/var/backups/online-emulators` | archives quotidiennes | root |
| `/etc/online-emulators.env` | configuration et secrets | root:jeux, `640` |

Le serveur applicatif tourne sous un utilisateur système `jeux`, sans shell ni
répertoire personnel, et n'écoute que sur `127.0.0.1`. Apache est seul exposé.

## Prérequis

- Debian 12, Apache 2.4.47 ou plus récent (pour `upgrade=websocket`)
- Node 20 ou plus récent, `npm`, `git`
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
qui poussera n'est pas celui qui lance `sudo`.

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
`next build`, puis redémarrage du service. Le serveur n'a **aucun accès à la
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

L'inscription est fermée. Une fois le premier administrateur en place, les
comptes suivants se créent **depuis la page Administration du site**. La ligne
de commande sert au premier compte, et de secours.

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

Le formulaire de mot de passe oublié accepte un captcha Cloudflare Turnstile.
Tant que `TURNSTILE_SECRET_KEY` est vide, il est contourné. Renseigner les deux
clés depuis le tableau de bord Cloudflare suffit à l'activer.

Les en-têtes d'isolation cross-origin (`COOP`/`COEP`) ne couvrent que `/jouer` et
`/mgba`, précisément pour que le widget Turnstile, chargé depuis Cloudflare,
reste autorisé sur les pages d'authentification.

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
  vignettes de **libretro**, pour la jaquette seulement, par nom de fichier
  No-Intro.

Ce qui est trouvé va dans `DATA_DIR/retouches` (description, année) et
`DATA_DIR/jaquettes` : la bibliothèque reste en lecture seule, et une
correction faite ensuite dans l'administration l'emporte.

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

## Sauvegardes

Le timer `sauvegarde-online-emulators.timer` tourne chaque nuit à 04:30 et garde
14 jours d'archives dans `/var/backups/online-emulators`.

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
