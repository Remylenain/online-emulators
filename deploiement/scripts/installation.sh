#!/bin/bash
# Installation d'Online Emulators sur un serveur Debian avec Apache.
#
# A lancer en root, depuis un clone du depot place dans le repertoire
# personnel de l'utilisateur qui poussera les mises a jour :
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
#
# Une seconde instance sur le meme serveur (un site public reduit a quelques
# jeux a cote d'une bibliotheque privee, par exemple) s'installe avec
# --instance, et --port devient alors obligatoire :
#
#     sudo ./deploiement/scripts/installation.sh \
#         --instance vitrine --port 3101 \
#         --domaine vitrine.exemple.com --mail admin@exemple.com
#
# Tout ce qui precede porte alors le nom de l'instance : utilisateur
# `jeux-vitrine`, /opt/online-emulators-vitrine(.git),
# /var/lib/online-emulators-vitrine, /etc/online-emulators-vitrine.env, service
# online-emulators-vitrine. Sans --instance, rien ne change de nom : relancer
# le script sur un serveur deja installe ne deplace rien.
#
# Options : --domaine, --mail, --port (3100 par defaut, obligatoire avec
# --instance), --instance, --bibliotheque (dossier des jeux), --pousseur
# (compte qui poussera, si ce n'est pas celui qui lance sudo).
set -euo pipefail

DOMAINE=""
MAIL_ADMIN=""
PORT=""
INSTANCE=""
BIBLIOTHEQUE=""
POUSSEUR="${SUDO_USER:-}"

while [ $# -gt 0 ]; do
    case "$1" in
        --domaine)      DOMAINE="${2:-}"; shift 2 ;;
        --mail)         MAIL_ADMIN="${2:-}"; shift 2 ;;
        --port)         PORT="${2:-}"; shift 2 ;;
        --instance)
            # Un nom vide n'est pas "pas d'instance" : ce serait viser
            # l'installation par defaut par megarde, depuis une variable
            # restee vide par exemple.
            [ -n "${2:-}" ] || { echo "--instance attend un nom." >&2; exit 1; }
            INSTANCE="$2"; shift 2 ;;
        --bibliotheque) BIBLIOTHEQUE="${2:-}"; shift 2 ;;
        --pousseur)     POUSSEUR="${2:-}"; shift 2 ;;
        -h|--help)
            # L'en-tete de ce fichier, jusqu'a la premiere ligne qui n'est
            # plus un commentaire.
            awk 'NR == 1 { next } !/^#/ { exit } { sub(/^# ?/, ""); print }' "$0"
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

# Le nom de l'instance finit dans des chemins, un nom d'utilisateur, un nom
# d'unite systemd et un nom de fichier sudoers (ou un point suffirait a faire
# ignorer la regle) : on n'accepte que ce qui est sur partout.
if [ -n "$INSTANCE" ]; then
    case "$INSTANCE" in
        *[!a-z0-9-]*|-*|*-)
            echec "--instance : minuscules, chiffres et tirets seulement (ex. vitrine)." ;;
    esac
    # Un nom d'utilisateur Linux est limite a 32 caracteres, `jeux-` compris.
    [ "${#INSTANCE}" -le 20 ] || echec "--instance : 20 caracteres au plus."
fi

# Tout derive d'un seul nom. Sans --instance ce sont, a la lettre, les noms de
# l'installation d'origine : c'est ce qui permet de relancer ce script sur un
# serveur deja en service sans rien deplacer. post-receive, migrer.sh et
# sauvegarde.sh refont la meme deduction a partir de leur emplacement : changer
# la convention ici oblige a la changer la-bas.
if [ -z "$INSTANCE" ]; then
    NOM="online-emulators"
    UTILISATEUR="jeux"
    ETIQUETTE=""
    HEURE_SAUVEGARDE="04:30:00"
    DISTANT="serveur"
    [ -n "$PORT" ] || PORT="3100"
else
    NOM="online-emulators-$INSTANCE"
    # Un utilisateur par instance, et pas `jeux` pour toutes : une instance
    # publique compromise ne doit pouvoir lire ni la base ni le fichier
    # d'environnement de l'instance privee d'a cote.
    UTILISATEUR="jeux-$INSTANCE"
    ETIQUETTE=", instance $INSTANCE"
    # Un quart d'heure apres l'instance par defaut, pour ne pas archiver les
    # deux en meme temps.
    HEURE_SAUVEGARDE="04:45:00"
    DISTANT="serveur-$INSTANCE"
    # Pas de port par defaut ici : il serait forcement celui d'une autre
    # instance, et le service ne demarrerait pas.
    [ -n "$PORT" ] || echec "--port est obligatoire avec --instance (ex. 3101)."
fi

case "$PORT" in
    ""|*[!0-9]*) echec "--port : un nombre est attendu (recu : $PORT)." ;;
esac
{ [ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ]; } \
    || echec "--port : entre 1024 et 65535 (recu : $PORT)."

# Le clone depuis lequel ce script est lance sert au tout premier deploiement.
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GABARITS="$SOURCE/deploiement"
[ -f "$GABARITS/apache-vhost.conf.gabarit" ] || echec "gabarits introuvables dans $GABARITS."

ARBRE="/opt/$NOM"
DEPOT="/opt/$NOM.git"
DONNEES="/var/lib/$NOM"
SAUVEGARDES="/var/backups/$NOM"
ENV_FILE="/etc/$NOM.env"
SUDOERS="/etc/sudoers.d/$NOM"
UNITE="/etc/systemd/system/$NOM.service"
VHOST="/etc/apache2/sites-available/$DOMAINE.conf"
[ -n "$BIBLIOTHEQUE" ] || BIBLIOTHEQUE="$DONNEES/library"

# Remplace les reperes d'un gabarit et ecrit le resultat sur la sortie.
rendre() {
    sed -e "s|@@NOM@@|$NOM|g" \
        -e "s|@@UTILISATEUR@@|$UTILISATEUR|g" \
        -e "s|@@ETIQUETTE@@|$ETIQUETTE|g" \
        -e "s|@@PORT@@|$PORT|g" \
        -e "s|@@DOMAINE@@|$DOMAINE|g" \
        -e "s|@@MAIL_ADMIN@@|$MAIL_ADMIN|g" \
        -e "s|@@HEURE_SAUVEGARDE@@|$HEURE_SAUVEGARDE|g" \
        "$1"
}

# Le port d'une instance n'est ecrit qu'a un endroit : l'option -p de la ligne
# ExecStart de son unite systemd. Le fichier d'environnement ne le porte pas.
port_de_l_unite() {
    sed -n 's/^ExecStart=.* -p \([0-9][0-9]*\).*$/\1/p' "$1" | head -n 1
}

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

# Deux instances sur le meme port : la seconde ne demarrerait pas, et le vhost
# de l'une servirait le site de l'autre. On le refuse avant d'avoir cree quoi
# que ce soit. Seules les autres instances de ce site sont examinees : un port
# pris par un tout autre programme n'est pas detecte ici.
for unite in /etc/systemd/system/online-emulators*.service; do
    if [ -f "$unite" ] && [ "$unite" != "$UNITE" ] \
        && [ "$(port_de_l_unite "$unite")" = "$PORT" ]; then
        echec "le port $PORT est deja celui de $(basename "$unite" .service) : choisir un autre --port."
    fi
done
# Meme prudence pour le nom d'hote, quand on installe une instance nommee : un
# --domaine recopie de l'autre instance reecrirait son vhost et enverrait ses
# visiteurs vers celle-ci.
if [ -n "$INSTANCE" ] && [ -f "$VHOST" ] && ! grep -q "http://127.0.0.1:$PORT/" "$VHOST"; then
    echec "$VHOST existe et relaie vers un autre port : ce nom d'hote est deja celui d'un autre site (pour changer le port de cette instance, retirer d'abord ce fichier)."
fi
echo "Instance : $NOM, port $PORT."

etape "Utilisateur systeme $UTILISATEUR"
if id "$UTILISATEUR" >/dev/null 2>&1; then
    echo "Deja present."
else
    # --system sans home ni shell : ce compte ne sert qu'a faire tourner le
    # serveur, il n'a aucune raison de pouvoir se connecter.
    adduser --system --group --no-create-home --shell /usr/sbin/nologin "$UTILISATEUR"
    echo "Cree."
fi
# Le pousseur doit appartenir au groupe du service : c'est ce qui lui permet de
# lire le fichier de configuration (dont le hook a besoin) et de lancer les
# scripts d'administration sous l'identite du service plutot qu'en root, ce qui
# laisserait des fichiers SQLite appartenant a root et bloquerait ensuite le
# service.
usermod -aG "$UTILISATEUR" "$POUSSEUR"

etape "Arborescence"
mkdir -p "$ARBRE" "$DONNEES" "$SAUVEGARDES"
# L'arbre de travail appartient au pousseur (le hook y fait git checkout et
# npm ci) et se lit par le groupe du service (qui y lit .next et node_modules).
# Rien pour les autres : l'utilisateur d'une autre instance n'y entre pas.
chown -R "$POUSSEUR:$UTILISATEUR" "$ARBRE"
chmod 2750 "$ARBRE"
# Les donnees appartiennent au service, qui est seul a y ecrire.
chown -R "$UTILISATEUR:$UTILISATEUR" "$DONNEES"
chmod 2750 "$DONNEES"
# Les archives contiennent une copie de la base : sans ce chmod le dossier
# serait lisible par tous, donc par l'utilisateur d'une autre instance, et le
# cloisonnement des donnees ci-dessus ne servirait a rien.
chmod 700 "$SAUVEGARDES"
mkdir -p "$BIBLIOTHEQUE"
echo "$ARBRE, $DONNEES, $BIBLIOTHEQUE"

etape "Configuration ($ENV_FILE)"
if [ -f "$ENV_FILE" ]; then
    echo "Deja present : laisse tel quel (regenerer SESSION_SECRET"
    echo "deconnecterait tous les comptes)."
else
    secret="$(openssl rand -base64 48 | tr -d '\n')"
    cat > "$ENV_FILE" <<FIN
# Configuration d'Online Emulators$ETIQUETTE. Lu par systemd, par le hook de
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
# Lisible par systemd (root) et par le groupe du service, auquel appartiennent
# le service et le pousseur : le hook en a besoin pour les migrations et la
# construction. Jamais par le reste du monde, il contient le secret de session
# — et le reste du monde comprend l'utilisateur des autres instances.
chown "root:$UTILISATEUR" "$ENV_FILE"
chmod 640 "$ENV_FILE"

etape "Droit de redemarrer le service sans mot de passe"
# Les deux commandes autorisees doivent correspondre mot pour mot a celles que
# lance post-receive, qui les reconstruit a partir du nom de son depot.
cat > "$SUDOERS" <<FIN
# Le hook de deploiement tourne sous $POUSSEUR et doit relancer le service.
# Portee volontairement limitee a cette seule unite et a ce seul verbe : lire
# l'etat ou le journal d'une unite ne demande aucun privilege, donc rien
# d'autre n'a besoin d'etre autorise ici.
$POUSSEUR ALL=(root) NOPASSWD: /usr/bin/systemctl restart $NOM

# Les migrations doivent tourner sous l'identite du service : la base et ses
# fichiers -wal/-shm doivent appartenir a $UTILISATEUR, seul a pouvoir ecrire dans
# $DONNEES. Le script vise est dans l'arbre de travail, que
# $POUSSEUR peut de toute facon modifier — et dont le service execute deja le
# code : cette regle n'accorde donc aucun pouvoir supplementaire.
$POUSSEUR ALL=($UTILISATEUR) NOPASSWD: $ARBRE/deploiement/scripts/migrer.sh
FIN
chmod 440 "$SUDOERS"
# visudo -c refuse d'ecrire : une erreur de syntaxe ici casserait sudo pour
# tout le monde, donc on verifie et on retire le fichier au moindre doute.
visudo -c -f "$SUDOERS" >/dev/null \
    || { rm -f "$SUDOERS"; echec "regle sudoers invalide, retiree."; }
echo "$SUDOERS"

etape "Unites systemd"
rendre "$GABARITS/online-emulators.service.gabarit" > "$UNITE"
rendre "$GABARITS/sauvegarde-online-emulators.service.gabarit" \
    > "/etc/systemd/system/sauvegarde-$NOM.service"
rendre "$GABARITS/sauvegarde-online-emulators.timer.gabarit" \
    > "/etc/systemd/system/sauvegarde-$NOM.timer"
systemctl daemon-reload
systemctl enable --quiet "$NOM"
systemctl enable --now --quiet "sauvegarde-$NOM.timer"
echo "$NOM.service, sauvegarde quotidienne a ${HEURE_SAUVEGARDE%:00}."

etape "Depot nu et hook de deploiement"
if [ ! -d "$DEPOT" ]; then
    git init --bare --quiet "$DEPOT"
    git --git-dir="$DEPOT" symbolic-ref HEAD refs/heads/main
fi
# Le meme fichier pour toutes les instances : une fois copie, le hook deduit la
# sienne du nom du depot nu dans lequel il se trouve.
install -m 755 "$GABARITS/scripts/post-receive" "$DEPOT/hooks/post-receive"
chown -R "$POUSSEUR:$POUSSEUR" "$DEPOT"
echo "$DEPOT"

etape "Deploiement"
# Lance depuis un clone, le script y pousse le code. Lance depuis l'arbre de
# travail d'une instance (qui n'est pas un depot git), il n'y a rien a
# pousser : le code y est deja arrive par un push precedent, et seul le hook
# ci-dessous a besoin de tourner — pour reprendre une unite systemd modifiee,
# par exemple.
if git -C "$SOURCE" rev-parse --git-dir >/dev/null 2>&1; then
    sudo -u "$POUSSEUR" git -C "$SOURCE" push --quiet "$DEPOT" HEAD:refs/heads/main \
        || echec "l'envoi du code vers $DEPOT a echoue."
else
    echo "$SOURCE n'est pas un depot git : le code deja present dans $DEPOT est redeploye tel quel."
fi
# Une instance neuve installee depuis l'arbre de travail d'une autre : son
# depot est vide, il n'y a rien a deployer.
git --git-dir="$DEPOT" rev-parse --verify --quiet refs/heads/main >/dev/null \
    || echec "$DEPOT ne contient pas encore de code : relancer ce script depuis un clone git du depot."
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
rendre "$GABARITS/apache-vhost.conf.gabarit" > "$VHOST"
a2ensite -q "$DOMAINE.conf" >/dev/null
# apache2ctl configtest avant tout rechargement : une erreur de syntaxe
# empecherait Apache de repartir et couperait les autres sites du serveur.
apache2ctl configtest || echec "configuration Apache invalide, rien n'a ete recharge."
systemctl reload apache2
echo "$VHOST"

etape "Certificat Let's Encrypt"
# Le vhost ecrit plus haut ne couvre que le port 80. Celui du port 443 est
# l'oeuvre de certbot, qui le recopie du premier au moment ou il installe le
# certificat — et ne le suit plus ensuite. Regarder seulement si le certificat
# existe ne suffit donc pas : sur un nom d'hote qui en avait deja un, le vhost
# HTTPS pouvait manquer, ou relayer encore vers l'ancien port, et
# l'installation se terminait en annoncant une reussite.
VHOST_TLS="/etc/apache2/sites-available/$DOMAINE-le-ssl.conf"
if [ -f "$VHOST_TLS" ] && ! grep -q "http://127.0.0.1:$PORT/" "$VHOST_TLS"; then
    echo "$VHOST_TLS relaie vers un autre port : il est refait."
    a2dissite -q "$DOMAINE-le-ssl.conf" >/dev/null || true
    rm -f "$VHOST_TLS"
fi
if [ -d "/etc/letsencrypt/live/$DOMAINE" ] && [ -f "$VHOST_TLS" ]; then
    echo "Deja present : laisse tel quel."
else
    # --keep-until-expiring : un certificat encore valable est garde et
    # simplement reinstalle, ce qui reecrit le vhost HTTPS sans en redemander
    # un a Let's Encrypt, dont les quotas sont comptes par nom d'hote.
    certbot --apache --non-interactive --agree-tos --redirect \
        --domains "$DOMAINE" --email "$MAIL_ADMIN" --keep-until-expiring
fi

etape "Termine"
echo "Site     : https://$DOMAINE"
echo "Etat     : systemctl status $NOM"
echo "Journal  : journalctl -u $NOM -f"
echo
echo "Depuis le poste de developpement, pour les mises a jour :"
echo "    git remote add $DISTANT ssh://<serveur>$DEPOT"
echo "    git push $DISTANT main"
echo
echo "Reste a faire :"
echo "  - creer un compte (sous l'identite du service, pour ne pas laisser de"
echo "    fichiers SQLite appartenant a root) :"
echo "      cd $ARBRE && sudo -u $UTILISATEUR node --env-file=$ENV_FILE \\"
echo "          scripts/create-user.ts --pseudo ... --email ... --admin"
echo "  - renseigner SMTP_* dans $ENV_FILE, sans quoi les liens de"
echo "    reinitialisation de mot de passe partent dans le journal du service"
echo "  - deposer les jeux dans $BIBLIOTHEQUE"
