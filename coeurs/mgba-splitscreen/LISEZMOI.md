# mGBA Splitscreen — cœur GBA du câble link

Deux à quatre Game Boy Advance reliées par le câble lockstep de mGBA, dans un
seul module WebAssembly. Le serveur du câble link le fait tourner sous Node
(`src/lib/link/moteurs.ts`) : c'est le pendant GBA de TGB Dual.

- **Origine :** https://github.com/Spuds0588/mgba-splitscreen, dossier
  `mgba-splitscreen/web/`, révision `f1d5975d77285f77affbfe64b7050ebd5c4b6a77`
  (master au 3 novembre 2026). Pas l'étiquette `v0.3.1` : l'import et
  l'export des sauvegardes (`mgs_import_save`, `mgs_export_save`) n'y sont pas
  encore.
- **Licence :** MPL 2.0, comme mGBA. `build.sh` et `mgba_splitscreen_web.c`
  sont conservés ici comme offre de source, avec le lien vers la révision
  exacte.
- **Notre seule modification**, dans `mgs_get_audio` : le compteur
  `g_astream_used` est une longueur depuis la tête (comme à l'écriture), lue
  à tort comme une position et jamais diminuée. Le pont relisait des trames
  déjà rendues : 3,5 fois trop de son, « aigu, en tuyau ». À proposer en
  amont.
- **Recompiler :** cloner le fork à la révision ci-dessus, copier notre `.c`
  dans `mgba-splitscreen/web/`, puis lancer `mgba-splitscreen/web/build.sh`
  dans Docker `emscripten/emsdk:3.1.74` (`--platform linux/amd64` sur Mac).
  Le `.js` produit est rangé ici en `.cjs`.
- **Fréquence :** `mgs_get_audio_rate()` ne répond la vraie fréquence du cœur
  (65 536 Hz) qu'après `mgs_set_audio_source(joueur)` ; sur la source
  « mélange », elle répond un 32 768 figé.
- **Pourquoi `.cjs` :** le fichier est publié en UMD (`module.exports`). Sous
  ce projet, dont le `package.json` déclare `"type": "module"`, Node lirait un
  `.js` comme module ES et ignorerait l'export. L'extension force CommonJS ;
  rien d'autre n'a changé.
- **Chargement :** ce build d'Emscripten ignore l'option `wasmBinary`. On lui
  fournit le module par le crochet `instantiateWasm`, à partir des octets du
  `.wasm` lus sur disque.
- **API :** `mgs_init(n)`, `mgs_load_rom`, `mgs_run_frame`,
  `mgs_get_video(j)` (RGBA, `mgs_get_video_width/height`), `mgs_set_keys(j,
  masque)` avec les bits de mGBA (A=1, B=2, Select=4, Start=8, Droite=16,
  Gauche=32, Haut=64, Bas=128, R=256, L=512), `mgs_get_audio` /
  `mgs_audio_frames` / `mgs_get_audio_rate`, `mgs_set_audio_source(n)`,
  `mgs_import_save(j, ptr, taille)`, `mgs_export_save(j)` + `mgs_save_ptr`,
  `mgs_quit`.
- **Son par joueur :** le pont garde un flux audio par console, et
  `mgs_set_audio_source(n)` suivi de `mgs_get_audio()` vide le flux de la
  console n seule. Deux appels par image donnent donc le son de chaque joueur
  séparément — ce que TGB Dual ne sait pas faire.

Ce dossier n'est pas dans `public/` : le navigateur n'en a pas besoin, seul le
serveur le charge.
