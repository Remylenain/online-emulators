"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import {
  ajouterAstuce,
  configParId,
  creerApplication,
  hoteDejaPris,
  hoteNormalise,
  modifierApplication,
  supprimerApplication,
  supprimerAstuce,
} from "@/lib/discord/applications";
import { essayerApplication, type EssaiApplication } from "@/lib/discord/essai";
import { LONGUEUR_MAX_ACCUEIL, LONGUEUR_MAX_ASTUCE } from "@/lib/discord/limites";
import { env } from "@/lib/env";
import type { Resultat } from "./actions";

/**
 * Les applications Discord, depuis l'administration.
 *
 * Même règle que les autres actions : `requireAdmin()` d'abord, parce qu'une
 * action reste une adresse que n'importe qui peut appeler.
 */

/** Un nom d'hôte : des étiquettes séparées par des points, ou `localhost`. */
const FORME_HOTE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const FORME_IDENTIFIANT = /^\d{17,20}$/;

export async function enregistrerApplication(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const id = String(donnees.get("id") ?? "").trim();
  const name = String(donnees.get("name") ?? "").trim();
  const host = hoteNormalise(String(donnees.get("host") ?? ""));
  const clientId = String(donnees.get("clientId") ?? "").trim();
  const clientSecret = String(donnees.get("clientSecret") ?? "").trim();
  const guildId = String(donnees.get("guildId") ?? "").trim();
  const botToken = String(donnees.get("botToken") ?? "").trim();
  const gameId = String(donnees.get("gameId") ?? "").trim();
  const welcome = String(donnees.get("welcome") ?? "").trim();

  if (name.length < 1 || name.length > 60) return { ok: false, message: "Le nom fait entre 1 et 60 caractères." };
  if (welcome.length > LONGUEUR_MAX_ACCUEIL) {
    return { ok: false, message: `Le mot d'accueil fait au plus ${LONGUEUR_MAX_ACCUEIL} caractères.` };
  }
  if (!FORME_HOTE.test(host)) {
    return { ok: false, message: "Le nom d'hôte est invalide : lettres, chiffres, tirets et points, sans schéma ni port." };
  }
  // Réserver l'hôte du site à une Activité fermerait le site entier : plus
  // de connexion, plus de catalogue, plus d'administration pour y revenir.
  if (host === hoteNormalise(new URL(env.PUBLIC_URL).host)) {
    return { ok: false, message: "C'est le nom d'hôte du site lui-même : une Activité demande un hôte à elle." };
  }
  if (!FORME_IDENTIFIANT.test(clientId)) {
    return { ok: false, message: "L'identifiant d'application est un nombre de 17 à 20 chiffres (Application ID)." };
  }
  if (guildId && !FORME_IDENTIFIANT.test(guildId)) {
    return { ok: false, message: "L'identifiant du serveur est un nombre de 17 à 20 chiffres." };
  }
  if ([clientSecret, botToken].some((valeur) => valeur.length > 200)) {
    return { ok: false, message: "Une des valeurs est trop longue." };
  }
  const jeu = db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).get();
  if (!jeu) return { ok: false, message: "Choisis le jeu que cette Activité sert." };
  if (hoteDejaPris(host, id || undefined)) {
    return { ok: false, message: "Une autre application a déjà ce nom d'hôte." };
  }

  if (!id) {
    if (!clientSecret) return { ok: false, message: "Le Client Secret est obligatoire (onglet OAuth2 du portail)." };
    if (guildId && !botToken) {
      return { ok: false, message: "Le verrou sur un serveur demande le jeton de bot (onglet Bot du portail)." };
    }
    creerApplication({ name, host, clientId, clientSecret, guildId, botToken, gameId, welcome });
  } else {
    const existante = configParId(id);
    if (!existante) return { ok: false, message: "Cette application n'existe plus." };
    if (guildId && !botToken && !existante.botToken) {
      return { ok: false, message: "Le verrou sur un serveur demande le jeton de bot (onglet Bot du portail)." };
    }
    modifierApplication(id, {
      name,
      host,
      clientId,
      ...(clientSecret ? { clientSecret } : {}),
      guildId,
      // Lever le verrou retire aussi le jeton : il ne servait qu'à lui.
      ...(botToken ? { botToken } : guildId ? {} : { botToken: "" }),
      gameId,
      welcome,
    });
  }
  revalidatePath("/admin/discord");
  return { ok: true, message: id ? "Application modifiée." : "Application enregistrée. Reste à régler le portail Discord et le nom d'hôte." };
}

export async function supprimerApplicationDiscord(id: string): Promise<Resultat> {
  await requireAdmin();
  supprimerApplication(id);
  revalidatePath("/admin/discord");
  return { ok: true, message: "Application supprimée. Les comptes nés de cette Activité restent." };
}

/** Une astuce de plus : mot du jour, conseil, rappel. L'accueil en tire une au hasard. */
export async function ajouterAstuceDiscord(appId: string, texte: string): Promise<Resultat> {
  await requireAdmin();
  const propre = texte.trim().replace(/\s+/g, " ");
  if (!propre) return { ok: false, message: "L'astuce est vide." };
  if (propre.length > LONGUEUR_MAX_ASTUCE) {
    return { ok: false, message: `Une astuce fait au plus ${LONGUEUR_MAX_ASTUCE} caractères.` };
  }
  if (!configParId(appId)) return { ok: false, message: "Cette application n'existe plus." };
  ajouterAstuce(appId, propre);
  revalidatePath("/admin/discord");
  return { ok: true, message: "Astuce ajoutée." };
}

export async function supprimerAstuceDiscord(id: string): Promise<Resultat> {
  await requireAdmin();
  if (!supprimerAstuce(id)) return { ok: false, message: "Cette astuce n'existe plus." };
  revalidatePath("/admin/discord");
  return { ok: true, message: "Astuce supprimée." };
}

/** Les réglages enregistrés, confrontés à Discord. */
export async function essayerApplicationDiscord(id: string): Promise<EssaiApplication | null> {
  await requireAdmin();
  const application = configParId(id);
  if (!application) return null;
  return essayerApplication(application);
}
