[Français](decisions.md) · **English**

# Technical decisions

Each entry records what was chosen, on what evidence, and what remains to be
verified. Assumptions are flagged as such.

---

## 1. Emulation core: mGBA compiled to WebAssembly

**Choice**: [`@thenick775/mgba-wasm`](https://github.com/thenick775/mgba) — the
mGBA core from the `feature/wasm` branch, published as an npm package — rather
than EmulatorJS.

**Context**: the first plan went with EmulatorJS (libretro cores compiled to
wasm) because its interface comes for free. Reading both sets of documentation
reversed the conclusion.

**What the EmulatorJS documentation says**

| Need | Status |
|---|---|
| Save states | Options present (`EJS_onSaveState`, `EJS_loadStateURL`, slots via `EJS_defaultOptions`) |
| SRAM save | Well covered: `EJS_onSaveSave`, `EJS_onLoadSave`, `EJS_onSaveUpdate` (change detection by hash), `EJS_fixedSaveInterval` |
| **Fast forward** | **No documented option.** The term appears neither on the Options page, nor on the system pages, nor on the Features page |
| GB/GBC cores | `gambatte` (default) or `mgba` — a single `gb` system covers GB and GBC |
| GBA core | `mgba` only |
| Link cable | Nothing. The documented netplay is a WebRTC rendezvous server; the documentation does not say whether it means several controllers on one instance or separate consoles |

**What the mgba-wasm documentation says**

The public contract directly exposes every need in the requirements:

| Need | Method |
|---|---|
| Fast forward | `setFastForwardMultiplier(n)` / `getFastForwardMultiplier()` |
| Save states | `saveState(slot)` / `loadState(slot)`, plus auto-save |
| SRAM save | `getSave()`, `listSaves()`, `uploadSaveOrSaveState(file, cb)` |
| Reset | `quickReload()` |
| Pause | `pauseGame()` / `resumeGame()` |
| Remapping | `bindKey(binding, input)`, `buttonPress/Unpress(name)` |
| **Local link cable** | `linkLocalStartSession(options)`, `linkLocalStopSession()`, `linkLocalGetStatus()`, `linkLocalSetActivePlayer(player)` |

The mGBA core handles GB, GBC and GBA with **a single core**, MBC1/2/3/5
mappers included, and **MBC3+RTC** — required by real-time-clock hacks such as
Crystal Clear.

**Reasons for the choice**

1. Fast forward is documented and driven by a method, instead of being
   assumed to exist in an undocumented menu.
2. `linkLocal*` is the only link cable primitive found in a core usable in a
   browser. The repository describes it as "best for things like pokemon
   trades" — exactly the site's end goal.
3. The requested interface is very specific (bezel, screen on the top half on
   touch devices, 75% of the height on desktop, custom menu). With EmulatorJS
   you would have to neutralise its interface in order to replace it; with a
   bare core, there is nothing to undo.
4. A single core for all three consoles, hence a single behaviour to learn.

**What it costs**

- The whole interface has to be written: virtual gamepad, menus, settings.
  That is extra work, but it was bespoke work in any case.
- The core uses threads, hence `SharedArrayBuffer`, hence cross-origin
  isolation: `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`. These headers are set only on
  the player's routes, because `require-corp` would block the Turnstile
  captcha elsewhere on the site.
- `mgba.js` and `mgba.wasm` must be served same-origin: the pthread worker
  starts from the script's URL. No CDN.

**Licences**: mGBA core under MPL-2.0, gbajs3 interface under 2-clause BSD.
Both allow a public repository under our own licence, without contamination,
provided the copyright notices are kept. The details of all third-party
components, TGB Dual (GPL-2.0) included, are in `THIRD_PARTY_NOTICES.md`.

**To be verified in the field** (undocumented)

- That the wasm binding really does accept `.gb` and `.gbc` files, and not
  only `.gba`: the mGBA core handles them, but no documentation confirms that
  `loadGame()` accepts them. **Priority test for phase 5.**
- The bounds of the fast forward multiplier.
- The exact contents of `options` in `linkLocalStartSession`.
- The save state format (so that they can be stored and read back server-side).

**Escape hatch**: the player is written behind an adapter interface
(`src/lib/emulator/adapter.ts`). If the core disappoints on a `.gbc`,
EmulatorJS can be plugged in behind the same interface without touching the
rest of the site.

---

## 2. Remote link cable: what is actually possible

**Documented state**: mGBA implements the **local** link cable (several
emulated consoles within a single instance). The **network** link is listed
under the mGBA project's "Planned features": it does not exist.

**Consequence**: connecting two remote players will mean building the network
layer ourselves, around `linkLocal*`: one instance is authoritative, the
second player's inputs are relayed to it, and the picture is sent back to
them — or else both instances advance in lockstep with periodic state
verification. The repository's note ("v1 supports running one game+inputs at a
time") suggests the first approach.

This is the least certain part of the project. It stays in phase 7, after
everything else works, and no other phase depends on it.

---

## 3. Database: SQLite

A few dozen accounts, a single server. Postgres would mean one more service to
monitor and back up for no measurable gain. A backup is the copy of one file,
which matters more here than scaling.

Binaries (ROMs, saves, save states, avatars) stay on disk: multi-megabyte
blobs in the database would weigh down every backup.

---

## 4. Hand-written authentication

Auth.js does not handle password reset and fits poorly with a closed sign-up
where accounts are created by the administrator. A session cookie, a sessions
table and argon2id come to about two hundred readable lines, with no
dependency to keep up to date.

---

## 5. Sending email: an external relay rather than a local MTA

A mail server on a hosting provider's IP ends up overwhelmingly in spam at
Gmail and Outlook. A reset email that does not arrive is a dead feature. So
the code talks to an SMTP relay through `nodemailer`; the operator chooses
which one. SPF, DKIM and DMARC on the domain remain necessary in every case.

---

## 6. ORM: Drizzle rather than Prisma

**Choice**: Drizzle ORM on `better-sqlite3`.

Prisma was the first choice, and the data model had been written in PSL.
Three findings ruled it out at installation time:

1. Prisma's `latest` npm tag points to a **release candidate**
   (8.0.0-rc.29) whose CLI has been reoriented towards their cloud offering:
   no more `prisma db push`, replaced by a "data contract" workflow.
2. The latest stable version (7.10.1) now rejects `url` in the `datasource`
   block: you need a separate `prisma.config.ts` file **and** have to pass a
   driver adapter to the client.
3. That adapter, for SQLite, is `better-sqlite3` — so the same native
   dependency as a direct solution, to which Prisma adds its query engine and
   a generation step before every build.

Drizzle removes all three: no engine to deploy, no generation before the
build, and migrations in readable SQL in `drizzle/`, versioned with the code.
`better-sqlite3` installs from a prebuilt binary, so there is nothing to
compile on the server.

What is lost: Prisma Studio, replaced by `npm run db:studio` (drizzle-kit),
and a query syntax a little closer to SQL.

---

## 7. npm audit: 20 moderate alerts, left as they are

All of them come from `minimatch` through ESLint's dependency tree
(`eslint-config-next`, `@typescript-eslint`, the React plugins). These are
development dependencies: they are never served to the browser nor run in
production. `npm audit fix --force` would break `eslint-config-next`. To be
revisited when ESLint publishes the update.


---

## 8. Deployment: push to the server, no key entrusted to the forge

The remote repository is private, and the server has no way of reading it. Two
ways to get it there:

| | Deploy key on the forge | Bare repository on the server |
| --- | --- | --- |
| Credentials on the server | an SSH key registered on the forge | none |
| Trigger | `git pull` by hand or via webhook | `git push` from the workstation |
| If the forge changes hands | the server keeps an access that must be revoked | nothing to revoke |

The second is the one chosen: `/opt/online-emulators.git` is a bare repository
whose `post-receive` hook updates the working tree, installs the dependencies,
applies the migrations, builds the site and restarts the service. The server
knows neither the forge nor the remote repository.

Accepted consequence: a deployment requires the development workstation. For a
private site updated by a single person, that is of no consequence, and it
avoids leaving access to the code lying around on an exposed machine.

Restarting the service is the only privileged action: it goes through a
`sudoers` rule limited to that unit and to three `systemctl` subcommands.

---

## 9. Reverse proxy: Apache, because it is already there

The server already serves some fifteen vhosts behind Apache, with certificates
managed by `certbot --apache`. Adding nginx in front of it or alongside it
would have meant moving all those vhosts, or having two servers coexist on the
same ports, for zero gain here: the expected traffic is a few players.

Apache 2.4.47 introduced `ProxyPass ... upgrade=websocket`, which switches
requests carrying an `Upgrade` header all by itself. The remote link cable
will therefore be able to go through a WebSocket on the same origin, without
an extra vhost.

Caveat noted for that phase: the MPM in use is `prefork`, which ties up one
process per open connection. A WebSocket held open per player therefore holds
a process. With a few players that is painless; beyond that, the `event` MPM
will need looking into.

---

## 10. Backups: the SQLite API, not a file copy

In WAL mode, some of the recent writes live in `app.db-wal` and not in
`app.db`. A copy of both files taken during a transaction yields an
inconsistent snapshot, and `tar` guarantees nothing about read order either.

The two classic ways out are to stop the service while the archive is made —
which is what the backup of the book catalogue on this server does — or to use
SQLite's backup API, exposed by `better-sqlite3` as `db.backup()`. It copies
page by page while accounting for concurrent writes and produces a clean file
**without stopping anyone**.

It is the second: cutting off a game in progress for a nightly backup would be
absurd, whereas the book library, for its part, can afford a few seconds of
downtime. Verified on the server: the snapshot passes
`pragma integrity_check`.
