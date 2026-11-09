[Français](README.md) · **English**

# Online Emulators

A site that lets a community play Game Boy, Game Boy Color and Game Boy
Advance games right in the browser, with one account per player, one save
per account, and an emulated link cable for playing with two.

The project started as a way to have a community test ROM hacks and
translations without asking anyone to install an emulator or deal with save
files: you open a link, you play, and your progress follows your account.

**The repository contains no games.** It is the engine of the site; the
library stays with you, in a separate folder. It is up to you to put in it
only what you have the right to share.

## What the site does

- **In-browser player** (mGBA in WebAssembly): save synced per account,
  manual and automatic save states, fast-forward (list, key to hold or touch
  button), volume, customizable keys and controller (USB or Bluetooth),
  touch controller on phones, screen bezels.
- **Link cable**: two players, two browsers, both consoles run on the
  server — TGB Dual for GB and GBC, mGBA Splitscreen for GBA. Trades and
  battles just like with a real cable. Public rooms or private ones with a
  code, up to five spectators per room, and the number of rooms capped at
  what the server can handle.
- **Discord Activity** (optional, experimental): a game from the site
  playable inside Discord, emulated in the player's browser, with its save
  kept per Discord user. See [docs/discord](docs/discord/README.en.md).
- **French and English**: the whole site, administration included. Each
  visitor sees it in their browser's language or in the one they choose; the
  administrator sets the default language. See
  [docs/langues.en.md](docs/langues.en.md).
- **Showcase** (optional): a few games opened to visitors without an
  account, who play as guests — their progress stays in their browser, and
  the server keeps nothing of it. See [docs/vitrine.en.md](docs/vitrine.en.md).
- **Accounts**: created by the administrator, invitation links valid for
  24 hours for one or several accounts, or sign-ups open to everyone with a
  confirmed e-mail address and a captcha — your choice. Password reset by
  e-mail.
- **Protected saves**: backup copies of the last five writes plus one per
  day over thirty days, which the player can restore, and a zip export of
  all their saves.
- **Catalog** by console, search, sorting by rating or popularity, ratings,
  play time per game and per account, a “Mes jeux” (My games) page.
- **Administration**: accounts, library, play time, site name.

## Five-minute install

You need [Node.js](https://nodejs.org) 22 or later, and `git`.

```bash
git clone https://github.com/<you>/online-emulators.git
cd online-emulators
npm install
npm run installer
```

`npm run installer` creates the configuration, installs the mGBA core, sets
up the database and the folders, and creates the administrator account,
whose password it displays only once. Then:

```bash
npm run dev
```

The site is at <http://localhost:3000>. For a real server, see
[docs/deploiement.en.md](docs/deploiement.en.md): systemd service, Apache as
a reverse proxy, certificate, daily backups, updates by `git push`.

## Adding games

The library is a folder (`LIBRARY_DIR` in `.env`, `./library` by default):
one folder per console, one folder per game.

```
library/
  gbc/
    mon-rom-hack/
      game.json      title, description, author, version, language
      rom.gbc        a single ROM file
      cover.webp     cover art (jpg and png accepted)
  gba/
    une-traduction/
      ...
```

A minimal `game.json`:

```json
{ "titre": "My ROM hack", "auteur": "Someone", "version": "1.2", "langue": "en" }
```

The keys are in French: `titre` (title, the only required one), `auteur` (author), `langue` (language).

Then:

```bash
npm run library:scan
```

The scan computes the ROMs' hashes, generates the thumbnails and updates the
database. Dropping in a folder and running the scan again is all it takes to
publish a game. The ROM and the cover can be symbolic links to a working
folder.

A few useful details:

- An **unfolded** cover (back, spine, front) is recognized by its
  proportions: the front is used as the thumbnail, the back is shown on the
  game's page. An `etiquette.png` next to it is shown as the cartridge
  label.
- **Screen bezels** can be dropped into `library/bezels/<console>/`: a PNG
  image with a transparent area in the center, detected automatically.
- ROMs patched to be *batteryless* write their save to the cartridge's flash
  memory, which does not exist in an emulator: use the standard SRAM
  versions.

## Configuration

Everything that depends on the installation goes through `.env`, described
in [.env.example](.env.example). The two optional features:

- **SMTP**: required for password reset by e-mail and for open sign-ups.
  Without it, the administrator hands out a new password themselves.
- **Cloudflare Turnstile** (captcha, free): required for open sign-ups, and
  protects the reset request. Without a key, the captcha is bypassed, which
  is fine locally only.

The site's name and its welcome line are changed in Administration →
Réglages (Settings).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run installer` | install, or upgrade a local installation |
| `npm run dev` | site and link cable server in development |
| `npm run build` then `npm start` | production |
| `npm run library:scan` | re-read the library |
| `node scripts/importer-roms.ts --source <folder> --console gb --bibliotheque <LIBRARY_DIR> [--officiel] [--gamelist <gamelist.xml>] [--essai]` | file a folder of ROMs into the library (symbolic links, titles read from the No-Intro names); picks up the entries and covers from an EmulationStation `gamelist.xml` if there is one |
| `npm run user:create -- --pseudo <name> --admin` | create an account from the command line |
| `npm run db:migrate` | apply the migrations after an update |
| `npm run link:capacite -- --appliquer` | measure what a link cable room costs the server, and cap the number of rooms accordingly |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint, Next and TypeScript rules |
| `node --env-file=.env scripts/scraper.ts` | fill in the entries of official games (description, year, cover); also available as a single button in Administration → Bibliothèque (Library) |

## Tech stack

Next.js, TypeScript, Drizzle ORM on SQLite, Tailwind. Player: mGBA in
WebAssembly. Link cable: a WebSocket server in the same process as Next,
which runs TGB Dual (GB/GBC) or mGBA Splitscreen (GBA) in one worker thread
per room. The reasons behind each choice are in
[docs/decisions.en.md](docs/decisions.en.md).

## License

The project's code is under the [MIT license](LICENSE). The emulation cores
have their own licenses — MPL-2.0 for mGBA and mgba-splitscreen, GPL-2.0 for
TGB Dual — detailed in [THIRD_PARTY_NOTICES.en.md](THIRD_PARTY_NOTICES.en.md).
