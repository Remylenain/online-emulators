import type { Metadata } from "next";
import { PageMentions } from "@/components/discord/mentions";
import { enTeteMentions, langueDesMentions, mentionsDeLaRequete, vueMentions } from "@/lib/discord/mentions";
import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { TexteConfidentialiteEn } from "./texte-en";
import { TexteConfidentialiteFr } from "./texte-fr";

type Recherche = Promise<{ lang?: string | string[] }>;

export async function generateMetadata({ searchParams }: { searchParams: Recherche }): Promise<Metadata> {
  return enTeteMentions(dictionnaire(await langueDesMentions(searchParams)).mentions.confidentialite);
}
export const viewport = vueMentions;

/**
 * La politique de confidentialité d'une Activité, celle de l'hôte demandé.
 *
 * Chaque phrase décrit ce que le code fait réellement : qui touche à ce que
 * l'Activité reçoit, enregistre ou journalise relit cette page, et change
 * la date de `src/lib/discord/mentions.ts`. Les sources sont `src/lib/discord/compte.ts` (le compte),
 * `src/lib/saves.ts` et `src/lib/states.ts` (la partie), `src/lib/keymap`
 * (les touches), `src/app/api/discord/session/route.ts` (Discord, le débit)
 * et `src/lib/link` (le jeu à deux).
 */
export default async function PageConfidentialite({ searchParams }: { searchParams: Recherche }) {
  const langue = await langueDesMentions(searchParams);
  const mentions = await mentionsDeLaRequete();

  return (
    <PageMentions page="confidentialite" langue={langue} mentions={mentions}>
      {langue === "en" ? <TexteConfidentialiteEn mentions={mentions} /> : <TexteConfidentialiteFr mentions={mentions} />}
    </PageMentions>
  );
}
