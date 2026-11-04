import type { Metadata } from "next";
import { env, mailEnabled } from "@/lib/env";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();
  // La clé publique du captcha est la seule valeur d'environnement qui a le
  // droit de descendre jusqu'au navigateur.
  return <ForgotPasswordForm siteKey={env.TURNSTILE_SITE_KEY} mailActif={mailEnabled} />;
}
