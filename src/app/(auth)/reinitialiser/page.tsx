import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Panel } from "@/components/ui";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { ResetPasswordForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await textes();
  return { title: t.connexion.reinitialisation.onglet };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; bienvenue?: string }>;
}) {
  await redirectIfAuthenticated();
  const { token, bienvenue } = await searchParams;

  /**
   * Le même formulaire sert à deux situations très différentes : reprendre la
   * main sur un compte qu'on a déjà, ou en ouvrir un pour la première fois.
   * Seuls les mots changent — parler de « réinitialisation » à quelqu'un qui
   * n'a jamais eu de mot de passe serait déroutant.
   */
  const invitation = bienvenue === "1";

  // Le jeton n'est pas vérifié ici : la validité se joue à la soumission, en
  // une seule opération qui le consomme. Vérifier d'abord puis consommer
  // ensuite laisserait une fenêtre où deux requêtes passeraient toutes les deux.
  if (!token) {
    const t = (await textes()).connexion.reinitialisation.lienIncomplet;
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">{t.titre}</h1>
          <Alert>{t.explication}</Alert>
          <Link
            href="/mot-de-passe-oublie"
            className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
          >
            {t.demander}
          </Link>
        </div>
      </Panel>
    );
  }

  return <ResetPasswordForm token={token} invitation={invitation} />;
}
