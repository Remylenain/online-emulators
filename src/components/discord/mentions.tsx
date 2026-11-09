import type { ReactNode } from "react";
import { Accentue } from "@/components/langue";
import { miseAJour, type Mentions } from "@/lib/discord/mentions";
import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { LANGUES, NOM_DES_LANGUES, type Langue } from "@/lib/i18n/langues";

/**
 * La mise en page des deux textes légaux d'une Activité : une colonne de
 * lecture, sans rien du site autour — ni en-tête, ni lien vers lui.
 *
 * Chaque langue a son adresse, `?lang=fr` ou `?lang=en` : les liens de la
 * page la gardent, et le sélecteur du haut n'est fait que de ces liens — pas
 * de cookie pour une page que l'on ouvre depuis Discord ou depuis son
 * portail.
 */
export function PageMentions({
  page,
  langue,
  mentions,
  children,
}: {
  page: "confidentialite" | "conditions";
  langue: Langue;
  mentions: Mentions;
  children: ReactNode;
}) {
  const t = dictionnaire(langue).mentions;
  const autre = page === "confidentialite" ? "conditions" : "confidentialite";
  return (
    <main
      lang={langue}
      className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 text-[0.95rem] leading-relaxed text-ink-200 [&_a]:text-accent-400 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-50 [&_li]:mt-1.5 [&_section]:flex [&_section]:flex-col [&_section]:gap-2 [&_strong]:font-semibold [&_strong]:text-ink-50 [&_ul]:list-disc [&_ul]:pl-5"
    >
      <nav aria-label={dictionnaire(langue).commun.langue} className="flex gap-3 self-end text-xs">
        {LANGUES.map((code) =>
          code === langue ? (
            <span key={code} className="text-ink-400">
              {NOM_DES_LANGUES[code]}
            </span>
          ) : (
            <a key={code} href={`/discord/${page}?lang=${code}`} lang={code} hrefLang={code}>
              {NOM_DES_LANGUES[code]}
            </a>
          ),
        )}
      </nav>
      <header className="flex flex-col gap-1 border-b border-ink-800 pb-5">
        <h1 className="text-2xl font-semibold text-ink-50">{t[page]}</h1>
        <p className="text-sm text-ink-400">{t.enTete(mentions.jeu, miseAJour(langue))}</p>
      </header>
      {children}
      <footer className="border-t border-ink-800 pt-5 text-sm text-ink-400">
        {t.voirAussi}{" "}
        <a href={`/discord/${autre}?lang=${langue}`}>
          {autre === "confidentialite" ? t.lienConfidentialite : t.lienConditions}
        </a>
        .
      </footer>
    </main>
  );
}

/**
 * Qui propose l'Activité et comment le joindre. Tant que l'administrateur n'a
 * rien saisi, la page renvoie à ceux que le joueur sait déjà trouver : les
 * responsables du serveur Discord où il a lancé l'Activité.
 */
export function Responsable({ mentions, langue }: { mentions: Mentions; langue: Langue }) {
  const t = dictionnaire(langue).mentions;
  return (
    <>
      <p>{mentions.editeur ? <Accentue texte={t.proposeePar(mentions.editeur)} /> : t.proposeeParLeServeur}</p>
      <p>{mentions.contact ? <Accentue texte={t.contact(mentions.contact)} /> : t.contactLeServeur}</p>
    </>
  );
}
