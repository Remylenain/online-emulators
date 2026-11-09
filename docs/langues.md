**Français** · [English](langues.en.md)

# Les langues de l'interface

Le site parle français et anglais. Le français est la langue de référence :
celle dans laquelle il a été écrit, et celle dont le dictionnaire donne sa
forme aux autres.

## Ce qui est traduit

Tout ce qu'un visiteur, un joueur ou un administrateur lit à l'écran : la
vitrine, la connexion et l'inscription, le catalogue, les fiches, « Mes
jeux », le compte, le lecteur, le câble link, l'Activité Discord et ses pages
légales, l'administration, et les e-mails que le site envoie.

Ne sont jamais traduits :

- ce que l'administrateur ou un joueur a écrit : le nom du site, sa phrase
  d'accueil, les libellés des boutons de la vitrine, les fiches des jeux, le
  mot d'accueil et les astuces d'une Activité, les pseudos ;
- la sortie des scripts en ligne de commande, donc le journal du scan affiché
  dans l'administration, et les journaux du serveur ;
- les libellés du portail développeur de Discord, cités tels qu'il les
  affiche.

## Comment la langue est choisie

Dans l'ordre, pour chaque visiteur :

1. **son choix explicite** — le sélecteur FR / EN : dans l'en-tête de la
   vitrine, sous le formulaire de connexion, et dans le menu du compte ;
2. **la langue de son navigateur** (`Accept-Language`) ;
3. **la langue par défaut du site**, réglée dans Administration → Réglages →
   Identité du site.

Le choix explicite est retenu dans un cookie, `oe_langue`, pendant un an.
C'est le seul cas où le site en pose un à un visiteur sans compte : sans clic
sur le sélecteur, rien n'est déposé.

**Le lecteur d'un invité fait exception** : sans choix explicite, il prend la
langue du jeu lancé (le champ `langue` de son `game.json`). Un bouton « Play
in English » mène donc à un lecteur en anglais, quel que soit le navigateur.
Seul le lecteur est concerné ; l'en-tête de la page garde la langue du
visiteur.

**L'Activité Discord** n'a ni cookie ni sélecteur — c'est une iframe tierce :
elle prend la langue du navigateur du joueur, sinon celle par défaut du site.
Ses requêtes portent le même en-tête, donc les refus du serveur arrivent dans
la même langue que l'écran.

**Les pages légales d'une Activité** ont une adresse par langue,
`/discord/confidentialite?lang=en` et `?lang=fr` (de même pour
`/discord/conditions`) : c'est l'anglaise qu'on donne à Discord. Sans le
paramètre, elles suivent la langue du visiteur.

**Les e-mails** partent dans la langue de celui qui les demande (confirmation
d'inscription, mot de passe oublié). Une invitation envoyée par
l'administrateur part dans la langue par défaut du site : celle de l'invité
n'est pas connue.

**Le catalogue** montre d'abord les jeux dans la langue du visiteur ; le
filtre de langue reste à un clic.

## Où sont les textes

```
src/lib/i18n/
  langues.ts         les langues, le cookie, la lecture d'Accept-Language
  dictionnaires.ts   le type `Dictionnaire`, et la convention
  serveur.ts         la langue d'une requête, pour les composants serveur
  fr/                le dictionnaire de référence, un fichier par écran
  en/                sa traduction, de même forme
src/components/langue.tsx   le fournisseur, `useT()`, le sélecteur
```

Un texte se lit par son chemin, pas par une clé :

```tsx
// composant serveur
const t = await textes();
<p>{t.vitrine.sansCompte}</p>

// composant client
const t = useT();
<button>{t.lecteur.quitter}</button>
```

Quatre conventions :

- **Un texte qui dépend d'une valeur est une fonction** —
  `t.lecteur.chargement.jeu("2")` — parce que l'ordre des mots et les accords
  ne se traduisent pas par simple remplacement.
- **L'emphase s'écrit entre astérisques**, « ta partie reste *dans ce
  navigateur* », et c'est le composant `Accentue` qui lui donne sa balise.
  Les dictionnaires restent du texte.
- **Un dictionnaire ne voyage pas du serveur au navigateur** : il contient des
  fonctions. Chacun importe le module, et seule la langue descend, par le
  fournisseur posé dans `src/app/layout.tsx`.
- **Un module que Node charge seul n'importe pas les dictionnaires.** Les
  scripts de `scripts/` et `serveur.ts` chargent certains fichiers de
  `src/lib/` sans l'alias `@/`. Ceux-là reçoivent leurs libellés en dernier
  paramètre facultatif, dont le défaut est le français : `keyLabel` dans
  `src/lib/consoles.ts`, `schemasDeValidation` dans `src/lib/validation.ts`,
  `modesAcces` dans `src/lib/modes-acces.ts`.

Deux cas où le serveur ne peut pas choisir les mots lui-même :

- **Le câble link.** Le serveur WebSocket ne sait pas dans quelle langue lit
  le joueur. Il envoie un **code** stable, avec les valeurs utiles et le texte
  français en repli ; c'est le navigateur qui rédige
  (`src/lib/link/textes.ts`, codes dans `src/lib/link/protocole.ts`).
- **Les textes légaux.** Longs et structurés, ils sont écrits en entier dans
  chaque langue, à côté de leur page (`texte-fr.tsx`, `texte-en.tsx`) : un
  texte légal se relit d'un bloc. Le français fait référence.

## Ajouter un texte

L'ajouter dans `fr/<écran>.ts`, avec un commentaire si le choix du mot mérite
une explication, puis dans `en/<écran>.ts`. Le dictionnaire anglais est typé
d'après le français : tant que la traduction manque, la compilation échoue.
C'est voulu — un texte oublié ne finit pas en chaîne vide à l'écran.

## Traduire un écran de plus

1. Créer `fr/<écran>.ts` et `en/<écran>.ts`, et les ajouter aux deux
   `index.ts`.
2. Remplacer les textes en dur du composant par `t.<écran>.…`. Les dates
   passent par `REGION[langue]`.
3. Une action serveur ou une route lit `await textes()` : ses messages
   partent dans la langue de la requête.

## La documentation

La documentation suit la même règle que l'interface : le français est la
référence, dans `README.md` et `docs/*.md` ; l'anglais est dans le fichier
jumeau, `*.en.md`. Chaque fichier commence par un lien vers l'autre langue.
Une modification se fait dans les deux.

## Ajouter une langue

1. L'ajouter à `LANGUES`, `NOM_DES_LANGUES` et `REGION` dans `langues.ts`.
2. Créer son dossier de dictionnaires, de la forme du français, et l'ajouter
   à `DICTIONNAIRES` dans `dictionnaires.ts`.

Le sélecteur, la lecture d'`Accept-Language` et le réglage de l'administration
suivent tout seuls.
