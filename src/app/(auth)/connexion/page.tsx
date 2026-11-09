import type { Metadata } from "next";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { inscriptionsOuvertes } from "@/lib/parametres";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await textes();
  return { title: t.connexion.entree.titre };
}

export default async function LoginPage() {
  await redirectIfAuthenticated();
  return <LoginForm inscriptionOuverte={inscriptionsOuvertes()} />;
}
