#!/usr/bin/env bash
# Compile la variante « une console » du cœur : celle que le navigateur charge
# dans l'Activité Discord (src/lib/emulator/mgs.ts).
#
# Même source et mêmes options que le build du câble link (build.sh), à trois
# différences près :
#   - la mémoire n'est plus fixée à 256 Mio (quatre consoles et leurs ROMs) :
#     elle part de 32 Mio et grandit au besoin, ce qu'un téléphone supporte ;
#   - `mgs_load_save_file` est exportée (sauvegarde chargée comme un fichier,
#     horloge temps réel comprise) ;
#   - la sortie s'appelle mgba-une-console.{js,wasm}.
#
# À lancer comme build.sh : depuis un clone de mgba-splitscreen à la révision
# notée dans LISEZMOI.md, ce script et notre mgba_splitscreen_web.c copiés dans
# mgba-splitscreen/web/, dans Docker emscripten/emsdk:3.1.74.
set -euo pipefail
cd "$(dirname "$0")/../.."

BUILD_DIR=build-wasm
# Les mêmes définitions que libmgba : un écart déplace les champs de mCore.
DEFINES="-DBUILD_STATIC -DENABLE_DIRECTORIES -DENABLE_VFS -DENABLE_VFS_FD \
 -DHAVE_LOCALTIME_R -DHAVE_STRDUP -DHAVE_STRLCPY -DHAVE_STRTOF_L -DHAVE_XLOCALE \
 -DM_CORE_GB -DM_CORE_GBA -DUSE_PTHREADS"

emcmake cmake -S . -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_STATIC=ON -DBUILD_SHARED=OFF \
  -DBUILD_GL=OFF -DBUILD_GLES2=OFF -DBUILD_GLES3=OFF \
  -DUSE_PTHREADS=OFF -DENABLE_SCRIPTING=OFF -DENABLE_GDB_STUB=OFF \
  -DENABLE_DEBUGGERS=OFF -DUSE_FFMPEG=OFF -DUSE_ZLIB=OFF -DUSE_PNG=OFF \
  -DUSE_LZMA=OFF -DUSE_SQLITE3=OFF -DUSE_ELF=OFF -DUSE_EPOXY=OFF \
  -DUSE_LIBZIP=OFF -DUSE_MINIZIP=OFF \
  -DCMAKE_C_FLAGS="-D_GNU_SOURCE" >/dev/null
emmake make -C "$BUILD_DIR" -j"$(nproc)" >/dev/null

emcc -O3 -D_GNU_SOURCE -DNDEBUG $DEFINES \
  -Iinclude -I"$BUILD_DIR/include" -I"$BUILD_DIR" \
  -sENVIRONMENT=web \
  -sEXPORTED_FUNCTIONS=_mgs_init,_mgs_load_rom,_mgs_run_frame,_mgs_get_video_width,_mgs_get_video_height,_mgs_get_platform,_mgs_get_video,_mgs_set_keys,_mgs_get_audio,_mgs_audio_frames,_mgs_get_audio_rate,_mgs_set_audio_source,_mgs_save_state,_mgs_state_ptr,_mgs_load_state,_mgs_load_state_bytes,_mgs_export_save,_mgs_save_ptr,_mgs_import_save,_mgs_load_save_file,_mgs_quit,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=HEAP16,HEAPU8 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=268435456 -sSTACK_SIZE=1048576 \
  -sMODULARIZE=1 -sEXPORT_NAME=MgbaUneConsole \
  -sNO_EXIT_RUNTIME=1 -sERROR_ON_UNDEFINED_SYMBOLS=1 -sASSERTIONS=0 \
  -sSTRICT=0 \
  mgba-splitscreen/web/mgba_splitscreen_web.c "$BUILD_DIR/libmgba.a" -o mgba-splitscreen/web/mgba-une-console.js

echo "Compilé : mgba-splitscreen/web/mgba-une-console.{js,wasm}"
