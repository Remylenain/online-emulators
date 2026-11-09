[Français](langues.md) · **English**

# The interface languages

The site speaks French and English. French is the reference language: the
one it was written in, and the one whose dictionary gives the others their
shape.

## What is translated

Everything a visitor, a player or an administrator reads on screen: the
showcase (*vitrine*), sign-in and sign-up, the catalog, the game pages, “My
games”, the account, the player, the link cable, the Discord Activity and
its legal pages, the administration, and the e-mails the site sends.

Never translated:

- what the administrator or a player wrote: the site's name, its tagline, the
  labels of the showcase buttons, the game entries, an Activity's welcome
  message and tips, usernames;
- the output of command-line scripts, hence the scan log shown in the
  administration, and the server logs;
- the labels of Discord's developer portal, quoted as it displays them.

## How the language is chosen

In order, for each visitor:

1. **their explicit choice** — the FR / EN switcher: in the showcase header,
   under the sign-in form, and in the account menu;
2. **their browser's language** (`Accept-Language`);
3. **the site's default language**, set in Administration → Settings → Site
   identity.

The explicit choice is remembered in a cookie, `oe_langue`, for one year.
This is the only case where the site sets one for a visitor without an
account: without a click on the switcher, nothing is stored.

**A guest's player is the exception**: without an explicit choice, it takes
the language of the game being launched (the `langue` field of its
`game.json`). A “Play in English” button therefore leads to an English
player, whatever the browser. Only the player is affected; the page header
keeps the visitor's language.

**The Discord Activity** has neither a cookie nor a switcher — it is a
third-party iframe: it takes the language of the player's browser, otherwise
the site's default. Its requests carry the same header, so the server's
refusals arrive in the same language as the screen.

**An Activity's legal pages** have one address per language,
`/discord/confidentialite?lang=en` and `?lang=fr` (likewise for
`/discord/conditions`): the English one is the one to give Discord. Without
the parameter, they follow the visitor's language.

**E-mails** go out in the language of whoever asks for them (sign-up
confirmation, forgotten password). An invitation sent by the administrator
goes out in the site's default language: the guest's is not known.

**The catalog** shows games in the visitor's language first; the language
filter is one click away.

## Where the texts live

```
src/lib/i18n/
  langues.ts         the languages, the cookie, reading Accept-Language
  dictionnaires.ts   the `Dictionnaire` type, and the convention
  serveur.ts         the language of a request, for server components
  fr/                the reference dictionary, one file per screen
  en/                its translation, of the same shape
src/components/langue.tsx   the provider, `useT()`, the switcher
```

A text is read by its path, not by a key:

```tsx
// server component
const t = await textes();
<p>{t.vitrine.sansCompte}</p>

// client component
const t = useT();
<button>{t.lecteur.quitter}</button>
```

Four conventions:

- **A text that depends on a value is a function** —
  `t.lecteur.chargement.jeu("2")` — because word order and agreement do not
  translate by simple substitution.
- **Emphasis is written between asterisks**, “your progress stays *in this
  browser*”, and it is the `Accentue` component that gives it its tag.
  Dictionaries remain plain text.
- **A dictionary does not travel from the server to the browser**: it
  contains functions. Each side imports the module, and only the language is
  passed down, through the provider set up in `src/app/layout.tsx`.
- **A module that Node loads on its own does not import the dictionaries.**
  The scripts in `scripts/` and `serveur.ts` load some files of `src/lib/`
  without the `@/` alias. Those receive their labels as a last optional
  parameter, whose default is French: `keyLabel` in `src/lib/consoles.ts`,
  `schemasDeValidation` in `src/lib/validation.ts`, `modesAcces` in
  `src/lib/modes-acces.ts`.

Two cases where the server cannot choose the words itself:

- **The link cable.** The WebSocket server does not know which language the
  player reads. It sends a stable **code**, with the useful values and the
  French text as a fallback; the browser writes the sentence
  (`src/lib/link/textes.ts`, codes in `src/lib/link/protocole.ts`).
- **The legal texts.** Long and structured, they are written in full in each
  language, next to their page (`texte-fr.tsx`, `texte-en.tsx`): a legal text
  is proofread as a whole. French is the reference.

## Adding a text

Add it to `fr/<screen>.ts`, with a comment if the choice of word deserves an
explanation, then to `en/<screen>.ts`. The English dictionary is typed after
the French one: as long as the translation is missing, compilation fails.
That is deliberate — a forgotten text does not end up as an empty string on
screen.

## Translating one more screen

1. Create `fr/<screen>.ts` and `en/<screen>.ts`, and add them to both
   `index.ts` files.
2. Replace the component's hard-coded texts with `t.<screen>.…`. Dates go
   through `REGION[langue]`.
3. A server action or a route reads `await textes()`: its messages go out
   in the language of the request.

## The documentation

The documentation follows the same rule as the interface: French is the
reference, in `README.md` and `docs/*.md`; English lives in the twin file,
`*.en.md`. Each file starts with a link to the other language. A change is
made in both.

## Adding a language

1. Add it to `LANGUES`, `NOM_DES_LANGUES` and `REGION` in `langues.ts`.
2. Create its dictionary folder, shaped like the French one, and add it to
   `DICTIONNAIRES` in `dictionnaires.ts`.

The switcher, the reading of `Accept-Language` and the administration
setting follow on their own.
