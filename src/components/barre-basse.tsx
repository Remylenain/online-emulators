"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONSOLES } from "@/lib/consoles";

/**
 * Barre de navigation du bas, sur téléphone seulement : l'accueil, les trois
 * consoles, et « Mes jeux ». Comme dans une application, le pouce y arrive
 * sans effort.
 *
 * Elle disparaît pendant une partie et dans un salon : l'écran y est pris
 * par la console, et une barre fixe gênerait la manette tactile.
 */
export function BarreBasse() {
  const chemin = usePathname();
  if (chemin.startsWith("/jouer/") || chemin.startsWith("/link/")) return null;

  const entrees = [
    { href: "/", libelle: "Accueil", actif: chemin === "/" },
    ...CONSOLES.map((console) => ({
      href: `/consoles/${console.slug}`,
      libelle: console.shortName,
      actif:
        chemin.startsWith(`/consoles/${console.slug}`) ||
        chemin.startsWith(`/jeux/${console.slug}/`),
    })),
    { href: "/mes-jeux", libelle: "Mes jeux", actif: chemin.startsWith("/mes-jeux") },
  ];

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-800 bg-ink-900/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {entrees.map((entree) => (
          <li key={entree.href} className="flex-1">
            <Link
              href={entree.href}
              aria-current={entree.actif ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors ${
                entree.actif ? "text-accent-400" : "text-ink-400 hover:text-ink-50"
              }`}
            >
              <span
                aria-hidden
                className={`h-0.5 w-6 rounded-full ${entree.actif ? "bg-accent-500" : "bg-transparent"}`}
              />
              {entree.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
