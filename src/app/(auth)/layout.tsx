import Link from "next/link";
import type { ReactNode } from "react";
import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { langueDeLaRequete } from "@/lib/i18n/serveur";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";
import { vitrineOuverte } from "@/lib/vitrine";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const langue = await langueDeLaRequete();
  const t = dictionnaire(langue);
  return (
    // `lang="fr"` : ces pages ne sont pas encore traduites, alors que la racine
    // annonce la langue du visiteur. Un lecteur d'écran doit lire du français.
    <div lang="fr" className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-ink-50">
          {nomDuSite()}
        </Link>
        <p className="max-w-sm text-sm text-ink-400">{descriptionDuSite()}</p>
      </header>

      <main className="w-full max-w-sm">{children}</main>

      {vitrineOuverte() ? (
        // La vitrine est ouverte : on peut jouer sans passer par ici. Un lien
        // ordinaire, parce que le lecteur exige un document chargé pour de bon.
        <footer className="text-xs text-ink-400">
          <a href="/accueil" lang={langue} className="underline-offset-4 hover:text-ink-200 hover:underline">
            {t.vitrine.jouerSansCompte}
          </a>
        </footer>
      ) : (
        <footer className="text-xs text-ink-700">Accès réservé aux comptes du site.</footer>
      )}
    </div>
  );
}
