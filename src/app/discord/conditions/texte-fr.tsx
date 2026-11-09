import { Responsable } from "@/components/discord/mentions";
import type { Mentions } from "@/lib/discord/mentions";

/**
 * Le texte français, qui fait référence : `texte-en.tsx` en est la
 * traduction, section pour section. Une retouche se fait dans les deux, et
 * change la date de `src/lib/discord/mentions.ts`.
 */
export function TexteConditionsFr({ mentions }: { mentions: Mentions }) {
  return (
    <>
      <section>
        <h2>Ce qu&apos;est l&apos;Activité</h2>
        <p>
          L&apos;Activité permet de jouer à « {mentions.jeu} » dans Discord, seul ou à deux. Elle est gratuite et ne
          demande aucun compte à créer : ta partie suit ton compte Discord. En la lançant, tu acceptes ces
          conditions.
        </p>
      </section>

      <section>
        <h2>Qui la propose</h2>
        <Responsable mentions={mentions} langue="fr" />
        <p>L&apos;Activité n&apos;est ni éditée ni approuvée par Discord.</p>
      </section>

      <section>
        <h2>Ce qui t&apos;est demandé</h2>
        <ul>
          <li>Respecter les conditions d&apos;utilisation de Discord et les règles du serveur où tu joues.</li>
          <li>
            Ne pas chercher à perturber l&apos;Activité, à contourner ses limites ou à accéder aux parties des
            autres.
          </li>
          <li>Ne pas l&apos;utiliser de façon automatisée, ni en récupérer le contenu autrement que pour y jouer.</li>
        </ul>
        <p>En cas d&apos;abus, l&apos;accès d&apos;un compte peut être retiré.</p>
      </section>

      <section>
        <h2>Ta partie</h2>
        <ul>
          <li>
            Elle est enregistrée au fil du jeu, avec des copies de secours. Elle peut malgré tout être perdue : une
            panne, ou une nouvelle version du jeu qui ne relit plus l&apos;ancienne.
          </li>
          <li>Pour en garder une copie à toi, télécharge ta sauvegarde depuis le menu de pause.</li>
          <li>
            Le jeu à deux tourne sur le serveur de l&apos;Activité, dont les places sont comptées : il peut y avoir
            une file d&apos;attente.
          </li>
        </ul>
      </section>

      <section>
        <h2>Disponibilité et responsabilité</h2>
        <p>
          L&apos;Activité est fournie telle quelle, sans garantie. Elle peut être interrompue, modifiée ou arrêtée à
          tout moment, sans préavis. Dans la limite de ce que la loi permet, la perte d&apos;une partie ou une
          indisponibilité n&apos;ouvre droit à aucun dédommagement.
        </p>
      </section>

      <section>
        <h2>Le jeu et les marques</h2>
        <p>
          Les marques, les personnages et les contenus de tiers qui apparaissent dans le jeu appartiennent à leurs
          détenteurs respectifs. Sauf mention contraire de leur part, ils n&apos;ont ni édité ni approuvé cette
          Activité.
        </p>
      </section>

      <section>
        <h2>Tes données</h2>
        <p>
          Ce que l&apos;Activité enregistre et comment le faire supprimer est décrit dans{" "}
          <a href="/discord/confidentialite?lang=fr">la politique de confidentialité</a>.
        </p>
      </section>

      <section>
        <h2>Changements</h2>
        <p>
          Ces conditions peuvent évoluer ; la date en tête de page dit quand elles ont été retouchées pour la
          dernière fois.
        </p>
      </section>
    </>
  );
}
