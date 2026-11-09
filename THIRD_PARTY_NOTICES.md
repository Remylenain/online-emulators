**Français** · [English](THIRD_PARTY_NOTICES.en.md)

# Composants tiers

Le code du projet est sous licence MIT (voir [LICENSE](LICENSE)). Il s'appuie
sur des cœurs d'émulation qui ont chacun leur licence et leurs auteurs. Ils
sont des programmes à part, compilés séparément en WebAssembly, et chargés par
le site au moment de jouer.

| Composant | Rôle | Licence | Où |
| --- | --- | --- | --- |
| [mGBA](https://mgba.io) via [`@thenick775/mgba-wasm`](https://www.npmjs.com/package/@thenick775/mgba-wasm) | lecteur GB, GBC et GBA dans le navigateur | MPL-2.0 | dépendance npm, copiée dans `public/mgba/` par `npm run core:install` (non versionnée) |
| [mgba-splitscreen](https://github.com/Spuds0588/mgba-splitscreen) (dérivé de mGBA) | câble link GBA, exécuté par le serveur ; variante « une console » chargée par le navigateur dans l'Activité Discord | MPL-2.0 | `coeurs/mgba-splitscreen/` : binaires, source modifiée, scripts de compilation, [LICENSE](coeurs/mgba-splitscreen/LICENSE), [LISEZMOI](coeurs/mgba-splitscreen/LISEZMOI.md) |
| [TGB Dual](https://github.com/libretro/tgbdual-libretro) (port libretro) | câble link GB et GBC, exécuté par le serveur | GPL-2.0 | `public/tgbdual/` : binaire et [LICENSE](public/tgbdual/LICENSE) ; sources exactes et correctif dans `outils/tgbdual/build.sh` |

## Détail

**mGBA** — © endrift et contributeurs, Mozilla Public License 2.0.
`@thenick775/mgba-wasm` est l'empaquetage WebAssembly du projet
[gbajs3](https://github.com/thenick775/gbajs3) (BSD 2 clauses pour gbajs3,
MPL-2.0 pour le cœur). Le dépôt ne le redistribue pas : il est installé depuis
npm.

**mgba-splitscreen** — © Spuds0588, MPL-2.0, révision
`f1d5975d77285f77affbfe64b7050ebd5c4b6a77`. Deux modifications ont été
apportées à `mgba_splitscreen_web.c` (lecture du tampon audio dans
`mgs_get_audio` ; ajout de `mgs_load_save_file`) ; elles sont décrites dans
`coeurs/mgba-splitscreen/LISEZMOI.md`, et le fichier modifié est fourni, comme
la MPL le demande.

**TGB Dual** — © Hii et contributeurs, port libretro, GNU General Public
License version 2. Le binaire `public/tgbdual/tgbdual.wasm` est compilé depuis
le commit `0392c9c` de `libretro/tgbdual-libretro` avec le correctif indiqué
dans `outils/tgbdual/build.sh` ; ce script constitue l'offre de source. Le
texte de la licence est dans `public/tgbdual/LICENSE`.

Le site charge ces cœurs comme des programmes séparés et communique avec eux
par leur interface exportée. Si tu réutilises ce projet dans un contexte où la
GPL-2.0 pose problème, retire `public/tgbdual/` et la partie GB/GBC du câble
link : le reste n'en dépend pas.
