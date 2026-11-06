import { famille, placesLibres } from "./capacite";

/**
 * La file d'attente des Activités Discord qui veulent jouer à deux.
 *
 * Le serveur ne tient qu'un nombre de salons à la fois (`capacite.ts`). Sur
 * le site, quand c'est complet, on refuse et le joueur réessaie plus tard.
 * Dans Discord, les deux joueurs sont déjà ensemble dans un salon vocal : on
 * leur donne un rang, et le salon s'ouvre quand leur tour vient.
 *
 * Une instance s'inscrit en demandant son rang, et y reste tant qu'elle
 * redemande ; une page fermée cesse de demander, et sort de la file au bout
 * de quelques secondes. Pas de réservation : quand un salon se libère, c'est
 * la première instance de la file qui peut ouvrir le sien, et elle seule
 * (voir `peutOuvrir`). En mémoire, comme les salons.
 */
type Attente = { depuis: number; vu: number; consoleSlug: string };

/** Sans nouvelle demande pendant ce temps, l'instance a renoncé. */
const OUBLI_MS = 20_000;

const global = globalThis as unknown as { __fileLink?: Map<string, Attente> };

function file(): Map<string, Attente> {
  global.__fileLink ??= new Map();
  return global.__fileLink;
}

function purger(): void {
  const limite = Date.now() - OUBLI_MS;
  for (const [cle, attente] of file()) if (attente.vu < limite) file().delete(cle);
}

/** Les instances qui attendent la même famille de cœur, dans l'ordre d'arrivée. */
function enAttente(consoleSlug: string): string[] {
  purger();
  const f = famille(consoleSlug);
  return [...file().entries()]
    .filter(([, attente]) => famille(attente.consoleSlug) === f)
    .sort((a, b) => a[1].depuis - b[1].depuis)
    .map(([cle]) => cle);
}

export type Rang = {
  /** 0 : c'est son tour dès qu'une place se libère. */
  position: number;
  /** Instances qui attendent la même famille de cœur, celle-ci comprise. */
  total: number;
  /** Salons encore ouvrables ; `null` tant que la capacité n'est pas mesurée. */
  libres: number | null;
};

/** Inscrit l'instance, ou la garde dans la file, et rend son rang. */
export function attendre(instance: string, consoleSlug: string): Rang {
  const existante = file().get(instance);
  file().set(instance, { depuis: existante?.depuis ?? Date.now(), vu: Date.now(), consoleSlug });
  const liste = enAttente(consoleSlug);
  return { position: liste.indexOf(instance), total: liste.length, libres: placesLibres(famille(consoleSlug)) };
}

export function quitterLaFile(instance: string): void {
  file().delete(instance);
}

/**
 * Cette instance peut-elle ouvrir un salon maintenant ? Sans limite mesurée,
 * oui. Sinon, il faut une place, et personne devant elle dans la file — une
 * instance qui n'a jamais attendu passe derrière celles qui attendent.
 */
export function peutOuvrir(instance: string, consoleSlug: string): boolean {
  const libres = placesLibres(famille(consoleSlug));
  if (libres === null) return true;
  if (libres <= 0) return false;
  const liste = enAttente(consoleSlug);
  const rang = liste.indexOf(instance);
  const devant = rang === -1 ? liste.length : rang;
  return devant < libres;
}
