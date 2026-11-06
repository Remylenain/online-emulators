"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/admin/tableau", libelle: "Tableau de bord" },
  { href: "/admin/comptes", libelle: "Comptes" },
  { href: "/admin/bibliotheque", libelle: "Bibliothèque" },
  { href: "/admin/temps", libelle: "Temps de jeu" },
  { href: "/admin/reglages", libelle: "Réglages" },
  { href: "/admin/discord", libelle: "Discord" },
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

  return (
    <nav
      className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-ink-800)] [scrollbar-width:none]"
      aria-label="Administration"
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
            {onglet.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
