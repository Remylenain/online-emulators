#!/bin/bash
# Compile le cœur PCSX-ReARMed (PlayStation, port libretro) en WebAssembly.
#
#   outils/pcsx-rearmed/build.sh
#
# Essai en cours : le cœur n'est chargé que par la page d'administration
# « Essai PS1 ». Aucun jeu du catalogue ne s'en sert.
#
# Résultat : public/pcsx-rearmed/pcsx-rearmed.js et .wasm, versionnés dans le
# dépôt. Le serveur n'a donc pas besoin d'Emscripten.
#
# Le Makefile du projet sait viser Emscripten, mais s'arrête à une archive
# d'objets destinée à RetroArch. On fait ici l'édition de liens qui manque :
# un module ES autonome, avec les fonctions libretro exportées et le système
# de fichiers d'Emscripten — ce cœur lit le disque par son chemin, pas en
# mémoire. En WebAssembly il tourne en interpréteur (pas de recompilateur),
# avec le rendu logiciel « neon » compilé en SIMD, sans thread.
#
# Emscripten : la version ci-dessous, soit déjà activée dans le terminal
# (`source emsdk_env.sh`), soit prise dans son image Docker.
#
# Licence : PCSX-ReARMed est sous GPL-2.0. Ce script et le commit ci-dessous
# suffisent à retrouver les sources exactes du binaire publié.
set -euo pipefail

DEPOT="https://github.com/libretro/pcsx_rearmed.git"
COMMIT="7b0e8f8fadfbce3d170d195b9d9eecaabfa08c8e"
EMSCRIPTEN="3.1.74"

ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
SORTIE="$RACINE/public/pcsx-rearmed"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

git clone -q "$DEPOT" "$TRAVAIL/src"
git -C "$TRAVAIL/src" checkout -q "$COMMIT"
git -C "$TRAVAIL/src" submodule update -q --init --recursive --depth 1

mkdir -p "$SORTIE"
cp "$TRAVAIL/src/COPYING" "$SORTIE/LICENSE"

EXPORTS="_malloc,_free,_retro_init,_retro_deinit,_retro_api_version,_retro_set_environment,_retro_set_video_refresh,_retro_set_audio_sample,_retro_set_audio_sample_batch,_retro_set_input_poll,_retro_set_input_state,_retro_set_controller_port_device,_retro_get_system_av_info,_retro_load_game,_retro_unload_game,_retro_run,_retro_reset,_retro_serialize_size,_retro_serialize,_retro_unserialize,_retro_get_memory_data,_retro_get_memory_size"

COMPILER="
  set -euo pipefail
  cd \"\$1\"
  emmake make -f Makefile.libretro platform=emscripten -j\"\$(nproc)\" > build.log 2>&1 || { tail -40 build.log >&2; exit 1; }
  # L'archive porte l'extension .bc, qu'emcc prendrait pour du code à compiler.
  cp pcsx_rearmed_libretro_emscripten.bc libpcsx.a
  emcc -O2 -msimd128 libpcsx.a -o \"\$2/pcsx-rearmed.js\" \
    -sUSE_ZLIB=1 -lworkerfs.js \
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createPcsxRearmed \
    -sENVIRONMENT=web,worker -sALLOW_MEMORY_GROWTH=1 -sALLOW_TABLE_GROWTH=1 \
    -sSTACK_SIZE=1MB -sFILESYSTEM=1 \
    -sEXPORTED_FUNCTIONS=$EXPORTS \
    -sEXPORTED_RUNTIME_METHODS=addFunction,UTF8ToString,HEAPU8,HEAP16,HEAPU32,FS,WORKERFS
"

if command -v emcc >/dev/null 2>&1 && emcc --version | head -1 | grep -q " $EMSCRIPTEN "; then
  bash -c "$COMPILER" compiler "$TRAVAIL/src" "$SORTIE"
else
  docker run --rm \
    -v "$TRAVAIL/src:/src" \
    -v "$SORTIE:/sortie" \
    --platform linux/amd64 "emscripten/emsdk:$EMSCRIPTEN" bash -c "$COMPILER" compiler /src /sortie
fi

echo "PCSX-ReARMed ${COMMIT:0:7} compilé dans public/pcsx-rearmed/"
ls -l "$SORTIE"
