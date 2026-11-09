# La vitrine : jouer sans compte

Par défaut, tout le site est derrière la connexion. La **vitrine** ouvre
quelques jeux, choisis par l'administrateur, aux visiteurs sans compte : la
page d'accueil leur montre un bouton par jeu, et ils jouent en **invités**.

Ce que le serveur garde d'un invité : **rien**. Sa sauvegarde, ses points de
reprise et ses réglages restent dans son navigateur.

Le cas d'usage typique : une seconde instance du site, publique, réduite à un
ou deux jeux, à côté d'une bibliothèque privée — voir
[« Une seconde instance sur le même serveur »](deploiement.md#une-seconde-instance-sur-le-même-serveur).
La vitrine marche aussi sur une instance unique : le reste du catalogue y
demande alors toujours un compte.

## Une seule application, plusieurs usages

Le même code sert tous les cas ; ce sont les réglages de l'administration qui
décident.

| Ce qu'on veut | Réglages |
| --- | --- |
| Une bibliothèque privée | Vitrine éteinte (le défaut) |
| Des invités et des comptes | Vitrine allumée : sans compte on voit les boutons, connecté on retrouve son catalogue |
| Des invités seulement | Vitrine allumée, inscriptions fermées, et le seul compte de l'administrateur |
| Un jeu dans Discord | Une application déclarée dans Administration → Discord, en plus du reste — voir [discord](discord/README.md) |

Pour séparer complètement un site public d'une bibliothèque privée — comptes,
base et jeux distincts —, on installe deux instances plutôt que de tout mettre
dans une seule.

## L'allumer

Administration → Réglages → **Vitrine : jouer sans compte**.

- Cocher « Ouvrir ces jeux aux visiteurs sans compte ».
- Jusqu'à quatre boutons : un libellé (« Jouer en français », « Play in
  English »…) et le jeu qu'il lance. Libellé vide : le titre du jeu.
- Un jeu doit être **publié** pour être proposé. Le dépublier le retire aussi
  de la vitrine.

Le réglage prend effet en quelques secondes, sans redémarrage. Décocher la
case referme tout.

Le titre et la phrase affichés au-dessus des boutons sont le nom du site et sa
phrase d'accueil, réglés juste au-dessus, dans « Identité du site ».

Le lecteur d'un invité s'affiche dans la langue du jeu lancé : un bouton qui
lance un jeu déclaré en anglais mène à un lecteur en anglais. Le reste suit la
langue du visiteur, qu'il peut changer dans l'en-tête — voir
[langues.md](langues.md).

### Sur une instance neuve

Dans l'ordre : déposer les jeux dans la bibliothèque de l'instance, lancer le
scan (Administration → Bibliothèque, ou la commande de
[deploiement.md](deploiement.md#publier-les-jeux-déposés)) pour qu'ils soient
publiés, puis allumer la vitrine. Le formulaire refuse un jeu qui n'est pas
publié, et une vitrine sans jeu.

## Ce qui change pour un visiteur

| Adresse | Vitrine éteinte | Vitrine allumée, sans compte |
| --- | --- | --- |
| `/` | renvoi vers la connexion | l'accueil de la vitrine |
| `/partie/<console>/<jeu>` | renvoi vers la connexion | le lecteur, pour un jeu de la vitrine |
| `/api/rom/<jeu>` | refusé | servi pour un jeu de la vitrine, refusé pour tout autre |
| `/api/bezel/<id>` | refusé | servi (les habillages d'écran) |
| tout le reste | renvoi vers la connexion | renvoi vers la connexion |

Un compte connecté ne voit pas de différence : la racine reste son catalogue,
et `/partie/…` le renvoie vers `/jouer/…`, où sa partie est sur le serveur.
La page de connexion gagne un lien « Jouer sans compte ».

Une Activité Discord peut partager l'adresse de la vitrine : déclarée sur
l'hôte du site, elle s'y ajoute et le site continue d'y répondre. Déclarée sur
un hôte à elle, cet hôte ne sert que l'Activité. Voir
[discord](discord/README.md).

## Ce que garde le navigateur d'un invité

| Quoi | Où |
| --- | --- |
| La sauvegarde du jeu | IndexedDB, base `oe_invite` |
| Dix points de reprise (cinq manuels, cinq automatiques) | IndexedDB, base `oe_invite` |
| Touches, manette, habillage, volume | `localStorage` |
| Les fichiers de travail du cœur d'émulation | IndexedDB, bases `/data` et `/autosave` (comme pour un compte) |

Pour tout effacer, il suffit de supprimer les données du site dans le
navigateur.

Le lecteur est le même que celui des comptes. Pour un invité, ses requêtes
d'enregistrement (`/api/save`, `/api/state`, `/api/play`) ne partent pas sur
le réseau : un `fetch` de remplacement y répond depuis le navigateur, avec les
mêmes codes et les mêmes en-têtes que les routes du site
(`src/lib/invite/stockage.ts`). Seuls le jeu lui-même et les habillages
viennent du serveur.

### Les limites, dites au joueur

Un stockage de navigateur est fragile :

- vider les données du site efface la partie ;
- rien ne suit d'un appareil ou d'un navigateur à l'autre ;
- Safari efface le stockage d'un site resté sept jours sans visite ;
- en navigation privée, tout disparaît à la fermeture.

Le lecteur le dit, et propose le fichier de sauvegarde comme parade :
« Télécharger » pour l'emporter, « Remplacer par un fichier » pour le
reprendre ailleurs. Deux rappels, tant qu'une sauvegarde faite dans le jeu n'a
pas été téléchargée :

- au bouton **Quitter**, une fenêtre du site propose de la télécharger —
  on peut partir sans ;
- à la **fermeture de l'onglet**, le navigateur demande confirmation. Son
  texte ne se choisit pas, et les navigateurs de téléphone l'ignorent
  souvent : le vrai rappel est le premier.

Les points de reprise ne s'exportent pas : seul le fichier de sauvegarde
voyage.

## Ce que la vitrine ne fait pas

- Pas de câble link pour un invité : il tourne sur le serveur et reste
  réservé aux comptes.
- Pas de passage automatique d'invité à compte : pour garder sa partie en
  créant un compte, on télécharge sa sauvegarde puis on l'importe une fois
  connecté.
- Le nom du site, sa phrase d'accueil et les libellés des boutons ne se
  traduisent pas : ils s'affichent tels que l'administrateur les a écrits.
  Tout le reste de la vitrine et du lecteur existe en français et en anglais —
  voir [langues.md](langues.md).
- Les pages restent marquées `noindex` : la vitrine est ouverte, pas
  référencée.

## Où est le code

| Quoi | Où |
| --- | --- |
| Le réglage, les jeux ouverts aux invités | `src/lib/vitrine.ts`, `src/lib/vitrine-limites.ts` |
| Le formulaire de l'administration | `src/app/(app)/admin/reglages/reglages.tsx`, `src/lib/admin/actions-vitrine.ts` |
| Ce qui s'ouvre sans compte | `src/proxy.ts` (`CHEMINS_VITRINE`), `src/app/api/rom/[id]/route.ts`, `src/app/api/bezel/[id]/route.ts` |
| L'accueil servi à la racine | la réécriture de `next.config.ts` |
| L'accueil et le lecteur de l'invité | `src/app/(invite)/` |
| Le stockage dans le navigateur | `src/lib/invite/stockage.ts` |
| Le lecteur, côté invité | `src/components/player/lecteur-invite.tsx`, et `invite` dans `lecteur.tsx` |
