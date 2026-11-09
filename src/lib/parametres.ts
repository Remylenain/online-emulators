import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { env } from "@/lib/env";
import { estLangue, LANGUE_DE_REFERENCE, type Langue } from "@/lib/i18n/langues";

/**
 * Réglages du site que l'administrateur change depuis l'interface.
 *
 * Lus à chaque demande : ils tiennent dans une table minuscule, et un réglage
 * qui ne prend effet qu'au redémarrage ne serait pas un réglage.
 */

const INSCRIPTIONS_OUVERTES = "inscriptions_ouvertes";
const NOM_DU_SITE = "nom_du_site";
const DESCRIPTION_DU_SITE = "description_du_site";
const NOM_APPLICATION = "nom_application";

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

function effacerParametres(cles: string[]): void {
  for (const cle of cles) db.delete(settings).where(eq(settings.key, cle)).run();
}

/**
 * Le relais d'e-mails et le captcha.
 *
 * Deux endroits peuvent les fournir : les réglages de l'administration, ou
 * l'environnement du serveur. **Les réglages l'emportent dès qu'ils sont
 * renseignés**, en bloc — on ne mélange pas l'hôte de l'un et le mot de
 * passe de l'autre ; sinon c'est l'environnement, comme avant. Changer de
 * relais ne demande donc plus ni SSH ni redémarrage.
 *
 * Le mot de passe et la clé secrète sont rangés en clair dans la base, au
 * même titre qu'ils le seraient dans le fichier d'environnement : les deux
 * ne sont lisibles que par le compte du service. Ils ne redescendent jamais
 * vers le navigateur.
 */
const MAIL = {
  host: "smtp_host",
  port: "smtp_port",
  user: "smtp_user",
  password: "smtp_password",
  from: "mail_from",
} as const;

export type ConfigMail = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  /** D'où vient la configuration en vigueur. */
  source: "reglages" | "serveur" | "aucune";
};

export function configMail(): ConfigMail {
  const host = lireParametre(MAIL.host)?.trim() ?? "";
  if (host) {
    return {
      host,
      port: Number(lireParametre(MAIL.port)) || 587,
      user: lireParametre(MAIL.user) ?? "",
      password: lireParametre(MAIL.password) ?? "",
      from: lireParametre(MAIL.from) ?? "",
      source: "reglages",
    };
  }
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.MAIL_FROM,
    source: env.SMTP_HOST ? "serveur" : "aucune",
  };
}

/** Sans relais configuré, les e-mails sont écrits dans la console du serveur. */
export function mailActif(): boolean {
  return configMail().host.length > 0;
}

/** `password` omis : celui déjà enregistré est gardé. */
export function definirConfigMail(config: { host: string; port: number; user: string; password?: string; from: string }): void {
  ecrireParametre(MAIL.host, config.host.trim());
  ecrireParametre(MAIL.port, String(config.port));
  ecrireParametre(MAIL.user, config.user.trim());
  ecrireParametre(MAIL.from, config.from.trim());
  if (config.password !== undefined) ecrireParametre(MAIL.password, config.password);
}

export function effacerConfigMail(): void {
  effacerParametres(Object.values(MAIL));
}

const CAPTCHA = { site: "turnstile_site_key", secret: "turnstile_secret_key" } as const;

export type ConfigCaptcha = { siteKey: string; secretKey: string; source: "reglages" | "serveur" | "aucune" };

export function configCaptcha(): ConfigCaptcha {
  const secretKey = lireParametre(CAPTCHA.secret)?.trim() ?? "";
  if (secretKey) {
    return { siteKey: lireParametre(CAPTCHA.site)?.trim() ?? "", secretKey, source: "reglages" };
  }
  return {
    siteKey: env.TURNSTILE_SITE_KEY,
    secretKey: env.TURNSTILE_SECRET_KEY,
    source: env.TURNSTILE_SECRET_KEY ? "serveur" : "aucune",
  };
}

/** Le captcha est contourné tant qu'aucune clé secrète n'est fournie. */
export function captchaActif(): boolean {
  return configCaptcha().secretKey.length > 0;
}

export function definirConfigCaptcha(siteKey: string, secretKey?: string): void {
  ecrireParametre(CAPTCHA.site, siteKey.trim());
  if (secretKey !== undefined) ecrireParametre(CAPTCHA.secret, secretKey.trim());
}

export function effacerConfigCaptcha(): void {
  effacerParametres(Object.values(CAPTCHA));
}

/**
 * Le compte ScreenScraper, pour compléter les fiches des jeux officiels
 * (voir `scripts/scraper.ts`, qui lit ces mêmes clés). L'API demande deux
 * paires d'identifiants : celle du logiciel (« développeur », délivrée sur
 * demande par ScreenScraper) et celle du membre, qui relève son quota.
 */
const SCRAPER = { devId: "ss_devid", devPassword: "ss_devpassword", ssId: "ss_id", ssPassword: "ss_password" } as const;

export type ConfigScraper = { devId: string; devPassword: string; ssId: string; ssPassword: string };

export function configScraper(): ConfigScraper {
  return {
    devId: lireParametre(SCRAPER.devId)?.trim() ?? "",
    devPassword: lireParametre(SCRAPER.devPassword) ?? "",
    ssId: lireParametre(SCRAPER.ssId)?.trim() ?? "",
    ssPassword: lireParametre(SCRAPER.ssPassword) ?? "",
  };
}

/** Un mot de passe omis garde celui déjà enregistré. */
export function definirConfigScraper(config: { devId: string; devPassword?: string; ssId: string; ssPassword?: string }): void {
  ecrireParametre(SCRAPER.devId, config.devId.trim());
  ecrireParametre(SCRAPER.ssId, config.ssId.trim());
  if (config.devPassword !== undefined) ecrireParametre(SCRAPER.devPassword, config.devPassword);
  if (config.ssPassword !== undefined) ecrireParametre(SCRAPER.ssPassword, config.ssPassword);
}

export function effacerConfigScraper(): void {
  effacerParametres(Object.values(SCRAPER));
}

/**
 * Ouvrir les inscriptions suppose un serveur de mail — le compte n'existe
 * qu'une fois l'adresse confirmée — et un captcha, sans quoi le formulaire
 * serait une porte ouverte aux robots. Sans l'un des deux, elles restent
 * fermées quoi qu'en dise le réglage, et l'administration explique pourquoi.
 */
export function inscriptionsOuvrables(): boolean {
  return mailActif() && captchaActif();
}

export function inscriptionsOuvertes(): boolean {
  return inscriptionsOuvrables() && lireParametre(INSCRIPTIONS_OUVERTES) === "1";
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

/**
 * Le nom de l'application une fois installée sur un téléphone (sous l'icône,
 * dans le manifeste). Facultatif : à défaut, c'est le nom du site.
 */
export function nomApplication(): string {
  return lireParametre(NOM_APPLICATION)?.trim() || nomDuSite();
}

export function definirIdentite(nom: string, description: string, application = ""): void {
  ecrireParametre(NOM_DU_SITE, nom.trim());
  ecrireParametre(DESCRIPTION_DU_SITE, description.trim());
  ecrireParametre(NOM_APPLICATION, application.trim());
}

/**
 * La langue par défaut du site : celle d'un visiteur qui n'en a pas choisi
 * et dont le navigateur n'en demande aucune que le site parle. Le reste du
 * choix de la langue est dans `src/lib/i18n/serveur.ts`.
 */
const LANGUE_DU_SITE = "langue_du_site";

export function langueDuSite(): Langue {
  const reglee = lireParametre(LANGUE_DU_SITE);
  return estLangue(reglee) ? reglee : LANGUE_DE_REFERENCE;
}

export function definirLangueDuSite(langue: Langue): void {
  ecrireParametre(LANGUE_DU_SITE, langue);
}
