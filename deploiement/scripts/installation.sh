#!/bin/bash
# Installation d'Online Emulators sur un serveur Debian avec Apache.
#
# A lancer une seule fois, en root, depuis un clone du depot place dans le
# repertoire personnel de l'utilisateur qui poussera les mises a jour :
#
#     sudo ./deploiement/scripts/installation.sh \
#         --domaine jeux.exemple.com --mail admin@exemple.com
#
# Le script est idempotent : le relancer ne casse rien et ne regenere pas le
# secret de session (ce qui deconnecterait tout le monde). Il ne touche a aucun
# autre vhost du serveur.
#
# Ce qu'il met en place :
#   - l'utilisateur systeme `jeux`, sans login, qui fait tourner le serveur ;
#   - /opt/online-emulators.git, depot nu + hook de deploiement par push ;
#   - /opt/online-emulators, l'arbre de travail construit par le hook ;
#   - /var/lib/online-emulators, les donnees (base, sauvegardes, avatars) ;
#   - /etc/online-emulators.env, la configuration propre a l'installation ;
#   - le service et le timer de sauvegarde systemd ;
#   - le vhost Apache et le certificat Let's Encrypt.
set -euo pipefail

DOMAINE=""
MAIL_ADMIN=""
PORT="3100"
BIBLIOTHEQUE=""
POUSSEUR="${SUDO_USER:-}"

while [ $# -gt 0 ]; do
    case "$1" in
        --domaine)      DOMAINE="${2:-}"; shift 2 ;;
        --mail)         MAIL_ADMIN="${2:-}"; shift 2 ;;
        --port)         PORT="${2:-}"; shift 2 ;;
        --bibliotheque) BIBLIOTHEQUE="${2:-}"; shift 2 ;;
        --pousseur)     POUSSEUR="${2:-}"; shift 2 ;;
        -h|--help)
            sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *)
            echo "Option inconnue : $1" >&2
            exit 1 ;;
    esac
done

echec() { echo "ERREUR : $*" >&2; exit 1; }
etape() { echo; echo "==> $*"; }

[ "$(id -u)" -eq 0 ] || echec "a lancer avec sudo."
[ -n "$DOMAINE" ] || echec "--domaine est obligatoire (ex. jeux.exemple.com)."
[ -n "$MAIL_ADMIN" ] || echec "--mail est obligatoire (contact Let's Encrypt)."
[ -n "$POUSSEUR" ] || echec "--pousseur est obligatoire hors sudo."
id "$POUSSEUR" >/dev/null 2>&1 || echec "l'utilisateur $POUSSEUR n'existe pas."

# Le clone depuis lequel ce script est lance sert au tout premier deploiement.
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GABARITS="$SOURCE/deploiement"
[ -f "$GABARITS/apache-vhost.conf.gabarit" ] || echec "gabarits introuvables dans $GABARITS."

ARBRE="/opt/online-emulators"
DEPOT="/opt/online-emulators.git"
DONNEES="/var/lib/online-emulators"
ENV_FILE="/etc/online-emulators.env"
[ -n "$BIBLIOTHEQUE" ] || BIBLIOTHEQUE="$DONNEES/library"

etape "Verification des prerequis"
for binaire in node npm git apache2ctl certbot openssl; do
    command -v "$binaire" >/dev/null 2>&1 || echec "$binaire est absent."
done
# Le plugin Apache de certbot ne vient pas avec certbot : sans lui, la commande
# finale echouerait apres avoir tout installe.
certbot plugins --noninteractive 2>/dev/null | grep -q apache \
    || echec "le plugin apache de certbot est absent (apt install python3-certbot-apache)."
noeud="$(node -p 'process.versions.node.split(".")[0]')"
[ "$noeud" -ge 20 ] || echec "Node 20 ou plus recent est requis (installe : $noeud)."
echo "Node $(node -v), Apache present, certbot present."

etape "Utilisateur systeme jeux"
if id jeux >/dev/null 2>&1; then
    echo "Deja present."
else
    # --system sans home ni shell : ce compte ne sert qu'a faire tourner le
    # serveur, il n'a aucune raison de pouvoir se connecter.
    adduser --system --group --no-create-home --shell /usr/sbin/nologin jeux
    echo "Cree."
fi
# Le pousseur doit appartenir au groupe jeux : c'est ce qui lui permet de lire
# le fichier de configuration (dont le hook a besoin) et de lancer les scripts
# d'administration sous l'identite du service plutot qu'en root, ce qui laisserait
# des fichiers SQLite appartenant a root et bloquerait ensuite le service.
usermod -aG jeux "$POUSSEUR"

etape "Arborescence"
mkdir -p "$ARBRE" "$DONNEES" /var/backups/online-emulators
# L'arbre de travail appartient au pousseur (le hook y fait git checkout et
# npm ci) et se lit par le groupe jeux (le service y lit .next et node_modules).
chown -R "$POUSSEUR:jeux" "$ARBRE"
chmod 2750 "$ARBRE"
# Les donnees appartiennent au service, qui est seul a y ecrire.
chown -R jeux:jeux "$DONNEES"
chmod 2750 "$DONNEES"
mkdir -p "$BIBLIOTHEQUE"
echo "$ARBRE, $DONNEES, $BIBLIOTHEQUE"

etape "Configuration ($ENV_FILE)"
if [ -f "$ENV_FILE" ]; then
    echo "Deja present : laisse tel quel (regenerer SESSION_SECRET"
    echo "deconnecterait tous les comptes)."
else
    secret="$(openssl rand -base64 48 | tr -d '\n')"
    cat > "$ENV_FILE" <<FIN
# Configuration d'Online Emulators. Lu par systemd, par le hook de
# deploiement et par le script de sauvegarde. Ne jamais commiter.
NODE_ENV="production"
PUBLIC_URL="https://$DOMAINE"
SESSION_SECRET="$secret"

DATABASE_PATH="$DONNEES/app.db"
DATA_DIR="$DONNEES"
# Un dossier par console, puis un dossier par jeu. Peut pointer vers un dossier
# synchronise : le service le lit sans jamais y ecrire.
LIBRARY_DIR="$BIBLIOTHEQUE"

# Relais SMTP pour les liens de reinitialisation de mot de passe. Tant que
# SMTP_HOST est vide, les e-mails sont ecrits dans le journal du service.
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
MAIL_FROM="Online Emulators <noreply@$DOMAINE>"

# Captcha Cloudflare Turnstile sur le formulaire de mot de passe oublie.
# Tant que la cle secrete est vide, le captcha est contourne.
TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
FIN
    echo "Cree, avec un SESSION_SECRET tire au hasard."
fi
# Lisible par systemd (root) et par le groupe jeux, auquel appartiennent le
# service et le pousseur : le hook en a besoin pour les migrations et la
# construction. Jamais par le reste du monde, il contient le secret de session.
chown "root:jeux" "$ENV_FILE"
chmod 640 "$ENV_FILE"

etape "Droit de redemarrer le service sans mot de passe"
cat > /etc/sudoers.d/online-emulators <<FIN
# Le hook de deploiement tourne sous $POUSSEUR et doit relancer le service.
# Portee volontairement limitee a cette seule unite et a ce seul verbe : lire
# l'etat ou le journal d'une unite ne demande aucun privilege, donc rien
# d'autre n'a besoin d'etre autorise ici.
$POUSSEUR ALL=(root) NOPASSWD: /usr/bin/systemctl restart online-emulators

# Les migrations doivent tourner sous l'identite du service : la base et ses
# fichiers -wal/-shm doivent appartenir a jeux, seul a pouvoir ecrire dans
# /var/lib/online-emulators. Le script vise est dans l'arbre de travail, que
# $POUSSEUR peut de toute facon modifier — et dont le service execute deja le
# code : cette regle n'accorde donc aucun pouvoir supplementaire.
$POUSSEUR ALL=(jeux) NOPASSWD: $ARBRE/deploiement/scripts/migrer.sh
FIN
chmod 440 /etc/sudoers.d/online-emulators
# visudo -c refuse d'ecrire : une erreur de syntaxe ici casserait sudo pour
# tout le monde, donc on verifie et on retire le fichier au moindre doute.
visudo -c -f /etc/sudoers.d/online-emulators >/dev/null \
    || { rm -f /etc/sudoers.d/online-emulators; echec "regle sudoers invalide, retiree."; }
echo "/etc/sudoers.d/online-emulators"

etape "Unites systemd"
sed "s|@@PORT@@|$PORT|g" "$GABARITS/online-emulators.service.gabarit" \
    > /etc/systemd/system/online-emulators.service
install -m 644 "$GABARITS/sauvegarde-online-emulators.service" /etc/systemd/system/
install -m 644 "$GABARITS/sauvegarde-online-emulators.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --quiet online-emulators
systemctl enable --now --quiet sauvegarde-online-emulators.timer
echo "online-emulators.service, sauvegarde quotidienne a 04:30."

etape "Depot nu et hook de deploiement"
if [ ! -d "$DEPOT" ]; then
    git init --bare --quiet "$DEPOT"
    git --git-dir="$DEPOT" symbolic-ref HEAD refs/heads/main
fi
install -m 755 "$GABARITS/scripts/post-receive" "$DEPOT/hooks/post-receive"
chown -R "$POUSSEUR:$POUSSEUR" "$DEPOT"
echo "$DEPOT"

etape "Deploiement"
# Lance depuis un clone, le script y pousse le code. Lance depuis l'arbre de
# travail (/opt/online-emulators, qui n'est pas un depot git), il n'y a rien
# a pousser : le code y est deja arrive par un push precedent, et seul le
# hook ci-dessous a besoin de tourner — pour reprendre une unite systemd
# modifiee, par exemple.
if git -C "$SOURCE" rev-parse --git-dir >/dev/null 2>&1; then
    sudo -u "$POUSSEUR" git -C "$SOURCE" push --quiet "$DEPOT" HEAD:refs/heads/main \
        || echec "l'envoi du code vers $DEPOT a echoue."
else
    echo "$SOURCE n'est pas un depot git : le code deja present dans $DEPOT est redeploye tel quel."
fi
# Le hook n'est declenche que par un push qui fait bouger la reference : au
# second passage du script, le push ne transmet rien et le deploiement serait
# silencieusement saute, le script allant jusqu'au bout en annoncant une
# reussite. On appelle donc le hook explicitement, avec l'entree qu'un push lui
# fournirait. C'est lui qui installe les dependances, applique les migrations,
# construit le site et demarre le service.
revision="$(git --git-dir="$DEPOT" rev-parse refs/heads/main)"
printf '%s %s refs/heads/main\n' "$revision" "$revision" \
    | sudo -u "$POUSSEUR" "$DEPOT/hooks/post-receive" \
    || echec "le deploiement a echoue (voir les messages ci-dessus)."

etape "Vhost Apache"
for module in proxy proxy_http proxy_wstunnel rewrite headers ssl; do
    a2enmod -q "$module" >/dev/null
done
sed -e "s|@@DOMAINE@@|$DOMAINE|g" \
    -e "s|@@MAIL_ADMIN@@|$MAIL_ADMIN|g" \
    -e "s|@@PORT@@|$PORT|g" \
    "$GABARITS/apache-vhost.conf.gabarit" \
    > "/etc/apache2/sites-available/$DOMAINE.conf"
a2ensite -q "$DOMAINE.conf" >/dev/null
# apache2ctl configtest avant tout rechargement : une erreur de syntaxe
# empecherait Apache de repartir et couperait les autres sites du serveur.
apache2ctl configtest || echec "configuration Apache invalide, rien n'a ete recharge."
systemctl reload apache2
echo "/etc/apache2/sites-available/$DOMAINE.conf"

etape "Certificat Let's Encrypt"
if [ -d "/etc/letsencrypt/live/$DOMAINE" ]; then
    echo "Deja present : laisse tel quel."
else
    certbot --apache --non-interactive --agree-tos --redirect \
        --domains "$DOMAINE" --email "$MAIL_ADMIN" --keep-until-expiring
fi

etape "Termine"
echo "Site     : https://$DOMAINE"
echo "Etat     : systemctl status online-emulators"
echo "Journal  : journalctl -u online-emulators -f"
echo
echo "Depuis le poste de developpement, pour les mises a jour :"
echo "    git remote add serveur ssh://<serveur>$DEPOT"
echo "    git push serveur main"
echo
echo "Reste a faire :"
echo "  - creer un compte (sous l'identite du service, pour ne pas laisser de"
echo "    fichiers SQLite appartenant a root) :"
echo "      cd $ARBRE && sudo -u jeux node --env-file=$ENV_FILE \\"
echo "          scripts/create-user.ts --pseudo ... --email ... --admin"
echo "  - renseigner SMTP_* dans $ENV_FILE, sans quoi les liens de"
echo "    reinitialisation de mot de passe partent dans le journal du service"
echo "  - deposer les jeux dans $BIBLIOTHEQUE"
