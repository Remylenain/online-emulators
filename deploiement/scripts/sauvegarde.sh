#!/bin/bash
# Sauvegarde quotidienne d'Online Emulators.
#
# Doit tourner en root : la base et les sauvegardes de jeu appartiennent a
# l'utilisateur systeme du service. Lance par le timer systemd de l'instance :
# sauvegarde-online-emulators.timer, ou sauvegarde-online-emulators-<nom>.timer.
#
# La base n'est pas copiee avec `cp` : en mode WAL une copie brute prise
# pendant une ecriture donne un fichier incoherent. On passe par l'API de
# sauvegarde de SQLite, qui produit un instantane propre sans arreter le
# service. Les joueurs ne sont donc jamais coupes.
set -uo pipefail

# Les archives contiennent une copie de la base. Sans ce masque elles seraient
# lisibles par tous, donc par l'utilisateur d'une autre instance du site
# installee sur le meme serveur.
umask 077

# Aucun chemin en dur : ce script vit dans <arbre>/deploiement/scripts/, et
# l'arbre porte le nom de son instance (/opt/online-emulators, ou
# /opt/online-emulators-<nom>). Chaque instance sauvegarde donc sa propre base,
# dans son propre dossier, sans rien avoir a lui passer.
BASE="$(CDPATH='' cd -- "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
NOM="$(basename "$BASE")"
case "$NOM" in
    online-emulators|online-emulators-?*) ;;
    *)
        echo "ERREUR : $BASE n'est pas l'arbre de travail d'une instance." >&2
        exit 1 ;;
esac
ENV_FILE="/etc/$NOM.env"
DEST="/var/backups/$NOM"
RETENTION_JOURS=14
JOURNAL="$DEST/sauvegarde.log"

mkdir -p "$DEST"
exec >> "$JOURNAL" 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') debut ====="

if [ "$(id -u)" -ne 0 ]; then
    echo "ERREUR : doit tourner en root (fichiers appartenant a l'utilisateur du service)." >&2
    exit 1
fi

# Le dossier lui-meme, pour les archives deja presentes : creees avant ce
# masque, elles sont lisibles par tous tant qu'on peut entrer dans le dossier.
chmod 700 "$DEST"

# DATABASE_PATH et DATA_DIR ne sont pas ecrits en dur : le fichier
# d'environnement reste la seule source de verite pour les chemins.
if [ ! -r "$ENV_FILE" ]; then
    echo "ERREUR : $ENV_FILE illisible." >&2
    exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${DATABASE_PATH:?DATABASE_PATH absent de $ENV_FILE}"
: "${DATA_DIR:?DATA_DIR absent de $ENV_FILE}"

HORODATAGE="$(date '+%Y-%m-%d_%H%M')"
ARCHIVE="$DEST/${NOM}_$HORODATAGE.tar.gz"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

echo "Instantane de la base..."
# `cd "$BASE"` : better-sqlite3 est resolu depuis node_modules du projet.
if ! (cd "$BASE" && DEST_DB="$TRAVAIL/base-sqlite.db" node -e '
const Database = require("better-sqlite3");
const source = new Database(process.env.DATABASE_PATH, { readonly: true });
source.backup(process.env.DEST_DB)
    .then(() => { source.close(); })
    .catch((erreur) => { console.error(erreur.message); process.exit(1); });
'); then
    echo "ERREUR : instantane de la base echoue, archive non creee." >&2
    exit 1
fi

echo "Archivage vers $ARCHIVE"
# La base vit dans DATA_DIR : les trois --exclude ecartent le fichier en cours
# d'ecriture, pour ne garder que l'instantane propre pris juste au-dessus.
# --warning=no-file-changed : un joueur qui sauvegarde pendant l'archivage fait
# changer un fichier sous tar, ce qui ne doit pas faire echouer la sauvegarde.
if tar czf "$ARCHIVE" \
        --warning=no-file-changed \
        --exclude=app.db \
        --exclude=app.db-wal \
        --exclude=app.db-shm \
        -C "$TRAVAIL" base-sqlite.db \
        -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"; then
    echo "Archive creee : $(du -h "$ARCHIVE" | cut -f1)"
else
    echo "ERREUR : archivage echoue." >&2
    rm -f "$ARCHIVE"
    exit 1
fi

echo "Purge des archives de plus de $RETENTION_JOURS jours..."
find "$DEST" -name "${NOM}_*.tar.gz" -mtime "+$RETENTION_JOURS" -print -delete

echo "===== $(date '+%Y-%m-%d %H:%M:%S') fin ====="
