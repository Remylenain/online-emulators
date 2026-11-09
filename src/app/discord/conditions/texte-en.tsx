import { Responsable } from "@/components/discord/mentions";
import type { Mentions } from "@/lib/discord/mentions";

/**
 * La traduction anglaise de `texte-fr.tsx`, section pour section. Rien n'y
 * est ajouté ni retranché : une retouche se fait d'abord dans le français.
 */
export function TexteConditionsEn({ mentions }: { mentions: Mentions }) {
  return (
    <>
      <section>
        <h2>What the Activity is</h2>
        <p>
          The Activity lets you play “{mentions.jeu}” inside Discord, on your own or with someone else. It is free
          and requires no account to be created: your progress follows your Discord account. By launching it, you
          accept these terms.
        </p>
      </section>

      <section>
        <h2>Who offers it</h2>
        <Responsable mentions={mentions} langue="en" />
        <p>The Activity is neither published nor endorsed by Discord.</p>
      </section>

      <section>
        <h2>What is asked of you</h2>
        <ul>
          <li>Comply with Discord&apos;s terms of service and with the rules of the server where you play.</li>
          <li>
            Do not try to disrupt the Activity, to get around its limits, or to access other players&apos; progress.
          </li>
          <li>Do not use it in an automated way, nor retrieve its content other than to play it.</li>
        </ul>
        <p>In case of abuse, an account&apos;s access may be withdrawn.</p>
      </section>

      <section>
        <h2>Your progress</h2>
        <ul>
          <li>
            It is saved as you play, with backup copies. It may nevertheless be lost: a failure, or a new version of
            the game that can no longer read the old one.
          </li>
          <li>To keep a copy of your own, download your save file from the pause menu.</li>
          <li>
            Two-player mode runs on the Activity&apos;s server, where places are limited: there may be a queue.
          </li>
        </ul>
      </section>

      <section>
        <h2>Availability and liability</h2>
        <p>
          The Activity is provided as is, without warranty. It may be interrupted, changed or shut down at any time,
          without notice. To the extent the law allows, the loss of your progress or a period of unavailability
          gives no right to compensation.
        </p>
      </section>

      <section>
        <h2>The game and trademarks</h2>
        <p>
          The trademarks, characters and third-party content that appear in the game belong to their respective
          owners. Unless they state otherwise, they have neither published nor endorsed this Activity.
        </p>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          What the Activity stores and how to have it deleted is described in{" "}
          <a href="/discord/confidentialite?lang=en">the privacy policy</a>.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>These terms may change; the date at the top of the page says when they were last revised.</p>
      </section>
    </>
  );
}
