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

## En deux mots

- **L'émulation tourne chez le joueur**, dans son Discord. Le serveur du site
  envoie la page, l'émulateur (≈ 900 Ko) et la ROM, puis ne fait plus que
  ranger les sauvegardes. Un petit serveur suffit, même avec du monde.
- **Une Activité = une application Discord = un jeu.** Pour un autre jeu, une
  autre application et une autre instance du site.
- **La partie suit le compte Discord**, d'un appareil à l'autre, au même format
  que le lecteur du site, horloge temps réel comprise.

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

## Installer

### 1. Créer l'application Discord

Sur <https://discord.com/developers/applications> :

1. **New Application**.
2. **OAuth2 → Redirects** : ajouter `https://127.0.0.1`. Discord exige une
   adresse de retour, mais le SDK ne s'en sert pas.
3. **Activities → Settings** : cocher *Enable Activities*, et les plateformes
   voulues (ordinateur par défaut ; iOS et Android à cocher).
4. **Activities → URL Mappings** : préfixe `/`, cible le nom d'hôte du site,
   sans `https://`.

### 2. Régler le site

Dans `.env`, jamais dans le dépôt — les conditions de Discord interdisent de
publier ces identifiants dans un projet ouvert, identifiant d'application
compris :

```
DISCORD_CLIENT_ID="…"       # Application ID, onglet General Information
DISCORD_CLIENT_SECRET="…"   # Client Secret, onglet OAuth2 (bouton Reset Secret)
DISCORD_JEU="…"             # identifiant du jeu en base (colonne games.id)
```

Attention à ne pas confondre : la **Public Key** de l'onglet General
Information n'est pas le Client Secret, et ne sert pas ici.

Puis appliquer la migration (`npm run db:migrate`) et redémarrer. Tant que
ces trois réglages ne sont pas renseignés, `/discord` et `/api/discord`
répondent 404.

### 3. Essayer

- **Hors de Discord**, pendant le développement : `DISCORD_ESSAI_LOCAL="1"`,
  puis ouvrir `/discord`. Un compte d'essai remplace l'utilisateur Discord ;
  `?essai=nom` en ouvre un autre, `?muet=1` coupe le son. Ignoré en
  production.
- **Dans Discord, sans rien déployer** : un tunnel vers le serveur local
  (`cloudflared tunnel --url http://localhost:3000`), et son nom d'hôte comme
  cible de l'URL Mapping. Le tunnel expose le serveur de développement sur une
  adresse publique tant qu'il tourne : couper l'essai local avant, et remettre
  le mapping en place après.
- Dans Discord : activer le **mode développeur** (Paramètres → Avancés), entrer
  dans un salon vocal, ouvrir le lanceur d'activités.

Si la connexion échoue, le journal du serveur donne le motif de Discord :
`invalid_client` (identifiant ou secret faux) ou `invalid_grant` (code périmé).

## Verrouiller l'Activité sur un serveur

Par défaut, l'Activité se joue partout où Discord accepte de la lancer. Pour
la réserver à **un seul serveur** :

```
DISCORD_SERVEUR="…"     # identifiant du serveur (clic droit → Copier l'identifiant)
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
- **Le reste du site passe aussi par le proxy.** Si l'URL Mapping vise le site
  entier, ses autres pages — la page de connexion, par exemple — se lisent à
  la même adresse `discordsays.com`, et disent ce qu'il est. Pour ne montrer
  que l'Activité, lui donner un nom d'hôte à elle.
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
- Manettes, touches personnalisées, points de reprise : le lecteur du site
  les a, l'Activité non.
- Rattacher un compte existant du site à son utilisateur Discord, pour y
  retrouver sa partie.
- Un nom d'hôte réservé à l'Activité, qui ne serve rien d'autre du site.

## Où est le code

| Quoi | Où |
| --- | --- |
| La page et son composant | `src/app/discord/`, `src/components/discord/activite.tsx` |
| L'adaptateur du cœur (rythme, image, son, sauvegarde) | `src/lib/emulator/mgs.ts` |
| Session, ROM, sauvegarde, cœur | `src/app/api/discord/` |
| OAuth, jeton, compte, jeu, verrou | `src/lib/discord/` |
| Le cœur et sa recette de compilation | `coeurs/mgba-splitscreen/` |
| Le renvoi de la racine et les en-têtes | `src/proxy.ts`, `next.config.ts` |
