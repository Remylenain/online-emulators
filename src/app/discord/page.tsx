import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Activite } from "@/components/discord/activite";
import { configPourHote, hoteDeLaRequete } from "@/lib/discord/applications";
import { discordEssaiLocal } from "@/lib/env";
import { textes } from "@/lib/i18n/serveur";

/**
 * Rien du site dans l'en-tête de cette page : ni son nom, ni sa description,
 * ni son manifeste. Elle s'affiche chez des joueurs qui ne connaissent que
 * l'Activité, à travers le proxy de Discord ; ce qui l'héberge ne les regarde
 * pas, et n'a pas à se lire dans le code source de la page.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: (await textes()).activite.titreOnglet },
    description: null,
    manifest: null,
    icons: null,
    appleWebApp: null,
  };
}

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
   * La langue est celle de la requête : celle du navigateur du joueur, ou la
   * langue par défaut du site. Pas de choix explicite ici — une iframe tierce
   * n'a pas de cookie, et l'Activité n'a pas de sélecteur. Les requêtes
   * qu'elle fait ensuite portent le même en-tête : les refus du serveur
   * arrivent donc dans la même langue que l'écran.
   */
  return <Activite clientId={application.clientId} essaiLocal={discordEssaiLocal} />;
}
