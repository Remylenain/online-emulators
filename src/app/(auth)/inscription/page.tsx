import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Panel } from "@/components/ui";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { configCaptcha, inscriptionsOuvertes } from "@/lib/parametres";
import { OpenRegisterForm } from "./open-register-form";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Inscription" };

/**
 * Deux façons d'arriver ici : avec un jeton d'invitation dans l'adresse, ou
 * sans — et alors seulement si l'administrateur a ouvert les inscriptions.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await redirectIfAuthenticated();
  const { token } = await searchParams;

  // Comme pour la réinitialisation, le jeton n'est vérifié qu'à l'envoi du
  // formulaire, dans l'opération qui le consomme.
  if (token) return <RegisterForm token={token} />;

  // La clé publique du captcha est la seule valeur d'environnement qui a le
  // droit de descendre jusqu'au navigateur.
  if (inscriptionsOuvertes()) return <OpenRegisterForm siteKey={configCaptcha().siteKey} />;

  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-ink-50">Inscription sur invitation</h1>
        <Alert tone="info">
          Les comptes se créent sur invitation : il te faut un lien donné par l&apos;administrateur.
          Si tu en as reçu un et qu&apos;il semble tronqué, copie-le en entier.
        </Alert>
        <Link
          href="/connexion"
          className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
        >
          J&apos;ai déjà un compte
        </Link>
      </div>
    </Panel>
  );
}
