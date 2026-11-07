import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { saveBackups, saveFiles } from "@/db/schema";
import { newId } from "@/lib/auth/session";
import { paths } from "@/lib/paths";

/**
 * Au-delà, ce n'est pas une sauvegarde de ces consoles. La plus grande SRAM
 * ou flash d'une cartouche GB, GBC ou GBA fait 128 Kio ; les émulateurs y
 * ajoutent parfois un pied de page — l'horloge temps réel, quelques dizaines
 * d'octets — qu'il faut laisser passer, d'où la marge. Les tailles exactes
 * ne sont pas imposées : le lecteur avertit, le serveur borne. Ce qui est
 * reçu finit dans un cœur d'émulation sur le serveur (câble link) : autant
 * qu'il n'y entre que ce qui a la taille d'une sauvegarde.
 */
export const TAILLE_MAX_SAUVEGARDE = 128 * 1024 + 4096;

/**
 * Sauvegardes SRAM, une par compte et par jeu.
 *
 * Le fichier vit sur disque, la base n'en garde que la trace : taille,
 * empreinte et numéro de révision. C'est la révision qui permet de détecter un
 * conflit — même compte, deux appareils, deux parties en parallèle.
 */

/**
 * Versions précédentes conservées.
 *
 * Les cinq dernières écritures, quoi qu'il arrive, plus une par jour sur
 * trente jours : la plus ancienne de chaque journée, c'est-à-dire l'état de la
 * partie au début de ce jour-là. Cinq écritures seules ne suffisaient pas :
 * une sauvegarde abîmée — par un savestate malheureux, ou par quelqu'un qui
 * aurait mis la main sur le compte — s'écrit plusieurs fois en une soirée et
 * chasse tout l'historique. L'état de la veille, lui, reste.
 */
const BACKUPS_RECENTS = 5;
const BACKUPS_JOURS = 30;

export type Sauvegarde = {
  donnees: Uint8Array;
  revision: number;
  modifiee: Date;
};

function empreinte(donnees: Uint8Array): string {
  return createHash("sha1").update(donnees).digest("hex");
}

export async function lireSauvegarde(
  userId: string,
  gameId: string,
): Promise<Sauvegarde | null> {
  const ligne = await db
    .select()
    .from(saveFiles)
    .where(and(eq(saveFiles.userId, userId), eq(saveFiles.gameId, gameId)))
    .get();

  if (!ligne) return null;

  try {
    const fichier = await fs.readFile(paths.data(ligne.path));
    return {
      donnees: new Uint8Array(fichier),
      revision: ligne.revision,
      modifiee: ligne.updatedAt,
    };
  } catch {
    // Enregistrée en base mais absente du disque : on repart d'une partie
    // vierge plutôt que de refuser de lancer le jeu.
    return null;
  }
}

export type ResultatEcriture =
  | { etat: "ecrit"; revision: number }
  | { etat: "inchange"; revision: number }
  | { etat: "conflit"; revision: number };

/**
 * Enregistre la sauvegarde d'un compte pour un jeu.
 *
 * `revisionAttendue` est la révision sur laquelle le joueur a construit cette
 * partie. Si elle ne correspond plus, c'est qu'une autre session a écrit
 * entre-temps : on refuse plutôt que d'écraser en silence des heures de jeu.
 */
export async function ecrireSauvegarde(
  userId: string,
  gameId: string,
  donnees: Uint8Array,
  revisionAttendue: number | null,
): Promise<ResultatEcriture> {
  const existante = await db
    .select()
    .from(saveFiles)
    .where(and(eq(saveFiles.userId, userId), eq(saveFiles.gameId, gameId)))
    .get();

  if (existante && revisionAttendue !== null && revisionAttendue !== existante.revision) {
    return { etat: "conflit", revision: existante.revision };
  }

  const somme = empreinte(donnees);
  if (existante?.hash === somme) {
    // Le cœur signale la sauvegarde comme modifiée plus souvent qu'elle ne
    // change vraiment : inutile de réécrire un contenu identique.
    return { etat: "inchange", revision: existante.revision };
  }

  const relatif = paths.saveFile(userId, gameId);
  const absolu = paths.data(relatif);
  await fs.mkdir(path.dirname(absolu), { recursive: true });

  if (existante) {
    // La version précédente est mise de côté avant d'être remplacée : une
    // sauvegarde corrompue par un savestate malheureux reste récupérable.
    const relatifBackup = paths.saveBackup(userId, gameId, existante.revision);
    try {
      await fs.copyFile(absolu, paths.data(relatifBackup));
      db.insert(saveBackups)
        .values({
          id: newId(),
          saveFileId: existante.id,
          path: relatifBackup,
          size: existante.size,
          revision: existante.revision,
        })
        .run();
      await purgerBackups(existante.id);
    } catch {
      // Pas de version précédente lisible : ce n'est pas une raison de perdre
      // celle que le joueur vient de faire.
    }
  }

  await fs.writeFile(absolu, donnees);

  const revision = (existante?.revision ?? 0) + 1;
  const maintenant = new Date();

  if (existante) {
    db.update(saveFiles)
      .set({
        size: donnees.length,
        hash: somme,
        revision,
        updatedAt: maintenant,
      })
      .where(eq(saveFiles.id, existante.id))
      .run();
  } else {
    db.insert(saveFiles)
      .values({
        id: newId(),
        userId,
        gameId,
        path: relatif,
        size: donnees.length,
        hash: somme,
        revision,
      })
      .run();
  }

  return { etat: "ecrit", revision };
}

async function purgerBackups(saveFileId: string): Promise<void> {
  const tous = await db
    .select({ id: saveBackups.id, path: saveBackups.path, createdAt: saveBackups.createdAt })
    .from(saveBackups)
    .where(eq(saveBackups.saveFileId, saveFileId))
    .orderBy(desc(saveBackups.createdAt))
    .all();

  const garder = new Set(tous.slice(0, BACKUPS_RECENTS).map((b) => b.id));
  const limite = Date.now() - BACKUPS_JOURS * 24 * 60 * 60 * 1000;
  const parJour = new Map<string, (typeof tous)[number]>();
  for (const copie of tous) {
    if (copie.createdAt.getTime() < limite) continue;
    const jour = jourLocal(copie.createdAt);
    // La liste va du plus récent au plus ancien : la dernière vue d'un jour
    // est la plus ancienne de ce jour, celle qu'on garde.
    parJour.set(jour, copie);
  }
  for (const copie of parJour.values()) garder.add(copie.id);

  for (const vieux of tous) {
    if (garder.has(vieux.id)) continue;
    await fs.rm(paths.data(vieux.path), { force: true });
    db.delete(saveBackups).where(eq(saveBackups.id, vieux.id)).run();
  }
}

/** Journée en heure de Paris : c'est là que jouent les comptes. */
function jourLocal(date: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(date);
}

// ---------------------------------------------------------------------------
// Copies de secours, vues par le joueur
// ---------------------------------------------------------------------------

export type Copie = { id: string; revision: number; taille: number; creeLe: Date };

export async function listerCopies(userId: string, gameId: string): Promise<Copie[]> {
  const lignes = await db
    .select({
      id: saveBackups.id,
      revision: saveBackups.revision,
      size: saveBackups.size,
      createdAt: saveBackups.createdAt,
    })
    .from(saveBackups)
    .innerJoin(saveFiles, eq(saveBackups.saveFileId, saveFiles.id))
    .where(and(eq(saveFiles.userId, userId), eq(saveFiles.gameId, gameId)))
    .orderBy(desc(saveBackups.createdAt))
    .all();
  return lignes.map((l) => ({ id: l.id, revision: l.revision, taille: l.size, creeLe: l.createdAt }));
}

/**
 * Une copie de secours, à condition qu'elle appartienne bien au compte : le
 * numéro vient de l'adresse, et chacun ne voit que ses propres parties.
 */
export async function lireCopie(
  userId: string,
  copieId: string,
): Promise<{ donnees: Uint8Array; gameId: string; revision: number } | null> {
  const ligne = await db
    .select({ path: saveBackups.path, revision: saveBackups.revision, gameId: saveFiles.gameId })
    .from(saveBackups)
    .innerJoin(saveFiles, eq(saveBackups.saveFileId, saveFiles.id))
    .where(and(eq(saveBackups.id, copieId), eq(saveFiles.userId, userId)))
    .get();
  if (!ligne) return null;

  try {
    return {
      donnees: new Uint8Array(await fs.readFile(paths.data(ligne.path))),
      gameId: ligne.gameId,
      revision: ligne.revision,
    };
  } catch {
    return null;
  }
}

/**
 * Remet une copie de secours à la place de la sauvegarde courante.
 *
 * Passe par l'écriture ordinaire : la version remplacée part à son tour dans
 * les copies, donc restaurer ne détruit rien, et se défait de la même façon.
 */
export async function restaurerCopie(userId: string, copieId: string): Promise<boolean> {
  const copie = await lireCopie(userId, copieId);
  if (!copie) return false;
  await ecrireSauvegarde(userId, copie.gameId, copie.donnees, null);
  return true;
}
