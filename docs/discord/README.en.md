[Français](README.md) · **English**

# Discord Activity

One of the site's games, playable **inside Discord**: a server member launches
the Activity, presses "Play", and their progress is kept for their Discord
account. No sign-up, no password, nothing to install.

This page is for whoever hosts the site and wants to offer a game — their ROM
hack, their translation — in their own Discord server.

> **Status: prototype.** Tested with a Game Boy Color ROM, locally and then in
> Discord on desktop: sign-in, gameplay, saving and the clock all work.
> Not yet tested on a phone, nor with a GBA game. The per-server lock has been
> tested against simulated Discord responses, not against a real instance.
> Two-player mode, keys and the controller have been tested locally (two test
> accounts), not yet in Discord.

## In a nutshell

- **Emulation runs on the player's side**, inside their Discord. The site's
  server sends the page, the emulator (≈ 900 KB) and the ROM, then does nothing
  more than store the saves. A small server is enough, even with a crowd.
- **One Activity = one Discord application = one game.** For another game,
  another application, declared in the administration with **its own
  hostname**: the host of the request is what says which Activity answers, and
  an Activity host serves nothing else from the site.
- **Progress follows the Discord account**, from one device to another, in the
  same format as the site's player, real-time clock included — solo as well as
  two-player.
- **In two-player, the voice channel is the game room**: two members who open
  the Activity in the same voice channel play together over the site's link
  cable, with no code to exchange; those who come after watch. The server only
  holds so many rooms at a time, and the Activity handles the queue.
- **Keys and controller** are set in the Activity, and are the account's: the
  same as on the site.
- **In solo, a pause menu**: five save states set by hand, the administrator's
  tips scrolling by; speed and sound are adjusted at the bottom of the screen.
- **A welcome message and tips** per application, written in the
  administration: the message at every launch, one tip at random.

## How it works

Three machines, three roles:

| Who | What it does |
| --- | --- |
| The site's server | Serves the page, the emulator and the ROM; says who is playing; stores the saves |
| Discord | Displays the page in a frame and routes all traffic through its proxy (`https://<application ID>.discordsays.com`) |
| The player's device | Runs the emulator and the game |

The path of a launch:

1. The player opens the Activity. Discord loads the **root** of the address
   set in the URL Mapping, with `frame_id` in the address.
2. The site redirects to the `/discord` page (`src/proxy.ts`).
3. The page obtains an authorization code from the Discord client (`identify`
   scope, nothing else) and sends it to `/api/discord/session`.
4. The server exchanges that code with Discord — this is where the
   application's secret is used — then asks Discord who the user is. What the
   page claims is never taken at its word.
5. On first launch, a site account is created: **restricted**, with only this
   game assigned, and no password (`users.discord_id`). The ordinary access
   rules (`src/lib/acces.ts`) apply to this account. Its username is the
   player's Discord name, and follows it when it changes. In the admin, the
   account carries a "discord" tag, and its play time counts as on the site
   (Play time, "who is playing"): the Activity reports the game every minute
   (`/api/discord/partie`), and the link-cable server does it for both
   players of a room.
6. The page receives a signed token, valid for twelve hours, which it sends
   back in a header. No cookie: in a third-party frame, browsers refuse them.
7. The player presses "Play" — a gesture is needed for the browser to let
   sound start. The ROM and the save arrive, the game starts. Every time the
   game writes its save, it goes off to the server.

### Why a different emulator from the site's

The site's player uses a threaded mGBA, hence `SharedArrayBuffer`, hence
cross-origin isolation. Discord doesn't grant it to its frames, and has replied
that it cannot do so. The Activity therefore loads an mGBA built **without
threads** (`coeurs/mgba-splitscreen`, "single console" variant, 32 MiB of
memory at start), which runs in any page. See
[its README](../../coeurs/mgba-splitscreen/README.md).

## Setting it up: the complete walkthrough

Everything there is to do at Discord, then in the site, then on the server.
The same walkthrough is shown in the administration (Discord tab,
"Read the walkthrough"); the two are maintained together. Tab names are those
of the portal as of late 2026; Discord sometimes moves them, the concepts
stay.

### 0. Before you start

- A Discord account and **a Discord server of your own** (or one you
  administer) with **fewer than 25 members**: as long as the application isn't
  verified by Discord, it only launches in a server of that size, and only
  for you, your team and your testers.
- **Developer mode** in Discord: User Settings → Advanced → Developer Mode.
  It adds "Copy ID" to right-click menus.
- A **hostname** for the Activity (`prism.exemple.com`), different from the
  site's, that you can point at the server at your registrar.
- The game already present in the site's library (published or not).

### 1. Create the application at Discord

1. <https://discord.com/developers/applications> → **New Application**. The
   name is the one players will see in the launcher — the name of the game,
   for example.
2. **General Information** tab: copy the **Application ID** (18 or
   19 digits); the site asks for it under the same name. Add an icon and a description,
   shown in the activity launcher.
3. Don't copy the **Public Key**: it isn't used here, and mistaking it for
   the secret gives `invalid_client`.

### 2. The secret and the redirect address (OAuth2 tab)

1. **Client Secret** → **Reset Secret** → copy it right away: Discord only
   shows it once. Regenerating it later invalidates the old one, everywhere it
   is stored.
2. **Redirects** → Add Redirect → `https://127.0.0.1` → Save Changes. Discord
   requires a redirect address; the Activity never uses it.

### 3. The bot token (only to restrict the Activity to one server)

1. **Bot** tab → **Reset Token** → copy it right away.
2. Nothing else: the bot doesn't need to be invited to the server, nor does
   it need any permission. With this token, the site only asks Discord where
   the Activity is running and who is in it.
3. The server's ID: right-click the server's name → **Copy Server ID**.

### 4. Enable the Activity (Activities tab)

1. **Getting Started** → **Enable Activities**.
2. **Settings**: tick the platforms you want (desktop, iOS, Android).
   For a Game Boy game, the "portrait" orientation on phones is suitable.
3. **URL Mappings**: a single row, prefix `/`, target the Activity's hostname
   **without** `https://` or a path. Discord will route everything the page
   requests through its proxy to that host.

### 5. Declare the Activity in the site

**Discord** tab of the administration → *New application*: a name, the
hostname, the game served, the application ID and the Client Secret, and if
needed the lock (server ID and bot token). Then **Test against Discord**: the
credentials must be accepted before going any further. **Step-by-step**
recalls, for this application, what remains to be copied into the portal.

The form also has a **Welcome message** (shown at every launch under the
game's title: an introduction, an instruction for testers), and the
application's card has **Tips** to add one by one: word of the day, advice,
reminder. The home screen shows one at random, and the pause menu cycles
through all of them.

Finally **Offered by** and **Contact**: a name or a pseudonym, and a way to
reach you. They are displayed on the Activity's legal pages (see
"The legal pages") and are not written anywhere in the repository.

The **hostname** is either:

- **a separate host, dedicated to this Activity**: neither the sign-in page
  nor the catalog is served there, and its root redirects to the Activity.
  This is what you need when the Activity must say nothing about the site
  hosting it — a private library, for example;
- **the site's own host**: the Activity is added to it without reserving
  anything. The site keeps answering there, and Discord, which opens the root
  with `frame_id`, finds the Activity there. This is what you need for a
  public site devoted to the game the Activity serves (a
  [showcase](../vitrine.en.md)): a single address, no extra DNS or vhost. In
  return, the whole site becomes reachable through Discord's proxy — it still
  refuses to be displayed in a frame, the Activity excepted.

Secret and bot token are stored like the other secrets in the settings:
readable only by the service account, never sent back to the browser, never
in the repository — Discord's terms forbid publishing these credentials in an
open project, application ID included.

**As a fallback, the environment.** With no row in the administration for the
requested host, the site falls back on `.env` — a single Activity, which
answers on the site's host and on any undeclared host:

```
DISCORD_CLIENT_ID="…"       # Application ID, General Information tab
DISCORD_CLIENT_SECRET="…"   # Client Secret, OAuth2 tab (Reset Secret button)
DISCORD_JEU="…"             # the game's identifier in the database (games.id column)
```

As long as no Activity is configured for a host, `/discord` and
`/api/discord` answer 404 there.

### 6. The hostname, on the server side

1. At the registrar: an `A` (or `CNAME`) record pointing the hostname at the
   server. Wait until it is visible (`nslookup`).
2. On the server, as root, from the clone of the repository:
   `sudo ./deploiement/scripts/hote-activite.sh --domaine prism.exemple.com --mail toi@exemple.com`
   — same vhost template as the site, everything is relayed to the same Next
   server, then certbot. On a named instance (see
   [deploiement.en.md](../deploiement.en.md#a-second-instance-on-the-same-server)),
   add `--instance <name>`: without it, the host would relay to the default
   instance.
3. Check: `https://prism.exemple.com/` must display the Activity (the
   "This page opens from Discord" page) and `…/connexion` must answer
   "Introuvable" (Not found).

### 7. Launch it in Discord

1. Join a voice channel in the server.
2. Open the **activity launcher** (the voice channel's rocket icon, or the
   "Activities" button) and search for the application by name.
3. On first launch, Discord asks for permission to know your identity:
   accept. The site then creates your account, restricted to this game.
4. For a friend to try it before verification: **App Testers** tab, invite
   their account (50 at most).

### 8. Try it without Discord, or without deploying

- **Outside Discord**, during development: `DISCORD_ESSAI_LOCAL="1"`, then
  open `/discord` on a host that has an Activity — for example an application
  declared on `127.0.0.1`, with the site staying on `localhost`. A test
  account stands in for the Discord user; `?essai=nom` opens another one,
  `?muet=1` mutes the sound. Ignored in production.
- **In Discord, without deploying anything**: a tunnel to the local server
  (`cloudflared tunnel --url http://localhost:3000`), with its hostname as the
  URL Mapping target. The tunnel exposes the development server on a public
  address for as long as it runs: turn local testing off beforehand, and put
  the mapping back afterwards.

### 9. When it doesn't work

- **White or black screen**: the URL Mapping doesn't point to the right host,
  the DNS isn't visible yet, or the certificate is missing. Open the host in a
  browser to see which.
- `invalid_client` in the server log: wrong ID, or the Public Key put in
  place of the secret. `invalid_grant`: expired code, relaunch the Activity.
- "This Activity can only be played in the Discord servers it is restricted
  to": the lock is refusing; check the server ID and the bot token with
  "Test against Discord".
- The application doesn't appear in the launcher: platform not ticked in
  Activities → Settings; server of 25 members or more; account that is neither
  the owner, nor on the team, nor a tester.
- Players don't see each other in two-player: they must be in the **same voice
  channel**; it is what makes the game room.

### 10. Beyond 25 members: verification

Discord asks for **verification of the application**, and therefore of its
owner's identity, and a commitment to its developer terms — including respect
for third parties' rights. This is a decision to make before opening the
Activity to a large server: it attaches an identity to the application.

According to Discord's help pages (November 2026):

1. The application must belong to a **team** (portal → Teams, then
   General Information → transfer the application to the team). It is the
   team owner's identity that Discord has checked, by Stripe.
2. The **legal pages**: paste into General Information the two addresses
   given by the application's "Step-by-step" —
   `https://<host>/discord/confidentialite?lang=en` (Privacy Policy URL) and
   `https://<host>/discord/conditions?lang=en` (Terms of Service URL) — the
   English version, the one Discord will read.
3. The **App Verification** tab lists the requirements; when all are met,
   the "Verify App" button.

Once verified, the application stays **public**: Discord no longer lets you
turn off the "Public Bot" setting, and anyone can add it to their server. The
per-server lock is then what keeps the game for yours. Discovery (directory,
other servers' launchers) remains a separate setting, off until you turn it
on.

Unverified: the exact list in the App Verification tab, which only the
application's owner sees.

## The legal pages

Each Activity serves, on its hostname, a **privacy policy**
(`/discord/confidentialite`) and **terms of use** (`/discord/conditions`).
Discord asks for their addresses in the portal, and its developer terms
require the former.

- They name the game, and what the administrator entered in "Offered by"
  and "Contact". Without those two fields, they refer to the people in charge
  of the Discord server where the Activity is launched. Nothing in them names
  the site hosting the Activity.
- The privacy policy **describes what the code does**: what it receives from
  Discord, what it stores, what it logs. Whoever changes one rereads the
  other, and updates `MISE_A_JOUR` in `src/lib/discord/mentions.ts`.
- It promises deletion of an account on request: that is the
  "Delete permanently" button of the Accounts tab, which removes the account,
  its progress, its save states and its settings.
- It doesn't say how long the web server keeps its log: that depends on the
  hosting, not on the site.
- The texts exist in French and in English, each at its own address
  (`?lang=fr`, `?lang=en`); the French is the reference. They hold for any
  game: they say nothing about the rights to the one the Activity serves.

## Two-player mode

Solo, emulation runs on the player's side. In two-player, it is the **site's
link cable** (`src/lib/link`): both consoles run on the server, in a worker
thread, and each page only receives its screen and the sound over
WebSocket — Discord lets WebSockets through in an Activity, not WebRTC. The
client is the same component as on the site (`SalonLink`), with the Activity's
token in place of the cookie.

- **The voice channel is the game room.** Everyone who opens the Activity in
  the same voice channel shares a Discord *instance*; the session derives an
  opaque key from it (`cleInstance`), and the server opens one link cable room
  per instance: private, with no code, invisible from the site. The first to
  choose "Play two-player" opens it, the second takes a seat in it, those who
  come after watch (five at most).
- **Each player's progress is their account's**, read at the start and
  written back at the end, as on the site: a game started alone continues in
  two-player.
- **Places are counted.** The server measures what a room costs (Settings →
  Link cable) and refuses beyond that. In Discord, rather than refusing, the
  instance takes a place in a queue (`src/lib/link/file.ts`); the screen tells
  its position, and the room opens when its turn comes. An instance that
  closes its page leaves the queue within twenty seconds.
- **GB, GBC and GBA**: the same cores as the site's link cable.
- Without a per-server lock, the instance key is the only door: whoever knows
  it can take a seat in the room. It only travels between the page and the
  site, but it is not proof of belonging to the voice channel; the lock is.

To try it outside Discord: two tabs on `/discord?essai=a&instance=x`
and `/discord?essai=b&instance=x` — the same `instance` stands in for the
voice channel.

## A player's progress: taking it away, bringing their own in

On the home screen, "Download my progress" gives the save file (`.sav`, the
format of the site's player, readable by mGBA or a real cartridge) and
"Replace with a file" imports one, after confirmation; the server keeps the
previous versions. It is the same progress as on the site, carried by the
account.

What is imported ends up in an emulation core — on the player's side in solo,
**on the server** in two-player. What contains it: a save is cartridge memory
read by the emulated game, never executed code; the cores are WebAssembly,
with no access to the system; each room runs in its own worker thread,
memory-bounded, whose crash closes the room without writing anything; and the
server refuses anything over 132 KiB (`TAILLE_MAX_SAUVEGARDE`), the largest
cartridge plus a clock footer — for the site as for the Activity. The worst
case is a room that goes down, or a tampered save that bothers the other
player.

"Start from scratch" sets the progress aside in the same way: it joins the
previous versions (the site knows how to restore it), and the next "Play"
starts like the first time. The save states stay.

Unverified: that the Discord client lets the iframe trigger a download. The
fallback is the site, same account, same progress.

## The pause menu: save states, tips, speed, sound

In solo, "Pause" at the bottom of the screen stops the console and opens the
menu:

- **Five save states**, set by hand only — no automatic rotation as on the
  site. Same storage as the site's player (`/api/discord/etat`, token in a
  header): a save state taken in Discord shows up there. The Activity's core
  returns a raw state, without an image: the page attaches a capture of the
  screen to it (`?vignette=1`), stored separately.
- **The tips** of the application scroll by, one every seven seconds.
- **Speed** (×1 to ×5, with the fast-forward key on top of that) and
  **sound** (button and slider, remembered in the browser) are at the bottom
  of the screen, during the game.
- **Rumble**, for a game whose cartridge has a motor (Pokémon Pinball and its
  derivatives, for instance): a button turns it on or off, remembered in the
  browser. See below.

### Cartridge rumble

The core reports, frame by frame, the share of the time the cartridge's
motor ran (`mgs_get_rumble`); `src/lib/emulator/vibration.ts` turns it into a
vibration of whatever the player is holding:

- **the phone**, through `navigator.vibrate`: on Android. iOS offers that
  call in no browser; nothing vibrates, nothing breaks;
- **the connected controller**, when the browser can drive its motors
  (`vibrationActuator`).

The button in the pause menu only shows up if the game rumbles — a Game Boy
cartridge says so in its header (MBC5 with a motor), a GBA cartridge is
recognised at its first rumble — and if there is something to vibrate: a
touch screen that knows `navigator.vibrate`, or a controller with motors.
Solo only: with two players, emulation runs on the server, which only sends
the picture and the sound.

The site's player rumbles the same way, for those same games: it then takes
this core instead of its own (see `docs/decisions.en.md`, item 1).

Tried in a browser with Pokémon Pinball Generations, logging the calls to
`navigator.vibrate` one by one. **Never felt on a real phone nor in the
Discord app**, where the Activity runs in a web view that may or may not
allow vibration; controllers and the GBA have not been tried either.

## Keys and controller

The "Keys and controller" button on the home screen opens the same screens as
the site's player. In solo play, the pause menu has the same button: you
change your keys without leaving the game, with the console paused, and
"Close" brings you back to the pause menu. They save to the Discord account through
`/api/discord/touches` (token in a header); a setting made in the Activity
applies on the site, and vice versa. Unverified: that Discord lets an
Activity's iframe use the Gamepad API.

## The launch command

As soon as an application enables Activities, Discord creates an entry point
command for it, named `launch`. It is the Activity's button in the App
Launcher: Discord launches the Activity itself, and the site has nothing to
receive. Since every Activity carries that same default name, renaming it
makes it easier to find.

**It cannot be typed.** The list that opens when you type “/” in a channel
does not offer it, and writing it out in full launches nothing — observed on a
real application, renamed, with no permission restriction. Discord's
documentation files it under “UI-based” commands, next to the context-menu
ones. For a player to type `/prism`, see “Typing it in a channel” below.

On the application's card, **Launch command → Show the command** reads its
name and description from Discord, and lets you change them — `prism` instead
of `launch`. The name is not stored in the site: Discord is the only source
(`src/lib/discord/commande.ts`).

- An application has only one entry point command: you rename it, you do not
  add another.
- The name follows Discord's rules: lowercase letters, digits and hyphens, no
  spaces, 32 characters at most.
- The site talks to Discord with the bot token if there is one, otherwise with
  the application's ID and secret.
- The default command carries one name per language — “lancer” in a French
  Discord — and that is the one players see. Renaming clears those
  translations: the new name then applies to every language, and Discord no
  longer translates it.
- A change can take a few minutes to reach players.
- The Activity can also be launched from a text channel, through the App
  Launcher in the message bar: no need to be in a voice channel. Discord then
  posts a message in the channel announcing the game, from which other members
  can join. Observed in use; Discord's documentation does not say which
  channel types. To get rid of it, see “The invite in the channel” below.
- The server lock and the restricted roles apply the same way, whatever the
  channel.

### Typing it in a channel

For `/prism` to be typed in a channel, like the commands of Discord's own
Activities, a second command is needed — an ordinary one this time, with the
same name. Discord does not launch it by itself: each time a player types it,
Discord notifies the application at the address it declared (*Interactions
Endpoint URL*) and waits for its answer. The site answers “launch the
Activity” (`LAUNCH_ACTIVITY`), and Discord opens it as it would from the App
Launcher.

In the same panel, **Typing it in a channel → Allow typing /prism** does the
three things required, in this order:

1. read the application's public key from Discord and store it
   (`discord_apps.public_key`) — the site uses it to check that what it
   receives really comes from Discord;
2. declare the address `https://<application's host>/api/discord/interactions`
   to Discord. Discord tries it on the spot, with one properly signed request
   and one badly signed: the site must therefore be reachable from the
   internet, over HTTPS;
3. create the command, with the entry point command's name and description.

**Stop allowing it to be typed** undoes all three, in reverse order. Renaming
the command renames both.

- The **bot token** is required: Discord allows neither reading the key nor
  declaring the address with the ID and secret. It is entered along with the
  lock; once the typed command is enabled, lifting the lock no longer erases
  it.
- The site refuses to plug into an application that already has an
  interactions address, or other commands: a bot handles them, and declaring
  an address would divert everything that bot receives to the site.
- The route (`src/app/api/discord/interactions`) reads only the targeted
  application and the interaction type from Discord's message. Discord
  attaches who typed the command and in which channel: none of it is read,
  kept or logged. The Activity's privacy page says so as soon as the typed
  command is enabled.
- The player's rights — lock, roles — are not checked at that point, but when
  the Activity opens, as for a launch from the App Launcher.
- A wrong signature gets a 401. Discord sends some on purpose from time to
  time, and removes the address of an application that would accept them.
- For an Activity configured through the environment, without the
  administration: `DISCORD_CLE_PUBLIQUE` (“Public Key”, *General Information*
  tab), then the address and the command by hand, in the portal and through
  the API.
- Observed on a real application: the command shows up in the “/” list and
  opens the Activity. The list can take a few minutes to offer it, and
  restarting Discord speeds it up.

### The invite in the channel

When Discord launches the Activity itself — from the App Launcher button — it
posts a “game invite” in the channel, every time: a card with a “Play” button,
which stays after the game. No portal setting prevents it.

The typed command posts none: the site answers, and Discord merely opens the
Activity. Observed on a real application. The App Launcher button can go the
same way: the entry point command carries a setting, `handler`, that tells
Discord to stop launching it itself and to notify the application instead.

In the same panel, once the typed command is enabled, **The invite in the
channel → Stop posting the invite** changes that setting; **Let Discord post
the invite** puts it back as it was.

- The typed command is required: Discord notifies the site at that same
  address. “Stop allowing it to be typed” first hands the launch back to
  Discord, so that the button is not left unanswered.
- In return, other members of the channel no longer get a card to join from,
  and the App Launcher button launches nothing when the site is unreachable —
  Discord used to launch the Activity without asking anything.
- Nothing is stored in the site: the setting is read from Discord, like the
  command's name.
- Tried against a fake Discord. Whether the invite also disappears for the
  App Launcher button remains to be observed on a real application: Discord's
  documentation does not say.

## Locking the Activity to one server

By default, the Activity can be played anywhere Discord agrees to launch it.
To restrict it to **certain servers**: in the administration, tick
*Restrict the Activity to certain Discord servers*, with their IDs, one per
line (right-click the server → Copy Server ID, developer mode enabled), and
the bot token (Bot tab of the portal). One server or several, twenty at most
(`discord_app_servers`). As a fallback, in `.env`, for a single server:

```
DISCORD_SERVEUR="…"     # the server's ID
DISCORD_BOT_TOKEN="…"   # Token, Bot tab of the portal
```

When a session is opened, the site then asks Discord where the Activity's
instance is running and who is in it (`src/lib/discord/instance.ts`).
The session is only opened if the instance exists, runs in one of those
servers, and the user is part of it. Otherwise: no token, hence no game and no
save.

- The page decides nothing: it gives the name of its instance, and it is
  Discord that answers the site. A made-up name matches no instance.
- When in doubt (Discord unreachable, bot token refused), the answer is no.
- The bot token is used for this question only, and for the one about roles
  below.
- `DISCORD_SERVEUR` without `DISCORD_BOT_TOKEN` prevents the site from
  starting, rather than letting anyone believe in a lock that checks nothing.
- The lock is checked when the session is opened; the session is valid for
  twelve hours.

### Restricting to certain roles

The lock says **where** the Activity is played; roles say **who**, among the
members of a server, is allowed to play. On the application's card,
**Restricted roles → Choose the roles** reads the server's roles from Discord
and offers them by name. One ticked role is enough for a player; with no box
ticked, all members of the server play, as before.

**Roles are chosen server by server**: with several servers in the lock, the
card shows one panel per server, labelled with its ID. A role only exists in
its own server; one server's roles do not count in another, and one can be
open to all its members while another is restricted.

As a fallback, in `.env`, for the server in `DISCORD_SERVEUR`:

```
DISCORD_ROLES="…,…"     # role IDs, separated by commas
```

When a session is opened, after the location check, the site asks Discord for
the player's member record in the server where the Activity is running and
looks at their roles (`src/lib/discord/roles.ts`). Without one of that
server's restricted roles: no token.

- **The bot must be invited to every server where roles are restricted.** Discord only answers about a
  server's members to a bot that belongs to it — which the lock alone did not
  require. It needs no permission. If the bot is not there, the role picker
  says so and gives the invitation link.
- When in doubt (bot absent, Discord unreachable), the answer is no for
  everyone. **Test against Discord** checks in advance that the bot can read
  the roles and that the restricted ones still exist.
- Two distinct refusals for the player: they have none of the roles, or their
  roles could not be checked.
- Roles are checked when the session is opened, like the lock: a role that is
  removed takes effect at the next launch.
- Removing a server from the lock, or lifting the lock, forgets its
  restricted roles: they do not exist anywhere else. The other servers keep
  theirs, and an added server is open to all its members until roles are
  chosen for it.
- The Activity stays visible in Discord's launcher for all members; a member
  without a role is refused when opening it.
- The Activity's privacy policy says so as soon as a role is restricted: the
  member record is read, not kept.

## What players can see of your server

- **The player only talks to Discord.** Their page comes from
  `<application ID>.discordsays.com`, and all their requests go
  back there. According to Discord's documentation, the proxy serves precisely
  to hide the players' IP address and that of the application's server.
- **The page doesn't name the site**: no name, description or manifest in its
  head, no absolute address.
- **A host dedicated to the Activity serves only the Activity.** Declared in
  the administration with a hostname of its own, nothing else from the site
  answers there — the sign-in page, for example, would otherwise be readable at
  the same `discordsays.com` address, and would say what the site is. That is
  the case for the fallback Activity (`.env`), which answers on the site's
  host.
- **The software is recognizable.** This repository is public: the shape of
  the addresses and the texts of the page are enough to identify it. That says
  which software is running, not where.
- **A domain name is not a secret.** Every TLS certificate is recorded in
  public logs, and a hostname leads to an IP address, hence to the other sites
  hosted behind it.
- Whoever has access to the application in the developer portal (the team's
  members) sees the URL Mapping. Invited testers don't.

Unverified: whether Discord exposes an application's URL Mapping to its users
by some route other than the portal.

## Limits that don't depend on the site

- An **unverified** Activity only launches in a server of fewer than
  25 members, and is visible only to the application's owner, their team and
  their invited testers (50 at most). Beyond that, Discord asks for
  verification of the application, and therefore of its owner's identity.
- Discord's developer terms forbid an application that infringes a third
  party's rights. Everyone is responsible for what they offer there.

## What remains to be done

- Testing on iOS and Android.
- Testing the lock on a real instance.
- GBA (the core handles it, nothing has been tested).
- Pausing when the Activity goes into picture-in-picture; orientation on
  phones.
- Two-player mode and the controller in Discord itself (tested locally only);
  the latency of Discord's proxy on picture and sound.
- Linking an existing site account to its Discord user, to find its progress
  there.
- The test button doesn't say whether a host is actually relayed all the way
  to the site.

## Where the code lives

| What | Where |
| --- | --- |
| The page and its component | `src/app/discord/`, `src/components/discord/activite.tsx` |
| The core adapter (pacing, picture, sound, save) | `src/lib/emulator/mgs.ts` |
| Session, ROM, save, core, keys | `src/app/api/discord/` |
| Two-player: home screen, queue, room client | `src/components/discord/duo.tsx`, `src/components/link/salon-link.tsx`, `src/lib/link/file.ts`, `serveur.ts` |
| Keys and controller in the Activity | `src/components/discord/reglages.tsx`, `src/lib/keymap/ecriture.ts` |
| Downloading, importing, starting from scratch | `src/components/discord/partie.tsx` |
| Save states and thumbnails | `src/app/api/discord/etat/`, `src/components/player/savestates.tsx`, `src/lib/states.ts` |
| Speed and sound, shared with the site's player | `src/components/player/commandes.tsx` |
| Welcome message and tips | `src/lib/discord/applications.ts` (`discord_tips`), `src/lib/admin/actions-discord.ts` |
| OAuth, token, account, game, lock, per-host applications | `src/lib/discord/` |
| Restricted roles | `src/lib/discord/roles.ts` |
| Launch command | `src/lib/discord/commande.ts` |
| Typed command: interactions received from Discord | `src/lib/discord/interactions.ts`, `src/app/api/discord/interactions/route.ts` |
| Legal pages (privacy, terms) | `src/app/discord/confidentialite/`, `src/app/discord/conditions/`, `src/components/discord/mentions.tsx`, `src/lib/discord/mentions.ts` |
| The administration's Discord tab | `src/app/(app)/admin/discord/`, `src/lib/admin/actions-discord.ts` |
| Vhost and certificate for an Activity host | `deploiement/scripts/hote-activite.sh` |
| The core and its build recipe | `coeurs/mgba-splitscreen/` |
| The root redirect and the headers | `src/proxy.ts`, `next.config.ts` |
