import { commandes } from "./commandes";
import { commun } from "./commun";
import { lecteur } from "./lecteur";
import { partie } from "./partie";
import { vitrine } from "./vitrine";

/**
 * Le dictionnaire de référence. Sa forme est celle de tous les autres
 * (`Dictionnaire`, dans `../dictionnaires.ts`).
 */
export const fr = { commun, vitrine, lecteur, partie, commandes };
