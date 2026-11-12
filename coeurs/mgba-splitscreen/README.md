[Français](LISEZMOI.md) · **English**

# mGBA Splitscreen — the link cable's GBA core

Two to four Game Boy Advances connected by mGBA's lockstep cable, in a
single WebAssembly module. The link cable server runs it under Node
(`src/lib/link/moteurs.ts`): it is the GBA counterpart of TGB Dual.

- **Origin:** https://github.com/Spuds0588/mgba-splitscreen, folder
  `mgba-splitscreen/web/`, revision `f1d5975d77285f77affbfe64b7050ebd5c4b6a77`
  (master as of November 3, 2026). Not the `v0.3.1` tag: save import and
  export (`mgs_import_save`, `mgs_export_save`) are not in it yet.
- **License:** MPL 2.0, like mGBA. `build.sh` and `mgba_splitscreen_web.c`
  are kept here as the source offer, with the link to the exact revision.
- **Our only modification**, in `mgs_get_audio`: the `g_astream_used`
  counter is a length from the head (as on the write side), wrongly read as
  a position and never decreased. The bridge was re-reading frames it had
  already returned: 3.5 times too much sound, “high-pitched, as if through a
  pipe”. To be proposed upstream.
- **Rebuilding:** clone the fork at the revision above, copy our `.c` into
  `mgba-splitscreen/web/`, then run `mgba-splitscreen/web/build.sh` in
  Docker `emscripten/emsdk:3.1.74` (`--platform linux/amd64` on a Mac). The
  resulting `.js` is stored here as `.cjs`.
- **Sample rate:** `mgs_get_audio_rate()` only returns the core's real rate
  (65,536 Hz) after `mgs_set_audio_source(joueur)`; on the “mix” source, it
  returns a fixed 32,768.
- **Why `.cjs`:** the file is published as UMD (`module.exports`). In this
  project, whose `package.json` declares `"type": "module"`, Node would read
  a `.js` as an ES module and ignore the export. The extension forces
  CommonJS; nothing else has changed.
- **Loading:** this Emscripten build ignores the `wasmBinary` option. We
  hand it the module through the `instantiateWasm` hook, from the bytes of
  the `.wasm` read from disk.
- **API:** `mgs_init(n)`, `mgs_load_rom`, `mgs_run_frame`,
  `mgs_get_video(j)` (RGBA, `mgs_get_video_width/height`), `mgs_set_keys(j,
  masque)` with mGBA's bits (A=1, B=2, Select=4, Start=8, Right=16,
  Left=32, Up=64, Down=128, R=256, L=512), `mgs_get_audio` /
  `mgs_audio_frames` / `mgs_get_audio_rate`, `mgs_set_audio_source(n)`,
  `mgs_import_save(j, ptr, taille)`, `mgs_export_save(j)` + `mgs_save_ptr`,
  `mgs_quit`.
- **Per-player sound:** the bridge keeps one audio stream per console, and
  `mgs_set_audio_source(n)` followed by `mgs_get_audio()` drains the stream
  of console n alone. Two calls per frame therefore give each player's sound
  separately — something TGB Dual cannot do.

This folder is not in `public/`: the browser does not need it, only the
server loads it.

## “Single console” variant (Discord Activity)

`mgba-une-console.cjs` and `mgba-une-console.wasm` are the same core,
compiled from the same revision and the same `mgba_splitscreen_web.c`, for a
different use: a single console, in the **browser**. It is the Discord
Activity's player (`src/lib/emulator/mgs.ts`), served by
`/api/discord/coeur/` — Discord's iframe has no cross-origin isolation, and
the regular player's threaded core cannot run in it. The site's player takes
it too, through `/api/coeur/`, for games whose cartridge rumbles (see
`docs/decisions.en.md`, item 1).

- **Rebuilding:** as above, but with `build-une-console.sh` (also copied
  into `mgba-splitscreen/web/`). The resulting `.js` is stored here as
  `.cjs`.
- **Memory:** 32 MiB to start with, growable up to 256, instead of the fixed
  256 MiB of the four-console build. That is what makes it loadable on a
  phone.
- **Our second modification**, `mgs_load_save_file`: loads the save as an
  in-memory file (`loadSave`) instead of copying it into the SRAM
  (`savedataRestore`, which is what `mgs_import_save` does). On Game Boy, it
  is the only path through which mGBA reads and rewrites the clock footer of
  the `.sav` (48 bytes): without it, an MBC3 game with a clock starts from
  zero at every launch and asks for the time again. Verified on a save that
  came from the site's player: the clock resumes to the second.
- **Our third modification**, `mgs_get_rumble`: the cartridge's rumble motor
  (MBC5 with a motor on Game Boy, the rumble pin on GBA). Each console gets
  an `mRumbleIntegrator`, plugged in as `mPERIPH_RUMBLE`; the function
  returns how hard the motor ran since the last call, from 0 to 255, averaged
  over the frames run in between. The Activity reads it once per display
  refresh (`src/lib/emulator/vibration.ts`). Verified with Pokémon Pinball
  Generations, on GB Color.
- **The link cable build has not been recompiled**: its binary contains
  neither `mgs_load_save_file` nor `mgs_get_rumble`, and needs neither.
- Tried on GB Color only. The GBA goes through the same path, but has not
  been tried with this build.
