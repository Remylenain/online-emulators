"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { definirVitrine, ENTREES_MAX, LIBELLE_MAX, type EntreeVitrine } from "@/lib/vitrine";
import type { Resultat } from "./actions";

/**
 * La vitrine, réglée depuis l'administration : ouverte ou non, et les jeux
 * qu'elle propose. Le formulaire envoie `ENTREES_MAX` lignes ; une ligne sans
 * jeu est simplement ignorée.
 */
export async function definirLaVitrine(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminReglages.vitrine.retours;

  const active = donnees.get("active") === "on";
  const entrees: EntreeVitrine[] = [];
  for (let i = 0; i < ENTREES_MAX; i++) {
    const jeu = String(donnees.get(`jeu-${i}`) ?? "").trim();
    const libelle = String(donnees.get(`libelle-${i}`) ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!jeu) continue;
    if (libelle.length > LIBELLE_MAX) {
      return { ok: false, message: t.libelleTropLong(LIBELLE_MAX) };
    }
    if (entrees.some((e) => e.jeu === jeu)) {
      return { ok: false, message: t.jeuEnDouble };
    }
    entrees.push({ libelle, jeu });
  }

  if (entrees.length > 0) {
    const connus = await db
      .select({ id: games.id, publie: games.isPublished, titre: games.title })
      .from(games)
      .where(inArray(games.id, entrees.map((e) => e.jeu)))
      .all();
    if (connus.length !== entrees.length) return { ok: false, message: t.jeuDisparu };
    const depublie = connus.find((jeu) => !jeu.publie);
    if (depublie && active) {
      return { ok: false, message: t.jeuDepublie(depublie.titre) };
    }
  }
  if (active && entrees.length === 0) {
    return { ok: false, message: t.aucunJeu };
  }

  definirVitrine(active, entrees);
  revalidatePath("/", "layout");
  return { ok: true, message: active ? t.ouverte : t.fermee };
}
