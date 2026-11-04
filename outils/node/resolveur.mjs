/**
 * Résolveur de modules pour Node : alias `@/` et extensions implicites.
 *
 * Deux règles, et rien d'autre :
 *
 * - `@/truc` désigne `src/truc`, comme dans `tsconfig.json`.
 * - Un import sans extension que Node ne trouve pas est réessayé avec les
 *   extensions que Next devinerait à sa place.
 *
 * Tout ce que Node résout déjà passe sans être touché : la règle ne joue que
 * sur l'échec, et seulement pour « introuvable ».
 */
import { pathToFileURL } from "node:url";

const racineSrc = pathToFileURL(`${process.cwd()}/src/`).href;

/**
 * Extensions essayées quand l'import n'en porte pas, dans l'ordre de Next.
 *
 * Le `.js` final n'est pas pour nos fichiers : il est pour `next/headers` et
 * ses semblables, que Next publie sans carte d'exports. Un bundler les trouve
 * en devinant l'extension ; Node, en mode ESM strict, ne devine rien.
 */
const SUFFIXES = [".ts", ".tsx", "/index.ts", ".js", "/index.js"];

const INTROUVABLE = new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"]);

export async function resolve(specifier, context, suivant) {
  // Les modules internes de Node et les URL complètes ne se devinent pas.
  if (specifier.startsWith("node:") || specifier.includes("://")) {
    return suivant(specifier, context);
  }

  const base = specifier.startsWith("@/") ? racineSrc + specifier.slice(2) : specifier;

  // Avec l'extension déjà écrite, rien à deviner.
  try {
    return await suivant(base, context);
  } catch (erreur) {
    if (!INTROUVABLE.has(erreur?.code)) throw erreur;
  }

  for (const suffixe of SUFFIXES) {
    try {
      return await suivant(base + suffixe, context);
    } catch (erreur) {
      if (!INTROUVABLE.has(erreur?.code)) throw erreur;
    }
  }

  // Rien trouvé : on laisse Node produire son erreur habituelle.
  return suivant(base, context);
}
