"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guard";
import { restaurerCopie } from "@/lib/saves";

/**
 * Ce qu'un joueur peut faire de ses copies de secours : en remettre une à la
 * place de sa sauvegarde courante. La version remplacée part elle-même dans
 * les copies, donc le geste se défait.
 */
export async function restaurer(copieId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const fait = await restaurerCopie(user.id, copieId);
  revalidatePath("/mes-jeux");
  return fait
    ? { ok: true, message: "Copie restaurée. Elle sera chargée à la prochaine ouverture du jeu." }
    : { ok: false, message: "Cette copie n'existe plus." };
}
