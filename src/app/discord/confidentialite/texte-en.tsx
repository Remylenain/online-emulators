import { Responsable } from "@/components/discord/mentions";
import type { Mentions } from "@/lib/discord/mentions";

/**
 * La traduction anglaise de `texte-fr.tsx`, section pour section. Rien n'y
 * est ajouté ni retranché : chaque phrase décrit ce que le code fait
 * réellement, et une retouche se fait d'abord dans le français.
 */
export function TexteConfidentialiteEn({ mentions }: { mentions: Mentions }) {
  return (
    <>
      <p>
        The Activity stores only what it needs to give you your progress back from one session to the next: who you
        are on Discord, and what you did in the game. This page says exactly what, why, for how long, and how to have
        it deleted.
      </p>

      <section>
        <h2>Who is responsible for your data</h2>
        <Responsable mentions={mentions} langue="en" />
      </section>

      <section>
        <h2>What the Activity receives from Discord</h2>
        <ul>
          <li>
            The first time you launch it, Discord asks you to allow the Activity to know your identity. Discord then
            sends it your public profile. The Activity keeps only <strong>your Discord user ID</strong> and{" "}
            <strong>your display name</strong>.
          </li>
          <li>
            This authorization gives access neither to your e-mail address, nor to your messages, nor to your
            friends, nor to the list of your servers.
          </li>
          <li>
            The token Discord issues for this authorization is used once, at launch. It is not kept on the
            Activity&apos;s server.
          </li>
          {mentions.verrou && (
            <li>
              The Activity is restricted to certain Discord servers. At each launch it therefore asks Discord which server
              it is running in and who is taking part, to check that you are a member. The answer is not kept.
            </li>
          )}
          {mentions.roles && (
            <li>
              In a server where it is restricted to certain roles, at each launch it also asks
              Discord for your server member record — your server nickname, your roles, the date you joined — and
              looks only at your roles. The answer is not kept.
            </li>
          )}
          {mentions.commande && (
            <li>
              The Activity can also be launched with a command typed in a channel, and its App Launcher button may
              go the same way. Discord then notifies the Activity&apos;s server that you launched it, telling it who
              you are and in which channel. The server only answers that the Activity should open: it does not read
              this information and does not keep it.
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2>What the Activity stores</h2>
        <ul>
          <li>
            <strong>An account</strong>, created at first launch: your Discord ID, a username derived from your
            display name, and the creation date. It has no password and no e-mail address.
          </li>
          <li>
            <strong>Your progress</strong>: the game&apos;s save file, and backup copies of its previous versions.
            The five most recent copies are kept, plus one per day over the last thirty days.
          </li>
          <li>
            <strong>Your save states</strong>: five at most, each with a capture of the game screen.
          </li>
          <li>
            <strong>Your settings</strong> for keys and controller.
          </li>
        </ul>
      </section>

      <section>
        <h2>When you play with someone else</h2>
        <p>
          In two-player mode the game runs on the Activity&apos;s server: your key presses are sent to it, and the
          picture and sound come back to you. The other people who have opened the Activity in the same channel can
          see the game. Nothing of this exchange is recorded; only your save file is read at the start and written
          back at the end.
        </p>
      </section>

      <section>
        <h2>Technical data</h2>
        <ul>
          <li>Inside Discord, everything the Activity exchanges with its server goes through Discord&apos;s servers.</li>
          <li>
            Like any web server, the Activity&apos;s server receives an IP address, the date and the requested
            address with each request. It may record them in a technical log, used only for troubleshooting and
            security.
          </li>
          <li>
            The IP address is also used to limit the number of connections per minute. This counter stays in memory
            and clears itself.
          </li>
        </ul>
      </section>

      <section>
        <h2>What the Activity does not do</h2>
        <ul>
          <li>It sets no cookie, and embeds no tracker, no audience measurement and no advertising.</li>
          <li>
            It neither sells nor passes your data on to anyone. They stay on the server that hosts the Activity and
            are used for nothing other than making it work.
          </li>
          <li>
            On your device, only convenience settings (the volume, rumble, a controller layout) are kept in the
            browser&apos;s local storage.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why, and for how long</h2>
        <p>
          These data are used to provide what you ask for when you launch the Activity: playing, and finding your
          progress again. Technical data are used to protect the service against abuse.
        </p>
        <p>
          Your account and your progress are kept for as long as the Activity exists, or until you ask for them to be
          deleted.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <ul>
          <li>
            <strong>From the Activity</strong>, in the pause menu: download your save file, replace it, start from
            scratch, delete a save state.
          </li>
          <li>
            <strong>On request</strong>, at the contact given above: obtain a copy of your data, have them corrected,
            or have your account deleted along with everything attached to it. Give your Discord ID or name so that
            you can be found.
          </li>
          <li>
            <strong>In Discord</strong>: User Settings → Authorized Apps, to withdraw the authorization given to the
            Activity. This does not delete what is already stored.
          </li>
          <li>
            If an answer does not satisfy you, you can refer the matter to the data protection authority of your
            country (in France, the CNIL).
          </li>
        </ul>
      </section>

      <section>
        <h2>And Discord</h2>
        <p>
          The Activity is neither published nor endorsed by Discord. What Discord does with your data is governed by
          its own policy: <a href="https://discord.com/privacy">discord.com/privacy</a>.
        </p>
      </section>
    </>
  );
}
