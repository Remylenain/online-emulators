/**
 * La commande qui lance l'Activité : `/launch` par défaut, ou le nom que
 * l'administrateur lui donne — `/prism`, par exemple.
 *
 * Dès qu'une application active les Activités, Discord lui crée une commande
 * d'entrée, une seule, qu'il lance lui-même : le site n'a rien à recevoir ni
 * à répondre. Elle apparaît dans le lanceur d'applications, et se tape dans
 * un salon comme n'importe quelle commande. Ce module ne fait que la lire et
 * la renommer, par l'API de Discord.
 *
 * Discord est la seule source : rien n'est enregistré ici. Comme
 * `./instance.ts`, ce module ne lit pas la configuration et n'importe rien
 * du site.
 */
const API = "https://discord.com/api";

/** Le type des commandes d'entrée d'une Activité (`PRIMARY_ENTRY_POINT`). */
const COMMANDE_D_ENTREE = 4;

export type AccesCommandes = {
  application: string;
  secret: string;
  /** Vide sans verrou : on passe alors par l'identifiant et le secret. */
  jetonBot: string;
};

export type CommandeDEntree = { id: string; nom: string; description: string };

/** Les règles de Discord pour un nom de commande : minuscules, chiffres, tirets, 32 au plus. */
export const FORME_NOM_COMMANDE = /^[-_\p{Ll}\p{N}]{1,32}$/u;
export const DESCRIPTION_COMMANDE_MAX = 100;

export type Refus = {
  ok: false;
  motif: "identifiants-refuses" | "sans-commande" | "refusee" | "discord-injoignable";
  /** Ce que Discord en dit, quand il le dit : c'est lui qui sait ce qui ne va pas dans un nom. */
  detail?: string;
};

/**
 * De quoi s'adresser à Discord au nom de l'application : le jeton de bot s'il
 * y en a un, sinon un jeton obtenu avec l'identifiant et le secret — le seul
 * usage que Discord laisse à ce jeton-là pour une application d'équipe, avec
 * la lecture du profil.
 */
async function autorisation(acces: AccesCommandes): Promise<string | null> {
  if (acces.jetonBot) return `Bot ${acces.jetonBot}`;
  const reponse = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${acces.application}:${acces.secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "applications.commands.update" }),
    cache: "no-store",
  });
  if (!reponse.ok) return null;
  const corps = (await reponse.json().catch(() => null)) as { access_token?: unknown } | null;
  return typeof corps?.access_token === "string" ? `Bearer ${corps.access_token}` : null;
}

type Brute = { id?: unknown; name?: unknown; description?: unknown; type?: unknown };

function lire(brute: Brute | null | undefined): CommandeDEntree | null {
  if (!brute || typeof brute.id !== "string" || typeof brute.name !== "string") return null;
  return { id: brute.id, nom: brute.name, description: typeof brute.description === "string" ? brute.description : "" };
}

/** Le message d'erreur de Discord, tel qu'il le donne : court, et en anglais. */
function detailDe(corps: unknown): string | undefined {
  const message = (corps as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message.slice(0, 200) : undefined;
}

export async function commandeDEntree(
  acces: AccesCommandes,
): Promise<{ ok: true; commande: CommandeDEntree } | Refus> {
  try {
    const qui = await autorisation(acces);
    if (!qui) return { ok: false, motif: "identifiants-refuses" };
    const reponse = await fetch(`${API}/applications/${acces.application}/commands`, {
      headers: { Authorization: qui },
      cache: "no-store",
    });
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    const corps: unknown = await reponse.json().catch(() => null);
    if (!reponse.ok || !Array.isArray(corps)) return { ok: false, motif: "discord-injoignable" };
    const commande = lire((corps as Brute[]).find((c) => c.type === COMMANDE_D_ENTREE));
    return commande ? { ok: true, commande } : { ok: false, motif: "sans-commande" };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

/** Renomme la commande d'entrée. Les joueurs la voient changer en quelques instants. */
export async function renommerCommandeDEntree(
  acces: AccesCommandes,
  nom: string,
  description: string,
): Promise<{ ok: true; commande: CommandeDEntree } | Refus> {
  const actuelle = await commandeDEntree(acces);
  if (!actuelle.ok) return actuelle;
  try {
    const qui = await autorisation(acces);
    if (!qui) return { ok: false, motif: "identifiants-refuses" };
    const reponse = await fetch(`${API}/applications/${acces.application}/commands/${actuelle.commande.id}`, {
      method: "PATCH",
      headers: { Authorization: qui, "Content-Type": "application/json" },
      body: JSON.stringify({ name: nom, description }),
      cache: "no-store",
    });
    const corps: unknown = await reponse.json().catch(() => null);
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    if (reponse.status === 400) return { ok: false, motif: "refusee", detail: detailDe(corps) };
    const commande = reponse.ok ? lire(corps as Brute) : null;
    return commande ? { ok: true, commande } : { ok: false, motif: "discord-injoignable", detail: detailDe(corps) };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}
