import Link from "next/link";
import type { ReactNode } from "react";
import { ChoixLangue } from "@/components/langue";
import { textes } from "@/lib/i18n/serveur";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";
import { vitrineOuverte } from "@/lib/vitrine";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await textes();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-ink-50">
          {nomDuSite()}
        </Link>
        <p className="max-w-sm text-sm text-ink-400">{descriptionDuSite()}</p>
      </header>

      <main className="w-full max-w-sm">{children}</main>

      <footer className="flex flex-col items-center gap-3 text-xs">
        {vitrineOuverte() ? (
          // La vitrine est ouverte : on peut jouer sans passer par ici. Un lien
          // ordinaire, parce que le lecteur exige un document chargé pour de bon.
          <a href="/accueil" className="text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline">
            {t.vitrine.jouerSansCompte}
          </a>
        ) : (
          <p className="text-ink-700">{t.connexion.accesReserve}</p>
        )}
        {/* Sous le reste, sans insister : ces écrans n'ont pas d'en-tête où le loger. */}
        <ChoixLangue />
      </footer>
    </div>
  );
}
