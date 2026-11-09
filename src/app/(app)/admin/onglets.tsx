"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/langue";

/** `onglet` : le nom du libellé dans `t.adminGeneral.onglets`. */
const ONGLETS = [
  { href: "/admin/tableau", onglet: "tableau" },
  { href: "/admin/comptes", onglet: "comptes" },
  { href: "/admin/bibliotheque", onglet: "bibliotheque" },
  { href: "/admin/temps", onglet: "temps" },
  { href: "/admin/reglages", onglet: "reglages" },
  { href: "/admin/discord", onglet: "discord" },
] as const;

/**
 * Navigation entre les deux pages d'administration.
 *
 * Composant client pour le seul besoin de `usePathname` : savoir quel onglet
 * marquer comme courant.
 *
 * À cinq, les onglets ne tiennent plus sur la largeur d'un téléphone : la
 * barre défile sur elle-même au lieu d'élargir la page entière. Le filet du
 * bas est une ombre et non une bordure, parce qu'un conteneur qui défile
 * rogne ce qui dépasse — le soulignement de l'onglet courant ne peut plus
 * venir recouvrir une bordure par une marge négative.
 */
export function OngletsAdmin() {
  const chemin = usePathname();
  const t = useT().adminGeneral;

  return (
    <nav
      className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-ink-800)] [scrollbar-width:none]"
      aria-label={t.coquille.titre}
    >
      {ONGLETS.map((onglet) => {
        const actif = chemin.startsWith(onglet.href);
        return (
          <Link
            key={onglet.href}
            href={onglet.href}
            aria-current={actif ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 ${
              actif
                ? "border-accent-500 text-ink-50"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            {t.onglets[onglet.onglet]}
          </Link>
        );
      })}
    </nav>
  );
}
