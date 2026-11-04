# Online Emulators

Un site pour faire jouer une communauté à des jeux Game Boy, Game Boy Color
et Game Boy Advance directement dans le navigateur, avec un compte par
joueur, une sauvegarde par compte, et un câble link émulé pour jouer à deux.

Le projet est né pour faire tester des rom hacks et des traductions à une
communauté, sans demander à personne d'installer un émulateur ni de gérer des
fichiers de sauvegarde : on ouvre un lien, on joue, la partie suit le compte.

**Le dépôt ne contient aucun jeu.** C'est le moteur du site ; la bibliothèque
reste chez toi, dans un dossier à part. À toi de n'y mettre que ce que tu as
le droit de partager.

## Ce que le site fait

- **Lecteur dans le navigateur** (mGBA en WebAssembly) : sauvegarde
  synchronisée par compte, points de reprise manuels et automatiques,
  avance rapide, touches personnalisables, manette tactile sur téléphone,
  habillages d'écran.
- **Câble link** : deux joueurs, deux navigateurs, les deux consoles tournent
  sur le serveur. Échanges et combats comme avec un vrai câble, sur GB, GBC
  et GBA. Salons publics ou privés avec code.
- **Comptes** : création par l'administrateur, liens d'invitation valables
  24 h pour un ou plusieurs comptes, ou inscriptions ouvertes à tous avec
  e-mail confirmé et captcha, au choix. Réinitialisation de mot de passe par
  e-mail.
- **Sauvegardes protégées** : copies de secours des cinq dernières écritures
  et une par jour sur trente jours, restaurables par le joueur, export de
  toutes ses sauvegardes en zip.
- **Catalogue** par console, recherche, tri par note ou popularité, notes,
  temps de jeu par jeu et par compte, page « Mes jeux ».
- **Administration** : comptes, bibliothèque, temps de jeu, nom du site.

## Installation en cinq minutes

Il faut [Node.js](https://nodejs.org) 22 ou plus récent, et `git`.

```bash
git clone https://github.com/<toi>/online-emulators.git
cd online-emulators
npm install
npm run installer
```

`npm run installer` crée la configuration, installe le cœur mGBA, prépare la
base de données et les dossiers, et crée le compte administrateur dont il
affiche le mot de passe une seule fois. Ensuite :

```bash
npm run dev
```

Le site est sur <http://localhost:3000>. Pour un vrai serveur, voir
[docs/deploiement.md](docs/deploiement.md) : service systemd, Apache en
reverse proxy, certificat, sauvegardes quotidiennes, mises à jour par
`git push`.

## Ajouter des jeux

La bibliothèque est un dossier (`LIBRARY_DIR` dans `.env`, `./library` par
défaut) : un dossier par console, un dossier par jeu.

```
library/
  gbc/
    mon-rom-hack/
      game.json      titre, description, auteur, version, langue
      rom.gbc        un seul fichier ROM
      cover.webp     jaquette (jpg et png acceptés)
  gba/
    une-traduction/
      ...
```

`game.json` minimal :

```json
{ "title": "Mon rom hack", "author": "Quelqu'un", "version": "1.2", "language": "fr" }
```

Puis :

```bash
npm run library:scan
```

Le scan calcule l'empreinte des ROMs, génère les miniatures et met la base à
jour. Déposer un dossier et relancer le scan suffit à publier un jeu. La ROM
et la jaquette peuvent être des liens symboliques vers un dossier de travail.

Quelques détails utiles :

- Une jaquette **dépliée** (dos, tranche, face) est reconnue à ses
  proportions : la face sert de vignette, le dos s'affiche sur la fiche. Une
  `etiquette.png` à côté est montrée comme étiquette de cartouche.
- Des **habillages d'écran** (bezels) peuvent être déposés dans
  `library/bezels/<console>/` : une image PNG avec une zone transparente au
  centre, détectée automatiquement.
- Les ROMs patchées *batteryless* écrivent leur sauvegarde dans la mémoire
  flash de la cartouche, qui n'existe pas dans un émulateur : utiliser les
  versions à SRAM standard.

## Configuration

Tout ce qui dépend de l'installation passe par `.env`, décrit dans
[.env.example](.env.example). Les deux options facultatives :

- **SMTP** : nécessaire à la réinitialisation de mot de passe par e-mail et
  aux inscriptions ouvertes. Sans lui, l'administrateur donne lui-même un
  nouveau mot de passe.
- **Cloudflare Turnstile** (captcha, gratuit) : nécessaire aux inscriptions
  ouvertes, et protège la demande de réinitialisation. Sans clé, le captcha
  est contourné, ce qui convient en local seulement.

Le nom du site et sa phrase d'accueil se changent dans Administration →
Réglages.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run installer` | installation ou mise à niveau d'une installation locale |
| `npm run dev` | site et serveur du câble link en développement |
| `npm run build` puis `npm start` | production |
| `npm run library:scan` | relire la bibliothèque |
| `npm run user:create -- --pseudo <nom> --admin` | créer un compte en ligne de commande |
| `npm run db:migrate` | appliquer les migrations après une mise à jour |
| `npm run typecheck` | vérification TypeScript |

## Pile technique

Next.js, TypeScript, Drizzle ORM sur SQLite, Tailwind. Lecteur : mGBA en
WebAssembly. Câble link : un serveur WebSocket dans le même processus que
Next, qui fait tourner TGB Dual (GB/GBC) ou mGBA Splitscreen (GBA) dans un fil
de travail par salon. Les raisons de chaque choix sont dans
[docs/decisions.md](docs/decisions.md).

## Licence

Le code du projet est sous [licence MIT](LICENSE). Les cœurs d'émulation ont
leur propre licence — MPL-2.0 pour mGBA et mgba-splitscreen, GPL-2.0 pour
TGB Dual — détaillée dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
