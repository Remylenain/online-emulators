#!/bin/bash
# Applique les migrations Drizzle sous l'identite du service.
#
# Appele par le hook de deploiement via `sudo -u jeux`, et autorise sans mot de
# passe par la regle /etc/sudoers.d/online-emulators.
#
# Pourquoi ne pas migrer directement depuis le hook : le hook tourne sous le
# compte qui pousse, alors que /var/lib/online-emulators n'est ecrivable que par
# `jeux`. SQLite a besoin d'ecrire dans le dossier, et pas seulement dans le
# fichier, pour creer app.db-wal et app.db-shm. Migrer sous une autre identite
# laisserait en plus des fichiers que le service ne pourrait plus ecrire.
set -euo pipefail

cd /opt/online-emulators

# La configuration est lisible par le groupe jeux : DATABASE_PATH vient de la,
# jamais d'un chemin ecrit en dur.
set -a
# shellcheck disable=SC1091
. /etc/online-emulators.env
set +a

# `jeux` n'a pas de repertoire personnel, et sudo laisse par defaut le HOME de
# l'appelant : on heriterait de /home/<pousseur>, ou `jeux` ne peut pas ecrire.
# Des outils de la chaine de construction y deposent un cache et echouent
# alors. Un dossier jetable evite les deux cas.
HOME="$(mktemp -d)"
export HOME
trap 'rm -rf "$HOME"' EXIT

# Pas d'`exec` : il remplacerait ce shell et le piege de nettoyage ne
# s'executerait jamais.
./node_modules/.bin/drizzle-kit migrate
