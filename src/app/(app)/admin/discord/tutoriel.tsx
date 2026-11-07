"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/ui";

/**
 * Le pas à pas complet, de zéro jusqu'à l'Activité qui se lance dans Discord.
 *
 * Il doit suffire à quelqu'un qui n'a jamais ouvert le portail développeur
 * de Discord. Les noms d'onglets sont ceux du portail à l'écriture (fin
 * 2026) ; Discord les déplace parfois, les notions restent.
 *
 * Une copie en Markdown vit dans `docs/discord/README.md` : les deux
 * s'entretiennent ensemble.
 */
export function Tutoriel({ ouvertAuDepart }: { ouvertAuDepart: boolean }) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart);

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-50">Ajouter une Activité : le pas à pas complet</h3>
          <p className="text-sm text-ink-400">
            Tout ce qu&apos;il y a à faire chez Discord, puis ici, puis sur le serveur. Compter une
            demi-heure la première fois.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
          {ouvert ? "Replier" : "Lire le pas à pas"}
        </Button>
      </div>

      {ouvert && (
        <div className="flex flex-col gap-5 border-t border-ink-800 pt-4 text-sm text-ink-300 [&_code]:rounded [&_code]:bg-ink-950/80 [&_code]:px-1 [&_code]:text-ink-50 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-ink-100 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
          <section>
            <h4>0. Ce qu&apos;il faut avant de commencer</h4>
            <ul>
              <li>
                Un compte Discord, et <strong className="text-ink-100">un serveur Discord à toi</strong> (ou dont
                tu es administrateur) de <strong className="text-ink-100">moins de 25 membres</strong> : tant que
                l&apos;application n&apos;est pas vérifiée par Discord, elle ne se lance que dans un serveur de
                cette taille, et seulement pour toi, ton équipe et tes testeurs.
              </li>
              <li>
                Le <strong className="text-ink-100">mode développeur</strong> dans Discord : Paramètres utilisateur
                → Avancés → Mode développeur. Il ajoute « Copier l&apos;identifiant » aux clics droits.
              </li>
              <li>
                Un <strong className="text-ink-100">nom d&apos;hôte</strong> pour l&apos;Activité (par exemple{" "}
                <code>prism.exemple.com</code>), différent de celui du site, que tu peux faire pointer vers ce
                serveur chez ton registrar.
              </li>
              <li>Le jeu déjà présent dans la bibliothèque du site (publié ou non).</li>
            </ul>
          </section>

          <section>
            <h4>1. Créer l&apos;application chez Discord</h4>
            <ol>
              <li>
                Ouvrir <code>discord.com/developers/applications</code>, bouton{" "}
                <strong className="text-ink-100">New Application</strong>. Le nom est celui que verront les
                joueurs dans le lanceur — le nom du jeu, par exemple. Accepter les conditions.
              </li>
              <li>
                Onglet <strong className="text-ink-100">General Information</strong> : copier{" "}
                <strong className="text-ink-100">Application ID</strong> (un nombre de 18 ou 19 chiffres).
                C&apos;est « l&apos;identifiant d&apos;application » demandé ici. Ajouter une icône et une
                description : elles s&apos;affichent dans le lanceur d&apos;activités.
              </li>
              <li>
                Ne pas copier la <strong className="text-ink-100">Public Key</strong> : elle ne sert pas ici, et
                la prendre pour le secret donne l&apos;erreur <code>invalid_client</code>.
              </li>
            </ol>
          </section>

          <section>
            <h4>2. Le secret et l&apos;adresse de retour (onglet OAuth2)</h4>
            <ol>
              <li>
                <strong className="text-ink-100">Client Secret</strong> → <strong className="text-ink-100">Reset
                Secret</strong> → copier tout de suite : Discord ne le montre qu&apos;une fois. Le régénérer
                plus tard invalide l&apos;ancien, partout où il est enregistré.
              </li>
              <li>
                <strong className="text-ink-100">Redirects</strong> → Add Redirect → <code>https://127.0.0.1</code>{" "}
                → Save Changes. Discord exige une adresse de retour, l&apos;Activité ne s&apos;en sert jamais.
              </li>
            </ol>
          </section>

          <section>
            <h4>3. Le jeton de bot (seulement pour réserver l&apos;Activité à un serveur)</h4>
            <ol>
              <li>
                Onglet <strong className="text-ink-100">Bot</strong> → <strong className="text-ink-100">Reset
                Token</strong> → copier tout de suite, pour la même raison que le secret.
              </li>
              <li>
                Rien d&apos;autre : le bot n&apos;a pas besoin d&apos;être invité dans le serveur, ni de permission.
                Avec ce jeton, le site demande seulement à Discord où tourne l&apos;Activité et qui y est.
              </li>
              <li>
                L&apos;identifiant du serveur : dans Discord, clic droit sur le nom du serveur →{" "}
                <strong className="text-ink-100">Copier l&apos;identifiant du serveur</strong>.
              </li>
            </ol>
          </section>

          <section>
            <h4>4. Activer l&apos;Activité (onglet Activities)</h4>
            <ol>
              <li>
                <strong className="text-ink-100">Getting Started</strong> →{" "}
                <strong className="text-ink-100">Enable Activities</strong>. Discord crée la commande de lancement
                de l&apos;application.
              </li>
              <li>
                <strong className="text-ink-100">Settings</strong> : cocher les plateformes voulues (ordinateur,
                iOS, Android). Pour un jeu Game Boy, l&apos;orientation « portrait » sur téléphone convient
                bien ; en paysage l&apos;écran est petit.
              </li>
              <li>
                <strong className="text-ink-100">URL Mappings</strong> : une seule ligne, préfixe <code>/</code>,
                cible le nom d&apos;hôte de l&apos;Activité <strong className="text-ink-100">sans</strong>{" "}
                <code>https://</code> ni chemin (par exemple <code>prism.exemple.com</code>). Discord fera passer
                tout ce que la page demande par son proxy vers cet hôte.
              </li>
            </ol>
          </section>

          <section>
            <h4>5. Déclarer l&apos;Activité ici, dans le site</h4>
            <ol>
              <li>
                Bouton <strong className="text-ink-100">Nouvelle application</strong> : le nom (pour toi), le nom
                d&apos;hôte, le jeu, l&apos;Application ID, le Client Secret, et si tu veux le verrou avec
                l&apos;identifiant du serveur et le jeton de bot.
              </li>
              <li>
                <strong className="text-ink-100">Essayer auprès de Discord</strong> : les identifiants doivent être
                acceptés avant d&apos;aller plus loin.
              </li>
              <li>
                <strong className="text-ink-100">Marche à suivre</strong> rappelle, pour cette application, ce qui
                reste à recopier dans le portail.
              </li>
              <li>
                Facultatif : un <strong className="text-ink-100">mot d&apos;accueil</strong> dans le formulaire
                (affiché à chaque lancement sous le titre du jeu), et des{" "}
                <strong className="text-ink-100">astuces</strong> sur la carte de l&apos;application — mot du jour,
                conseil, rappel. L&apos;accueil en montre une au hasard, le menu de pause les fait défiler.
              </li>
            </ol>
          </section>

          <section>
            <h4>6. Le nom d&apos;hôte, côté serveur</h4>
            <ol>
              <li>
                Chez le registrar : un enregistrement <code>A</code> (ou <code>CNAME</code>) qui fait pointer
                le nom d&apos;hôte vers ce serveur. Attendre qu&apos;il soit visible (<code>nslookup</code>).
              </li>
              <li>
                Sur le serveur, en root, depuis le clone du dépôt :{" "}
                <code>sudo ./deploiement/scripts/hote-activite.sh --domaine prism.exemple.com --mail
                toi@exemple.com</code>. Le script pose le vhost Apache et demande le certificat.
              </li>
              <li>
                Vérifier dans un navigateur : <code>https://prism.exemple.com/</code> doit afficher
                l&apos;Activité (page « Cette page s&apos;ouvre depuis Discord ») et{" "}
                <code>https://prism.exemple.com/connexion</code> répondre « Introuvable ».
              </li>
            </ol>
          </section>

          <section>
            <h4>7. Lancer dans Discord</h4>
            <ol>
              <li>Entrer dans un salon vocal du serveur.</li>
              <li>
                Ouvrir le <strong className="text-ink-100">lanceur d&apos;activités</strong> (l&apos;icône de fusée
                dans le salon vocal, ou le bouton « Activités »), chercher l&apos;application par son nom.
              </li>
              <li>
                Au premier lancement, Discord demande l&apos;autorisation de connaître ton identité : accepter. Le
                site crée alors ton compte restreint à ce jeu.
              </li>
              <li>
                Pour qu&apos;un ami l&apos;essaie avant la vérification : onglet{" "}
                <strong className="text-ink-100">App Testers</strong> du portail, inviter son compte (50 au plus).
              </li>
            </ol>
          </section>

          <section>
            <h4>8. Quand ça ne marche pas</h4>
            <ul>
              <li>
                <strong className="text-ink-100">Écran blanc ou noir</strong> : l&apos;URL Mapping ne pointe pas
                vers le bon hôte, le DNS n&apos;est pas encore visible, ou le certificat manque. Ouvrir l&apos;hôte
                dans un navigateur pour voir lequel.
              </li>
              <li>
                <code>invalid_client</code> dans le journal du serveur : identifiant faux, ou Public Key mise à la
                place du secret. <code>invalid_grant</code> : code périmé, relancer l&apos;Activité.
              </li>
              <li>
                « Cette Activité ne se joue que dans son serveur Discord » : le verrou refuse ; vérifier
                l&apos;identifiant du serveur et le jeton de bot avec « Essayer auprès de Discord ».
              </li>
              <li>
                L&apos;application n&apos;apparaît pas dans le lanceur : Activities → Settings, la plateforme
                n&apos;est pas cochée ; ou le serveur a 25 membres ou plus ; ou le compte n&apos;est ni le
                propriétaire, ni dans l&apos;équipe, ni testeur.
              </li>
              <li>
                Les joueurs ne se voient pas à deux : ils doivent être dans le{" "}
                <strong className="text-ink-100">même salon vocal</strong> — c&apos;est lui qui fait le salon de
                jeu.
              </li>
            </ul>
          </section>

          <section>
            <h4>9. Au-delà de 25 membres</h4>
            <p>
              Discord demande la <strong className="text-ink-100">vérification de l&apos;application</strong> (onglet
              App Verification), donc celle de l&apos;identité de son propriétaire, et s&apos;engage sur ses
              conditions développeur — dont le respect des droits des tiers. C&apos;est une décision à prendre
              avant d&apos;ouvrir l&apos;Activité à un grand serveur.
            </p>
          </section>
        </div>
      )}
    </Panel>
  );
}
