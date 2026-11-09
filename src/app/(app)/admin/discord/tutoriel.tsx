"use client";

import { useState } from "react";
import { Accentue, useT } from "@/components/langue";
import { Button, Panel } from "@/components/ui";

/**
 * Un paragraphe du dictionnaire, avec sa mise en forme : le `code` entre
 * accents graves, l'emphase entre astérisques (rendue par `Accentue`). Les
 * couleurs viennent du conteneur (`[&_strong]`, `[&_code]`).
 *
 * Seuls des textes du dictionnaire y passent, avec des valeurs à la forme
 * contrôlée (nom d'hôte, identifiant) : jamais une saisie libre, dont un
 * astérisque déplacerait l'emphase.
 */
export function Prose({ texte }: { texte: string }) {
  return (
    <>
      {texte
        .split("`")
        .map((morceau, rang) =>
          rang % 2 === 1 ? <code key={rang}>{morceau}</code> : <Accentue key={rang} texte={morceau} />,
        )}
    </>
  );
}

/**
 * Le pas à pas complet, de zéro jusqu'à l'Activité qui se lance dans Discord.
 *
 * Il doit suffire à quelqu'un qui n'a jamais ouvert le portail développeur
 * de Discord. Les noms d'onglets sont ceux du portail à l'écriture (fin
 * 2026) ; Discord les déplace parfois, les notions restent.
 *
 * Le texte est dans le dictionnaire (`adminDiscord.tutoriel`), un paragraphe
 * par entrée ; ici, seulement l'ordre des sections et leur forme. Une copie
 * en Markdown vit dans `docs/discord/README.md` : les deux s'entretiennent
 * ensemble.
 */
export function Tutoriel({ ouvertAuDepart }: { ouvertAuDepart: boolean }) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  const t = useT().adminDiscord.tutoriel;

  // Dans l'ordre de lecture. `puces` : une liste de choses à avoir ou à
  // vérifier, pas des étapes à suivre dans l'ordre.
  const sections: { titre: string; intro?: string; points: readonly string[]; puces?: boolean }[] = [
    { ...t.avant, puces: true },
    t.creer,
    t.secret,
    t.bot,
    t.activer,
    t.declarer,
    t.hote,
    t.lancer,
    { ...t.depannage, puces: true },
    t.verification,
  ];

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-50">{t.titre}</h3>
          <p className="text-sm text-ink-400">{t.resume}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
          {ouvert ? t.replier : t.lire}
        </Button>
      </div>

      {ouvert && (
        <div className="flex flex-col gap-5 border-t border-ink-800 pt-4 text-sm text-ink-300 [&_code]:rounded [&_code]:bg-ink-950/80 [&_code]:px-1 [&_code]:text-ink-50 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-ink-100 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-ink-100 [&_ul]:list-disc [&_ul]:pl-5">
          {sections.map((section) => {
            const Liste = section.puces ? "ul" : "ol";
            return (
              <section key={section.titre}>
                <h4>{section.titre}</h4>
                {section.intro && (
                  <p>
                    <Prose texte={section.intro} />
                  </p>
                )}
                <Liste>
                  {section.points.map((point, rang) => (
                    <li key={rang}>
                      <Prose texte={point} />
                    </li>
                  ))}
                </Liste>
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
