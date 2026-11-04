import type { Metadata } from "next";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { inscriptionsOuvertes } from "@/lib/parametres";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  await redirectIfAuthenticated();
  return <LoginForm inscriptionOuverte={inscriptionsOuvertes()} />;
}
