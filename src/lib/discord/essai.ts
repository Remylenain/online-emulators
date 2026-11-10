import type { Dictionnaire } from "@/lib/i18n/dictionnaires";
import type { ConfigActivite, ServeurPermis } from "./applications";
import { rolesDuServeur } from "./roles";

/**
 * Essayer les réglages d'une application auprès de Discord, depuis
 * l'administration, avant de lancer quoi que ce soit dans Discord.
 *
 * Trois questions, posées comme l'Activité les posera :
 * - l'identifiant et le secret vont-ils ensemble ? (le jeton `client_credentials`
 *   s'obtient avec les deux, sans utilisateur) ;
 * - le jeton de bot est-il accepté ? ;
 * - chaque serveur du verrou existe-t-il, et le bot y est-il ? ;
 * - ses rôles réservés existent-ils encore, et le bot peut-il les lire ?
 *
 * Rien de secret ne sort d'ici : des verdicts, pas des jetons.
 */
const API = "https://discord.com/api";

export type Verdict = { ok: boolean; detail: string };

export type EssaiApplication = {
  identifiants: Verdict;
  /** `null` : aucun jeton de bot à essayer. */
  bot: Verdict | null;
  /** Un par serveur du verrou ; vide : pas de verrou, ou pas de jeton pour l'essayer. */
  serveurs: EssaiServeur[];
};

export type EssaiServeur = {
  id: string;
  serveur: Verdict;
  /** `null` : aucun rôle réservé dans ce serveur. */
  roles: Verdict | null;
};

/** Les textes des verdicts : ceux de la langue de l'administrateur qui lance l'essai. */
type Libelles = Dictionnaire["adminDiscord"]["essai"]["verdicts"];

async function identifiants(application: ConfigActivite, t: Libelles): Promise<Verdict> {
  try {
    const reponse = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${application.clientId}:${application.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "identify" }),
      cache: "no-store",
    });
    if (reponse.ok) return { ok: true, detail: t.identifiantsAcceptes };
    if (reponse.status === 401) {
      return { ok: false, detail: t.identifiantsRefuses };
    }
    return { ok: false, detail: t.reponse(reponse.status) };
  } catch {
    return { ok: false, detail: t.injoignable };
  }
}

async function bot(application: ConfigActivite, t: Libelles): Promise<Verdict> {
  try {
    const reponse = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bot ${application.botToken}` },
      cache: "no-store",
    });
    if (!reponse.ok) {
      return {
        ok: false,
        detail: reponse.status === 401 ? t.jetonRefuse : t.reponse(reponse.status),
      };
    }
    const corps = (await reponse.json()) as { id?: unknown; username?: unknown };
    const meme = corps.id === application.clientId;
    return {
      ok: meme,
      detail: meme
        ? t.jetonAccepte(String(corps.username ?? "bot"))
        : t.jetonDUneAutre,
    };
  } catch {
    return { ok: false, detail: t.injoignable };
  }
}

async function serveur(application: ConfigActivite, id: string, t: Libelles): Promise<Verdict> {
  try {
    const reponse = await fetch(`${API}/guilds/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bot ${application.botToken}` },
      cache: "no-store",
    });
    if (reponse.ok) {
      const corps = (await reponse.json()) as { name?: unknown };
      return { ok: true, detail: t.serveurTrouve(String(corps.name ?? id)) };
    }
    if (reponse.status === 403 || reponse.status === 404) {
      // Discord ne distingue pas un serveur inexistant d'un serveur où le
      // bot n'est pas : il répond 404 dans les deux cas. Le verrou, lui,
      // n'a pas besoin que le bot soit membre : il interroge l'instance de
      // l'Activité, pas le serveur.
      return {
        ok: false,
        detail: t.serveurInvisible,
      };
    }
    return { ok: false, detail: t.reponse(reponse.status) };
  } catch {
    return { ok: false, detail: t.injoignable };
  }
}

/**
 * Les rôles réservés ne pardonnent pas une erreur de réglage : si le bot ne
 * peut pas les lire, ou s'ils ont été supprimés du serveur, plus personne
 * n'entre. Autant le savoir d'ici.
 */
async function roles(application: ConfigActivite, permis: ServeurPermis, t: Libelles): Promise<Verdict> {
  const lus = await rolesDuServeur({ jetonBot: application.botToken, serveur: permis.id });
  if (!lus.ok) {
    return { ok: false, detail: lus.motif === "bot-absent" ? t.rolesBotAbsent : t.rolesIllisibles };
  }
  const connus = new Map(lus.roles.map((role) => [role.id, role.nom]));
  const disparus = permis.roles.filter((id) => !connus.has(id)).length;
  const noms = permis.roles.flatMap((id) => connus.get(id) ?? []);
  if (noms.length === 0) return { ok: false, detail: t.rolesTousDisparus };
  return disparus > 0
    ? { ok: false, detail: t.rolesDisparus(noms, disparus) }
    : { ok: true, detail: t.rolesReserves(noms) };
}

export async function essayerApplication(application: ConfigActivite, t: Libelles): Promise<EssaiApplication> {
  const serveurs: EssaiServeur[] = [];
  // L'un après l'autre : quelques serveurs, et Discord compte les appels.
  for (const permis of application.botToken ? application.serveurs : []) {
    serveurs.push({
      id: permis.id,
      serveur: await serveur(application, permis.id, t),
      roles: permis.roles.length > 0 ? await roles(application, permis, t) : null,
    });
  }
  return {
    identifiants: await identifiants(application, t),
    bot: application.botToken ? await bot(application, t) : null,
    serveurs,
  };
}
