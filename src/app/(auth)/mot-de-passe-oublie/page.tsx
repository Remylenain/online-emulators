import type { Metadata } from "next";
import { configCaptcha, mailActif } from "@/lib/parametres";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();
  // La clé publique du captcha est la seule valeur de configuration qui a le
  // droit de descendre jusqu'au navigateur.
  return <ForgotPasswordForm siteKey={configCaptcha().siteKey} mailActif={mailActif()} />;
}
