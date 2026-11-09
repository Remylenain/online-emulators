#!/bin/bash
# Applique les migrations Drizzle sous l'identite du service.
#
# Appele par le hook de deploiement via `sudo -u <utilisateur du service>`
# (`jeux`, ou `jeux-<nom>` pour une instance nommee), et autorise sans mot de
# passe par la regle /etc/sudoers.d/ de l'instance.
#
# Pourquoi ne pas migrer directement depuis le hook : le hook tourne sous le
# compte qui pousse, alors que le dossier de donnees n'est ecrivable que par
# l'utilisateur du service. SQLite a besoin d'ecrire dans le dossier, et pas
# seulement dans le fichier, pour creer app.db-wal et app.db-shm. Migrer sous
# une autre identite laisserait en plus des fichiers que le service ne pourrait
# plus ecrire.
set -euo pipefail

# Aucun chemin en dur : ce script vit dans <arbre>/deploiement/scripts/, et
# l'arbre porte le nom de son instance (/opt/online-emulators, ou
# /opt/online-emulators-<nom>). Il ne peut pas recevoir ce nom en argument ni
# par l'environnement : sudo vide l'environnement, et la regle sudoers designe
# le chemin de ce script, qui suffit donc a dire pour quelle instance il tourne.
ARBRE="$(CDPATH='' cd -- "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NOM="$(basename "$ARBRE")"
case "$NOM" in
    online-emulators|online-emulators-?*) ;;
    *)
        echo "ERREUR : $ARBRE n'est pas l'arbre de travail d'une instance." >&2
        exit 1 ;;
esac
ENV_FILE="/etc/$NOM.env"

cd "$ARBRE"

# La configuration est lisible par le groupe du service : DATABASE_PATH vient
# de la, jamais d'un chemin ecrit en dur.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# L'utilisateur du service n'a pas de repertoire personnel, et sudo laisse par
# defaut le HOME de l'appelant : on heriterait de /home/<pousseur>, ou il ne
# peut pas ecrire.
# Des outils de la chaine de construction y deposent un cache et echouent
# alors. Un dossier jetable evite les deux cas.
HOME="$(mktemp -d)"
export HOME
trap 'rm -rf "$HOME"' EXIT

# Pas d'`exec` : il remplacerait ce shell et le piege de nettoyage ne
# s'executerait jamais.
./node_modules/.bin/drizzle-kit migrate
