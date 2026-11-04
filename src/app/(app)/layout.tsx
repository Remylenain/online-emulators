import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guard";
import { BandeauVoirComme } from "@/components/bandeau-voir-comme";
import { BarreBasse } from "@/components/barre-basse";
import { SiteHeader } from "@/components/site-header";

/**
 * Coquille des pages privées. `requireUser()` est ici plutôt que répété dans
 * chaque page : toute route de ce groupe est réservée aux comptes connectés.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      {user.vuPar && <BandeauVoirComme user={user} />}
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      {/* Marge basse sur téléphone : la barre de navigation fixe ne doit pas
          recouvrir la fin de la page. */}
      <footer className="border-t border-ink-800 px-5 py-6 pb-20 text-center text-xs text-ink-700 sm:pb-6">
        Bibliothèque privée. Les sauvegardes sont attachées à ton compte.
      </footer>
      <BarreBasse />
    </div>
  );
}
