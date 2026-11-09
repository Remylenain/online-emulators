"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/session";
import { Avatar } from "./avatar";
import { ChoixLangue, useT } from "./langue";

/**
 * Le menu de la personne connectée, derrière son avatar.
 *
 * Tout ce qui la concerne est rangé là — ses jeux, son compte,
 * l'administration si elle y a droit, la langue de l'interface, la
 * déconnexion — pour que l'en-tête ne s'étale pas, surtout sur un téléphone
 * où ces liens se repliaient sur deux lignes.
 */
export function MenuCompte({ user }: { user: SessionUser }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const chemin = usePathname();
  const t = useT();

  // Fermé dès qu'on navigue, et dès qu'on clique ailleurs.
  useEffect(() => setOuvert(false), [chemin]);
  useEffect(() => {
    if (!ouvert) return;
    function dehors(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    }
    function echappe(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echappe);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echappe);
    };
  }, [ouvert]);

  const entree =
    "block rounded-md px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-50";

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-200 transition-colors hover:bg-ink-800"
      >
        <Avatar user={user} size={28} />
        <span className="hidden sm:inline">{user.pseudo}</span>
        <span aria-hidden className="hidden text-[10px] text-ink-700 sm:inline">
          ▼
        </span>
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-0.5 rounded-panel border border-ink-800 bg-ink-900 p-1.5 shadow-lg shadow-black/40"
        >
          <span className="truncate px-3 py-1.5 text-xs text-ink-700">{user.pseudo}</span>
          <Link href="/mes-jeux" role="menuitem" className={entree}>
            {t.site.navigation.mesJeux}
          </Link>
          <Link href="/compte" role="menuitem" className={entree}>
            {t.site.menu.monCompte}
          </Link>
          {/* Visible aux seuls administrateurs — la page vérifie de son côté,
              l'affichage n'est pas un contrôle d'accès. */}
          {user.role === "ADMIN" && (
            <Link href="/admin" role="menuitem" className={entree}>
              {t.site.menu.administration}
            </Link>
          )}
          {/* La langue de l'interface : une ligne discrète, sous les liens. Le
              sélecteur porte lui-même son nom pour les lecteurs d'écran. */}
          <div className="flex items-center justify-between gap-3 border-t border-ink-800 py-1.5 pr-1.5 pl-3 text-xs text-ink-400">
            <span aria-hidden>{t.commun.langue}</span>
            <ChoixLangue />
          </div>
          <form action={logout} className="border-t border-ink-800 pt-1">
            <button type="submit" role="menuitem" className={`w-full text-left ${entree} text-ink-400`}>
              {t.site.menu.deconnexion}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
