import { cookies, headers } from "next/headers";
import { langueDuSite } from "@/lib/parametres";
import { dictionnaire, type Dictionnaire } from "./dictionnaires";
import { COOKIE_LANGUE, estLangue, langueDeLEntete, type Langue } from "./langues";

/**
 * La langue d'une requête, côté serveur.
 *
 * Dans l'ordre : le choix explicite du visiteur (le cookie posé par le
 * sélecteur de langue), puis ce que son navigateur demande, puis la langue
 * par défaut du site, réglée par l'administrateur. Un visiteur qui n'a rien
 * choisi ne reçoit donc aucun cookie.
 */

/** Le choix explicite du visiteur, s'il en a fait un. */
export async function langueChoisie(): Promise<Langue | null> {
  const choisie = (await cookies()).get(COOKIE_LANGUE)?.value;
  return estLangue(choisie) ? choisie : null;
}

export async function langueDeLaRequete(): Promise<Langue> {
  return (
    (await langueChoisie()) ?? langueDeLEntete((await headers()).get("accept-language")) ?? langueDuSite()
  );
}

/** Les textes dans la langue de la requête, pour un composant serveur. */
export async function textes(): Promise<Dictionnaire> {
  return dictionnaire(await langueDeLaRequete());
}
