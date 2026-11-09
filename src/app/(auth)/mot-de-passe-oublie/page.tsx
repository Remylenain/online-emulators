import type { Metadata } from "next";
import { configCaptcha, mailActif } from "@/lib/parametres";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { ForgotPasswordForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await textes();
  return { title: t.connexion.oubli.titre };
}

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();
  // La clé publique du captcha est la seule valeur de configuration qui a le
  // droit de descendre jusqu'au navigateur.
  return <ForgotPasswordForm siteKey={configCaptcha().siteKey} mailActif={mailActif()} />;
}
