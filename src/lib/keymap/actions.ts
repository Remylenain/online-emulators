"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { keymaps } from "@/db/schema";
import { newId } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guard";
import { ACTIONS, BUTTONS, CONSOLE_SLUGS, DEFAULT_KEYMAP, type ButtonName } from "@/lib/consoles";
import { MOTIF_ENTREE } from "@/lib/manette";
import { ecrireDisposition } from "./disposition";
import { ligneDuCompte } from "./lecture";

/**
 * Touches du clavier et boutons de la manette d'un compte.
 *
 * Une disposition vaut pour toutes les consoles : le joueur règle ses touches
 * une fois, et les retrouve partout. Elle est enregistrée telle quelle en
 * JSON — une colonne par bouton figerait le modèle pour rien.
 *
 * Un bouton peut rester sans touche : quand le joueur donne à un bouton la
 * touche d'un autre, cet autre la perd, et le lecteur le lui signale. On
 * l'enregistre vide plutôt que de lui rendre sa touche par défaut, qui
 * pourrait être justement celle qu'on vient de lui prendre.
 */

const BOUTONS = [...BUTTONS.common, ...BUTTONS.shoulder, ...ACTIONS] as const;
const NOM_BOUTON = z.enum(BOUTONS as unknown as [string, ...string[]]);
const CONSOLE = z.enum(CONSOLE_SLUGS as [string, ...string[]]);

/** Combien de manettes non reconnues un compte retient ; au-delà, les plus anciennes sortent. */
const MANETTES_MAX = 20;

const schema = z.object({
  console: CONSOLE,
  // `partialRecord` : un bouton sans touche est simplement absent.
  mapping: z.partialRecord(
    NOM_BOUTON,
    // Une lettre, un chiffre, ou un code de touche comme « ArrowUp ».
    z.string().trim().min(1).max(32),
  ),
});

/** Une entrée de manette : `b7`, `a1-`, `h9u` (voir `src/lib/manette.ts`). */
const schemaManette = z.object({
  console: CONSOLE,
  mapping: z.partialRecord(NOM_BOUTON, z.string().regex(MOTIF_ENTREE)),
  /** « appareil|nom de la manette », pour une manette que le navigateur ne reconnaît pas. */
  cle: z.string().trim().min(1).max(300).optional(),
});

export type ResultatTouches = { ok: boolean; message?: string };

/** Écrit dans la ligne du compte, ou la crée — avec les dispositions par défaut pour le reste. */
function ecrire(
  userId: string,
  consoleSlug: string,
  champs: { mapping?: string; gamepad?: string | null; gamepads?: string | null },
): void {
  const ligne = ligneDuCompte(userId);
  if (ligne) {
    db.update(keymaps)
      .set({ ...champs, updatedAt: new Date() })
      .where(eq(keymaps.id, ligne.id))
      .run();
    return;
  }
  db.insert(keymaps)
    .values({
      id: newId(),
      userId,
      consoleSlug,
      mapping: JSON.stringify(DEFAULT_KEYMAP),
      ...champs,
    })
    .run();
}

/**
 * Les manettes non reconnues, telles qu'enregistrées : on les réécrit sans
 * les interpréter, pour qu'un bouton laissé vide le reste.
 */
function manettesEnregistrees(texte: string | null | undefined): Record<string, unknown> {
  try {
    const lues: unknown = JSON.parse(texte ?? "{}");
    return lues && typeof lues === "object" ? { ...lues } : {};
  } catch {
    return {};
  }
}

/**
 * Deux boutons sur la même touche rendraient le jeu injouable sans que rien
 * ne l'explique : on refuse plutôt que d'enregistrer une configuration dont
 * le joueur découvrirait l'effet en pleine partie.
 */
function enDouble(mapping: Record<string, string | undefined>): boolean {
  const valeurs = Object.values(mapping).filter(Boolean);
  return new Set(valeurs).size !== valeurs.length;
}

export async function enregistrerTouches(
  console_: string,
  mapping: Record<string, string>,
): Promise<ResultatTouches> {
  const user = await requireUser();

  const valide = schema.safeParse({ console: console_, mapping });
  if (!valide.success) {
    return { ok: false, message: "Disposition invalide." };
  }
  if (enDouble(valide.data.mapping)) {
    return { ok: false, message: "Deux boutons ne peuvent pas partager la même touche." };
  }

  ecrire(user.id, valide.data.console, { mapping: ecrireDisposition(BOUTONS, valide.data.mapping) });
  return { ok: true };
}

/**
 * Efface la disposition clavier du compte : la configuration par défaut
 * reprend. La manette, si elle a été réglée, reste.
 */
export async function retablirTouches(console_: string): Promise<ResultatTouches> {
  const user = await requireUser();
  if (!CONSOLE_SLUGS.includes(console_)) return { ok: false, message: "Console inconnue." };

  if (ligneDuCompte(user.id)) ecrire(user.id, console_, { mapping: JSON.stringify(DEFAULT_KEYMAP) });
  return { ok: true };
}

/**
 * La disposition manette du compte, dans la même ligne que le clavier.
 *
 * Sans `cle`, c'est celle des manettes à numérotation standard, la même sur
 * tous les appareils. Avec, c'est celle d'une manette que le navigateur ne
 * reconnaît pas : sa numérotation lui est propre, et change d'un système à
 * l'autre — la clé porte donc le type d'appareil en plus du nom de la manette.
 */
export async function enregistrerManette(
  console_: string,
  mapping: Record<string, string>,
  cle?: string,
): Promise<ResultatTouches> {
  const user = await requireUser();
  const valide = schemaManette.safeParse({ console: console_, mapping, cle });
  if (!valide.success) return { ok: false, message: "Disposition invalide." };
  if (enDouble(valide.data.mapping)) {
    return { ok: false, message: "Deux boutons ne peuvent pas partager la même entrée." };
  }

  const serialise = ecrireDisposition(BOUTONS, valide.data.mapping);
  if (!valide.data.cle) {
    ecrire(user.id, valide.data.console, { gamepad: serialise });
    return { ok: true };
  }

  // La manette réglée passe en dernier : c'est l'ordre dans lequel on oublie.
  const manettes = manettesEnregistrees(ligneDuCompte(user.id)?.gamepads);
  delete manettes[valide.data.cle];
  manettes[valide.data.cle] = JSON.parse(serialise);
  const gardees = Object.entries(manettes).slice(-MANETTES_MAX);
  ecrire(user.id, valide.data.console, { gamepads: JSON.stringify(Object.fromEntries(gardees)) });
  return { ok: true };
}

export async function retablirManette(console_: string, cle?: string): Promise<ResultatTouches> {
  const user = await requireUser();
  if (!CONSOLE_SLUGS.includes(console_)) return { ok: false, message: "Console inconnue." };
  const ligne = ligneDuCompte(user.id);
  if (!ligne) return { ok: true };

  if (!cle) {
    ecrire(user.id, console_, { gamepad: null });
    return { ok: true };
  }
  const manettes = manettesEnregistrees(ligne.gamepads);
  delete manettes[cle];
  ecrire(user.id, console_, { gamepads: Object.keys(manettes).length > 0 ? JSON.stringify(manettes) : null });
  return { ok: true };
}

export type { ButtonName };
