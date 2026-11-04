#!/bin/bash
# Compile le cœur TGB Dual (tgbdual-libretro) en WebAssembly pour le site.
#
#   outils/tgbdual/build.sh
#
# TGB Dual contient deux Game Boy reliées par un câble dans un seul cœur, avec
# une horloge (RTC) pilotée par les cycles émulés : c'est la base du câble
# link GB/GBC du site.
#
# Résultat : public/tgbdual/tgbdual.js et tgbdual.wasm, versionnés dans le
# dépôt. Le serveur n'a donc pas besoin d'Emscripten.
#
# Licence : tgbdual-libretro est sous GPL-2.0. Ce script et le commit
# ci-dessous suffisent à retrouver les sources exactes du binaire publié.
set -euo pipefail

DEPOT="https://github.com/libretro/tgbdual-libretro.git"
COMMIT="0392c9c"
EMSDK="emscripten/emsdk:3.1.74"

ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

git clone -q "$DEPOT" "$TRAVAIL/src"
git -C "$TRAVAIL/src" checkout -q "$COMMIT"

# Correctif : rendre au tampon d'image ses 100 lignes de marge.
#
# Un nettoyage récent du cœur l'a réduit à 144 lignes, les jugeant inutiles.
# Le rendu écrit pourtant au-delà, et en WebAssembly (32 bits) ces écritures
# tombent sur `skip_buf`, la variable qui décide d'afficher l'image : elle
# prenait la valeur du blanc (0xFF7F), et l'écran se figeait au bout d'une
# seconde alors que le jeu continuait de tourner. En natif 64 bits, la
# disposition des champs change et le débordement passait inaperçu.
sed -i.orig 's/word vframe\[160\*144\];/word vframe[160*(144+100)];/' "$TRAVAIL/src/gb_core/gb.h"
grep -q 'word vframe\[160\*(144+100)\];' "$TRAVAIL/src/gb_core/gb.h" || { echo "Correctif vframe non appliqué" >&2; exit 1; }

mkdir -p "$RACINE/public/tgbdual"

docker run --rm \
  -v "$TRAVAIL/src:/src" \
  -v "$RACINE/public/tgbdual:/sortie" \
  -w /src \
  --platform linux/amd64 "$EMSDK" bash -euo pipefail -c "
    FLAGS='-O2 -D__LIBRETRO__ -DFRONTEND_SUPPORTS_RGB565 -DNDEBUG -I. -Igb_core -Ilibretro -Ilibretro-common/include'
    mkdir -p /tmp/obj
    OBJETS=''
    for f in gb_core/apu.cpp gb_core/cheat.cpp gb_core/cpu.cpp gb_core/gb.cpp gb_core/lcd.cpp \
             gb_core/mbc.cpp gb_core/rom.cpp libretro/dmy_renderer.cpp libretro/libretro.cpp; do
      o=/tmp/obj/\$(echo \"\$f\" | tr '/.' '__').o
      em++ \$FLAGS -c \"\$f\" -o \"\$o\"
      OBJETS=\"\$OBJETS \$o\"
    done
    em++ -O2 \$OBJETS -o /sortie/tgbdual.js \
      -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createTgbDual \
      -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH=1 -sALLOW_TABLE_GROWTH=1 \
      -sFILESYSTEM=0 \
      -sEXPORTED_FUNCTIONS=_malloc,_free,_retro_init,_retro_deinit,_retro_api_version,_retro_set_environment,_retro_set_video_refresh,_retro_set_audio_sample,_retro_set_audio_sample_batch,_retro_set_input_poll,_retro_set_input_state,_retro_get_system_av_info,_retro_load_game,_retro_load_game_special,_retro_unload_game,_retro_run,_retro_reset,_retro_serialize_size,_retro_serialize,_retro_unserialize,_retro_get_memory_data,_retro_get_memory_size \
      -sEXPORTED_RUNTIME_METHODS=addFunction,UTF8ToString,HEAPU8,HEAP16,HEAPU32
  "

echo "TGB Dual $COMMIT compilé dans public/tgbdual/"
ls -l "$RACINE/public/tgbdual"
