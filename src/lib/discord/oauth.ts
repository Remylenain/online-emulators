import type { ConfigActivite } from "./applications";

/**
 * Les deux appels à l'API de Discord dont l'Activité a besoin.
 *
 * La page obtient un `code` du client Discord (`authorize`) ; c'est ici, côté
 * serveur, qu'il s'échange contre un jeton d'accès, parce que l'échange exige
 * le secret de l'application. On demande ensuite à Discord qui est derrière ce
 * jeton : ce que la page prétend savoir de l'utilisateur ne vaut rien, elle
 * tourne chez lui.
 */
const API = "https://discord.com/api";

export type ProfilDiscord = { id: string; pseudo: string };

/** Le jeton d'accès Discord, ou `null` si le code est refusé. */
export async function echangerCode(
  application: Pick<ConfigActivite, "clientId" | "clientSecret">,
  code: string,
): Promise<string | null> {
  const reponse = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: application.clientId,
      client_secret: application.clientSecret,
      grant_type: "authorization_code",
      code,
    }),
    cache: "no-store",
  });
  if (!reponse.ok) {
    // Le motif de Discord, sans rien de secret : `invalid_client` dit que
    // l'identifiant ou le secret de l'application est faux, `invalid_grant`
    // que le code est périmé ou déjà utilisé. Sans cette ligne, les deux se
    // ressemblent vus de la page.
    const refus = (await reponse.json().catch(() => null)) as { error?: unknown } | null;
    console.warn(`[discord] échange du code refusé : ${reponse.status} ${String(refus?.error ?? "")}`);
    return null;
  }
  const corps = (await reponse.json()) as { access_token?: unknown };
  return typeof corps.access_token === "string" ? corps.access_token : null;
}

export async function profilDiscord(jetonAcces: string): Promise<ProfilDiscord | null> {
  const reponse = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${jetonAcces}` },
    cache: "no-store",
  });
  if (!reponse.ok) return null;
  const corps = (await reponse.json()) as { id?: unknown; username?: unknown; global_name?: unknown };
  if (typeof corps.id !== "string" || !/^\d{5,25}$/.test(corps.id)) return null;
  const nom = typeof corps.global_name === "string" && corps.global_name ? corps.global_name : corps.username;
  return { id: corps.id, pseudo: typeof nom === "string" ? nom : "" };
}
