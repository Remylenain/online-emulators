[Français](langues.md) · **English**

# The interface languages

The site speaks French and English. French is the reference language: the
one it was written in, and the one whose dictionary gives the others their
shape.

## What is translated

| Screen | Status |
| --- | --- |
| The showcase (*vitrine*): home page, header, footer | translated |
| The player and its panels (save, save states, keys, controller), the reminder when quitting | translated |
| The “Play without an account” link on the sign-in page | translated |
| The sign-in and sign-up pages, the e-mails | in French |
| The Discord Activity and its legal pages | in French |
| The catalog, the game pages, “Mes jeux” (My games), the account, the link cable | in French |
| The administration | in French, and will stay that way |

A screen that is not translated is displayed in French, whatever the
visitor's language. Since the player is the same for accounts and for
guests, an account whose browser is set to English plays in an English
player, in the middle of a French site.

Never translated: the site's name, its welcome line and the labels of the
showcase buttons, which the administrator writes themselves, and the game
entries.

## How the language is chosen

In order, for each visitor:

1. **their explicit choice** — the FR / EN switcher in the showcase header;
2. **their browser's language** (`Accept-Language`);
3. **the site's default language**, set in Administration → Réglages
   (Settings) → Identité du site (Site identity).

The explicit choice is remembered in a cookie, `oe_langue`, for one year.
This is the only case where the site sets one for a visitor without an
account: without a click on the switcher, nothing is stored.

**A guest's player is the exception**: without an explicit choice, it takes
the language of the game being launched (the `langue` field of its
`game.json`). A “Play in English” button therefore leads to an English
player, whatever the browser. Only the player is affected; the page header
keeps the visitor's language.

The Discord Activity is kept in French as long as its screens are not
translated, so as not to mix two languages.

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

Three conventions:

- **A text that depends on a value is a function** —
  `t.lecteur.chargement.jeu("2")` — because word order and agreement do not
  translate by simple substitution.
- **Emphasis is written between asterisks**, “your progress stays *in this
  browser*”, and it is the `Accentue` component that gives it its tag.
  Dictionaries remain plain text.
- **A dictionary does not travel from the server to the browser**: it
  contains functions. Each side imports the module, and only the language is
  passed down, through the provider set up in `src/app/layout.tsx`.

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
3. If the screen displays a message that came from the server, it is in
   French: prefer a text from the dictionary instead, chosen according to
   the response code.
4. Update the table at the top of this page.

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
