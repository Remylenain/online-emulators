import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
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
};

/** La date de la dernière retouche des textes, la même pour les deux pages. */
export const MISE_A_JOUR = "9 novembre 2026";

export async function mentionsDeLaRequete(): Promise<Mentions> {
  // Lu à la requête : l'Activité dépend de l'hôte, pas de la construction du site.
  const mentions = mentionsPourHote(hoteDeLaRequete(await headers()));
  const jeu = mentions ? await jeuDeLActivite(mentions.gameId) : null;
  if (!mentions || !jeu) notFound();
  return { jeu: jeu.titre, editeur: mentions.editeur, contact: mentions.contact, verrou: mentions.verrou };
}

/** Comme la page de l'Activité : rien du site qui l'héberge dans l'en-tête. */
export function enTeteMentions(titre: string): Metadata {
  return { title: { absolute: titre }, description: null, manifest: null, icons: null, appleWebApp: null };
}

/** Un texte à lire, pas un écran de jeu : le zoom que le site bloque ailleurs revient ici. */
export const vueMentions: Viewport = { maximumScale: 5, userScalable: true };
