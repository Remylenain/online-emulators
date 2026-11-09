import type { ReactNode } from "react";
import { MISE_A_JOUR, type Mentions } from "@/lib/discord/mentions";

/**
 * La mise en page des deux textes légaux d'une Activité : une colonne de
 * lecture, sans rien du site autour — ni en-tête, ni lien vers lui.
 */
export function PageMentions({
  titre,
  mentions,
  autre,
  children,
}: {
  titre: string;
  mentions: Mentions;
  /** L'autre page légale, liée en bas de celle-ci. */
  autre: { href: string; libelle: string };
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 text-[0.95rem] leading-relaxed text-ink-200 [&_a]:text-accent-400 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-50 [&_li]:mt-1.5 [&_section]:flex [&_section]:flex-col [&_section]:gap-2 [&_strong]:font-semibold [&_strong]:text-ink-50 [&_ul]:list-disc [&_ul]:pl-5">
      <header className="flex flex-col gap-1 border-b border-ink-800 pb-5">
        <h1 className="text-2xl font-semibold text-ink-50">{titre}</h1>
        <p className="text-sm text-ink-400">
          Activité Discord « {mentions.jeu} » · mise à jour le {MISE_A_JOUR}
        </p>
      </header>
      {children}
      <footer className="border-t border-ink-800 pt-5 text-sm text-ink-400">
        Voir aussi : <a href={autre.href}>{autre.libelle}</a>.
      </footer>
    </main>
  );
}

/**
 * Qui propose l'Activité et comment le joindre. Tant que l'administrateur n'a
 * rien saisi, la page renvoie à ceux que le joueur sait déjà trouver : les
 * responsables du serveur Discord où il a lancé l'Activité.
 */
export function Responsable({ mentions }: { mentions: Mentions }) {
  return (
    <>
      <p>
        {mentions.editeur ? (
          <>
            L&apos;Activité est proposée par <strong>{mentions.editeur}</strong>.
          </>
        ) : (
          <>L&apos;Activité est proposée par les responsables du serveur Discord où tu l&apos;as lancée.</>
        )}
      </p>
      <p>
        {mentions.contact ? (
          <>
            Pour toute question ou demande : <strong>{mentions.contact}</strong>.
          </>
        ) : (
          <>
            Pour toute question ou demande, adresse-toi aux responsables du serveur Discord où tu as lancé
            l&apos;Activité.
          </>
        )}
      </p>
    </>
  );
}
