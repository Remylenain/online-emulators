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
  definirClePublique,
  definirRoles,
  hoteDejaPris,
  hoteDuSite,
  hoteNormalise,
  interactionsParId,
  modifierApplication,
  supprimerApplication,
  supprimerAstuce,
} from "@/lib/discord/applications";
import {
  branchement,
  commandeDEntree,
  creerCommandeTapee,
  declarerAdresseInteractions,
  DESCRIPTION_COMMANDE_MAX,
  FORME_NOM_COMMANDE,
  renommerCommandeDEntree,
  supprimerCommande,
  type Refus as RefusCommande,
} from "@/lib/discord/commande";
import { essayerApplication, type EssaiApplication } from "@/lib/discord/essai";
import { invitationDuBot, ROLES_MAX, rolesDuServeur, type RoleDiscord } from "@/lib/discord/roles";
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
      // Lever le verrou retire aussi le jeton, s'il ne servait qu'à lui : la
      // commande tapée en a besoin pour se renommer et se défaire.
      ...(botToken ? { botToken } : guildId || interactionsParId(id)?.clePublique ? {} : { botToken: "" }),
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

/** Ce que l'écran de choix des rôles reçoit de Discord. */
export type RolesDiscord =
  | { ok: true; roles: RoleDiscord[]; choisis: string[] }
  | {
      ok: false;
      message: string;
      /** Quand il ne manque que le bot dans le serveur : l'adresse qui l'y invite. */
      invitation?: string;
    };

/**
 * Les rôles du serveur du verrou, lus à l'instant auprès de Discord, pour les
 * choisir par leur nom. Seuls leurs identifiants sont enregistrés.
 */
export async function rolesDiscord(id: string): Promise<RolesDiscord> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const application = configParId(id);
  if (!application) return { ok: false, message: t.applicationDisparue };
  if (!application.guildId || !application.botToken) return { ok: false, message: t.rolesSansVerrou };

  const lus = await rolesDuServeur({ jetonBot: application.botToken, serveur: application.guildId });
  if (lus.ok) return { ok: true, roles: lus.roles, choisis: application.roles };
  if (lus.motif === "bot-absent") {
    return {
      ok: false,
      message: t.rolesBotAbsent,
      invitation: invitationDuBot(application.clientId, application.guildId),
    };
  }
  return { ok: false, message: lus.motif === "jeton-refuse" ? t.rolesJetonRefuse : t.rolesInjoignable };
}

/** Réserve l'Activité à ces rôles ; aucun : tous les membres du serveur. */
export async function definirRolesDiscord(id: string, roles: string[]): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const application = configParId(id);
  if (!application) return { ok: false, message: t.applicationDisparue };
  if (!application.guildId || !application.botToken) return { ok: false, message: t.rolesSansVerrou };
  if (!Array.isArray(roles) || roles.length > ROLES_MAX || roles.some((role) => typeof role !== "string" || !FORME_IDENTIFIANT.test(role))) {
    return { ok: false, message: t.rolesInvalides };
  }
  const uniques = [...new Set(roles)];
  definirRoles(id, uniques);
  revalidatePath("/admin/discord");
  return { ok: true, message: uniques.length > 0 ? t.rolesReserves(uniques.length) : t.rolesOuverts };
}

/**
 * Où en est la commande tapée : branchée sur le site, pas encore, ou hors de
 * portée — sans jeton de bot, Discord ne laisse pas la brancher.
 */
export type EtatCommandeTapee = "active" | "inactive" | "sans-jeton";

/** Ce que l'écran de la commande de lancement reçoit de Discord. */
export type CommandeDiscord =
  | {
      ok: true;
      nom: string;
      description: string;
      /** Des noms traduits masquent encore ce nom. */
      traduite: boolean;
      tapee: EtatCommandeTapee;
    }
  | { ok: false; message: string };

/**
 * L'adresse où Discord envoie ses interactions pour cette application : sur
 * son propre hôte, celui par lequel ses joueurs l'atteignent déjà.
 */
function adresseDesInteractions(hote: string): string {
  return `https://${hote}/api/discord/interactions`;
}

function refusDeCommande(
  refus: RefusCommande,
  t: Awaited<ReturnType<typeof textes>>["adminDiscord"]["actions"],
): { ok: false; message: string } {
  switch (refus.motif) {
    case "identifiants-refuses":
      return { ok: false, message: t.commandeIdentifiants };
    case "sans-commande":
      return { ok: false, message: t.commandeAbsente };
    case "refusee":
      return { ok: false, message: t.commandeRefusee(refus.detail) };
    case "adresse-refusee":
      return { ok: false, message: t.commandeTapeeAdresseRefusee(refus.detail) };
    default:
      return { ok: false, message: t.commandeInjoignable };
  }
}

/** La commande qui lance l'Activité, telle que Discord la connaît à l'instant. */
export async function commandeDiscord(id: string): Promise<CommandeDiscord> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const application = configParId(id);
  if (!application) return { ok: false, message: t.applicationDisparue };
  const lue = await commandeDEntree({
    application: application.clientId,
    secret: application.clientSecret,
    jetonBot: application.botToken,
  });
  if (!lue.ok) return refusDeCommande(lue, t);

  let tapee: EtatCommandeTapee = "sans-jeton";
  const enregistre = interactionsParId(id);
  if (application.botToken && enregistre) {
    const chezDiscord = await branchement(application.botToken);
    if (!chezDiscord.ok) return refusDeCommande(chezDiscord, t);
    // Les trois à la fois, sans quoi taper la commande ne mène nulle part :
    // Discord envoie ici, le site sait vérifier, et la commande existe.
    tapee =
      chezDiscord.adresseInteractions === adresseDesInteractions(enregistre.hote) &&
      enregistre.clePublique === chezDiscord.clePublique.toLowerCase() &&
      lue.tapees.length > 0
        ? "active"
        : "inactive";
  }
  return {
    ok: true,
    nom: lue.commande.nom,
    description: lue.commande.description,
    traduite: lue.commande.traduite,
    tapee,
  };
}

/** Renomme la commande qui lance l'Activité : `/prism` au lieu de `/launch`. */
export async function renommerCommandeDiscord(id: string, nom: string, description: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const application = configParId(id);
  if (!application) return { ok: false, message: t.applicationDisparue };
  // Une barre oblique tapée par habitude ne fait pas partie du nom.
  const propre = String(nom).trim().replace(/^\//, "");
  const phrase = String(description).trim().replace(/\s+/g, " ");
  if (!FORME_NOM_COMMANDE.test(propre)) return { ok: false, message: t.commandeNomInvalide };
  if (phrase.length < 1 || phrase.length > DESCRIPTION_COMMANDE_MAX) {
    return { ok: false, message: t.commandeDescriptionInvalide(DESCRIPTION_COMMANDE_MAX) };
  }
  const faite = await renommerCommandeDEntree(
    { application: application.clientId, secret: application.clientSecret, jetonBot: application.botToken },
    propre,
    phrase,
  );
  return faite.ok ? { ok: true, message: t.commandeRenommee(faite.commande.nom) } : refusDeCommande(faite, t);
}

/**
 * Fait de la commande de lancement une commande qui se tape : `/prism` dans
 * un salon, comme `/wordle`.
 *
 * Trois gestes, dans cet ordre, parce que Discord essaie l'adresse au moment
 * où on la lui déclare : retenir la clé de l'application, déclarer l'adresse,
 * créer la commande. Une application dont un bot traite déjà les commandes
 * est laissée telle quelle — lui déclarer une adresse détournerait vers le
 * site tout ce que ce bot reçoit.
 */
export async function activerCommandeTapee(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const application = configParId(id);
  const enregistre = interactionsParId(id);
  if (!application || !enregistre) return { ok: false, message: t.applicationDisparue };
  if (!application.botToken) return { ok: false, message: t.commandeTapeeSansJeton };
  const acces = { application: application.clientId, secret: application.clientSecret, jetonBot: application.botToken };

  const commandes = await commandeDEntree(acces);
  if (!commandes.ok) return refusDeCommande(commandes, t);
  const chezDiscord = await branchement(application.botToken);
  if (!chezDiscord.ok) return refusDeCommande(chezDiscord, t);

  const adresse = adresseDesInteractions(enregistre.hote);
  const dejaIci = chezDiscord.adresseInteractions === adresse;
  if (chezDiscord.adresseInteractions && !dejaIci) return { ok: false, message: t.commandeTapeeAdressePrise };
  if (!dejaIci && commandes.autres > 0) return { ok: false, message: t.commandeTapeeAutresCommandes(commandes.autres) };

  definirClePublique(id, chezDiscord.clePublique);
  if (!dejaIci) {
    const declaree = await declarerAdresseInteractions(application.botToken, adresse);
    if (!declaree.ok) {
      // Comme avant : sans adresse déclarée, cette clé ne vérifierait rien.
      definirClePublique(id, enregistre.clePublique);
      return declaree.motif === "adresse-refusee"
        ? { ok: false, message: t.commandeTapeeAdresseRefusee(declaree.detail, adresse) }
        : refusDeCommande(declaree, t);
    }
  }
  if (commandes.tapees.length === 0) {
    const creee = await creerCommandeTapee(acces, commandes.commande.nom, commandes.commande.description);
    if (!creee.ok) return refusDeCommande(creee, t);
  }
  revalidatePath("/admin/discord");
  return { ok: true, message: t.commandeTapeeActivee(commandes.commande.nom) };
}

/**
 * Défait ce que `activerCommandeTapee` a fait, dans l'ordre inverse. La
 * commande d'entrée, celle du lanceur, n'est pas touchée.
 */
export async function desactiverCommandeTapee(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminDiscord.actions;
  const application = configParId(id);
  const enregistre = interactionsParId(id);
  if (!application || !enregistre) return { ok: false, message: t.applicationDisparue };
  if (!application.botToken) return { ok: false, message: t.commandeTapeeSansJeton };
  const acces = { application: application.clientId, secret: application.clientSecret, jetonBot: application.botToken };

  const chezDiscord = await branchement(application.botToken);
  if (!chezDiscord.ok) return refusDeCommande(chezDiscord, t);
  // Rien n'est retiré chez Discord si ses interactions ne viennent pas ici :
  // ces commandes-là seraient celles d'un autre.
  if (chezDiscord.adresseInteractions === adresseDesInteractions(enregistre.hote)) {
    const commandes = await commandeDEntree(acces);
    if (!commandes.ok) return refusDeCommande(commandes, t);
    for (const commande of commandes.tapees) {
      const retiree = await supprimerCommande(acces, commande.id);
      if (!retiree.ok) return refusDeCommande(retiree, t);
    }
    const oubliee = await declarerAdresseInteractions(application.botToken, null);
    if (!oubliee.ok) return refusDeCommande(oubliee, t);
  }
  definirClePublique(id, "");
  revalidatePath("/admin/discord");
  return { ok: true, message: t.commandeTapeeDesactivee };
}
