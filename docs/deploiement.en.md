[Français](deploiement.md) · **English**

# Deployment

The repository contains no value specific to any one installation: no domain,
no secret, no absolute path. Everything goes through
`/etc/online-emulators.env`, created on the server. This document explains how
to install the site on a Debian 12 server that already runs other sites behind
Apache.

## What the installation sets up

| Path | Role | Owner |
| --- | --- | --- |
| `/opt/online-emulators.git` | bare repository, target of `git push` | the pushing user |
| `/opt/online-emulators` | working tree, built by the hook | pushing user:jeux |
| `/var/lib/online-emulators` | SQLite database, save files, avatars | jeux:jeux |
| `/var/backups/online-emulators` | daily archives | root, `700` |
| `/etc/online-emulators.env` | configuration and secrets | root:jeux, `640` |

The application server runs as a system user `jeux`, with no shell and no home
directory, and listens only on `127.0.0.1`. Apache alone is exposed.

These are the names of the default instance. The same server can host another
one, all of whose names get a suffix: see
[A second instance on the same server](#a-second-instance-on-the-same-server).

## Prerequisites

- Debian 12, Apache 2.4.47 or later (for `upgrade=websocket`)
- Node 20 or later, `npm`, `git`
- `certbot` and its Apache plugin: `apt install certbot python3-certbot-apache`
- a DNS A record from the domain to the server, already in place

## Installation

From your workstation, clone the repository into the home directory of the
account that will push updates, then run the script once:

```sh
git clone <repository> ~/online-emulators
cd ~/online-emulators
sudo ./deploiement/scripts/installation.sh \
    --domaine jeux.exemple.com \
    --mail admin@exemple.com
```

Options: `--port` (3100 by default), `--bibliotheque` to put the games
somewhere other than `/var/lib/online-emulators/library`, `--pousseur` if the
account that will push is not the one running `sudo`, `--instance` to install
one more instance alongside the first (see below).

The script is **idempotent**: you can run it again after changing the
templates. One exception: the HTTPS vhost (`<domain>-le-ssl.conf`) is
generated **only once** by certbot, from the `:80` vhost, at the moment it
issues the certificate. Editing `apache-vhost.conf.gabarit` afterwards does not
update it — you have to carry the change over by hand into both files. The
script never regenerates `SESSION_SECRET`, which would log every account out,
and it checks the Apache configuration before any reload — a syntax error would
take down the server's other sites.

The first deployment is triggered by the script itself: it pushes the local
clone to the bare repository, which runs the hook.

## Updates

```sh
git remote add serveur ssh://<server>/opt/online-emulators.git
git push serveur main
```

The `post-receive` hook runs, in order: `git checkout`, `npm ci`, the Drizzle
migrations, `next build`, then a restart of the service. The server has **no
access to the forge**: nothing to configure on the GitHub side, no deploy key
to entrust to it.

The hook installed in `/opt/online-emulators.git/hooks/` is a **copy** made by
`installation.sh`: editing `deploiement/scripts/post-receive` in the repository
changes nothing about the next deployment. This is deliberate — a hook that
rewrites itself while it is running is a nasty surprise the day it is broken.

The bare repository belongs to the pushing user, so refreshing the copy **does
not require** `sudo`:

```sh
install -m 755 /opt/online-emulators/deploiement/scripts/post-receive \
               /opt/online-emulators.git/hooks/post-receive
```

The file is the same for every instance and contains no path: once copied, it
works out its instance from the name of the bare repository it sits in
(`/opt/online-emulators.git`, or `/opt/online-emulators-<name>.git`), and from
there the working tree, the environment file, the service and the user. It
therefore refuses to run from anywhere else.

**A hook copied before instances were introduced does not need to be
replaced.** It hard-codes the names of the default instance, which have not
changed, and the `migrer.sh` it calls finds its instance on its own. Refreshing
it with the command above is still possible, and changes nothing about what it
does.

Migrations are applied under the service's identity, by
`deploiement/scripts/migrer.sh` through `sudo`. The hook itself runs as the
pushing user, and `/var/lib/online-emulators` is writable only by `jeux`:
SQLite needs to write to the **directory**, not just the file, to create
`app.db-wal` and `app.db-shm` there.

The site is unavailable for a few seconds during the restart, and the build
replaces `.next` underneath the running process: a player navigating at that
exact moment may see an error and will have to reload. With a handful of
players, that did not seem worth the complexity of a zero-downtime deployment.

## After installation

### Create an account

Sign-up is closed. Once the first administrator is in place, further accounts
are created **from the site's Administration page**. The command line is for
the first account, and as a fallback.

```sh
cd /opt/online-emulators
sudo -u jeux node --env-file=/etc/online-emulators.env \
    scripts/create-user.ts --pseudo Untel --email untel@exemple.com --admin
```

The password is randomly generated and shown only once. Go through
`sudo -u jeux` and not root: root would leave behind `app.db-wal` files owned
by root, which the service could no longer write to afterwards.

### Configure the SMTP relay

The simplest way is to do it from the site: **Administration → Settings →
Outgoing email**, with a button to send yourself a test message. What is
entered there takes precedence over the environment file and takes effect
immediately, without a restart. The environment file, described below, remains
the option for when you would rather not store anything of the kind in the
database.

As long as `SMTP_HOST` is empty, password reset links are written to the
service's log instead of being sent — so the feature is unusable by players.

**A mail server installed on the server itself will end up in the spam folder**
at Gmail and Outlook: a hosting provider's IP has no reputation, and a reset
link that never arrives is as good as a missing feature. An external relay
(Brevo, Mailjet, Postmark…) is the better choice: the code talks to any SMTP
server, it is a matter of four lines in `/etc/online-emulators.env`.

```sh
SMTP_HOST="smtp-relay.exemple.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASSWORD="..."
MAIL_FROM="Online Emulators <noreply@jeux.exemple.com>"
```

Then `sudo systemctl restart online-emulators`.

### Enable the captcha

Same choice as for the relay: both keys are entered in
**Administration → Settings → Captcha**, or in the environment file.

The forgotten-password form accepts a Cloudflare Turnstile captcha. As long as
`TURNSTILE_SECRET_KEY` is empty, it is bypassed. Filling in both keys from the
Cloudflare dashboard is enough to enable it.

The cross-origin isolation headers (`COOP`/`COEP`) cover only `/jouer` and
`/mgba`, precisely so that the Turnstile widget, loaded from Cloudflare,
remains allowed on the authentication pages.

### Add the games

`LIBRARY_DIR` expects one folder per console, then one folder per game. The
service only ever **reads** it: so it can live in `/home`, where
`ProtectHome=read-only` allows reading without granting the right to write.

### Symbolic links rather than copies

A working folder rarely holds a single ROM. For one version of a game you will
often find in it the reference build and several variants intended for
cartridges — including *batteryless* versions, which write their save to the
cartridge's flash memory. **That flash does not exist in emulation: the save
fails or gets corrupted.** An automatic scan of the working folder would
publish one or the other at random.

The library is therefore a separate folder, outside the working folder's tree,
where each game is a **real directory** containing **symbolic links** to the
precisely chosen files:

```
bibliotheque-jeux/
  gbc/
    mon-rom-hack/
      game.json                 real file, specific to the publication
      rom.gbc    -> .../Mon rom hack/Mon rom hack 1.2.gbc
      cover.webp -> .../Mon rom hack/jaquette.webp
```

Nothing is duplicated, the working folder is not cluttered with site metadata,
and publishing a new version comes down to re-pointing a link.

Two consequences to keep in mind:

- **The scan must follow links.** `readdir` with `withFileTypes` reports a
  symbolic link as such, not as a file: an `isFile()` test would silently
  discard the whole library. It takes a `stat` (which dereferences) and not an
  `lstat`.
- **This folder must not be synced.** The links contain absolute paths specific
  to the server; synced to another machine, they would point at nothing. The
  working folder, for its part, can stay synced.

### Publish the games you added

The catalogue does not update itself: dropping a folder in is not enough, you
have to rerun the scan. **The simplest way is to do it from the site**, on the
Administration page — the service already runs as the user that owns the data,
so no privilege is needed.

From the command line, if the site is unreachable:

```sh
cd /opt/online-emulators
sudo -u jeux node --env-file=/etc/online-emulators.env scripts/scan-library.ts
```

As `jeux` and not root, for the same reason as account creation: root would
leave behind files that the service could no longer write to. The scan is
idempotent, and every warning it prints points to a folder it has skipped —
missing ROM, ambiguous ROM, dead symbolic link, or invalid `game.json`.

### Fill in the entries for official games

A commercial game stored in the library (`"officiel": true` in its
`game.json`, which is what `scripts/importer-roms.ts --officiel` does) has
neither description nor cover. **Administration → Library →
Fill in the entries** goes and fetches them, without overwriting anything that
already exists, then reruns the scan:

- from **ScreenScraper** (screenscraper.fr) if an account is entered in
  Administration → Settings — the ROM is recognised by its hash, and the
  description comes in French when one exists. On top of the member account,
  the API requires "developer" credentials, which ScreenScraper issues on
  request;
- otherwise, or for whatever ScreenScraper does not have, from **libretro**'s
  public thumbnail collection, for the cover only. It is filed under each
  game's No-Intro name. An intact ROM is recognised by its hash in the
  No-Intro database, whatever its file is called: there is nothing to
  rename. The others (translation, patched file) are matched by title
  against the system's full list — the title from the entry, from the file,
  then the one the cartridge carries in its header. A match that is not
  letter for letter is marked "≈" in the log, so that it can be checked; a
  game that is recognised but has no image at libretro is named there, so
  you know under which name to look for it elsewhere.

Both the scan and the filling-in of entries can be limited to one console: the
menu next to the two buttons ("On all consoles", or a single one) follows the
list's filter. After adding a game, rescanning only its console takes a few
seconds instead of several minutes; the games of the other consoles are
neither rescanned nor unpublished. From the command line:
`--console gbc` on `scripts/scan-library.ts` and `scripts/scraper.ts`.

What is found goes into `DATA_DIR/retouches` (description, year) and
`DATA_DIR/jaquettes`: the library stays read-only, and a correction made
afterwards in the administration takes precedence.

### EmulationStation entries: import your own, export the site's

The site reads and writes EmulationStation's `gamelist.xml` format — the one
used by Recalbox, Batocera, RetroPie and ES-DE.

**Importing an existing setup.** If you already have a scraped ROM folder,
there is nothing to retype: `scripts/importer-roms.ts` reads the
`gamelist.xml` of the source folder (or the one `--gamelist` points to) and
takes from it, for each ROM it names, the title, the description, the year,
the author (`<developer>`, except with `--officiel`) and the cover, through a
`cover.<ext>` link to the original image.

```bash
node scripts/importer-roms.ts --source /chemin/roms/gbc --console gbc \
     --bibliotheque "$LIBRARY_DIR" --essai
```

A game that is already in the library keeps everything it has: the
`gamelist.xml` only adds what is missing. `--essai` shows what would be done
without writing anything; the scan then publishes the result.

**Exporting the site's entries.** Administration → Library →
"Export the entries" downloads a zip archive: per console, a `gamelist.xml`
and an `images/` folder, both keyed to the name of the original ROM file (the
one the library's link points to). By default only ROM hacks are included —
official games can be found in any scraper. A `README.txt` in the archive says
where to put the files depending on the frontend. No ROM is ever in the
archive.

### Limit the number of link cable rooms

Each room runs two consoles on the server, at 60 frames per second. So that
the site does not collapse if everyone opens a room at the same time, you
measure once what a room costs, and the server refuses to open more of them
than the processor can sustain:

```sh
cd /opt/online-emulators
sudo -u jeux node --env-file=/etc/online-emulators.env     --import ./outils/node/charge-ts.mjs scripts/capacite-link.ts --appliquer
```

The script starts a GB/GBC room and then a GBA room on a game from the
library, for about fifteen seconds each, without touching the saves, and
records the measured cost in the settings: the limit applies immediately. The
share of the processor left to the link cable (65% by default) is set in
Administration → Settings, which also shows how many rooms are still possible
right now. Redo this after a change of machine or of emulation core.

## Backups

The `sauvegarde-online-emulators.timer` timer runs every night at 04:30 and
keeps 14 days of archives in `/var/backups/online-emulators`. The folder is
readable only by root: an archive contains a copy of the database, and
therefore the accounts.

The database is not copied with `cp`: in WAL mode, a raw copy taken during a
write yields an inconsistent file. The script goes through SQLite's backup
API, which produces a clean snapshot **without stopping the service** —
players are never cut off.

```sh
sudo systemctl start sauvegarde-online-emulators.service   # on demand
sudo tail -20 /var/backups/online-emulators/sauvegarde.log
```

The archives stay on the same disk as the data: they protect against a slip of
the hand or a botched migration, not against a server failure. Copying them
elsewhere remains to be done.

## A second instance on the same server

The intended case: a private library, reserved for a few accounts, and
alongside it a public site reduced to a handful of games — a showcase. Both
run the same code, on the same server, without sharing any data whatsoever:
what is published on one does not exist on the other, and an account on one
opens nothing on the other.

Opening this second instance's games to visitors without an account is a
setting in its administration, once it is installed: see
[vitrine.en.md](vitrine.en.md).

### Install

The second instance's hostname must already point to the server. Then, from
the same clone as for the first:

```sh
cd ~/online-emulators
sudo ./deploiement/scripts/installation.sh \
    --instance vitrine \
    --port 3101 \
    --domaine vitrine.exemple.com \
    --mail admin@exemple.com
```

`--instance` takes a short name, made of lowercase letters, digits and
hyphens. It makes `--port` mandatory: there is no default port that is not
already another instance's, and the script refuses a port that another one
occupies. It also refuses a `--domaine` already served by another site: to
take over a hostname that used to proxy to the first instance, first remove
its vhost (`a2dissite`, then delete the file from `sites-available`); its
certificate, for its part, is kept and reinstalled. `--bibliotheque`
remains available to store this instance's games somewhere other than
`/var/lib/online-emulators-vitrine/library`.

Everything the installation sets up then carries the instance's name:

| Default instance | `vitrine` instance |
| --- | --- |
| user `jeux` | user `jeux-vitrine` |
| `/opt/online-emulators.git` | `/opt/online-emulators-vitrine.git` |
| `/opt/online-emulators` | `/opt/online-emulators-vitrine` |
| `/var/lib/online-emulators` | `/var/lib/online-emulators-vitrine` |
| `/var/backups/online-emulators` | `/var/backups/online-emulators-vitrine` |
| `/etc/online-emulators.env` | `/etc/online-emulators-vitrine.env` |
| `/etc/sudoers.d/online-emulators` | `/etc/sudoers.d/online-emulators-vitrine` |
| service `online-emulators` | service `online-emulators-vitrine` |
| `sauvegarde-online-emulators.timer`, 04:30 | `sauvegarde-online-emulators-vitrine.timer`, 04:45 |
| Apache logs `online-emulators-*.log` | Apache logs `online-emulators-vitrine-*.log` |

**Without `--instance`, nothing changes name**: rerunning `installation.sh` on
the first instance moves nothing, and installing the second touches no file
belonging to the first.

### Push

Each instance has its own bare repository, and therefore its own remote:

```sh
git remote add serveur-vitrine ssh://<server>/opt/online-emulators-vitrine.git
git push serveur-vitrine main
```

### What is shared, what is not

Shared: the **code** (the same repository, pushed twice), **Apache** and its
certbot, **Node**, and the pushing user.

Specific to each instance: the **database**, and therefore the **accounts**
and the settings entered in the administration, the **data** folder (save
files, avatars, covers), the game **library**, the **session secret** — a
cookie from one is worth nothing on the other —, the SMTP relay and the
captcha, the backup archives, and the **system user** that runs the service.

That last point is what really provides the isolation. A public site is more
exposed than a private one: if it is compromised, its process runs as
`jeux-vitrine`, which is not a member of the `jeux` group and therefore can
read neither `/etc/online-emulators.env`, nor `/var/lib/online-emulators`, nor
`/opt/online-emulators`, nor the archives in `/var/backups/online-emulators`.
Three limits to be aware of:

- The isolation applies to **files**, not to the local network: a process of
  one can still talk over HTTP to the other's port on `127.0.0.1`, as any
  visitor does through Apache.
- A library stored outside `/var/lib` (in `/home`, for example) is protected
  by its own permissions, not by the installation: if it is world-readable, it
  is readable by the other instance's user. Conversely, the showcase's library
  must remain readable by `jeux-vitrine`.
- The pushing user belongs to both groups — it needs to read both environment
  files in order to build — and the bare repositories, which contain only the
  code, are readable by everyone on the server.

### Updating both

One push per bare repository. Each one deploys only its own instance: the
other keeps running the version it had, with no interruption.

```sh
git push serveur main            # the first instance
git push serveur-vitrine main    # the second
```

Nothing forces you to keep them at the same commit, but letting them diverge
for long means maintaining two versions of the site.

### Day to day

The commands in this document apply to a named instance, provided you replace
three things in them: the working tree, the user and the environment file.

```sh
cd /opt/online-emulators-vitrine
sudo -u jeux-vitrine node --env-file=/etc/online-emulators-vitrine.env \
    scripts/create-user.ts --pseudo Untel --email untel@exemple.com --admin

sudo systemctl status online-emulators-vitrine
sudo journalctl -u online-emulators-vitrine -f
sudo systemctl start sauvegarde-online-emulators-vitrine.service
sudo tail -40 /var/log/apache2/online-emulators-vitrine-error.log
```

A Discord Activity hostname belongs to the instance whose administration
declares it. `hote-activite.sh` proxies it to the first instance unless you
name another one, whose port it then reads back from the systemd unit:

```sh
sudo ./deploiement/scripts/hote-activite.sh --instance vitrine \
    --domaine prism.exemple.com --mail admin@exemple.com
```

### On a server that is already installed

Adding an instance asks nothing of the first: no reinstallation, no
replacement of its hook, no change to its `sudoers` rule. One precaution only,
**before** installing the second: lock down the first instance's archive
folder, which early versions of the installation left world-readable.

```sh
sudo chmod 700 /var/backups/online-emulators
```

Without this, the new instance's user could read a copy of the other's
database there. The backup script now does it by itself on every run, and so
does `installation.sh` when you rerun it; the command above merely saves you
the wait.

## HSTS

The application sends `Strict-Transport-Security: max-age=31536000`. The
browser will use nothing but HTTPS for this domain for a year, even if the
address is typed without `https://` — otherwise the first request goes out in
the clear, and Apache's redirect comes too late to protect the session cookie.

No `includeSubDomains` (the site has no subdomain) and no `preload`, which
requires registering with browser vendors and is all but impossible to undo.

**Rolling back takes patience.** Removing the header is not enough: browsers
have remembered it. You have to serve `max-age=0` and wait for visitors'
caches to expire. Keep this in mind before touching the certificate or moving
the domain.

## Troubleshooting

```sh
sudo systemctl status online-emulators
sudo journalctl -u online-emulators -f
sudo tail -40 /var/log/apache2/online-emulators-error.log
```

Two pitfalls already run into:

- **`SQLITE_BUSY` at build time.** `next build` starts as many processes as
  there are cores, and all of them open the database. Switching to WAL
  requires an exclusive lock: `busy_timeout` must be set *beforehand*,
  otherwise concurrent opens fail instead of waiting. Fixed in
  `src/db/index.ts`.
- **Next listens on all interfaces** by default, which makes the application
  reachable in the clear on its port, bypassing Apache and without HTTPS.
  Hence the `-H 127.0.0.1` in the systemd unit.
