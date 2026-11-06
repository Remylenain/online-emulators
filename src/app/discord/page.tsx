import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Activite } from "@/components/discord/activite";
import { discordActive, discordEssaiLocal, env } from "@/lib/env";

export const metadata: Metadata = { title: "Discord" };

/**
 * La page que Discord ouvre dans son iframe : l'Activité.
 *
 * Elle ne sait rien du visiteur à ce stade — pas de cookie dans une iframe
 * tierce. Tout se passe ensuite dans le navigateur : le SDK de Discord
 * identifie l'utilisateur, puis la page demande sa session à
 * `/api/discord/session`.
 *
 * L'identifiant d'application vient de l'environnement et part vers la page
 * à chaque requête ; il n'est écrit nulle part dans le dépôt.
 */
export default async function PageDiscord() {
  // Les réglages se lisent à la requête, pas à la construction du site.
  await connection();
  if (!discordActive && !discordEssaiLocal) notFound();

  return (
    <Activite clientId={discordActive ? env.DISCORD_CLIENT_ID : ""} essaiLocal={discordEssaiLocal} />
  );
}
