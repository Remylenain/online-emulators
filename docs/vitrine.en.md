[Français](vitrine.md) · **English**

# The showcase: playing without an account

By default, the whole site sits behind the sign-in. The **showcase**
(*vitrine*) opens a few games, chosen by the administrator, to visitors
without an account: the home page shows them one button per game, and they
play as **guests**.

What the server keeps about a guest: **nothing**. Their save, their save
states and their settings stay in their browser.

The typical use case: a second, public instance of the site, cut down to one
or two games, alongside a private library — see
[“A second instance on the same server”](deploiement.en.md#a-second-instance-on-the-same-server).
The showcase also works on a single instance: the rest of the catalog then
still requires an account there.

## One application, several uses

The same code serves every case; it is the administration's settings that
decide.

| What you want | Settings |
| --- | --- |
| A private library | Showcase off (the default) |
| Guests and accounts | Showcase on: without an account you see the buttons, signed in you get your catalog back |
| Guests only | Showcase on, sign-ups closed, and the administrator's account as the only one |
| A game in Discord | An application declared in Administration → Discord, on top of the rest — see [discord](discord/README.en.md) |

To fully separate a public site from a private library — separate accounts,
database and games — you install two instances rather than putting
everything into a single one.

## Turning it on

Administration → Réglages (Settings) → **Vitrine : jouer sans compte**
(Showcase: play without an account).

- Tick “Ouvrir ces jeux aux visiteurs sans compte” (Open these games to
  visitors without an account).
- Up to four buttons: a label (“Jouer en français”, “Play in English”…) and
  the game it launches. Empty label: the game's title.
- A game must be **published** to be offered. Unpublishing it also removes
  it from the showcase.

The setting takes effect within a few seconds, without a restart. Unticking
the box closes everything again.

The title and the line displayed above the buttons are the site's name and
its welcome line, set just above, in “Identité du site” (Site identity).

A guest's player is displayed in the language of the game being launched: a
button that launches a game declared as English leads to an English player.
The rest follows the visitor's language, which they can change in the
header — see [langues.en.md](langues.en.md).

### On a fresh instance

In order: drop the games into the instance's library, run the scan
(Administration → Bibliothèque (Library), or the command in
[deploiement.en.md](deploiement.en.md#publish-the-games-you-added))
so that they are published, then turn the showcase on. The form refuses a
game that is not published, and a showcase with no game.

## What changes for a visitor

| Address | Showcase off | Showcase on, without an account |
| --- | --- | --- |
| `/` | redirect to the sign-in | the showcase home page |
| `/partie/<console>/<game>` | redirect to the sign-in | the player, for a showcase game |
| `/api/rom/<game>` | refused | served for a showcase game, refused for any other |
| `/api/bezel/<id>` | refused | served (the screen bezels) |
| everything else | redirect to the sign-in | redirect to the sign-in |

A signed-in account sees no difference: the root remains its catalog, and
`/partie/…` redirects it to `/jouer/…`, where its progress is on the server.
The sign-in page gains a “Play without an account” link.

A Discord Activity can share the showcase's address: declared on the site's
host, it is added to it and the site keeps answering there. Declared on a
host of its own, that host serves only the Activity. See
[discord](discord/README.en.md).

## What a guest's browser keeps

| What | Where |
| --- | --- |
| The game's save | IndexedDB, `oe_invite` database |
| Ten save states (five manual, five automatic) | IndexedDB, `oe_invite` database |
| Keys, controller, bezel, volume | `localStorage` |
| The emulation core's working files | IndexedDB, `/data` and `/autosave` databases (as for an account) |

To erase everything, deleting the site's data in the browser is enough.

The player is the same as the one accounts use. For a guest, its save
requests (`/api/save`, `/api/state`, `/api/play`) do not go out on the
network: a replacement `fetch` answers them from within the browser, with
the same status codes and the same headers as the site's routes
(`src/lib/invite/stockage.ts`). Only the game itself and the bezels come
from the server.

### The limits, as told to the player

Browser storage is fragile:

- clearing the site's data erases the progress;
- nothing follows from one device or browser to another;
- Safari erases the storage of a site left unvisited for seven days;
- in private browsing, everything disappears on closing.

The player says so, and offers the save file as the workaround: “Download”
to take it with you, “Replace with a file” to pick it up elsewhere. Two
reminders, as long as a save made in the game has not been downloaded:

- on the **Quit** button, a dialog from the site offers to download it —
  you can leave without it;
- on **closing the tab**, the browser asks for confirmation. Its wording
  cannot be chosen, and phone browsers often ignore it: the real reminder is
  the first one.

Save states cannot be exported: only the save file travels.

## What the showcase does not do

- No link cable for a guest: it runs on the server and remains reserved for
  accounts.
- No automatic move from guest to account: to keep your progress when
  creating an account, you download your save, then import it once signed
  in.
- The site's name, its welcome line and the button labels are not
  translated: they are displayed as the administrator wrote them. Everything
  else in the showcase and the player exists in French and in English — see
  [langues.en.md](langues.en.md).
- The pages remain marked `noindex`: the showcase is open, not indexed.

## Where the code lives

| What | Where |
| --- | --- |
| The setting, the games open to guests | `src/lib/vitrine.ts`, `src/lib/vitrine-limites.ts` |
| The administration form | `src/app/(app)/admin/reglages/reglages.tsx`, `src/lib/admin/actions-vitrine.ts` |
| What opens without an account | `src/proxy.ts` (`CHEMINS_VITRINE`), `src/app/api/rom/[id]/route.ts`, `src/app/api/bezel/[id]/route.ts` |
| The home page served at the root | the rewrite in `next.config.ts` |
| The guest's home page and player | `src/app/(invite)/` |
| Storage in the browser | `src/lib/invite/stockage.ts` |
| The player, guest side | `src/components/player/lecteur-invite.tsx`, and `invite` in `lecteur.tsx` |
