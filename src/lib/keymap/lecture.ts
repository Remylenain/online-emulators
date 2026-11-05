import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { keymaps } from "@/db/schema";
import { DEFAULT_KEYMAP } from "@/lib/consoles";
import { MANETTE_PAR_DEFAUT } from "@/lib/manette";
import { lireDisposition, type Disposition } from "./disposition";

/** La ligne qui fait foi pour un compte : la plus récemment modifiée. */
export function ligneDuCompte(userId: string) {
  return db.select().from(keymaps).where(eq(keymaps.userId, userId)).orderBy(desc(keymaps.updatedAt)).get();
}

export type DispositionsDuCompte = {
  /** Clavier. */
  touches: Disposition;
  /** Manette à numérotation standard. */
  manette: Disposition;
  /** Manettes non reconnues, par « appareil|nom de la manette ». */
  manettes: Record<string, Disposition>;
};

/**
 * Les touches et la manette d'un compte, lues côté serveur pour que le lecteur
 * démarre avec les bonnes dès la première image, sans attendre une requête.
 * Rien d'enregistré, ou quelque chose d'illisible : les dispositions par
 * défaut, plutôt que de bloquer la partie.
 */
export function dispositionsDuCompte(userId: string): DispositionsDuCompte {
  const ligne = ligneDuCompte(userId);
  return {
    touches: lireDisposition(DEFAULT_KEYMAP, ligne?.mapping),
    manette: lireDisposition(MANETTE_PAR_DEFAUT, ligne?.gamepad),
    manettes: lireManettes(ligne?.gamepads),
  };
}

/** Les manettes non reconnues enregistrées : `{ "appareil|nom": disposition }`. */
export function lireManettes(texte: string | null | undefined): Record<string, Disposition> {
  if (!texte) return {};
  try {
    const lues: unknown = JSON.parse(texte);
    if (!lues || typeof lues !== "object") return {};
    return Object.fromEntries(
      Object.entries(lues).map(([cle, valeur]) => [cle, lireDisposition(MANETTE_PAR_DEFAUT, JSON.stringify(valeur))]),
    );
  } catch {
    return {};
  }
}
