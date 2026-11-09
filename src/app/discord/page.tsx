import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Activite } from "@/components/discord/activite";
import { FournisseurLangue } from "@/components/langue";
import { configPourHote, hoteDeLaRequete } from "@/lib/discord/applications";
import { discordEssaiLocal } from "@/lib/env";

/**
 * Rien du site dans l'en-tête de cette page : ni son nom, ni sa description,
 * ni son manifeste. Elle s'affiche chez des joueurs qui ne connaissent que
 * l'Activité, à travers le proxy de Discord ; ce qui l'héberge ne les regarde
 * pas, et n'a pas à se lire dans le code source de la page.
 */
export const metadata: Metadata = {
  title: { absolute: "Activité" },
  description: null,
  manifest: null,
  icons: null,
  appleWebApp: null,
};

/**
 * La page que Discord ouvre dans son iframe : l'Activité.
 *
 * Elle ne sait rien du visiteur à ce stade — pas de cookie dans une iframe
 * tierce. Tout se passe ensuite dans le navigateur : le SDK de Discord
 * identifie l'utilisateur, puis la page demande sa session à
 * `/api/discord/session`.
 *
 * L'application qui répond est celle de l'hôte demandé (voir
 * `src/lib/discord/applications.ts`). Son identifiant part vers la page à
 * chaque requête ; il n'est écrit nulle part dans le dépôt.
 */
export default async function PageDiscord() {
  // Les réglages se lisent à la requête, pas à la construction du site.
  const application = configPourHote(hoteDeLaRequete(await headers()));
  if (!application) notFound();

  /*
   * En français, quel que soit le navigateur : les écrans propres à
   * l'Activité ne sont pas encore traduits, alors que les panneaux qu'elle
   * partage avec le lecteur du site le sont. Sans ce fournisseur, un joueur
   * anglophone verrait les deux langues mêlées.
   */
  return (
    <FournisseurLangue langue="fr">
      <div lang="fr">
        <Activite clientId={application.clientId} essaiLocal={discordEssaiLocal} />
      </div>
    </FournisseurLangue>
  );
}
