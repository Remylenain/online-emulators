import type { Dictionnaire } from "@/lib/i18n/dictionnaires";
import type { CodeErreur, CodeFin } from "./protocole";

/**
 * Les textes du serveur du câble link, dans la langue du joueur.
 *
 * Le serveur envoie un code, des valeurs et un texte français (voir
 * `protocole.ts`) ; c'est ici que le navigateur en fait une phrase de son
 * dictionnaire. Le texte français reste le repli : pour un message sans code
 * — un serveur plus ancien que la page, une erreur que personne n'a prévue —,
 * pour un code que cette page ne connaît pas encore, et pour un code arrivé
 * sans les valeurs que son texte cite.
 *
 * Ce module n'est fait que pour le navigateur : il lit le dictionnaire, que
 * le serveur du câble link ne charge pas.
 */

type TextesLink = Dictionnaire["link"];

/**
 * Ce que le serveur a envoyé, tel que lu dans du JSON : rien n'y est sûr. Un
 * message de la WebSocket ou le corps d'une réponse de `/link/salons` se
 * passent tels quels.
 */
export type Avis = { code?: unknown; valeurs?: unknown } | null | undefined;

/** Les valeurs d'un message, lues avec méfiance : `null` pour ce qui manque ou n'a pas le bon type. */
type Lecture = { texte(cle: string): string | null; nombre(cle: string): number | null };

function lecture(valeurs: unknown): Lecture {
  const table = (typeof valeurs === "object" && valeurs !== null ? valeurs : {}) as Record<string, unknown>;
  return {
    texte: (cle) => (typeof table[cle] === "string" ? (table[cle] as string) : null),
    nombre: (cle) => (typeof table[cle] === "number" && Number.isFinite(table[cle]) ? (table[cle] as number) : null),
  };
}

type Redaction = (t: TextesLink, v: Lecture) => string | null;

/** Applique `rediger` si la valeur est là ; sinon `null`, et l'appelant prendra le repli. */
function avec<A>(valeur: A | null, rediger: (valeur: A) => string): string | null {
  return valeur === null ? null : rediger(valeur);
}

/** Un texte par code : en ajouter un à `CodeErreur` sans le rédiger ici ne compile pas. */
const ERREURS: Record<CodeErreur, Redaction> = {
  "non-connecte": (t) => t.erreurs.nonConnecte,
  "requete-illisible": (t) => t.erreurs.requeteIllisible,
  "methode-non-permise": (t) => t.erreurs.methodeNonPermise,
  "erreur-interne": (t) => t.erreurs.erreurInterne,
  "deja-dans-le-salon": (t, v) => avec(v.texte("salon"), t.erreurs.dejaDansLeSalon),
  "jeu-introuvable": (t) => t.erreurs.jeuIntrouvable,
  "console-sans-link": (t) => t.erreurs.consoleSansLink,
  "jeu-solo": (t) => t.erreurs.jeuSolo,
  "marge-insuffisante": (t) => t.erreurs.margeInsuffisante,
  "serveur-complet": (t, v) => avec(v.nombre("salons"), t.erreurs.serveurComplet),
  "file-d-attente": (t) => t.erreurs.fileDAttente,
  "salon-complet": (t) => t.erreurs.salonComplet,
  "deja-dans-un-autre-salon": (t) => t.erreurs.dejaDansUnAutreSalon,
  "joueur-du-salon": (t) => t.erreurs.joueurDuSalon,
  "spectateurs-fermes": (t) => t.erreurs.spectateursFermes,
  "partie-pas-commencee": (t) => t.erreurs.partiePasCommencee,
  "spectateurs-au-complet": (t, v) => avec(v.nombre("max"), t.erreurs.spectateursAuComplet),
  "salon-non-demarre": (t) => t.erreurs.salonNonDemarre,
  "demarrage-impossible": (t) => t.erreurs.demarrageImpossible,
  "coeur-jeu-refuse": (t) => t.coeur.jeuRefuse(null),
  "coeur-rom-refusee": (t, v) => avec(v.nombre("code"), t.coeur.romRefusee),
  "coeur-sans-memoire": (t, v) => avec(v.nombre("joueur"), t.coeur.sansMemoire),
  "coeur-sauvegarde-refusee": (t, v) => {
    const joueur = v.nombre("joueur");
    const code = v.nombre("code");
    return joueur === null || code === null ? null : t.coeur.sauvegardeDuJoueurRefusee(joueur, code);
  },
};

const FINS: Record<CodeFin, Redaction> = {
  demande: (t, v) => avec(v.texte("pseudo"), t.fins.demande),
  "coeur-echoue": (t) => t.fins.coeurEchoue,
  "fil-plante": (t) => t.fins.filPlante,
  "hote-absent": (t, v) => avec(v.texte("pseudo"), t.fins.hoteAbsent),
  abandon: (t) => t.fins.abandon,
};

function rediger<Code extends string>(
  table: Record<Code, Redaction>,
  t: Dictionnaire,
  avis: Avis,
  repli: string,
): string {
  const code = avis?.code;
  // `hasOwn`, et non `in` : un code ne doit pas tomber sur une méthode d'`Object`.
  if (typeof code !== "string" || !Object.hasOwn(table, code)) return repli;
  return table[code as Code](t.link, lecture(avis?.valeurs)) ?? repli;
}

/**
 * Un refus ou une erreur du serveur, dans la langue de `t`. `avis` est le
 * message reçu — `{ t: "erreur", message, code?, valeurs? }` sur la WebSocket,
 * `{ erreur, code?, valeurs? }` pour `/link/salons` — et `repli` son texte
 * français, ou ce que l'écran dit quand il n'y en a pas.
 */
export function texteErreurLink(t: Dictionnaire, avis: Avis, repli: string): string {
  return rediger(ERREURS, t, avis, repli);
}

/**
 * La raison de la fin d'une session — le message `{ t: "termine", raison,
 * code?, valeurs? }` —, dans la langue de `t`. Sans majuscule ni point : elle
 * s'affiche entre parenthèses.
 */
export function texteFinLink(t: Dictionnaire, avis: Avis, repli: string): string {
  return rediger(FINS, t, avis, repli);
}
