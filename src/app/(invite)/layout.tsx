import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { nomDuSite } from "@/lib/parametres";
import { vitrineOuverte } from "@/lib/vitrine";

// La vitrine s'allume et s'éteint dans les réglages : jamais de page figée à
// la construction du site.
export const dynamic = "force-dynamic";

/**
 * Coquille de la vitrine : ce qu'un visiteur sans compte voit du site quand
 * l'administrateur l'a ouverte (`src/lib/vitrine.ts`). Éteinte, ces pages
 * renvoient à la connexion, comme le reste du site.
 *
 * Des liens ordinaires et non des `<Link>` : le lecteur exige un document
 * isolé (COOP/COEP), ce qu'une navigation côté client ne donne pas — on y
 * arriverait avec le document de l'accueil, servi sans ces en-têtes.
 */
export default function InviteLayout({ children }: { children: ReactNode }) {
  if (!vitrineOuverte()) redirect("/connexion");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink-800 bg-ink-900/50">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-x-6 px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="font-semibold tracking-tight text-ink-50">
            {nomDuSite()}
          </a>
          <a
            href="/connexion"
            className="ml-auto rounded-md px-2.5 py-1.5 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50"
          >
            Se connecter
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      <footer className="border-t border-ink-800 px-5 py-6 text-center text-xs text-ink-700">
        Sans compte, ta partie reste dans ce navigateur : télécharge ta sauvegarde pour la garder.
      </footer>
    </div>
  );
}
