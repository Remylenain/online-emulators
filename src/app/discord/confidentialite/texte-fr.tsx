import { Responsable } from "@/components/discord/mentions";
import type { Mentions } from "@/lib/discord/mentions";

/**
 * Le texte français, qui fait référence : `texte-en.tsx` en est la
 * traduction, section pour section. Une retouche se fait dans les deux, et
 * change la date de `src/lib/discord/mentions.ts`.
 */
export function TexteConfidentialiteFr({ mentions }: { mentions: Mentions }) {
  return (
    <>
      <p>
        L&apos;Activité n&apos;enregistre que ce qu&apos;il faut pour te rendre ta partie d&apos;une fois sur
        l&apos;autre : qui tu es sur Discord, et ce que tu as fait dans le jeu. Cette page dit quoi exactement,
        pourquoi, pour combien de temps, et comment le faire supprimer.
      </p>

      <section>
        <h2>Qui est responsable de tes données</h2>
        <Responsable mentions={mentions} langue="fr" />
      </section>

      <section>
        <h2>Ce que l&apos;Activité reçoit de Discord</h2>
        <ul>
          <li>
            Au premier lancement, Discord te demande d&apos;autoriser l&apos;Activité à connaître ton identité.
            Discord lui transmet alors ton profil public. L&apos;Activité n&apos;en garde que{" "}
            <strong>ton identifiant d&apos;utilisateur Discord</strong> et <strong>ton nom affiché</strong>.
          </li>
          <li>
            Cette autorisation ne donne accès ni à ton adresse e-mail, ni à tes messages, ni à tes amis, ni à la
            liste de tes serveurs.
          </li>
          <li>
            Le jeton que Discord délivre pour cette autorisation sert une fois, au lancement. Il n&apos;est pas
            conservé sur le serveur de l&apos;Activité.
          </li>
          {mentions.verrou && (
            <li>
              L&apos;Activité est réservée à certains serveurs Discord. À chaque lancement, elle demande donc à Discord
              dans quel serveur elle tourne et qui y participe, pour vérifier que tu en fais partie. La réponse
              n&apos;est pas conservée.
            </li>
          )}
          {mentions.roles && (
            <li>
              Dans un serveur où elle est réservée à certains rôles, elle demande aussi, à chaque lancement,
              à Discord ta fiche de membre du serveur — ton pseudo de serveur, tes rôles, ta date d&apos;arrivée
              — et n&apos;y regarde que tes rôles. La réponse n&apos;est pas conservée.
            </li>
          )}
          {mentions.commande && (
            <li>
              L&apos;Activité se lance aussi par une commande tapée dans un salon, et son bouton du lanceur
              d&apos;applications peut passer par le même chemin. Discord prévient alors le serveur de
              l&apos;Activité que tu l&apos;as lancée, en lui disant qui tu es et dans quel salon. Le serveur répond
              seulement d&apos;ouvrir l&apos;Activité : il ne lit pas ces informations et ne les conserve pas.
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2>Ce que l&apos;Activité enregistre</h2>
        <ul>
          <li>
            <strong>Un compte</strong>, créé au premier lancement : ton identifiant Discord, un pseudo tiré de ton
            nom affiché et la date de création. Il n&apos;a ni mot de passe ni adresse e-mail.
          </li>
          <li>
            <strong>Ta partie</strong> : le fichier de sauvegarde du jeu, et des copies de secours de ses versions
            précédentes. Les cinq dernières copies sont gardées, plus une par jour sur les trente derniers jours.
          </li>
          <li>
            <strong>Tes points de reprise</strong> : cinq au plus, chacun avec une capture de l&apos;écran du jeu.
          </li>
          <li>
            <strong>Tes réglages</strong> de touches et de manette.
          </li>
        </ul>
      </section>

      <section>
        <h2>Quand tu joues à deux</h2>
        <p>
          À deux, le jeu tourne sur le serveur de l&apos;Activité : tes appuis de touches y sont envoyés, et
          l&apos;image et le son te reviennent. Les autres personnes qui ont ouvert l&apos;Activité dans le même
          salon voient la partie. Rien de cet échange n&apos;est enregistré ; seule ta sauvegarde est lue au début
          et réécrite à la fin.
        </p>
      </section>

      <section>
        <h2>Les données techniques</h2>
        <ul>
          <li>
            Dans Discord, tout ce que l&apos;Activité échange avec son serveur passe par les serveurs de Discord.
          </li>
          <li>
            Comme tout serveur web, celui de l&apos;Activité reçoit avec chaque requête une adresse IP, la date et
            l&apos;adresse demandée. Il peut les consigner dans un journal technique, qui ne sert qu&apos;au
            diagnostic et à la sécurité.
          </li>
          <li>
            L&apos;adresse IP sert aussi à limiter le nombre de connexions par minute. Ce compteur reste en
            mémoire et s&apos;efface de lui-même.
          </li>
        </ul>
      </section>

      <section>
        <h2>Ce que l&apos;Activité ne fait pas</h2>
        <ul>
          <li>Elle ne dépose aucun cookie, et n&apos;embarque ni traceur, ni mesure d&apos;audience, ni publicité.</li>
          <li>
            Elle ne vend ni ne transmet tes données à personne. Elles restent sur le serveur qui héberge
            l&apos;Activité et ne servent à rien d&apos;autre qu&apos;à la faire fonctionner.
          </li>
          <li>
            Sur ton appareil, seuls des réglages de confort (le volume, la vibration, une disposition de manette) sont retenus
            dans le stockage local du navigateur.
          </li>
        </ul>
      </section>

      <section>
        <h2>Pourquoi, et pour combien de temps</h2>
        <p>
          Ces données servent à fournir ce que tu demandes en lançant l&apos;Activité : jouer et retrouver ta
          partie. Les données techniques servent à protéger le service contre les abus.
        </p>
        <p>
          Ton compte et ta partie sont gardés tant que l&apos;Activité existe, ou jusqu&apos;à ce que tu en demandes
          la suppression.
        </p>
      </section>

      <section>
        <h2>Tes droits</h2>
        <ul>
          <li>
            <strong>Depuis l&apos;Activité</strong>, dans le menu de pause : télécharger ta sauvegarde, la remplacer,
            repartir de zéro, supprimer un point de reprise.
          </li>
          <li>
            <strong>Sur demande</strong>, au contact indiqué plus haut : obtenir une copie de tes données, les faire
            corriger, ou faire supprimer ton compte avec tout ce qui s&apos;y rattache. Donne ton identifiant ou
            ton nom Discord pour qu&apos;on te retrouve.
          </li>
          <li>
            <strong>Dans Discord</strong> : Paramètres utilisateur → Applications autorisées, pour retirer
            l&apos;autorisation donnée à l&apos;Activité. Cela ne supprime pas ce qui est déjà enregistré.
          </li>
          <li>
            Si une réponse ne te convient pas, tu peux saisir l&apos;autorité de protection des données de ton pays
            (en France, la CNIL).
          </li>
        </ul>
      </section>

      <section>
        <h2>Et Discord</h2>
        <p>
          L&apos;Activité n&apos;est ni éditée ni approuvée par Discord. Ce que Discord fait de tes données relève de
          sa propre politique : <a href="https://discord.com/privacy">discord.com/privacy</a>.
        </p>
      </section>
    </>
  );
}
