**Français** · [English](decisions.en.md)

# Décisions techniques

Chaque entrée note ce qui a été choisi, sur quelles preuves, et ce qui reste à
vérifier. Les suppositions sont signalées comme telles.

---

## 1. Cœur d'émulation : mGBA compilé en WebAssembly

**Choix** : [`@thenick775/mgba-wasm`](https://github.com/thenick775/mgba) — le
cœur mGBA de la branche `feature/wasm`, publié en paquet npm — plutôt
qu'EmulatorJS.

**Contexte** : le premier plan retenait EmulatorJS (cœurs libretro en wasm) pour
sa gratuité en interface. La lecture des deux documentations a inversé la
conclusion.

**Ce que dit la documentation d'EmulatorJS**

| Besoin | État |
|---|---|
| Savestates | Options présentes (`EJS_onSaveState`, `EJS_loadStateURL`, slots via `EJS_defaultOptions`) |
| Sauvegarde SRAM | Bien couvert : `EJS_onSaveSave`, `EJS_onLoadSave`, `EJS_onSaveUpdate` (détection de changement par empreinte), `EJS_fixedSaveInterval` |
| **Fast forward** | **Aucune option documentée.** Le terme n'apparaît ni dans la page Options, ni dans les pages systèmes, ni dans la page Features |
| Cœurs GB/GBC | `gambatte` (défaut) ou `mgba` — un seul système `gb` couvre GB et GBC |
| Cœur GBA | `mgba` uniquement |
| Link cable | Rien. Le netplay documenté est un serveur de rendez-vous WebRTC ; la documentation ne dit pas s'il s'agit de plusieurs manettes sur une instance ou de consoles distinctes |

**Ce que dit la documentation de mgba-wasm**

Le contrat public expose directement chaque besoin du cahier des charges :

| Besoin | Méthode |
|---|---|
| Fast forward | `setFastForwardMultiplier(n)` / `getFastForwardMultiplier()` |
| Savestates | `saveState(slot)` / `loadState(slot)`, plus l'auto-save |
| Sauvegarde SRAM | `getSave()`, `listSaves()`, `uploadSaveOrSaveState(file, cb)` |
| Reset | `quickReload()` |
| Pause | `pauseGame()` / `resumeGame()` |
| Remapping | `bindKey(binding, input)`, `buttonPress/Unpress(name)` |
| **Link cable local** | `linkLocalStartSession(options)`, `linkLocalStopSession()`, `linkLocalGetStatus()`, `linkLocalSetActivePlayer(player)` |

Le cœur mGBA gère GB, GBC et GBA avec **un seul cœur**, mappers MBC1/2/3/5
inclus, et **MBC3+RTC** — nécessaire aux hacks à horloge temps réel du type
Crystal Clear.

**Raisons du choix**

1. Le fast forward est documenté et piloté par une méthode, au lieu d'être
   supposé présent dans un menu non documenté.
2. `linkLocal*` est la seule primitive de câble link trouvée dans un cœur
   utilisable en navigateur. Le dépôt la décrit comme « best for things like
   pokemon trades » — exactement l'objectif final du site.
3. L'interface demandée est très spécifique (bézel, écran sur la moitié haute
   en tactile, 75 % de la hauteur sur PC, menu maison). Avec EmulatorJS il
   faudrait neutraliser son interface pour la remplacer ; avec un cœur nu, il
   n'y a rien à défaire.
4. Un seul cœur pour les trois consoles, donc un seul comportement à connaître.

**Ce que cela coûte**

- Toute l'interface est à écrire : gamepad virtuel, menus, réglages. C'est du
  travail en plus, mais c'était de toute façon du travail sur mesure.
- Le cœur utilise des threads, donc `SharedArrayBuffer`, donc l'isolation
  cross-origin : `Cross-Origin-Opener-Policy: same-origin` et
  `Cross-Origin-Embedder-Policy: require-corp`. Ces en-têtes sont posés
  uniquement sur les routes du lecteur, car `require-corp` bloquerait le
  captcha Turnstile ailleurs sur le site.
- `mgba.js` et `mgba.wasm` doivent être servis en same-origin : le worker
  pthread démarre depuis l'URL du script. Pas de CDN.

**Licences** : cœur mGBA en MPL-2.0, interface gbajs3 en BSD 2 clauses. Les deux
permettent un dépôt public sous notre propre licence, sans contamination, à
condition de conserver les mentions de copyright. Le détail de tous les
composants tiers, TGB Dual (GPL-2.0) compris, est dans
`THIRD_PARTY_NOTICES.md`.

**À vérifier sur le terrain** (non documenté)

- Que le binding wasm accepte bien les `.gb` et `.gbc`, et pas seulement les
  `.gba` : le cœur mGBA les gère, mais aucune documentation ne confirme que
  `loadGame()` les accepte. **Test prioritaire de la phase 5.**
- Les bornes du multiplicateur de fast forward.
- Le contenu exact de `options` dans `linkLocalStartSession`.
- Le format des savestates (pour pouvoir les stocker et les relire côté serveur).

**Porte de sortie** : le lecteur est écrit derrière une interface d'adaptateur
(`src/lib/emulator/adapter.ts`). Si le cœur déçoit sur un `.gbc`, EmulatorJS
peut être branché derrière la même interface sans toucher au reste du site.

**Un second cœur, pour les cartouches qui vibrent.** La porte de sortie a
servi : `@thenick775/mgba-wasm` ne rapporte pas le moteur de vibration des
cartouches (Pokémon Pinball, par exemple), et ce paquet n'est pas le nôtre.
Pour une cartouche Game Boy à moteur — son en-tête l'annonce, octet `0x147` —
le lecteur prend donc le cœur « une console » de l'Activité Discord
(`src/lib/emulator/mgs.ts`, `coeurs/mgba-splitscreen/`), que nous compilons et
qui rapporte ce moteur ; `src/lib/emulator/vibration.ts` en fait vibrer le
téléphone (Android) ou la manette. Tous les autres jeux gardent le cœur
ordinaire.

- **Le choix tient au jeu, jamais à l'appareil** : un même jeu passe par le
  même cœur partout, et ses points de reprise aussi.
- **Les points de reprise gardent leur format** : ce cœur rend un état brut,
  que le lecteur range dans un PNG au format de mGBA — l'image de l'écran et
  un bloc `gbAs` (`src/lib/emulator/etat-png.ts`). Routes, vignettes et
  stockage de l'invité n'y voient aucune différence, et une reprise prise
  avant le changement de cœur se relit : vérifié sur Pokémon Pinball
  Generations, dans les deux sens d'écriture.
- **Servi par `/api/coeur/`**, sans compte, comme le cœur de `public/mgba`.
- **Le son** de ce cœur attend un geste du joueur dans la page : il part au
  premier appui.
- **Pas la GBA** : une cartouche GBA n'annonce pas son moteur dans son
  en-tête ; elle reste sur le cœur ordinaire, sans vibration.

---

## 2. Link cable à distance : ce qui est réellement possible

**État documenté** : mGBA implémente le câble link **local** (plusieurs
consoles émulées dans une même instance). Le link **réseau** est listé dans les
« Planned features » du projet mGBA : il n'existe pas.

**Conséquence** : relier deux joueurs distants demandera de construire la couche
réseau nous-mêmes, autour de `linkLocal*` : une instance fait autorité, les
entrées du second joueur lui sont relayées, et l'image lui est renvoyée — ou
bien les deux instances avancent en lockstep avec vérification périodique
d'état. La note du dépôt (« v1 supports running one game+inputs at a time »)
suggère la première approche.

C'est la partie la moins certaine du projet. Elle reste en phase 7, après que
tout le reste fonctionne, et ne conditionne aucune autre phase.

---

## 3. Base de données : SQLite

Quelques dizaines de comptes, un seul serveur. Postgres demanderait un service
de plus à superviser et à sauvegarder pour aucun gain mesurable. La sauvegarde
est la copie d'un fichier, ce qui compte plus ici que la montée en charge.

Les binaires (ROMs, sauvegardes, savestates, avatars) restent sur le disque :
des blobs de plusieurs mégaoctets en base alourdiraient chaque sauvegarde.

---

## 4. Authentification écrite à la main

Auth.js ne gère pas la réinitialisation de mot de passe et s'accorde mal avec
une inscription fermée où les comptes sont créés par l'administrateur. Un
cookie de session, une table de sessions et argon2id représentent environ deux
cents lignes lisibles, sans dépendance à faire évoluer.

---

## 5. Envoi des e-mails : relais externe plutôt que MTA local

Un serveur de mail sur l'IP d'un hébergeur finit massivement en spam chez Gmail et
Outlook. Un mail de réinitialisation qui n'arrive pas est une fonctionnalité
morte. Le code parle donc à un relais SMTP par `nodemailer` ; l'opérateur
choisit lequel. SPF, DKIM et DMARC sur le domaine restent nécessaires dans tous
les cas.

---

## 6. ORM : Drizzle plutôt que Prisma

**Choix** : Drizzle ORM sur `better-sqlite3`.

Prisma était le premier choix, et le modèle de données avait été écrit en PSL.
Trois constats l'ont écarté à l'installation :

1. Le tag npm `latest` de Prisma pointe sur une **release candidate**
   (8.0.0-rc.29) dont la CLI est réorientée vers leur offre cloud : plus de
   `prisma db push`, remplacé par un workflow de « data contract ».
2. La dernière version stable (7.10.1) refuse désormais `url` dans le bloc
   `datasource` : il faut un fichier `prisma.config.ts` séparé **et** passer un
   adaptateur de pilote au client.
3. Cet adaptateur, pour SQLite, c'est `better-sqlite3` — donc la même
   dépendance native qu'une solution directe, à laquelle Prisma ajoute son
   moteur de requêtes et une étape de génération avant chaque build.

Drizzle supprime les trois : pas de moteur à déployer, pas de génération avant
le build, et des migrations en SQL lisible dans `drizzle/`, versionnées avec le
code. `better-sqlite3` s'installe depuis un binaire préconstruit, donc rien à
compiler sur le serveur.

Ce que l'on perd : Prisma Studio, remplacé par `npm run db:studio`
(drizzle-kit), et une syntaxe de requête un peu plus proche du SQL.

---

## 7. Audit npm : 20 alertes modérées, laissées en l'état

Toutes viennent de `minimatch` à travers l'arborescence d'ESLint
(`eslint-config-next`, `@typescript-eslint`, les plugins React). Ce sont des
dépendances de développement : elles ne sont jamais servies au navigateur ni
exécutées en production. `npm audit fix --force` casserait
`eslint-config-next`. À revoir quand ESLint publiera la mise à jour.


---

## 8. Mise en ligne : push vers le serveur, pas de clé confiée à la forge

Le dépôt distant est privé, et le serveur n'a aucun moyen de le lire. Deux
façons de l'y amener :

| | Clé de déploiement sur la forge | Dépôt nu sur le serveur |
| --- | --- | --- |
| Identifiants côté serveur | une clé SSH enregistrée sur la forge | aucun |
| Déclencheur | `git pull` à la main ou par webhook | `git push` depuis le poste |
| Si la forge change de main | le serveur garde un accès à révoquer | rien à révoquer |

C'est la seconde qui est retenue : `/opt/online-emulators.git` est un dépôt nu
dont le hook `post-receive` met à jour l'arbre de travail, installe les
dépendances, applique les migrations, construit le site et redémarre le
service. Le serveur ne connaît ni la forge ni le dépôt distant.

Conséquence assumée : un déploiement demande le poste de développement. Pour un
site privé mis à jour par une seule personne, c'est sans conséquence, et cela
évite de laisser traîner un accès au code sur une machine exposée.

Le redémarrage du service est le seul geste privilégié : il passe par une règle
`sudoers` limitée à cette unité et à trois sous-commandes de `systemctl`.

---

## 9. Reverse proxy : Apache, parce qu'il est déjà là

Le serveur sert déjà une quinzaine de vhosts derrière Apache, avec des
certificats gérés par `certbot --apache`. Ajouter nginx devant ou à côté aurait
voulu dire déplacer tous ces vhosts, ou faire cohabiter deux serveurs sur les
mêmes ports, pour un gain nul ici : le trafic attendu est de quelques joueurs.

Apache 2.4.47 a introduit `ProxyPass ... upgrade=websocket`, qui bascule tout
seul les requêtes portant un en-tête `Upgrade`. Le câble link à distance pourra
donc passer par une WebSocket sur la même origine, sans vhost supplémentaire.

Réserve notée pour cette phase : le MPM en service est `prefork`, qui occupe un
processus par connexion ouverte. Une WebSocket maintenue par joueur tient donc
un processus. À quelques joueurs c'est indolore ; au-delà, il faudra regarder du
côté du MPM `event`.

---

## 10. Sauvegardes : l'API de SQLite, pas une copie de fichier

En mode WAL, une partie des écritures récentes vit dans `app.db-wal` et pas dans
`app.db`. Une copie des deux fichiers prise pendant une transaction donne un
instantané incohérent, et `tar` ne garantit rien non plus sur l'ordre de lecture.

Les deux issues classiques sont d'arrêter le service le temps de l'archive — ce
que fait la sauvegarde du catalogue de livres sur ce serveur — ou d'utiliser
l'API de sauvegarde de SQLite, exposée par `better-sqlite3` sous `db.backup()`.
Elle copie page à page en tenant compte des écritures concurrentes et produit un
fichier propre **sans arrêter personne**.

C'est la seconde : couper une partie en cours pour une sauvegarde de nuit serait
absurde, quand la bibliothèque de livres, elle, peut se permettre quelques
secondes d'arrêt. Vérifié sur le serveur : l'instantané passe
`pragma integrity_check`.
