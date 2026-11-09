import { en } from "./en";
import { fr } from "./fr";
import type { Langue } from "./langues";

/**
 * Les textes de l'interface, par langue.
 *
 * Pas de clés en chaînes de caractères ni de bibliothèque : un dictionnaire
 * est un objet, et un texte se lit par son chemin — `t.lecteur.quitter`. Le
 * compilateur fait le reste. Le dictionnaire français donne la forme ; celui
 * de chaque autre langue est typé d'après lui, si bien qu'un texte oublié ou
 * en trop est une erreur de compilation, pas une chaîne vide à l'écran.
 *
 * Un texte qui dépend d'une valeur est une fonction — `t.partie.taille(n)` —
 * parce que l'ordre des mots et les accords ne se traduisent pas par simple
 * remplacement. C'est aussi pourquoi un dictionnaire ne se passe pas du
 * serveur au navigateur : chacun importe ce module, et seule la **langue**
 * voyage (voir `src/components/langue.tsx`).
 *
 * Convention pour l'emphase : un passage entre astérisques, « *ainsi* », est
 * mis en valeur par le composant qui l'affiche (`Accentue`). Les dictionnaires
 * restent du texte, sans balises.
 *
 * Tout ce qui se lit à l'écran passe par ici, administration comprise. Voir
 * `docs/langues.md` pour ce qui ne se traduit pas, et pour les cas où le
 * serveur ne peut pas choisir les mots lui-même.
 */
export type Dictionnaire = typeof fr;

const DICTIONNAIRES: Record<Langue, Dictionnaire> = { fr, en };

export function dictionnaire(langue: Langue): Dictionnaire {
  return DICTIONNAIRES[langue];
}
