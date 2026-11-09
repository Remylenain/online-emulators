import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Panel } from "@/components/ui";
import { redirectIfAuthenticated } from "@/lib/auth/guard";
import { apercuDemande } from "@/lib/auth/inscription-ouverte";
import { textes } from "@/lib/i18n/serveur";
import { inscriptionsOuvertes } from "@/lib/parametres";
import { ConfirmForm } from "./confirm-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await textes();
  return { title: t.connexion.confirmation.onglet };
}

/**
 * Dernière étape de l'inscription ouverte.
 *
 * La page ne crée rien : elle montre ce qui va être créé et attend un clic.
 * Les messageries ouvrent les liens des mails pour les vérifier, et un
 * compte créé par un robot de messagerie laisserait la personne sans
 * session, ni certitude de ce qui s'est passé.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await redirectIfAuthenticated();
  const { token } = await searchParams;
  const demande = token && inscriptionsOuvertes() ? apercuDemande(token) : null;

  if (!token || !demande) {
    const t = (await textes()).connexion.confirmation.lienInvalide;
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">{t.titre}</h1>
          <Alert>{t.explication}</Alert>
          <Link
            href="/inscription"
            className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
          >
            {t.refaire}
          </Link>
        </div>
      </Panel>
    );
  }

  return <ConfirmForm token={token} pseudo={demande.pseudo} email={demande.email} />;
}
