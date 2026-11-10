/**
 * Réserver l'Activité à certains rôles du serveur du verrou.
 *
 * Le verrou (`./instance.ts`) dit **où** le joueur lance l'Activité ; ce
 * module dit **qui** il est dans ce serveur. C'est encore notre serveur qui
 * pose la question à Discord, avec le jeton de bot de l'application : rien
 * de ce que la page affirme n'entre dans la décision.
 *
 * Une différence avec le verrou : Discord ne répond sur les membres d'un
 * serveur qu'à un bot qui en fait partie. Le bot doit donc y être **invité**
 * — sans aucune permission, il n'a rien à y faire d'autre que répondre ici.
 *
 * Comme `./instance.ts`, ce module ne lit pas la configuration et n'importe
 * rien du site : on lui donne ce dont il a besoin.
 */
const API = "https://discord.com/api";

export type AccesServeur = {
  jetonBot: string;
  /** Le serveur du verrou. */
  serveur: string;
};

export type RoleDiscord = {
  id: string;
  nom: string;
  /** La couleur du rôle dans Discord, `0` s'il n'en a pas. */
  couleur: number;
};

/** Les codes d'erreur de Discord qui disent « ce bot n'a pas accès à ce serveur ». */
const SERVEUR_INCONNU = 10004;
const ACCES_REFUSE = 50001;
const MEMBRE_INCONNU = 10007;

async function demander(acces: AccesServeur, chemin: string): Promise<{ statut: number; corps: unknown }> {
  const reponse = await fetch(`${API}/guilds/${encodeURIComponent(acces.serveur)}${chemin}`, {
    headers: { Authorization: `Bot ${acces.jetonBot}` },
    cache: "no-store",
  });
  return { statut: reponse.status, corps: await reponse.json().catch(() => null) };
}

function codeDErreur(corps: unknown): number | null {
  const code = (corps as { code?: unknown } | null)?.code;
  return typeof code === "number" ? code : null;
}

/** Le bot ne voit pas ce serveur : il n'y est pas, ou l'identifiant est faux. */
function botAbsent(statut: number, corps: unknown): boolean {
  const code = codeDErreur(corps);
  return code === SERVEUR_INCONNU || code === ACCES_REFUSE || (statut === 403 && code === null);
}

export type RolesDuServeur =
  | { ok: true; roles: RoleDiscord[] }
  | { ok: false; motif: "bot-absent" | "jeton-refuse" | "discord-injoignable" };

/**
 * Les rôles du serveur, du plus haut au plus bas comme dans Discord, pour que
 * l'administrateur les choisisse par leur nom. Sans `@everyone`, qui porte
 * l'identifiant du serveur : le choisir reviendrait à ne rien réserver.
 */
export async function rolesDuServeur(acces: AccesServeur): Promise<RolesDuServeur> {
  let reponse: Awaited<ReturnType<typeof demander>>;
  try {
    reponse = await demander(acces, "/roles");
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
  if (reponse.statut === 401) return { ok: false, motif: "jeton-refuse" };
  if (botAbsent(reponse.statut, reponse.corps) || reponse.statut === 404) return { ok: false, motif: "bot-absent" };
  if (reponse.statut !== 200 || !Array.isArray(reponse.corps)) return { ok: false, motif: "discord-injoignable" };

  type Brut = { id?: unknown; name?: unknown; color?: unknown; position?: unknown };
  const roles = (reponse.corps as Brut[])
    .filter((role): role is Brut & { id: string; name: string } => typeof role.id === "string" && typeof role.name === "string")
    .filter((role) => role.id !== acces.serveur)
    .sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0))
    .map((role) => ({ id: role.id, nom: role.name, couleur: typeof role.color === "number" ? role.color : 0 }));
  return { ok: true, roles };
}

export type DroitDeJouer =
  | { permis: true }
  | {
      permis: false;
      /**
       * `sans-role` et `pas-membre` : le joueur n'a pas le droit. Les autres :
       * la question n'a pas pu être posée, et c'est un réglage à revoir.
       */
      motif: "sans-role" | "pas-membre" | "bot-absent" | "jeton-refuse" | "discord-injoignable";
    };

/**
 * L'utilisateur porte-t-il l'un des rôles permis ?
 *
 * Un seul suffit. En cas de doute — Discord injoignable, bot absent du
 * serveur —, c'est non, comme pour le verrou : une réserve qui s'ouvre quand
 * elle ne peut pas vérifier n'en est pas une.
 */
export async function verifierRoles(acces: AccesServeur, utilisateur: string, permis: readonly string[]): Promise<DroitDeJouer> {
  let reponse: Awaited<ReturnType<typeof demander>>;
  try {
    reponse = await demander(acces, `/members/${encodeURIComponent(utilisateur)}`);
  } catch {
    return { permis: false, motif: "discord-injoignable" };
  }
  if (reponse.statut === 401) return { permis: false, motif: "jeton-refuse" };
  if (codeDErreur(reponse.corps) === MEMBRE_INCONNU) return { permis: false, motif: "pas-membre" };
  if (botAbsent(reponse.statut, reponse.corps)) return { permis: false, motif: "bot-absent" };
  // Un 404 sans code : on ne sait pas si c'est le membre ou le serveur.
  if (reponse.statut === 404) return { permis: false, motif: "pas-membre" };
  if (reponse.statut !== 200) return { permis: false, motif: "discord-injoignable" };

  const portes = (reponse.corps as { roles?: unknown } | null)?.roles;
  if (!Array.isArray(portes)) return { permis: false, motif: "discord-injoignable" };
  return portes.some((role) => typeof role === "string" && permis.includes(role))
    ? { permis: true }
    : { permis: false, motif: "sans-role" };
}

/** Un identifiant Discord : rôle, serveur, utilisateur. */
const FORME_IDENTIFIANT = /^\d{17,20}$/;

/** Au-delà, ce n'est plus une réserve mais la liste des rôles du serveur. */
export const ROLES_MAX = 50;

/** Relit des rôles enregistrés (un tableau JSON, ou une liste à virgules pour l'environnement). */
export function lireRoles(texte: string | null | undefined): string[] {
  if (!texte) return [];
  let lus: unknown;
  try {
    lus = texte.trim().startsWith("[") ? JSON.parse(texte) : texte.split(",").map((morceau) => morceau.trim());
  } catch {
    return [];
  }
  if (!Array.isArray(lus)) return [];
  return [...new Set(lus.filter((role): role is string => typeof role === "string" && FORME_IDENTIFIANT.test(role)))].slice(0, ROLES_MAX);
}

/**
 * L'adresse qui invite le bot dans le serveur du verrou, sans aucune
 * permission : il n'a qu'à y être pour que Discord réponde sur ses membres.
 */
export function invitationDuBot(application: string, serveur: string): string {
  const parametres = new URLSearchParams({
    client_id: application,
    scope: "bot",
    permissions: "0",
    guild_id: serveur,
    disable_guild_select: "true",
  });
  return `https://discord.com/oauth2/authorize?${parametres}`;
}
