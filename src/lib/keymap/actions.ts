"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { keymaps } from "@/db/schema";
import { newId } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guard";
import { ACTIONS, BUTTONS, CONSOLE_SLUGS, DEFAULT_KEYMAP, type ButtonName } from "@/lib/consoles";

/**
 * Disposition clavier d'un compte, par console.
 *
 * Elle est enregistrée telle quelle en JSON : le jeu de boutons dépend de la
 * console, et une colonne par bouton figerait le modèle pour rien.
 */

const BOUTONS = [...BUTTONS.common, ...BUTTONS.shoulder, ...ACTIONS] as const;

const schema = z.object({
  console: z.enum(CONSOLE_SLUGS as [string, ...string[]]),
  mapping: z.record(
    z.enum(BOUTONS as unknown as [string, ...string[]]),
    // Une lettre, un chiffre, ou un code de touche comme « ArrowUp ».
    z.string().trim().min(1).max(32),
  ),
});

export type ResultatTouches = { ok: boolean; message?: string };

export async function enregistrerTouches(
  console_: string,
  mapping: Record<string, string>,
): Promise<ResultatTouches> {
  const user = await requireUser();

  const valide = schema.safeParse({ console: console_, mapping });
  if (!valide.success) {
    return { ok: false, message: "Disposition invalide." };
  }

  /**
   * Deux boutons sur la même touche rendraient le jeu injouable sans que rien
   * ne l'explique : on refuse plutôt que d'enregistrer une configuration dont
   * le joueur découvrirait l'effet en pleine partie.
   */
  const touches = Object.values(valide.data.mapping);
  if (new Set(touches).size !== touches.length) {
    return { ok: false, message: "Deux boutons ne peuvent pas partager la même touche." };
  }

  // La disposition par défaut complète ce que le joueur n'a pas redéfini.
  const complet: Record<string, string> = { ...DEFAULT_KEYMAP, ...valide.data.mapping };
  const serialise = JSON.stringify(complet);
  const maintenant = new Date();

  const existante = await db
    .select({ id: keymaps.id })
    .from(keymaps)
    .where(and(eq(keymaps.userId, user.id), eq(keymaps.consoleSlug, valide.data.console)))
    .get();

  if (existante) {
    db.update(keymaps)
      .set({ mapping: serialise, updatedAt: maintenant })
      .where(eq(keymaps.id, existante.id))
      .run();
  } else {
    db.insert(keymaps)
      .values({
        id: newId(),
        userId: user.id,
        consoleSlug: valide.data.console,
        mapping: serialise,
      })
      .run();
  }

  return { ok: true };
}

/** Efface la disposition du compte : la configuration par défaut reprend. */
export async function retablirTouches(console_: string): Promise<ResultatTouches> {
  const user = await requireUser();
  if (!CONSOLE_SLUGS.includes(console_)) return { ok: false, message: "Console inconnue." };

  db.delete(keymaps)
    .where(and(eq(keymaps.userId, user.id), eq(keymaps.consoleSlug, console_)))
    .run();

  return { ok: true };
}

export type { ButtonName };
