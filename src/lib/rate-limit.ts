/**
 * Limitation de débit en mémoire, par fenêtre glissante.
 *
 * Le site tourne en un seul processus pour une poignée de comptes : une table
 * en mémoire suffit et évite une dépendance à Redis. Le compteur repart à zéro
 * au redémarrage, ce qui est acceptable ici — il protège contre le bourrinage
 * d'un formulaire, pas contre une attaque distribuée.
 */

type Entry = { hits: number[]; blockedUntil: number };

const buckets = new Map<string, Entry>();

export type RateLimitResult = {
  allowed: boolean;
  /** Secondes à attendre avant une nouvelle tentative. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number; blockMs?: number },
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key) ?? { hits: [], blockedUntil: 0 };

  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  entry.hits = entry.hits.filter((at) => now - at < options.windowMs);

  if (entry.hits.length >= options.limit) {
    entry.blockedUntil = now + (options.blockMs ?? options.windowMs);
    buckets.set(key, entry);
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  entry.hits.push(now);
  buckets.set(key, entry);
  return { allowed: true, retryAfter: 0 };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

// Entretien : sans cela, chaque clé vue une fois resterait en mémoire.
if (typeof setInterval === "function") {
  const cleanup = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of buckets) {
        const stale = entry.hits.every((at) => now - at > 60 * 60 * 1000);
        if (stale && entry.blockedUntil < now) buckets.delete(key);
      }
    },
    10 * 60 * 1000,
  );
  cleanup.unref?.();
}
