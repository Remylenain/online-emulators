import { LIBELLES_CLAVIER, type Touche } from "../../consoles";
import { enumerer } from "../../keymap/disposition";
import { LIBELLES_MANETTE } from "../../manette";

/**
 * Les commandes du jeu : les écrans où l'on attribue les touches du clavier
 * et les boutons de la manette, et la manette tactile.
 *
 * Trois mots à ne pas confondre : un **bouton** est celui de la console (A,
 * B, Start…) ; une **touche** est celle du clavier qu'on lui attribue ; une
 * **entrée** est ce que la manette envoie — bouton, stick ou croix.
 */
export const commandes = {
  /**
   * Les boutons de la console, tels que les écrans de réglage les nomment, et
   * l'action du lecteur qui se règle avec eux. Les lettres ne se traduisent
   * pas : ce sont celles gravées sur la console.
   */
  boutons: {
    A: "A",
    B: "B",
    START: "Start",
    SELECT: "Select",
    UP: "Haut",
    DOWN: "Bas",
    LEFT: "Gauche",
    RIGHT: "Droite",
    L: "L",
    R: "R",
    /** Accélère tant qu'on la tient, et pas au-delà : d'où la parenthèse. */
    FAST: "Accélérer (maintenir)",
  } satisfies Record<Touche, string>,

  /**
   * Les noms des touches du clavier, pour `keyLabel`, et ceux des entrées de
   * la manette, pour `libelleManette`. Le français est écrit dans ces deux
   * modules, qui ne peuvent rien importer et dont il est la valeur par
   * défaut (voir `src/lib/consoles.ts`) ; il est repris ici tel quel, pour
   * que les autres langues en suivent la forme.
   */
  clavier: LIBELLES_CLAVIER,
  entrees: LIBELLES_MANETTE,

  /** Quand l'enregistreur refuse sans dire pourquoi. */
  enregistrementRefuse: "Enregistrement refusé.",
  retablissementRefuse: "Opération refusée.",

  /** Le réglage des touches du clavier. */
  touches: {
    titre: "Touches",
    explication:
      "Clique sur une touche, puis appuie sur celle que tu veux. Échap annule. " +
      "Tes touches sont enregistrées sur ton compte, pour toutes les consoles.",
    /** Pour un invité, qui n'a pas de compte. */
    explicationLocale:
      "Clique sur une touche, puis appuie sur celle que tu veux. Échap annule. " +
      "Tes touches sont gardées dans ce navigateur.",
    /**
     * Les boutons dont la touche vient d'être donnée à un autre. `noms` sont
     * ceux de `boutons`, un au moins.
     */
    sansTouche: (noms: string[]) =>
      noms.length > 1
        ? `${enumerer(noms)} n'ont plus de touche : leur touche est passée à un autre bouton. ` +
          "Clique dessus pour leur en donner une."
        : `${enumerer(noms)} n'a plus de touche : sa touche est passée à un autre bouton. ` +
          "Clique dessus pour lui en donner une.",
    /** Pour un invité : le stockage du navigateur est plein, ou désactivé. */
    refuseLocal: "Le navigateur a refusé d'enregistrer ce réglage : il vaut pour cette partie seulement.",
    /** À la place du nom de la touche, en minuscules : une étiquette, pas une phrase. */
    aucune: "aucune",
    retablir: "Rétablir les touches par défaut",
  },

  /** Le réglage de la manette branchée. */
  manette: {
    titre: "Manette",
    /** « Touche » et non « Clique » : cet écran sert aussi sur un téléphone. */
    explication: "Touche un bouton ci-dessous, puis appuie sur l'entrée voulue de la manette.",
    aBrancher: "Branche une manette (USB ou Bluetooth) et appuie sur un de ses boutons pour qu'elle soit vue.",
    /** À la place du nom d'une manette qui n'en annonce aucun. */
    sansNom: "Manette",
    /** Ces deux textes suivent le nom de la manette et un tiret : pas de majuscule. */
    standard:
      "reconnue par le navigateur, numérotation standard. " +
      "Le réglage ci-dessous est enregistré sur ton compte, pour toutes les consoles.",
    numerotationPropre:
      "numérotation propre à cette manette sur ce type d'appareil : " +
      "le réglage ci-dessous est enregistré sur ton compte pour elle, et ne change rien pour tes autres manettes.",
    aRegler:
      "Le navigateur ne reconnaît pas cette manette : ses boutons ne sont pas là où on les attend. " +
      "Attribue-les une fois, un par un — c'est l'affaire d'une minute.",
    /** Les boutons dont l'entrée vient d'être donnée à un autre. `noms` sont ceux de `boutons`, un au moins. */
    sansBouton: (noms: string[]) =>
      noms.length > 1
        ? `${enumerer(noms)} n'ont plus de bouton sur la manette : le leur est passé à un autre. ` +
          "Touche-les ci-dessous pour leur en donner un."
        : `${enumerer(noms)} n'a plus de bouton sur la manette : le sien est passé à un autre. ` +
          "Touche-le ci-dessous pour lui en donner un.",
    /** À la place du nom de l'entrée, en minuscules : une étiquette, pas une phrase. */
    aucune: "aucune",
    stickGauche: "Le stick gauche fait toujours la croix, en plus de ce qui est réglé ici.",
    retablir: "Rétablir la manette par défaut",
  },

  /** La manette tactile : elle n'a de texte que pour les lecteurs d'écran. */
  tactile: {
    /** Une case de la croix : une direction, ou deux pour une diagonale. `noms` sont ceux de `boutons`. */
    directions: (noms: string[]) => noms.join(" et "),
  },
};
