import Link from "next/link";
import { CONSOLES } from "@/lib/consoles";
import type { SessionUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import { nomDuSite } from "@/lib/parametres";
import { MenuCompte } from "./menu-compte";
import { RechercheGlobale } from "./recherche-globale";

/**
 * Barre de navigation : accueil, une entrée par console, « Mes jeux », et le
 * menu de la personne connectée derrière son avatar.
 *
 * Sur téléphone, les consoles et « Mes jeux » passent dans la barre du bas
 * (`BarreBasse`) : ici ne restent que le nom du site et l'avatar.
 *
 * Les consoles viennent du module de définition plutôt que de la base : la
 * liste est fixe, et l'en-tête s'affiche sur toutes les pages — autant éviter
 * une requête à chaque rendu.
 */
export async function SiteHeader({ user }: { user: SessionUser }) {
  const t = (await textes()).site.navigation;
  const lien =
    "rounded-md px-2.5 py-1.5 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50";

  return (
    <header className="border-b border-ink-800 bg-ink-900/50">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-x-6 px-5 py-3">
        <Link href="/" className="font-semibold tracking-tight text-ink-50">
          {nomDuSite()}
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label={t.consoles}>
          {CONSOLES.map((console) => (
            <Link key={console.slug} href={`/consoles/${console.slug}`} className={lien}>
              {console.shortName}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <RechercheGlobale />
          <Link href="/mes-jeux" className={`hidden sm:inline-block ${lien}`}>
            {t.mesJeux}
          </Link>
          <MenuCompte user={user} />
        </div>
      </div>
    </header>
  );
}
