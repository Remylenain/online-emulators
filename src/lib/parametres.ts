import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { captchaEnabled, mailEnabled } from "@/lib/env";

/**
 * Réglages du site que l'administrateur change depuis l'interface.
 *
 * Lus à chaque demande : ils tiennent dans une table minuscule, et un réglage
 * qui ne prend effet qu'au redémarrage ne serait pas un réglage.
 */

const INSCRIPTIONS_OUVERTES = "inscriptions_ouvertes";
const NOM_DU_SITE = "nom_du_site";
const DESCRIPTION_DU_SITE = "description_du_site";

export const NOM_PAR_DEFAUT = "Online Emulators";
export const DESCRIPTION_PAR_DEFAUT = "Bibliothèque privée de rom hacks et de traductions.";

export function lireParametre(cle: string): string | null {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, cle)).get()?.value ?? null;
}

export function ecrireParametre(cle: string, valeur: string): void {
  db.insert(settings)
    .values({ key: cle, value: valeur })
    .onConflictDoUpdate({ target: settings.key, set: { value: valeur, updatedAt: new Date() } })
    .run();
}

/**
 * Ouvrir les inscriptions suppose un serveur de mail — le compte n'existe
 * qu'une fois l'adresse confirmée — et un captcha, sans quoi le formulaire
 * serait une porte ouverte aux robots. Sans l'un des deux, elles restent
 * fermées quoi qu'en dise le réglage, et l'administration explique pourquoi.
 */
export const inscriptionsOuvrables = mailEnabled && captchaEnabled;

export function inscriptionsOuvertes(): boolean {
  return inscriptionsOuvrables && lireParametre(INSCRIPTIONS_OUVERTES) === "1";
}

export function definirInscriptionsOuvertes(ouvertes: boolean): void {
  ecrireParametre(INSCRIPTIONS_OUVERTES, ouvertes ? "1" : "0");
}

/** Le nom affiché partout : en-tête, onglets, page de connexion. */
export function nomDuSite(): string {
  return lireParametre(NOM_DU_SITE)?.trim() || NOM_PAR_DEFAUT;
}

export function descriptionDuSite(): string {
  return lireParametre(DESCRIPTION_DU_SITE)?.trim() || DESCRIPTION_PAR_DEFAUT;
}

export function definirIdentite(nom: string, description: string): void {
  ecrireParametre(NOM_DU_SITE, nom.trim());
  ecrireParametre(DESCRIPTION_DU_SITE, description.trim());
}
