"use server";

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { games, playSessions, ratings, saveFiles, saveStates, sessions, userGames, users } from "@/db/schema";
import fs from "node:fs/promises";
import { MODES_ACCES, type ModeAcces } from "@/lib/acces";
import { requireAdmin } from "@/lib/auth/guard";
import { voirComme } from "@/lib/auth/session";
import { paths } from "@/lib/paths";
import {
  creerLienInscription,
  INSCRIPTION_PLAFONDS,
  revoquerLienInscription,
} from "@/lib/auth/invitations";
import { hashPassword } from "@/lib/auth/password";
import {
  createPasswordResetToken,
  INVITATION_TOKEN_DURATION_MS,
  newId,
} from "@/lib/auth/session";
import { env } from "@/lib/env";
import { mailEnabled } from "@/lib/env";
import { definirMargeLink, MARGE_MAX, MARGE_MIN } from "@/lib/link/capacite";
import { definirIdentite, definirInscriptionsOuvertes, inscriptionsOuvrables } from "@/lib/parametres";
import {
  manifestSchema,
  manifestToColumns,
  type Manifest,
} from "@/lib/library/manifest";
import {
  appliquerRetouche,
  CHAMPS_RETOUCHABLES,
  ecrireRetouche,
  lireRetouche,
  retoucheSchema,
} from "@/lib/library/retouches";
import { sendInvitation } from "@/lib/mail";
import { ecrireSauvegarde } from "@/lib/saves";
import { normalizeForSearch, optionalEmailSchema, pseudoSchema } from "@/lib/validation";

/**
 * Actions d'administration.
 *
 * Chacune commence par `requireAdmin()` : le menu ne montre l'entrée qu'aux
 * administrateurs, mais une action reste une adresse que n'importe qui peut
 * appeler. Le contrôle se fait ici, pas dans l'affichage.
 */

export type Resultat =
  | {
      ok: true;
      message?: string;
      /** Mot de passe provisoire, à transmettre de vive voix. */
      motDePasse?: string;
      /** Lien où la personne choisit elle-même son mot de passe. */
      lien?: string;
      /** Ce que le lien permet, affiché sous lui. Sinon : le texte du lien d'accès. */
      lienLibelle?: string;
      /** L'invitation est-elle aussi partie par mail ? */
      mailEnvoye?: boolean;
    }
  | { ok: false; message: string };

/**
 * Mot de passe lisible à l'oral, sans caractères ambigus — un zéro et un O se
 * confondent quand on dicte un mot de passe à quelqu'un.
 */
function motDePasseAleatoire(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(20), (octet) => alphabet[octet % alphabet.length]).join("");
}

export async function creerCompte(_etat: unknown, donnees: FormData): Promise<Resultat> {
  const admin = await requireAdmin();

  const pseudo = pseudoSchema.safeParse(donnees.get("pseudo"));
  if (!pseudo.success) {
    return { ok: false, message: pseudo.error.issues[0]?.message ?? "Pseudo invalide." };
  }

  // Facultative : un ami sans adresse aura un compte quand même. Il ne pourra
  // simplement pas réinitialiser son mot de passe seul.
  const email = optionalEmailSchema.safeParse(donnees.get("email"));
  if (!email.success) {
    return { ok: false, message: email.error.issues[0]?.message ?? "Adresse invalide." };
  }

  const doublon = await db
    .select({ pseudo: users.pseudo, email: users.email })
    .from(users)
    .where(
      email.data === null
        ? sql`lower(${users.pseudo}) = ${pseudo.data.toLowerCase()}`
        : sql`lower(${users.pseudo}) = ${pseudo.data.toLowerCase()} or lower(${users.email}) = ${email.data}`,
    )
    .get();

  if (doublon) {
    return {
      ok: false,
      message:
        email.data !== null && doublon.email === email.data
          ? `Un compte utilise déjà l'adresse ${email.data}.`
          : `Le pseudo « ${doublon.pseudo} » est déjà pris.`,
    };
  }

  const motDePasse = motDePasseAleatoire();
  const id = newId();
  db.insert(users)
    .values({
      id,
      pseudo: pseudo.data,
      email: email.data,
      passwordHash: await hashPassword(motDePasse),
      role: donnees.get("admin") === "on" ? "ADMIN" : "USER",
    })
    .run();

  const { lien, mailEnvoye } = await preparerInvitation(id, pseudo.data, email.data, admin.pseudo);

  revalidatePath("/admin");
  // Les deux voies sont offertes : le lien, où la personne choisit son mot de
  // passe, et le mot de passe provisoire pour le lui donner de vive voix. Ni
  // l'un ni l'autre n'est écrit ailleurs qu'ici.
  return {
    ok: true,
    message: `Compte créé pour ${pseudo.data}.`,
    motDePasse,
    lien,
    mailEnvoye,
  };
}

/**
 * Crée le lien d'invitation et tente de l'envoyer par mail.
 *
 * L'échec de l'envoi n'est pas une erreur : le lien reste affiché, et
 * l'administrateur le transmet comme il veut. Tant qu'aucun serveur de mail
 * n'est configuré, c'est même le cas normal.
 */
async function preparerInvitation(
  userId: string,
  pseudo: string,
  email: string | null,
  invitePar: string,
): Promise<{ lien: string; mailEnvoye: boolean }> {
  const token = await createPasswordResetToken(userId, INVITATION_TOKEN_DURATION_MS);
  const lien = `${env.PUBLIC_URL}/reinitialiser?token=${encodeURIComponent(token)}&bienvenue=1`;

  if (!mailEnabled || email === null) return { lien, mailEnvoye: false };

  try {
    await sendInvitation(email, pseudo, lien, invitePar);
    return { lien, mailEnvoye: true };
  } catch (erreur) {
    console.error("[invitation] envoi impossible", erreur);
    return { lien, mailEnvoye: false };
  }
}

/** Refait un lien d'invitation pour un compte existant. */
export async function renvoyerInvitation(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();

  const compte = await db
    .select({ pseudo: users.pseudo, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  const { lien, mailEnvoye } = await preparerInvitation(
    userId,
    compte.pseudo,
    compte.email,
    admin.pseudo,
  );

  return {
    ok: true,
    message: `Nouveau lien pour ${compte.pseudo}.`,
    lien,
    mailEnvoye,
  };
}

/**
 * Lien d'inscription : la personne qui le reçoit crée son compte elle-même,
 * pseudo compris. À donner de la main à la main ; il vit une journée, et vaut
 * pour autant de comptes que l'administrateur l'a décidé.
 */
export async function creerInvitation(plafond: number): Promise<Resultat> {
  const admin = await requireAdmin();
  if (!INSCRIPTION_PLAFONDS.includes(plafond as (typeof INSCRIPTION_PLAFONDS)[number])) {
    return { ok: false, message: "Nombre de comptes invalide." };
  }

  const { token } = await creerLienInscription(admin.id, plafond);
  revalidatePath("/admin/comptes");
  return {
    ok: true,
    message: "Lien d'inscription créé.",
    lien: `${env.PUBLIC_URL}/inscription?token=${encodeURIComponent(token)}`,
    lienLibelle:
      "Lien à transmettre : la personne y choisira son pseudo et son mot de passe. " +
      `Valable 24 heures, pour ${plafond === 1 ? "un seul compte" : `${plafond} comptes au plus`}.`,
  };
}

/**
 * « Voir comme » : regarder le site avec les yeux d'un autre compte — son
 * catalogue selon son mode d'accès, ses parties, ses salons. Tout ce qu'on y
 * fait (jouer, noter) compte pour ce compte ; le bandeau le rappelle, et le
 * bouton du bandeau ramène à soi.
 */
export async function voirLeSiteComme(userId: string): Promise<void> {
  await requireAdmin();
  const refus = await voirComme(userId);
  if (refus) throw new Error(refus);
  redirect("/");
}

/** Nom et phrase d'accueil du site, affichés partout. */
export async function definirNomDuSite(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const nom = String(donnees.get("nom") ?? "").trim();
  const description = String(donnees.get("description") ?? "").trim();
  if (nom.length < 2 || nom.length > 40) {
    return { ok: false, message: "Le nom doit faire entre 2 et 40 caractères." };
  }
  if (description.length > 120) {
    return { ok: false, message: "La description ne peut pas dépasser 120 caractères." };
  }
  const application = String(donnees.get("application") ?? "").trim();
  if (application.length > 40) {
    return { ok: false, message: "Le nom de l'application ne peut pas dépasser 40 caractères." };
  }
  definirIdentite(nom, description, application);
  revalidatePath("/", "layout");
  return { ok: true, message: "Réglages enregistrés." };
}

/**
 * Part du processeur laissée au câble link. Les coûts par salon, eux, se
 * mesurent sur le serveur (`npm run link:capacite -- --appliquer`).
 */
export async function definirMargeCableLink(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const marge = Number(donnees.get("marge"));
  if (!Number.isInteger(marge) || marge < MARGE_MIN || marge > MARGE_MAX) {
    return { ok: false, message: `La marge doit être un entier entre ${MARGE_MIN} et ${MARGE_MAX} %.` };
  }
  definirMargeLink(marge);
  revalidatePath("/admin/reglages");
  return { ok: true, message: "Marge enregistrée : la limite s'applique dès maintenant." };
}

/**
 * Ouvrir ou fermer les inscriptions. Ouvertes, n'importe qui crée un compte
 * avec une adresse e-mail confirmée, derrière un captcha : à ne faire qu'en
 * sachant que tout le catalogue devient accessible à qui s'inscrit.
 */
export async function definirInscriptions(ouvertes: boolean): Promise<Resultat> {
  await requireAdmin();
  if (ouvertes && !inscriptionsOuvrables) {
    return {
      ok: false,
      message: "Impossible d'ouvrir : il faut un serveur de mail et un captcha configurés.",
    };
  }
  definirInscriptionsOuvertes(ouvertes);
  revalidatePath("/admin/comptes");
  revalidatePath("/connexion");
  revalidatePath("/inscription");
  return {
    ok: true,
    message: ouvertes
      ? "Inscriptions ouvertes : la page de connexion propose de créer un compte."
      : "Inscriptions fermées : seuls les liens d'invitation créent des comptes.",
  };
}

export async function revoquerInvitation(id: string): Promise<Resultat> {
  await requireAdmin();
  const fait = await revoquerLienInscription(id);
  revalidatePath("/admin/comptes");
  return fait
    ? { ok: true, message: "Lien révoqué : il ne créera plus de compte." }
    : { ok: false, message: "Ce lien était déjà révoqué, ou n'existe pas." };
}

/** Ce que le compte voit du catalogue : normal, restreint ou testeur. */
export async function definirModeAcces(userId: string, mode: string): Promise<Resultat> {
  await requireAdmin();
  if (!MODES_ACCES.some((m) => m.valeur === mode)) return { ok: false, message: "Mode inconnu." };
  const resultat = db
    .update(users)
    .set({ accessMode: mode as ModeAcces, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();
  if (resultat.changes === 0) return { ok: false, message: "Compte introuvable." };
  revalidatePath("/admin/comptes");
  const libelle = MODES_ACCES.find((m) => m.valeur === mode)!;
  return { ok: true, message: `Accès ${libelle.libelle.toLowerCase()} : ${libelle.detail}.` };
}

/** Les jeux attribués à un compte restreint ou testeur : la liste cochée remplace l'ancienne. */
export async function definirJeuxAttribues(_etat: unknown, donnees: FormData): Promise<Resultat> {
  await requireAdmin();
  const userId = String(donnees.get("userId") ?? "");
  const choisis = donnees.getAll("jeux").map(String);

  const compte = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  // Seuls des identifiants de jeux existants : la liste vient d'un formulaire.
  const valides =
    choisis.length === 0
      ? []
      : (await db.select({ id: games.id }).from(games).where(inArray(games.id, choisis)).all()).map(
          (g) => g.id,
        );

  db.transaction((tx) => {
    tx.delete(userGames).where(eq(userGames.userId, userId)).run();
    if (valides.length > 0) {
      tx.insert(userGames)
        .values(valides.map((gameId) => ({ userId, gameId })))
        .run();
    }
  });
  revalidatePath("/admin/comptes");
  return {
    ok: true,
    message: `${valides.length} jeu${valides.length > 1 ? "x" : ""} attribué${valides.length > 1 ? "s" : ""}.`,
  };
}

/**
 * Remise à zéro d'un compte : sauvegardes, copies de secours, points de
 * reprise, temps de jeu et notes disparaissent. Le compte, son pseudo, son
 * mot de passe et ses réglages restent. Pour repartir d'une page blanche —
 * un compte de démonstration qu'on prête, par exemple.
 */
export async function remettreAZero(userId: string): Promise<Resultat> {
  await requireAdmin();
  const compte = await db
    .select({ id: users.id, pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  // Les jeux touchés, pour recalculer ensuite leurs compteurs dénormalisés.
  const touches = new Set<string>();
  for (const table of [playSessions, ratings] as const) {
    for (const l of await db.select({ gameId: table.gameId }).from(table).where(eq(table.userId, userId)).all()) {
      touches.add(l.gameId);
    }
  }

  db.transaction((tx) => {
    // Les copies de secours suivent la sauvegarde par cascade.
    tx.delete(saveFiles).where(eq(saveFiles.userId, userId)).run();
    tx.delete(saveStates).where(eq(saveStates.userId, userId)).run();
    tx.delete(playSessions).where(eq(playSessions.userId, userId)).run();
    tx.delete(ratings).where(eq(ratings.userId, userId)).run();
    for (const gameId of touches) {
      tx.update(games)
        .set({
          playCount: sql`(select count(*) from ${playSessions} where ${playSessions.gameId} = ${gameId})`,
          ratingAvg: sql`coalesce((select avg(${ratings.score}) from ${ratings} where ${ratings.gameId} = ${gameId}), 0)`,
          ratingCount: sql`(select count(*) from ${ratings} where ${ratings.gameId} = ${gameId})`,
        })
        .where(eq(games.id, gameId))
        .run();
    }
  });

  // Les fichiers, une fois la base d'accord : saves/<compte>/ et states/<compte>/.
  await fs.rm(paths.data(path.posix.join("saves", userId)), { recursive: true, force: true });
  await fs.rm(paths.data(path.posix.join("states", userId)), { recursive: true, force: true });

  revalidatePath("/admin/comptes");
  revalidatePath("/admin/temps");
  return { ok: true, message: `Compte de ${compte.pseudo} remis à zéro.` };
}

export async function basculerActivation(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();
  if (admin.id === userId) {
    return { ok: false, message: "Tu ne peux pas désactiver ton propre compte." };
  }

  const compte = await db
    .select({ isActive: users.isActive, pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  const actif = !compte.isActive;
  db.update(users).set({ isActive: actif, updatedAt: new Date() }).where(eq(users.id, userId)).run();

  // Désactiver ferme les sessions ouvertes : sans cela, le compte continuerait
  // de naviguer jusqu'à l'expiration de son cookie.
  if (!actif) db.delete(sessions).where(eq(sessions.userId, userId)).run();

  revalidatePath("/admin");
  return { ok: true, message: `${compte.pseudo} est maintenant ${actif ? "actif" : "désactivé"}.` };
}

export async function basculerAdministration(userId: string): Promise<Resultat> {
  const admin = await requireAdmin();
  if (admin.id === userId) {
    return { ok: false, message: "Tu ne peux pas retirer tes propres droits." };
  }

  const compte = await db
    .select({ role: users.role, pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  const role = compte.role === "ADMIN" ? "USER" : "ADMIN";
  db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).run();

  revalidatePath("/admin");
  return {
    ok: true,
    message: `${compte.pseudo} ${role === "ADMIN" ? "est administrateur" : "n'est plus administrateur"}.`,
  };
}

export async function reinitialiserMotDePasse(userId: string): Promise<Resultat> {
  await requireAdmin();

  const compte = await db
    .select({ pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  const motDePasse = motDePasseAleatoire();
  db.update(users)
    .set({ passwordHash: await hashPassword(motDePasse), updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();

  // Les sessions ouvertes sont fermées : un mot de passe réinitialisé doit
  // couper l'accès à qui l'utilisait.
  db.delete(sessions).where(eq(sessions.userId, userId)).run();

  revalidatePath("/admin");
  return { ok: true, message: `Nouveau mot de passe pour ${compte.pseudo}.`, motDePasse };
}

/** Taille maximale d'une sauvegarde importée : la même que celle du lecteur. */
const TAILLE_MAX_SAUVEGARDE = 1_048_576;

/**
 * Dépose une sauvegarde de jeu sur le compte de quelqu'un.
 *
 * Sert à préparer des parties de test (le câble link en demande deux), ou à
 * reprendre la partie d'un ami faite sur un autre émulateur. Le fichier passe
 * par le même circuit que le lecteur : l'ancienne sauvegarde du compte part
 * dans les copies de secours, elle n'est jamais perdue.
 */
export async function importerSauvegarde(
  _etat: unknown,
  donnees: FormData,
): Promise<Resultat> {
  await requireAdmin();

  const userId = donnees.get("userId");
  const gameId = donnees.get("gameId");
  const fichier = donnees.get("fichier");
  if (typeof userId !== "string" || typeof gameId !== "string" || !gameId) {
    return { ok: false, message: "Choisis un jeu." };
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisis un fichier de sauvegarde." };
  }
  if (fichier.size > TAILLE_MAX_SAUVEGARDE) {
    return { ok: false, message: "Ce fichier est trop gros pour une sauvegarde." };
  }

  const compte = await db
    .select({ pseudo: users.pseudo })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!compte) return { ok: false, message: "Compte introuvable." };

  const jeu = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu) return { ok: false, message: "Jeu introuvable." };

  const resultat = await ecrireSauvegarde(
    userId,
    gameId,
    new Uint8Array(await fichier.arrayBuffer()),
    null,
  );

  revalidatePath("/admin/comptes");
  return {
    ok: true,
    message:
      resultat.etat === "inchange"
        ? `${compte.pseudo} avait déjà exactement cette sauvegarde de ${jeu.title}.`
        : `Sauvegarde de ${jeu.title} importée pour ${compte.pseudo}. L'éventuelle précédente est dans les copies de secours.`,
  };
}

/** Jeu tel qu'il faut le connaître pour le retoucher : son adresse et son manifeste. */
async function jeuRetouchable(gameId: string) {
  const jeu = await db
    .select({
      id: games.id,
      title: games.title,
      consoleSlug: games.consoleSlug,
      slug: games.slug,
      romPath: games.romPath,
      isPublished: games.isPublished,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .get();
  if (!jeu) return null;

  return { ...jeu, manifeste: await lireManifeste(jeu.romPath) };
}

/**
 * Manifeste du jeu, lu dans la bibliothèque.
 *
 * Il sert de référence : une valeur du formulaire identique au manifeste ne
 * devient pas une retouche, et un champ vidé revient au manifeste. Sans cette
 * comparaison, chaque enregistrement figerait tout le contenu du manifeste
 * dans la retouche, et corriger le `game.json` n'aurait plus aucun effet.
 */
async function lireManifeste(romPath: string): Promise<Manifest | null> {
  const chemin = path.join(env.LIBRARY_DIR, path.dirname(romPath), "game.json");
  try {
    const analyse = manifestSchema.safeParse(JSON.parse(await readFile(chemin, "utf8")));
    return analyse.success ? analyse.data : null;
  } catch {
    return null;
  }
}

export async function basculerPublication(gameId: string): Promise<Resultat> {
  await requireAdmin();

  const jeu = await jeuRetouchable(gameId);
  if (!jeu) return { ok: false, message: "Jeu introuvable." };

  const publie = !jeu.isPublished;

  /**
   * La bascule doit survivre au prochain scan.
   *
   * Elle n'était écrite qu'en base : le scan suivant relisait le manifeste et
   * republiait le jeu, sans rien dire. Elle passe maintenant par une retouche,
   * et n'est posée que si elle contredit le manifeste.
   */
  try {
    const retouche = await lireRetouche(jeu.consoleSlug, jeu.slug);
    if (publie === (jeu.manifeste?.publie ?? true)) delete retouche.publie;
    else retouche.publie = publie;
    await ecrireRetouche(jeu.consoleSlug, jeu.slug, retouche);
  } catch {
    return {
      ok: false,
      message: "Impossible d'écrire dans le dossier des retouches sur le serveur.",
    };
  }

  db.update(games)
    .set({ isPublished: publie, updatedAt: new Date() })
    .where(eq(games.id, gameId))
    .run();

  revalidatePath("/admin/bibliotheque");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${jeu.title} ${publie ? "est publié" : "est retiré du catalogue"}.`,
  };
}

/**
 * Corrige les informations d'un jeu depuis l'administration.
 *
 * La saisie va dans une retouche à côté de la bibliothèque, puis la base est
 * mise à jour dans la foulée : attendre un scan pour voir sa correction
 * donnerait l'impression qu'il ne s'est rien passé. Le scan suivant relira la
 * même retouche et retrouvera le même résultat.
 */
export async function enregistrerRetouches(
  gameId: string,
  donnees: FormData,
): Promise<Resultat> {
  await requireAdmin();

  const jeu = await jeuRetouchable(gameId);
  if (!jeu) return { ok: false, message: "Jeu introuvable." };

  const saisie: Record<string, unknown> = {};
  for (const champ of CHAMPS_RETOUCHABLES) {
    const brut = donnees.get(champ);
    const valeur = typeof brut === "string" ? brut.trim() : "";
    if (valeur === "") continue;
    saisie[champ] = champ === "annee" ? Number(valeur) : valeur;
  }

  const analyse = retoucheSchema.safeParse(saisie);
  if (!analyse.success) {
    const probleme = analyse.error.issues[0];
    return {
      ok: false,
      message: `${probleme?.path.join(".") ?? "Champ"} : ${probleme?.message ?? "valeur invalide"}`,
    };
  }

  // On repart de la retouche existante pour ne pas effacer `publie`, qui se
  // règle par le bouton et non par ce formulaire.
  const retouche = await lireRetouche(jeu.consoleSlug, jeu.slug);
  for (const champ of CHAMPS_RETOUCHABLES) {
    const valeur = analyse.data[champ];
    // Vidé, ou identique au manifeste : ce n'est pas une retouche. Le champ
    // repart du manifeste, qui redevient seul maître de cette valeur.
    if (valeur === undefined || valeur === jeu.manifeste?.[champ]) delete retouche[champ];
    else Object.assign(retouche, { [champ]: valeur });
  }

  try {
    await ecrireRetouche(jeu.consoleSlug, jeu.slug, retouche);
  } catch {
    return {
      ok: false,
      message: "Impossible d'écrire dans le dossier des retouches sur le serveur.",
    };
  }

  const colonnes = manifestToColumns(
    appliquerRetouche(jeu.manifeste ?? { titre: jeu.title, publie: true }, retouche),
  );

  db.update(games)
    .set({
      title: colonnes.title,
      description: colonnes.description,
      author: colonnes.author,
      version: colonnes.version,
      language: colonnes.language,
      baseGame: colonnes.baseGame,
      year: colonnes.year,
      // Le texte de recherche est dérivé : le laisser en arrière ferait
      // chercher un titre corrigé sans jamais le trouver.
      searchText: normalizeForSearch(
        [colonnes.title, colonnes.author, colonnes.baseGame].filter(Boolean).join(" "),
      ),
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))
    .run();

  revalidatePath("/admin/bibliotheque");
  revalidatePath("/", "layout");

  const nombre = Object.keys(retouche).filter((cle) => cle !== "publie").length;
  return {
    ok: true,
    message:
      nombre === 0
        ? `${colonnes.title} suit entièrement son game.json.`
        : `${colonnes.title} enregistré — ${nombre} champ${nombre > 1 ? "s" : ""} retouché${nombre > 1 ? "s" : ""}.`,
  };
}
