import { activite } from "./activite";
import { adminActions } from "./adminActions";
import { adminBibliotheque } from "./adminBibliotheque";
import { adminComptes } from "./adminComptes";
import { adminDiscord } from "./adminDiscord";
import { adminGeneral } from "./adminGeneral";
import { adminReglages } from "./adminReglages";
import { catalogue } from "./catalogue";
import { commandes } from "./commandes";
import { commun } from "./commun";
import { compte } from "./compte";
import { connexion } from "./connexion";
import { emails } from "./emails";
import { fiche } from "./fiche";
import { lecteur } from "./lecteur";
import { link } from "./link";
import { mentions } from "./mentions";
import { mesJeux } from "./mesJeux";
import { partie } from "./partie";
import { site } from "./site";
import { validation } from "./validation";
import { vitrine } from "./vitrine";

/**
 * Le dictionnaire de référence. Sa forme est celle de tous les autres
 * (`Dictionnaire`, dans `../dictionnaires.ts`). Un fichier par écran ou par
 * famille d'écrans.
 */
export const fr = {
  commun,
  vitrine,
  lecteur,
  partie,
  commandes,
  activite,
  connexion,
  emails,
  validation,
  site,
  catalogue,
  fiche,
  mesJeux,
  compte,
  link,
  adminGeneral,
  adminComptes,
  adminBibliotheque,
  adminReglages,
  adminDiscord,
  adminActions,
  mentions,
};
