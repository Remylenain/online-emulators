import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { estLangue, REGION, type Langue } from "@/lib/i18n/langues";
import { langueDeLaRequete } from "@/lib/i18n/serveur";
import { hoteDeLaRequete, mentionsPourHote } from "./applications";
import { jeuDeLActivite } from "./jeu";

/**
 * Ce que les deux pages légales d'une Activité ont en commun : de quelle
 * Activité il s'agit — celle de l'hôte demandé —, et l'en-tête de la page.
 *
 * Discord demande ces deux adresses dans le portail (General Information)
 * avant de vérifier une application. Elles s'ouvrent dans un navigateur
 * ordinaire, hors de Discord.
 */
export type Mentions = {
  /** Le titre du jeu : ce que le joueur connaît de l'Activité. */
  jeu: string;
  /** Vides tant que l'administrateur ne les a pas saisis. */
  editeur: string;
  contact: string;
  verrou: boolean;
  /** L'Activité est réservée à certains rôles du serveur : la page dit ce qu'elle en lit. */
  roles: boolean;
  /** La commande se tape dans un salon : Discord signale alors au site qui la tape, et où. */
  commande: boolean;
};

/**
 * La date de la dernière retouche des textes, la même pour les deux pages et
 * pour toutes les langues : une traduction ne change pas ce que le texte dit.
 */
const MISE_A_JOUR = new Date(Date.UTC(2026, 10, 10));

export function miseAJour(langue: Langue): string {
  return new Intl.DateTimeFormat(REGION[langue], { dateStyle: "long", timeZone: "UTC" }).format(MISE_A_JOUR);
}

/**
 * La langue d'une page légale : `?lang=fr` ou `?lang=en` dans l'adresse, sinon
 * celle de la requête. Le paramètre donne à chaque langue une adresse fixe —
 * c'est celle qu'on colle dans le portail de Discord, où le relecteur n'a ni
 * le navigateur ni les préférences du joueur.
 */
export async function langueDesMentions(recherche: Promise<{ lang?: string | string[] }>): Promise<Langue> {
  const demandee = (await recherche).lang;
  const code = Array.isArray(demandee) ? demandee[0] : demandee;
  return estLangue(code) ? code : langueDeLaRequete();
}

export async function mentionsDeLaRequete(): Promise<Mentions> {
  // Lu à la requête : l'Activité dépend de l'hôte, pas de la construction du site.
  const mentions = mentionsPourHote(hoteDeLaRequete(await headers()));
  const jeu = mentions ? await jeuDeLActivite(mentions.gameId) : null;
  if (!mentions || !jeu) notFound();
  return {
    jeu: jeu.titre,
    editeur: mentions.editeur,
    contact: mentions.contact,
    verrou: mentions.verrou,
    roles: mentions.roles,
    commande: mentions.commande,
  };
}

/** Comme la page de l'Activité : rien du site qui l'héberge dans l'en-tête. */
export function enTeteMentions(titre: string): Metadata {
  return { title: { absolute: titre }, description: null, manifest: null, icons: null, appleWebApp: null };
}

/** Un texte à lire, pas un écran de jeu : le zoom que le site bloque ailleurs revient ici. */
export const vueMentions: Viewport = { maximumScale: 5, userScalable: true };
