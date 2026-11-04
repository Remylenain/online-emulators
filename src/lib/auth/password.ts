import { hash, verify } from "@node-rs/argon2";

/**
 * Paramètres argon2id recommandés par l'OWASP : 19 Mio de mémoire,
 * 2 passes. Le coût est volontairement perceptible (quelques dizaines de
 * millisecondes) — c'est ce qui rend une attaque par dictionnaire coûteuse.
 */
const options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password, options);
  } catch {
    // Empreinte illisible ou corrompue : on refuse sans faire échouer la requête.
    return false;
  }
}
