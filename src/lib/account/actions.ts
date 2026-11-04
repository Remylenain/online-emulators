"use server";

import { eq, sql } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { FormState } from "@/lib/auth/actions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guard";
import { paths } from "@/lib/paths";
import { changePasswordSchema, fieldErrors, updateProfileSchema } from "@/lib/validation";

export async function updateProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({
    pseudo: formData.get("pseudo"),
    email: formData.get("email"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Unicité insensible à la casse, en excluant le compte courant.
  const clash = await db
    .select({ id: users.id, pseudo: users.pseudo, email: users.email })
    .from(users)
    .where(
      parsed.data.email === null
        ? sql`${users.id} <> ${user.id} and lower(${users.pseudo}) = ${parsed.data.pseudo.toLowerCase()}`
        : sql`${users.id} <> ${user.id} and (lower(${users.pseudo}) = ${parsed.data.pseudo.toLowerCase()} or lower(${users.email}) = ${parsed.data.email})`,
    )
    .get();

  if (clash) {
    return parsed.data.email !== null && clash.email === parsed.data.email
      ? { errors: { email: "Cette adresse est déjà utilisée par un autre compte." } }
      : { errors: { pseudo: "Ce pseudo est déjà pris." } };
  }

  await db
    .update(users)
    .set({ pseudo: parsed.data.pseudo, email: parsed.data.email, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/compte");
  return { done: true, message: "Profil mis à jour." };
}

export async function changePassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const row = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (!row || !(await verifyPassword(row.passwordHash, parsed.data.currentPassword))) {
    return { errors: { currentPassword: "Mot de passe actuel incorrect." } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Les autres appareils sont déconnectés ; la session courante aussi, donc
  // l'écran suivant sera celui de la connexion.
  await destroyAllSessions(user.id);

  return {
    done: true,
    message: "Mot de passe modifié. Toutes les sessions ont été fermées : reconnecte-toi.",
  };
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;

export async function uploadAvatar(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { errors: { avatar: "Choisis une image." } };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { errors: { avatar: "L'image ne doit pas dépasser 5 Mo." } };
  }

  const relative = paths.avatar(user.id);
  const target = paths.data(relative);

  try {
    // On ne se fie pas au type déclaré par le navigateur : sharp lit l'image
    // et échoue si le contenu n'en est pas une. Le résultat est réencodé en
    // webp, ce qui écarte au passage toute donnée parasite du fichier d'origine.
    const resized = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, resized);
  } catch {
    return { errors: { avatar: "Ce fichier n'est pas une image lisible." } };
  }

  await db
    .update(users)
    .set({ avatarPath: relative, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/compte");
  revalidatePath("/");
  return { done: true, message: "Avatar mis à jour." };
}

export async function removeAvatar(): Promise<void> {
  const user = await requireUser();
  if (user.avatarPath) {
    await fs.rm(paths.data(user.avatarPath), { force: true });
  }
  await db.update(users).set({ avatarPath: null }).where(eq(users.id, user.id));
  revalidatePath("/compte");
  revalidatePath("/");
}
