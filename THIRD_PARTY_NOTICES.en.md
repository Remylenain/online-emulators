[Français](THIRD_PARTY_NOTICES.md) · **English**

# Third-party components

The project's code is under the MIT license (see [LICENSE](LICENSE)). It
relies on emulation cores that each have their own license and their own
authors. They are separate programs, compiled separately to WebAssembly, and
loaded by the site at play time.

| Component | Role | License | Where |
| --- | --- | --- | --- |
| [mGBA](https://mgba.io) via [`@thenick775/mgba-wasm`](https://www.npmjs.com/package/@thenick775/mgba-wasm) | GB, GBC and GBA player in the browser | MPL-2.0 | npm dependency, copied into `public/mgba/` by `npm run core:install` (not versioned) |
| [mgba-splitscreen](https://github.com/Spuds0588/mgba-splitscreen) (derived from mGBA) | GBA link cable, run by the server; “single console” variant loaded by the browser in the Discord Activity | MPL-2.0 | `coeurs/mgba-splitscreen/`: binaries, modified source, build scripts, [LICENSE](coeurs/mgba-splitscreen/LICENSE), [README](coeurs/mgba-splitscreen/README.md) |
| [TGB Dual](https://github.com/libretro/tgbdual-libretro) (libretro port) | GB and GBC link cable, run by the server | GPL-2.0 | `public/tgbdual/`: binary and [LICENSE](public/tgbdual/LICENSE); exact sources and patch in `outils/tgbdual/build.sh` |

## Details

**mGBA** — © endrift and contributors, Mozilla Public License 2.0.
`@thenick775/mgba-wasm` is the WebAssembly packaging of the
[gbajs3](https://github.com/thenick775/gbajs3) project (2-clause BSD for
gbajs3, MPL-2.0 for the core). The repository does not redistribute it: it
is installed from npm.

**mgba-splitscreen** — © Spuds0588, MPL-2.0, revision
`f1d5975d77285f77affbfe64b7050ebd5c4b6a77`. Two modifications were made to
`mgba_splitscreen_web.c` (reading of the audio buffer in `mgs_get_audio`;
addition of `mgs_load_save_file`); they are described in
`coeurs/mgba-splitscreen/README.md`, and the modified file is provided, as
the MPL requires.

**TGB Dual** — © Hii and contributors, libretro port, GNU General Public
License version 2. The `public/tgbdual/tgbdual.wasm` binary is compiled from
commit `0392c9c` of `libretro/tgbdual-libretro` with the patch given in
`outils/tgbdual/build.sh`; that script constitutes the source offer. The
license text is in `public/tgbdual/LICENSE`.

The site loads these cores as separate programs and communicates with them
through their exported interface. If you reuse this project in a context
where the GPL-2.0 is a problem, remove `public/tgbdual/` and the GB/GBC part
of the link cable: the rest does not depend on it.
