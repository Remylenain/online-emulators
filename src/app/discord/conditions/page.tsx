import type { Metadata } from "next";
import { PageMentions } from "@/components/discord/mentions";
import { enTeteMentions, langueDesMentions, mentionsDeLaRequete, vueMentions } from "@/lib/discord/mentions";
import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { TexteConditionsEn } from "./texte-en";
import { TexteConditionsFr } from "./texte-fr";

type Recherche = Promise<{ lang?: string | string[] }>;

export async function generateMetadata({ searchParams }: { searchParams: Recherche }): Promise<Metadata> {
  return enTeteMentions(dictionnaire(await langueDesMentions(searchParams)).mentions.conditions);
}
export const viewport = vueMentions;

/**
 * Les conditions d'utilisation d'une Activité, celle de l'hôte demandé.
 *
 * Le texte vaut pour n'importe quel jeu : il ne dit rien des droits sur
 * celui que l'administrateur a choisi de servir, qui restent son affaire.
 * Une retouche se fait dans les deux langues (`texte-fr.tsx`, `texte-en.tsx`)
 * et change la date de `src/lib/discord/mentions.ts`.
 */
export default async function PageConditions({ searchParams }: { searchParams: Recherche }) {
  const langue = await langueDesMentions(searchParams);
  const mentions = await mentionsDeLaRequete();

  return (
    <PageMentions page="conditions" langue={langue} mentions={mentions}>
      {langue === "en" ? <TexteConditionsEn mentions={mentions} /> : <TexteConditionsFr mentions={mentions} />}
    </PageMentions>
  );
}
