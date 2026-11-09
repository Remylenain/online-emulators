/**
 * Les langues de l'interface, dans un module neutre : le serveur comme le
 * navigateur le lisent.
 *
 * Le français est la langue de référence — celle dans laquelle le site a été
 * écrit, et celle dont les dictionnaires des autres langues doivent suivre la
 * forme (voir `./dictionnaires.ts`).
 */
export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export const LANGUE_DE_REFERENCE: Langue = "fr";

/** Le nom de chaque langue, dans cette langue : c'est ainsi qu'on la reconnaît. */
export const NOM_DES_LANGUES: Record<Langue, string> = { fr: "Français", en: "English" };

/**
 * Le cookie qui retient un choix **explicite** du visiteur. Il n'est posé que
 * par le sélecteur de langue : sans clic, le site ne dépose rien et s'en
 * remet au navigateur.
 */
export const COOKIE_LANGUE = "oe_langue";

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === "string" && (LANGUES as readonly string[]).includes(valeur);
}

/**
 * La langue d'un code comme « fr », « en-US » ou « FR-fr » ; `null` pour une
 * langue que le site ne parle pas. Sert aux en-têtes du navigateur comme à la
 * langue déclarée d'un jeu.
 */
export function langueDuCode(code: string | null | undefined): Langue | null {
  const court = code?.trim().toLowerCase().split(/[-_]/)[0];
  return estLangue(court) ? court : null;
}

/**
 * La première langue connue de l'en-tête `Accept-Language`, dans l'ordre de
 * préférence du navigateur (`q`), ou `null` s'il n'en demande aucune que le
 * site parle.
 */
export function langueDeLEntete(entete: string | null | undefined): Langue | null {
  if (!entete) return null;
  const demandes = entete
    .split(",")
    .map((morceau, rang) => {
      const [code = "", ...parametres] = morceau.trim().split(";");
      const q = parametres.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      const poids = q === undefined ? 1 : Number(q);
      return { code, poids: Number.isFinite(poids) ? poids : 0, rang };
    })
    .filter((demande) => demande.poids > 0)
    .sort((a, b) => b.poids - a.poids || a.rang - b.rang);
  for (const demande of demandes) {
    const langue = langueDuCode(demande.code);
    if (langue) return langue;
  }
  return null;
}

/** La région à passer à `toLocaleString` et à `Intl` pour les dates et les heures. */
export const REGION: Record<Langue, string> = { fr: "fr-FR", en: "en-GB" };
