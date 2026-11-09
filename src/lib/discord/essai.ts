import type { Dictionnaire } from "@/lib/i18n/dictionnaires";
import type { ConfigActivite } from "./applications";

/**
 * Essayer les réglages d'une application auprès de Discord, depuis
 * l'administration, avant de lancer quoi que ce soit dans Discord.
 *
 * Trois questions, posées comme l'Activité les posera :
 * - l'identifiant et le secret vont-ils ensemble ? (le jeton `client_credentials`
 *   s'obtient avec les deux, sans utilisateur) ;
 * - le jeton de bot est-il accepté ? ;
 * - le serveur du verrou existe-t-il, et le bot y est-il ?
 *
 * Rien de secret ne sort d'ici : des verdicts, pas des jetons.
 */
const API = "https://discord.com/api";

export type Verdict = { ok: boolean; detail: string };

export type EssaiApplication = {
  identifiants: Verdict;
  /** `null` : aucun jeton de bot à essayer. */
  bot: Verdict | null;
  /** `null` : pas de verrou. */
  serveur: Verdict | null;
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

async function serveur(application: ConfigActivite, t: Libelles): Promise<Verdict> {
  try {
    const reponse = await fetch(`${API}/guilds/${encodeURIComponent(application.guildId)}`, {
      headers: { Authorization: `Bot ${application.botToken}` },
      cache: "no-store",
    });
    if (reponse.ok) {
      const corps = (await reponse.json()) as { name?: unknown };
      return { ok: true, detail: t.serveurTrouve(String(corps.name ?? application.guildId)) };
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

export async function essayerApplication(application: ConfigActivite, t: Libelles): Promise<EssaiApplication> {
  return {
    identifiants: await identifiants(application, t),
    bot: application.botToken ? await bot(application, t) : null,
    serveur: application.guildId && application.botToken ? await serveur(application, t) : null,
  };
}
