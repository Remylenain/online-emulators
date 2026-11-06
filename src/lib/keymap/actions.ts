"use server";

import { requireUser } from "@/lib/auth/guard";
import type { ButtonName } from "@/lib/consoles";
import {
  enregistrerManetteDe,
  enregistrerTouchesDe,
  retablirManetteDe,
  retablirTouchesDe,
  type Enregistreur,
  type ResultatTouches,
} from "./ecriture";

/**
 * Touches et manette du compte connecté : les actions du site, par cookie de
 * session. La logique est dans `./ecriture.ts`, partagée avec l'Activité
 * Discord, qui n'a pas de cookie.
 */

export async function enregistrerTouches(console_: string, mapping: Record<string, string>): Promise<ResultatTouches> {
  const user = await requireUser();
  return enregistrerTouchesDe(user.id, console_, mapping);
}

export async function retablirTouches(console_: string): Promise<ResultatTouches> {
  const user = await requireUser();
  return retablirTouchesDe(user.id, console_);
}

export async function enregistrerManette(
  console_: string,
  mapping: Record<string, string>,
  cle?: string,
): Promise<ResultatTouches> {
  const user = await requireUser();
  return enregistrerManetteDe(user.id, console_, mapping, cle);
}

export async function retablirManette(console_: string, cle?: string): Promise<ResultatTouches> {
  const user = await requireUser();
  return retablirManetteDe(user.id, console_, cle);
}

export type { ButtonName, Enregistreur, ResultatTouches };
