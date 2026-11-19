"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessGroupGames, accessGroups, games, userAccessGroups, users } from "@/db/schema";
import { REGLES_GROUPE, type RegleGroupe } from "@/lib/acces";
import { requireAdmin } from "@/lib/auth/guard";
import { newId } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";
import type { Resultat } from "./actions";

/**
 * Les groupes d'accès, depuis l'administration : les créer, dire ce qu'ils
 * ouvrent, y ranger des jeux et des comptes. La règle qui en découle pour
 * chaque compte est dans `src/lib/acces.ts`.
 *
 * Tout change d'un coup pour les membres : le catalogue se relit à chaque
 * page, il n'y a rien à vider.
 */

const NOM_MAX = 60;

function nomPropre(brut: unknown): string | null {
  const nom = typeof brut === "string" ? brut.trim().replace(/\s+/g, " ") : "";
  return nom.length >= 1 && nom.length <= NOM_MAX ? nom : null;
}

function estRegle(valeur: unknown): valeur is RegleGroupe {
  return REGLES_GROUPE.some((regle) => regle === valeur);
}

function nomPris(nom: string, sauf?: string): boolean {
  const memeNom = sql`lower(${accessGroups.name}) = ${nom.toLowerCase()}`;
  return Boolean(
    db
      .select({ id: accessGroups.id })
      .from(accessGroups)
      .where(sauf ? and(memeNom, ne(accessGroups.id, sauf)) : memeNom)
      .get(),
  );
}

function groupe(id: string) {
  return db.select().from(accessGroups).where(eq(accessGroups.id, id)).get();
}

/** Tout ce qui montre un catalogue dépend des groupes : on relit tout. */
function relire(): void {
  revalidatePath("/", "layout");
}

export async function creerGroupe(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const nom = nomPropre(donnees.get("nom"));
  const regle = donnees.get("regle");
  if (!nom) return { ok: false, message: t.nomInvalide };
  if (!estRegle(regle)) return { ok: false, message: t.regleInconnue };
  if (nomPris(nom)) return { ok: false, message: t.nomPris };

  db.insert(accessGroups).values({ id: newId(), name: nom, rule: regle }).run();
  relire();
  return { ok: true, message: t.cree(nom) };
}

export async function modifierGroupe(id: string, nomBrut: string, regle: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const nom = nomPropre(nomBrut);
  if (!nom) return { ok: false, message: t.nomInvalide };
  if (!estRegle(regle)) return { ok: false, message: t.regleInconnue };
  if (!groupe(id)) return { ok: false, message: t.introuvable };
  if (nomPris(nom, id)) return { ok: false, message: t.nomPris };

  db.update(accessGroups).set({ name: nom, rule: regle }).where(eq(accessGroups.id, id)).run();
  relire();
  return { ok: true, message: t.modifie(nom) };
}

/** Fait d'un groupe celui par défaut, ou le lui retire. Un seul à la fois. */
export async function basculerGroupeParDefaut(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const actuel = groupe(id);
  if (!actuel) return { ok: false, message: t.introuvable };

  db.transaction((tx) => {
    tx.update(accessGroups).set({ isDefault: false }).run();
    if (!actuel.isDefault) tx.update(accessGroups).set({ isDefault: true }).where(eq(accessGroups.id, id)).run();
  });
  relire();
  return { ok: true, message: actuel.isDefault ? t.plusParDefaut(actuel.name) : t.parDefaut(actuel.name) };
}

export async function supprimerGroupe(id: string): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const actuel = groupe(id);
  if (!actuel) return { ok: false, message: t.introuvable };

  // Ses jeux et ses membres partent avec lui (`on delete cascade`).
  db.delete(accessGroups).where(eq(accessGroups.id, id)).run();
  relire();
  return { ok: true, message: t.supprime(actuel.name) };
}

/** La liste cochée remplace l'ancienne. Sans effet tant que la règle n'est pas « liste ». */
export async function definirJeuxDuGroupe(id: string, choisis: string[]): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const actuel = groupe(id);
  if (!actuel) return { ok: false, message: t.introuvable };

  // Seuls des identifiants de jeux existants : la liste vient du navigateur.
  const demandes = [...new Set(choisis.filter((jeu) => typeof jeu === "string"))];
  const valides =
    demandes.length === 0
      ? []
      : db
          .select({ id: games.id })
          .from(games)
          .where(inArray(games.id, demandes))
          .all()
          .map((jeu) => jeu.id);

  db.transaction((tx) => {
    tx.delete(accessGroupGames).where(eq(accessGroupGames.groupId, id)).run();
    if (valides.length > 0) {
      tx.insert(accessGroupGames)
        .values(valides.map((gameId) => ({ groupId: id, gameId })))
        .run();
    }
  });
  relire();
  return { ok: true, message: t.jeux(actuel.name, valides.length) };
}

/** Les membres cochés remplacent les anciens. */
export async function definirMembresDuGroupe(id: string, choisis: string[]): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const actuel = groupe(id);
  if (!actuel) return { ok: false, message: t.introuvable };

  const demandes = [...new Set(choisis.filter((compte) => typeof compte === "string"))];
  const valides =
    demandes.length === 0
      ? []
      : db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, demandes))
          .all()
          .map((compte) => compte.id);

  db.transaction((tx) => {
    tx.delete(userAccessGroups).where(eq(userAccessGroups.groupId, id)).run();
    if (valides.length > 0) {
      tx.insert(userAccessGroups)
        .values(valides.map((userId) => ({ userId, groupId: id })))
        .run();
    }
  });
  relire();
  return { ok: true, message: t.membres(actuel.name, valides.length) };
}

/** Les groupes d'un compte, depuis l'onglet Comptes : les cases cochées remplacent les anciennes. */
export async function definirGroupesDuCompte(userId: string, choisis: string[]): Promise<Resultat> {
  await requireAdmin();
  const t = (await textes()).adminGroupes.actions;
  const compte = db.select({ id: users.id, pseudo: users.pseudo }).from(users).where(eq(users.id, userId)).get();
  if (!compte) return { ok: false, message: t.compteIntrouvable };

  const demandes = [...new Set(choisis.filter((g) => typeof g === "string"))];
  const valides =
    demandes.length === 0
      ? []
      : db
          .select({ id: accessGroups.id })
          .from(accessGroups)
          .where(inArray(accessGroups.id, demandes))
          .all()
          .map((g) => g.id);

  db.transaction((tx) => {
    tx.delete(userAccessGroups).where(eq(userAccessGroups.userId, userId)).run();
    if (valides.length > 0) {
      tx.insert(userAccessGroups)
        .values(valides.map((groupId) => ({ userId, groupId })))
        .run();
    }
  });
  relire();
  return { ok: true, message: t.groupesDuCompte(compte.pseudo, valides.length) };
}
