#!/bin/bash
# Un nom d'hote de plus pour une Activite Discord : vhost Apache et certificat.
#
# Chaque Activite declaree dans l'administration (onglet Discord) repond sur
# son propre nom d'hote. L'administration ne peut pas faire ce qui suit toute
# seule : le DNS (chez le registrar), puis sur le serveur, en root :
#
#     sudo ./deploiement/scripts/hote-activite.sh \
#         --domaine prism.exemple.com --mail admin@exemple.com
#
# Le vhost est le meme gabarit que celui du site : tout est relaye vers le
# meme serveur Next, et c'est le site qui, voyant cet hote, ne sert que
# l'Activite (src/proxy.ts). Idempotent : relancer ne casse rien.
set -euo pipefail

DOMAINE=""
MAIL_ADMIN=""
PORT="3100"

while [ $# -gt 0 ]; do
    case "$1" in
        --domaine) DOMAINE="${2:-}"; shift 2 ;;
        --mail)    MAIL_ADMIN="${2:-}"; shift 2 ;;
        --port)    PORT="${2:-}"; shift 2 ;;
        *) echo "argument inconnu : $1" >&2; exit 1 ;;
    esac
done

echec() { echo "Erreur : $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || echec "a lancer en root (sudo)."
[ -n "$DOMAINE" ] || echec "--domaine est obligatoire (ex. prism.exemple.com)."
[ -n "$MAIL_ADMIN" ] || echec "--mail est obligatoire (pour Let's Encrypt)."
case "$DOMAINE" in
    *[!a-z0-9.-]*|"") echec "nom d'hote invalide : $DOMAINE" ;;
esac

GABARITS="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$GABARITS/apache-vhost.conf.gabarit" ] || echec "gabarit introuvable dans $GABARITS."
for binaire in apache2ctl certbot; do
    command -v "$binaire" >/dev/null || echec "$binaire est absent."
done

echo "== Vhost Apache"
for module in proxy proxy_http proxy_wstunnel rewrite headers ssl; do
    a2enmod -q "$module" >/dev/null
done
sed -e "s|@@DOMAINE@@|$DOMAINE|g" \
    -e "s|@@MAIL_ADMIN@@|$MAIL_ADMIN|g" \
    -e "s|@@PORT@@|$PORT|g" \
    "$GABARITS/apache-vhost.conf.gabarit" \
    > "/etc/apache2/sites-available/$DOMAINE.conf"
a2ensite -q "$DOMAINE.conf" >/dev/null
# Une erreur de syntaxe couperait les autres sites du serveur : on verifie
# avant de recharger.
apache2ctl configtest || echec "configuration Apache invalide, rien n'a ete recharge."
systemctl reload apache2
echo "/etc/apache2/sites-available/$DOMAINE.conf"

echo "== Certificat Let's Encrypt"
if [ -d "/etc/letsencrypt/live/$DOMAINE" ]; then
    echo "Deja present : laisse tel quel."
else
    # Le DNS doit deja pointer ici, sinon Let's Encrypt ne peut pas verifier.
    certbot --apache --non-interactive --agree-tos --redirect \
        --domains "$DOMAINE" --email "$MAIL_ADMIN" --keep-until-expiring
fi

echo "== Termine"
echo "https://$DOMAINE/ renvoie vers l'Activite des qu'une application porte"
echo "ce nom d'hote dans l'administration (onglet Discord). Reste le portail"
echo "Discord : URL Mapping / -> $DOMAINE"
