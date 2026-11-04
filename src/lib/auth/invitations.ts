import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { INSCRIPTION_DUREE_MS, INSCRIPTION_PLAFONDS } from "./inscription";
import { generateToken, hashToken } from "./tokens";
import { newId } from "./session";

/**
 * Lien d'inscription : un jeton que l'administrateur donne à quelqu'un, et
 * avec lequel cette personne crée elle-même son compte — pseudo et mot de
 * passe. C'est l'autre façon d'ouvrir un compte, à côté de la création par
 * l'administrateur suivie du lien « choisis ton mot de passe ».
 *
 * Un lien vaut pour un nombre de comptes choisi à la création, pour qu'un
 * même lien circule dans un groupe d'amis. Le risque est celui d'un secret
 * qui passe de main en main : s'il fuit, il produit des comptes inconnus.
 * D'où la journée de validité, la révocation, et la trace gardée par chaque
 * compte du lien qui l'a créé — on retrouve d'un coup ce qu'un lien a donné.
 *
 * Comme les autres jetons, la base ne garde que l'empreinte ; la valeur en
 * clair n'existe que dans le lien remis à la personne.
 */

export { INSCRIPTION_DUREE_MS, INSCRIPTION_PLAFONDS };

export async function creerLienInscription(
  creePar: string,
  maxUses: number,
): Promise<{ token: string; expiresAt: Date }> {
  // Les jetons périmés et jamais utilisés n'ont plus de raison d'être gardés.
  // Ceux qui ont servi restent : ils disent d'où viennent les comptes.
  await db
    .delete(invites)
    .where(and(lt(invites.expiresAt, new Date()), eq(invites.usesCount, 0)));

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INSCRIPTION_DUREE_MS);
  await db.insert(invites).values({
    id: newId(),
    code: hashToken(token),
    createdBy: creePar,
    maxUses,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function revoquerLienInscription(id: string): Promise<boolean> {
  const resultat = db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, id), isNull(invites.revokedAt)))
    .run();
  return resultat.changes > 0;
}

export type LienInscription = {
  id: string;
  creeLe: Date;
  expireLe: Date;
  maxUses: number;
  usesCount: number;
  /** Pseudos des comptes nés de ce lien, du plus récent au plus ancien. */
  comptes: string[];
};

/**
 * Les liens encore en vie, et ceux qui ont servi : un lien épuisé ou périmé
 * mais qui a créé des comptes reste visible, c'est lui qui dit d'où ils
 * viennent. Un lien révoqué sans avoir servi disparaît de la liste.
 */
export async function listerLiensInscription(): Promise<LienInscription[]> {
  const maintenant = new Date();
  const lignes = await db
    .select({
      id: invites.id,
      creeLe: invites.createdAt,
      expireLe: invites.expiresAt,
      maxUses: invites.maxUses,
      usesCount: invites.usesCount,
      revoque: invites.revokedAt,
    })
    .from(invites)
    .where(
      sql`${invites.usesCount} > 0 or (${invites.revokedAt} is null and ${invites.expiresAt} > ${maintenant.getTime()})`,
    )
    .orderBy(desc(invites.createdAt))
    .all();

  const comptes = await db
    .select({ inviteId: users.inviteId, pseudo: users.pseudo })
    .from(users)
    .where(sql`${users.inviteId} is not null`)
    .orderBy(desc(users.createdAt))
    .all();

  return lignes.map((ligne) => ({
    id: ligne.id,
    creeLe: ligne.creeLe,
    // Un lien révoqué est présenté comme expiré à l'instant de la révocation.
    expireLe: ligne.revoque ?? ligne.expireLe,
    maxUses: ligne.maxUses,
    usesCount: ligne.usesCount,
    comptes: comptes.filter((c) => c.inviteId === ligne.id).map((c) => c.pseudo),
  }));
}

export type Inscription =
  | { ok: true; userId: string }
  | { ok: false; raison: "jeton" | "pseudo" };

/**
 * Crée le compte et consomme un usage du jeton, en une seule transaction :
 * deux envois du même formulaire ne peuvent pas dépasser le plafond, et un
 * pseudo pris entre l'affichage et l'envoi est refusé sans brûler le jeton.
 */
export function inscrireAvecJeton(
  token: string,
  pseudo: string,
  passwordHash: string,
): Inscription {
  const code = hashToken(token);
  return db.transaction((tx) => {
    const invitation = tx
      .select({ id: invites.id })
      .from(invites)
      .where(
        and(
          eq(invites.code, code),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, new Date()),
          sql`${invites.usesCount} < ${invites.maxUses}`,
        ),
      )
      .get();
    if (!invitation) return { ok: false, raison: "jeton" } as const;

    const doublon = tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.pseudo}) = ${pseudo.toLowerCase()}`)
      .get();
    if (doublon) return { ok: false, raison: "pseudo" } as const;

    const userId = newId();
    tx.insert(users)
      .values({ id: userId, pseudo, email: null, passwordHash, role: "USER", inviteId: invitation.id })
      .run();
    tx.update(invites)
      .set({
        usedAt: new Date(),
        usedBy: userId,
        usesCount: sql`${invites.usesCount} + 1`,
      })
      .where(eq(invites.id, invitation.id))
      .run();
    return { ok: true, userId } as const;
  });
}
