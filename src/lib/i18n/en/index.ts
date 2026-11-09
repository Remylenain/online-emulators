import type { Dictionnaire } from "../dictionnaires";
import { commandes } from "./commandes";
import { commun } from "./commun";
import { lecteur } from "./lecteur";
import { partie } from "./partie";
import { vitrine } from "./vitrine";

export const en: Dictionnaire = { commun, vitrine, lecteur, partie, commandes };
