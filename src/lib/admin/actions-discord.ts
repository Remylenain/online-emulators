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
  hoteDuSite,
  hoteNormalise,
  modifierApplication,
  supprimerApplication,
  supprimerAstuce,
} from "@/lib/discord/applications";
import { essayerApplication, type EssaiApplication } from "@/lib/discord/essai";
import {
  LONGUEUR_MAX_ACCUEIL,
  LONGUEUR_MAX_ASTUCE,
  LONGUEUR_MAX_CONTACT,
  LONGUEUR_MAX_EDITEUR,
} from "@/lib/discord/limites";
import { textes } from "@/lib/i18n/serveur";
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
  const t = (await textes()).adminDiscord.actions;
  const id = String(donnees.get("id") ?? "").trim();
  const name = String(donnees.get("name") ?? "").trim();
  const host = hoteNormalise(String(donnees.get("host") ?? ""));
  const clientId = String(donnees.get("clientId") ?? "").trim();
  const clientSecret = String(donnees.get("clientSecret") ?? "").trim();
  const guildId = String(donnees.get("guildId") ?? "").trim();
  const botToken = String(donnees.get("botToken") ?? "").trim();
  const gameId = String(donnees.get("gameId") ?? "").trim();
  const welcome = String(donnees.get("welcome") ?? "").trim();
  // Une ligne chacun : ils s'affichent dans une phrase des pages légales.
  const publisher = String(donnees.get("publisher") ?? "").trim().replace(/\s+/g, " ");
  const contact = String(donnees.get("contact") ?? "").trim().replace(/\s+/g, " ");

  if (name.length < 1 || name.length > 60) return { ok: false, message: t.nomInvalide };
  if (welcome.length > LONGUEUR_MAX_ACCUEIL) {
    return { ok: false, message: t.accueilTropLong(LONGUEUR_MAX_ACCUEIL) };
  }
  if (publisher.length > LONGUEUR_MAX_EDITEUR) {
    return { ok: false, message: t.editeurTropLong(LONGUEUR_MAX_EDITEUR) };
  }
  if (contact.length > LONGUEUR_MAX_CONTACT) {
    return { ok: false, message: t.contactTropLong(LONGUEUR_MAX_CONTACT) };
  }
  if (!FORME_HOTE.test(host)) {
    return { ok: false, message: t.hoteInvalide };
  }
  // L'hôte du site lui-même est accepté : l'Activité s'y ajoute sans le
  // réserver (voir `hotesDesActivites`), le site continue d'y répondre.
  if (!FORME_IDENTIFIANT.test(clientId)) {
    return { ok: false, message: t.identifiantInvalide };
  }
  if (guildId && !FORME_IDENTIFIANT.test(guildId)) {
    return { ok: false, message: t.serveurInvalide };
  }
  if ([clientSecret, botToken].some((valeur) => valeur.length > 200)) {
    return { ok: false, message: t.valeurTropLongue };
  }
  const jeu = db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).get();
  if (!jeu) return { ok: false, message: t.jeuManquant };
  if (hoteDejaPris(host, id || undefined)) {
    return { ok: false, message: t.hoteDejaPris };
  }

  if (!id) {
    if (!clientSecret) return { ok: false, message: t.secretObligatoire };
    if (guildId && !botToken) {
      return { ok: false, message: t.jetonObligatoire };
    }
    creerApplication({ name, host, clientId, clientSecret, guildId, botToken, gameId, welcome, publisher, contact });
  } else {
    const existante = configParId(id);
    if (!existante) return { ok: false, message: t.applicationDisparue };
    if (guildId && !botToken && !existante.botToken) {
      return { ok: false, message: t.jetonObligatoire };
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
      publisher,
      contact,
    });
  }
  revalidatePath("/admin/discord");
  if (id) return { ok: true, message: t.modifiee };
  return {
    ok: true,
    message: host === hoteDuSite() ? t.enregistreeSurLeSite : t.enregistree,
  };
}

export async function supprimerApplicationDiscord(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  supprimerApplication(id);
  revalidatePath("/admin/discord");
  return { ok: true, message: t.supprimee };
}

/** Une astuce de plus : mot du jour, conseil, rappel. L'accueil en tire une au hasard. */
export async function ajouterAstuceDiscord(appId: string, texte: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const propre = texte.trim().replace(/\s+/g, " ");
  if (!propre) return { ok: false, message: t.astuceVide };
  if (propre.length > LONGUEUR_MAX_ASTUCE) {
    return { ok: false, message: t.astuceTropLongue(LONGUEUR_MAX_ASTUCE) };
  }
  if (!configParId(appId)) return { ok: false, message: t.applicationDisparue };
  ajouterAstuce(appId, propre);
  revalidatePath("/admin/discord");
  return { ok: true, message: t.astuceAjoutee };
}

export async function supprimerAstuceDiscord(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  if (!supprimerAstuce(id)) return { ok: false, message: t.astuceDisparue };
  revalidatePath("/admin/discord");
  return { ok: true, message: t.astuceSupprimee };
}

/**
 * Les réglages enregistrés, confrontés à Discord.
 *
 * Le détail de chaque verdict est écrit par `src/lib/discord/essai.ts`, avec
 * les textes de `adminDiscord.essai.verdicts` : ceux de la langue de
 * l'administrateur qui lance l'essai.
 */
export async function essayerApplicationDiscord(id: string): Promise<EssaiApplication | null> {
  await requireAdmin();
  const application = configParId(id);
  if (!application) return null;
  return essayerApplication(application, (await textes()).adminDiscord.essai.verdicts);
}
