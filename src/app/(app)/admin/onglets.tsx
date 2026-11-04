"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/admin/comptes", libelle: "Comptes" },
  { href: "/admin/bibliotheque", libelle: "Bibliothèque" },
  { href: "/admin/temps", libelle: "Temps de jeu" },
  { href: "/admin/reglages", libelle: "Réglages" },
] as const;

/**
 * Navigation entre les deux pages d'administration.
 *
 * Composant client pour le seul besoin de `usePathname` : savoir quel onglet
 * marquer comme courant.
 */
export function OngletsAdmin() {
  const chemin = usePathname();

  return (
    <nav className="flex gap-1 border-b border-ink-800" aria-label="Administration">
      {ONGLETS.map((onglet) => {
        const actif = chemin.startsWith(onglet.href);
        return (
          <Link
            key={onglet.href}
            href={onglet.href}
            aria-current={actif ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
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
