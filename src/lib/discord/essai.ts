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

async function identifiants(application: ConfigActivite): Promise<Verdict> {
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
    if (reponse.ok) return { ok: true, detail: "Identifiant et secret acceptés par Discord." };
    if (reponse.status === 401) {
      return { ok: false, detail: "Discord refuse l'identifiant ou le secret (invalid_client). Le secret n'est pas la Public Key." };
    }
    return { ok: false, detail: `Discord a répondu ${reponse.status}.` };
  } catch {
    return { ok: false, detail: "Discord est injoignable depuis le serveur." };
  }
}

async function bot(application: ConfigActivite): Promise<Verdict> {
  try {
    const reponse = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bot ${application.botToken}` },
      cache: "no-store",
    });
    if (!reponse.ok) {
      return {
        ok: false,
        detail: reponse.status === 401 ? "Discord refuse ce jeton de bot." : `Discord a répondu ${reponse.status}.`,
      };
    }
    const corps = (await reponse.json()) as { id?: unknown; username?: unknown };
    const meme = corps.id === application.clientId;
    return {
      ok: meme,
      detail: meme
        ? `Jeton de bot accepté (${String(corps.username ?? "bot")}).`
        : "Ce jeton de bot appartient à une autre application que cet identifiant.",
    };
  } catch {
    return { ok: false, detail: "Discord est injoignable depuis le serveur." };
  }
}

async function serveur(application: ConfigActivite): Promise<Verdict> {
  try {
    const reponse = await fetch(`${API}/guilds/${encodeURIComponent(application.guildId)}`, {
      headers: { Authorization: `Bot ${application.botToken}` },
      cache: "no-store",
    });
    if (reponse.ok) {
      const corps = (await reponse.json()) as { name?: unknown };
      return { ok: true, detail: `Serveur trouvé : ${String(corps.name ?? application.guildId)}.` };
    }
    if (reponse.status === 403 || reponse.status === 404) {
      // Discord ne distingue pas un serveur inexistant d'un serveur où le
      // bot n'est pas : il répond 404 dans les deux cas. Le verrou, lui,
      // n'a pas besoin que le bot soit membre : il interroge l'instance de
      // l'Activité, pas le serveur.
      return {
        ok: false,
        detail: "Discord ne montre pas ce serveur à ce bot : identifiant faux, ou bot non invité. Le verrou peut marcher quand même ; à essayer dans Discord.",
      };
    }
    return { ok: false, detail: `Discord a répondu ${reponse.status}.` };
  } catch {
    return { ok: false, detail: "Discord est injoignable depuis le serveur." };
  }
}

export async function essayerApplication(application: ConfigActivite): Promise<EssaiApplication> {
  return {
    identifiants: await identifiants(application),
    bot: application.botToken ? await bot(application) : null,
    serveur: application.guildId && application.botToken ? await serveur(application) : null,
  };
}
