**Français** · [English](langues.en.md)

# Les langues de l'interface

Le site parle français et anglais. Le français est la langue de référence :
celle dans laquelle il a été écrit, et celle dont le dictionnaire donne sa
forme aux autres.

## Ce qui est traduit

| Écran | État |
| --- | --- |
| La vitrine : accueil, en-tête, pied de page | traduit |
| Le lecteur et ses panneaux (sauvegarde, points de reprise, touches, manette), le rappel au moment de quitter | traduit |
| Le lien « Jouer sans compte » de la page de connexion | traduit |
| Les pages de connexion et d'inscription, les e-mails | en français |
| L'Activité Discord et ses pages légales | en français |
| Le catalogue, les fiches, « Mes jeux », le compte, le câble link | en français |
| L'administration | en français, et le restera |

Un écran qui n'est pas traduit s'affiche en français, quelle que soit la
langue du visiteur. Le lecteur étant le même pour les comptes et pour les
invités, un compte dont le navigateur est en anglais joue dans un lecteur en
anglais, au milieu d'un site en français.

Ne sont jamais traduits : le nom du site, sa phrase d'accueil et les libellés
des boutons de la vitrine, que l'administrateur écrit lui-même, et les fiches
des jeux.

## Comment la langue est choisie

Dans l'ordre, pour chaque visiteur :

1. **son choix explicite** — le sélecteur FR / EN de l'en-tête de la vitrine ;
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

L'Activité Discord est tenue en français tant que ses écrans ne sont pas
traduits, pour ne pas mêler deux langues.

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

Trois conventions :

- **Un texte qui dépend d'une valeur est une fonction** —
  `t.lecteur.chargement.jeu("2")` — parce que l'ordre des mots et les accords
  ne se traduisent pas par simple remplacement.
- **L'emphase s'écrit entre astérisques**, « ta partie reste *dans ce
  navigateur* », et c'est le composant `Accentue` qui lui donne sa balise.
  Les dictionnaires restent du texte.
- **Un dictionnaire ne voyage pas du serveur au navigateur** : il contient des
  fonctions. Chacun importe le module, et seule la langue descend, par le
  fournisseur posé dans `src/app/layout.tsx`.

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
3. Si l'écran affiche un message venu du serveur, il est en français : lui
   préférer un texte du dictionnaire, choisi d'après le code de la réponse.
4. Mettre à jour le tableau en tête de cette page.

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
