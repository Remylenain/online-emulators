# Activité Discord

Un jeu du site, jouable dans Discord : l'utilisateur lance l'Activité, appuie
sur « Jouer », et sa partie est gardée pour son compte Discord.

État : **prototype**. Essayé sur une ROM Game Boy Color, en local puis dans
Discord sur ordinateur, par un tunnel : connexion, jeu, sauvegarde et horloge
fonctionnent. Pas encore essayé sur téléphone.

## Comment ça marche

- Discord ouvre le site dans une iframe, à travers son proxy
  (`https://<identifiant d'application>.discordsays.com`). Il charge toujours
  la **racine** de l'URL Mapping, avec `frame_id` dans l'adresse ; le site
  renvoie alors vers la page `/discord` (`src/proxy.ts`).
- **L'émulation tourne chez le joueur**, pas sur le serveur : la page charge
  un cœur mGBA compilé sans threads (`coeurs/mgba-splitscreen`, variante « une
  console »). Le lecteur ordinaire du site ne peut pas servir ici : son cœur
  exige l'isolation cross-origin, que Discord ne donne pas à ses iframes.
- Le serveur ne fait que trois choses : dire qui joue, servir la ROM, ranger
  la sauvegarde. Cent joueurs ne lui coûtent presque rien.
- Une Activité = une application Discord = **un jeu**, choisi par
  `DISCORD_JEU`.

## Qui joue

1. Le SDK de Discord remet à la page un code d'autorisation (périmètre
   `identify`, rien d'autre).
2. `/api/discord/session` l'échange contre un jeton auprès de Discord — c'est
   là que sert le secret de l'application —, puis demande à Discord
   l'identifiant de l'utilisateur.
3. Au premier lancement, un compte du site est créé pour lui : **restreint**,
   avec ce seul jeu attribué, sans mot de passe (`users.discord_id`). Les
   règles d'accès ordinaires (`src/lib/acces.ts`) s'appliquent à ce compte.
4. La page reçoit un jeton signé, valable douze heures, qu'elle renvoie en
   en-tête. Pas de cookie : dans une iframe tierce, les navigateurs les
   refusent ou les cloisonnent.

La sauvegarde est celle du compte, au même endroit et au même format que
celle du lecteur du site, horloge temps réel comprise.

## Installer

### 1. Créer l'application Discord

Sur <https://discord.com/developers/applications> :

1. **New Application**.
2. **OAuth2 → Redirects** : ajouter `https://127.0.0.1`. Discord exige une
   adresse de retour, mais le SDK ne s'en sert pas.
3. **Activities → Settings** : cocher *Enable Activities*, et les plateformes
   voulues (web et bureau par défaut ; iOS et Android à cocher).
4. **Activities → URL Mappings** : préfixe `/`, cible le nom d'hôte du site,
   sans `https://`.

### 2. Régler le site

Dans `.env` (jamais dans le dépôt — les conditions de Discord interdisent de
publier ces identifiants dans un projet ouvert, identifiant d'application
compris) :

```
DISCORD_CLIENT_ID="…"       # Application ID, onglet General Information
DISCORD_CLIENT_SECRET="…"   # Client Secret, onglet OAuth2
DISCORD_JEU="…"             # identifiant du jeu en base (colonne games.id)
```

Puis appliquer la migration (`npm run db:migrate`) et redémarrer. Tant que
les trois réglages ne sont pas renseignés, `/discord` et `/api/discord`
répondent 404.

### 3. Essayer

- **Hors de Discord**, pendant le développement : `DISCORD_ESSAI_LOCAL="1"`,
  puis ouvrir `/discord`. Un compte d'essai remplace l'utilisateur Discord ;
  `?essai=nom` en ouvre un autre, `?muet=1` coupe le son. Ignoré en
  production.
- **Dans Discord**, sans rien déployer : un tunnel vers le serveur local
  (`cloudflared tunnel --url http://localhost:3000`), et son nom d'hôte comme
  cible de l'URL Mapping. Attention : le tunnel expose le serveur de
  développement sur une adresse publique tant qu'il tourne ; remettre le
  mapping en place ensuite.
- Les adresses de la page n'ont pas besoin du préfixe `/.proxy/` que montrent
  certains exemples de Discord : les chemins ordinaires passent par le proxy.
- Activer le **mode développeur** de Discord (Paramètres → Avancés), entrer
  dans un salon vocal, ouvrir le lanceur d'activités.

## Les limites qui ne dépendent pas du site

- Une Activité **non vérifiée** ne se lance que dans un serveur de moins de
  25 membres, et n'est visible que du propriétaire de l'application, de son
  équipe et de ses testeurs invités (50 au plus). Au-delà, Discord demande la
  vérification de l'application, donc celle de l'identité de son propriétaire.
- Les conditions développeur de Discord interdisent une application qui porte
  atteinte aux droits d'un tiers. Chacun est responsable de ce qu'il y
  propose.

## Ce qui reste à faire

- L'essai dans Discord sur iOS et Android.
- La GBA (le cœur la gère, rien n'a été essayé).
- Pause quand l'Activité passe en incrustation ; orientation sur téléphone.
- Manettes, touches personnalisées, points de reprise : le lecteur du site
  les a, l'Activité non.
- Rattacher un compte existant du site à son utilisateur Discord, pour y
  retrouver sa partie.
