import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Panel } from "@/components/ui";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Mot de passe" };

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
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">Lien incomplet</h1>
          <Alert>
            Ce lien ne contient pas de jeton de réinitialisation. Il a peut-être été
            tronqué par ton client mail : copie-le en entier, ou demande-en un nouveau.
          </Alert>
          <Link
            href="/mot-de-passe-oublie"
            className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </Panel>
    );
  }

  return <ResetPasswordForm token={token} invitation={invitation} />;
}
