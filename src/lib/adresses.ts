import { env } from "@/lib/env";

/**
 * Les adresses du site.
 *
 * Une installation a une adresse principale (`PUBLIC_URL`) et, si elle le
 * veut, d'autres noms d'hôte relayés vers le même serveur :
 *
 * - des **adresses secondaires** (`PUBLIC_URL_SECONDAIRES`) : le site y répond
 *   tel quel, sans changer d'adresse dans la barre du navigateur — un second
 *   nom de domaine pour le même site ;
 * - des **adresses redirigées** (`PUBLIC_URL_REDIRIGEES`) : tout ce qui y
 *   arrive est renvoyé vers l'adresse principale, chemin compris — l'ancien
 *   nom d'un site qui en a changé, ou un domaine nu vers son sous-domaine.
 *
 * Rien d'autre du site ne dépend de son nom d'hôte : les pages se servent
 * sous n'importe lequel. Seuls comptent, ici, les liens qu'on envoie à
 * quelqu'un (invitation, confirmation, mot de passe) et le tri des hôtes
 * réservés à une Activité Discord. La session, elle, tient à l'adresse où
 * l'on s'est connecté : un cookie ne passe pas d'un domaine à l'autre.
 *
 * Chaque nom d'hôte demande son vhost et son certificat sur le serveur :
 * voir `docs/deploiement.md`.
 */

/** Un nom d'hôte comparable : minuscules, sans port. */
export function hoteNormalise(hote: string): string {
  const propre = hote.trim().toLowerCase();
  if (propre.startsWith("[")) return propre.slice(0, propre.indexOf("]") + 1);
  return propre.replace(/:\d+$/, "");
}

/** L'hôte demandé, tel que le proxy inverse le transmet. */
export function hoteDeLaRequete(entetes: { get(nom: string): string | null }): string {
  const transmis = entetes.get("x-forwarded-host")?.split(",")[0];
  return hoteNormalise(transmis || entetes.get("host") || "");
}

/** Une liste de l'environnement : des adresses ou des noms d'hôte, séparés par des virgules ou des espaces. */
function liste(valeur: string): string[] {
  return valeur
    .split(/[\s,]+/)
    .map((morceau) => hoteNormalise(morceau.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "")))
    .filter((hote) => hote.length > 0);
}

/** L'hôte principal du site, tel que l'installation le déclare (`PUBLIC_URL`). */
export function hoteDuSite(): string {
  return hoteNormalise(new URL(env.PUBLIC_URL).host);
}

export function hotesSecondaires(): string[] {
  const principal = hoteDuSite();
  return liste(env.PUBLIC_URL_SECONDAIRES).filter((hote) => hote !== principal);
}

/** Les hôtes renvoyés vers l'adresse principale. Une adresse du site n'en fait jamais partie. */
export function hotesRediriges(): string[] {
  const duSite = new Set([hoteDuSite(), ...hotesSecondaires()]);
  return liste(env.PUBLIC_URL_REDIRIGEES).filter((hote) => !duSite.has(hote));
}

/** Tous les hôtes sous lesquels le site lui-même répond : le principal, puis les secondaires. */
export function hotesDuSite(): string[] {
  return [hoteDuSite(), ...hotesSecondaires()];
}

/**
 * L'adresse à mettre dans un lien qu'on envoie à quelqu'un : celle où la
 * demande a été faite, si c'est une adresse du site — qui s'inscrit sur
 * l'adresse secondaire reçoit un lien vers elle —, sinon la principale.
 *
 * L'en-tête `Host` vient du visiteur : on ne s'en sert jamais tel quel pour
 * fabriquer une adresse, seulement pour choisir parmi celles que
 * l'installation déclare.
 */
export function adresseDuSite(entetes: { get(nom: string): string | null }): string {
  if (!hotesSecondaires().includes(hoteDeLaRequete(entetes))) return env.PUBLIC_URL;
  // L'hôte tel qu'il est demandé, port compris s'il y en a un (en développement).
  const demande = (entetes.get("x-forwarded-host")?.split(",")[0] || entetes.get("host") || "").trim().toLowerCase();
  if (!/^[a-z0-9.:[\]-]+$/.test(demande)) return env.PUBLIC_URL;
  return `${new URL(env.PUBLIC_URL).protocol}//${demande}`;
}
