import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { etatCapacite } from "@/lib/link/capacite";
import {
  configCaptcha,
  configMail,
  configScraper,
  descriptionDuSite,
  langueDuSite,
  lireParametre,
  nomDuSite,
} from "@/lib/parametres";
import { vitrine } from "@/lib/vitrine";
import { Reglages } from "./reglages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await textes();
  return { title: t.adminReglages.titreOnglet };
}
// La capacité du câble link dépend des salons ouverts à l'instant.
export const dynamic = "force-dynamic";

/**
 * Ce qui se règle sans toucher au serveur : le nom du site, sa phrase
 * d'accueil, et la part du processeur laissée au câble link.
 */
export default async function ReglagesPage() {
  const admin = await requireAdmin();
  const mail = configMail();
  const captcha = configCaptcha();
  const scraper = configScraper();
  const jeux = await db
    .select({ id: games.id, titre: games.title, console: games.consoleSlug, publie: games.isPublished })
    .from(games)
    .orderBy(asc(games.consoleSlug), asc(games.searchText))
    .all();
  return (
    <Reglages
      nom={nomDuSite()}
      description={descriptionDuSite()}
      application={lireParametre("nom_application") ?? ""}
      langue={langueDuSite()}
      capacite={etatCapacite()}
      vitrine={vitrine()}
      jeux={jeux}
      // Ni le mot de passe ni la clé secrète ne descendent : seulement s'ils existent.
      mail={{
        host: mail.host,
        port: mail.port,
        user: mail.user,
        from: mail.from,
        motDePasseDefini: mail.password.length > 0,
        source: mail.source,
      }}
      captcha={{ siteKey: captcha.siteKey, secretDefini: captcha.secretKey.length > 0, source: captcha.source }}
      adresseAdmin={admin.email ?? ""}
      scraper={{
        devId: scraper.devId,
        devPasswordDefini: scraper.devPassword.length > 0,
        ssId: scraper.ssId,
        ssPasswordDefini: scraper.ssPassword.length > 0,
      }}
    />
  );
}
