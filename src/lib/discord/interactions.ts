import { createPublicKey, verify } from "node:crypto";

/**
 * Les interactions que Discord envoie au site : ce qu'il faut pour qu'une
 * commande **tapée** dans un salon — `/prism` — lance l'Activité, et pour
 * que le bouton du lanceur puisse passer par le même chemin.
 *
 * La commande d'entrée que Discord crée pour toute Activité ne s'affiche que
 * dans le lanceur d'applications : elle ne se tape pas. Une commande qui se
 * tape est une commande ordinaire, et Discord ne la lance pas lui-même : il
 * demande à l'application quoi répondre, par une requête signée envoyée à
 * l'adresse qu'elle a déclarée. Le site y répond « lance l'Activité », et
 * c'est tout ce qu'il y répond jamais.
 *
 * La commande d'entrée arrive ici aussi quand on a demandé à Discord de ne
 * plus la lancer lui-même (`./commande.ts`) : c'est une commande comme une
 * autre, et la réponse est la même.
 *
 * Ce module ne fait que vérifier la signature et choisir la réponse. Il ne
 * lit pas la configuration et n'importe rien du site : la route
 * (`src/app/api/discord/interactions`) lui passe les clés.
 */

/** Les types d'interaction de Discord dont le site s'occupe. */
const PING = 1;
const COMMANDE = 2;

/** Les réponses : `PONG`, et `LAUNCH_ACTIVITY` — « ouvre l'Activité de cette application ». */
const PONG = 1;
const LANCER_L_ACTIVITE = 12;

/** Une clé Ed25519 brute fait 32 octets ; Node la veut dans son enveloppe SPKI. */
const ENVELOPPE_SPKI = Buffer.from("302a300506032b6570032100", "hex");

export const FORME_CLE_PUBLIQUE = /^[0-9a-f]{64}$/i;
const FORME_SIGNATURE = /^[0-9a-f]{128}$/i;

/**
 * La requête vient-elle bien de Discord, pour cette application ? Discord
 * signe l'horodatage suivi du corps, tel qu'il l'envoie : c'est le texte brut
 * qu'il faut vérifier, pas un corps relu puis réécrit.
 */
export function signatureValide(cle: string, signature: string, horodatage: string, corps: string): boolean {
  if (!FORME_CLE_PUBLIQUE.test(cle) || !FORME_SIGNATURE.test(signature) || !horodatage) return false;
  try {
    const publique = createPublicKey({
      key: Buffer.concat([ENVELOPPE_SPKI, Buffer.from(cle, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(horodatage + corps, "utf8"), publique, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/** L'application à laquelle Discord dit s'adresser, si le corps le dit. */
export function applicationVisee(corps: string): string | null {
  try {
    const id = (JSON.parse(corps) as { application_id?: unknown } | null)?.application_id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/**
 * Ce qu'on répond à une interaction dont la signature est bonne, ou `null`
 * pour ce que le site n'a jamais demandé à recevoir — un bouton, un
 * formulaire : il n'en envoie aucun.
 *
 * Le corps n'est lu que pour son type. Discord y joint qui a tapé la
 * commande, et où : le site n'en fait rien et n'en garde rien. Les droits du
 * joueur se vérifient à l'ouverture de l'Activité, comme pour un lancement
 * depuis le lanceur (`src/app/api/discord/session`).
 */
export function reponse(corps: string): { type: number } | null {
  let type: unknown;
  try {
    type = (JSON.parse(corps) as { type?: unknown } | null)?.type;
  } catch {
    return null;
  }
  if (type === PING) return { type: PONG };
  if (type === COMMANDE) return { type: LANCER_L_ACTIVITE };
  return null;
}
