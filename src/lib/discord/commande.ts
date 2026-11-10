/**
 * Les commandes qui lancent l'Activité. Il y en a deux, de natures
 * différentes, et c'est toute la subtilité.
 *
 * **La commande d'entrée.** Dès qu'une application active les Activités,
 * Discord lui en crée une, une seule, nommée `launch`, qu'il lance lui-même :
 * le site n'a rien à recevoir ni à répondre. Elle ne s'affiche que dans le
 * **lanceur d'applications** — c'est son bouton. Elle ne se tape pas : la
 * liste qui s'ouvre quand on tape « / » ne la propose pas, quel que soit son
 * nom. Constaté sur une vraie application, après l'avoir renommée.
 *
 * Quand Discord la lance lui-même, il poste dans le salon une « invitation de
 * jeu », à chaque fois. On peut lui demander de ne plus la lancer et de
 * prévenir l'application à la place (`handler`) : le site répond alors comme
 * à la commande tapée, et Discord ne poste rien — constaté pour la commande
 * tapée, sur une vraie application.
 *
 * **La commande tapée.** Pour qu'un joueur écrive `/prism` dans un salon, il
 * faut une commande ordinaire, du même nom. Celle-là, Discord ne la lance pas
 * tout seul : il demande à l'application quoi répondre, à l'adresse qu'elle
 * lui a déclarée, et le site répond « lance l'Activité »
 * (`./interactions.ts`). Elle est facultative, et demande le jeton de bot :
 * c'est avec lui seul que Discord laisse lire la clé de l'application et
 * déclarer cette adresse.
 *
 * Ce module ne fait que parler à l'API de Discord. Comme `./instance.ts`, il
 * ne lit pas la configuration et n'importe rien du site.
 */
const API = "https://discord.com/api";

/** Le type des commandes d'entrée d'une Activité (`PRIMARY_ENTRY_POINT`). */
const COMMANDE_D_ENTREE = 4;
/** Le type des commandes qui se tapent (`CHAT_INPUT`). */
const COMMANDE_TAPEE = 1;

/** Qui lance l'Activité quand on appuie sur la commande d'entrée (`handler`). */
const LANCEE_PAR_L_APPLICATION = 1;
const LANCEE_PAR_DISCORD = 2;

export type AccesCommandes = {
  application: string;
  secret: string;
  /** Vide sans verrou : on passe alors par l'identifiant et le secret. */
  jetonBot: string;
};

export type CommandeDEntree = {
  id: string;
  nom: string;
  description: string;
  /**
   * Discord tient encore des noms traduits pour cette commande. La commande
   * par défaut en a une trentaine (« lancer », « Start », « ejecutar »…), et
   * ce sont eux que voient les joueurs, selon la langue de leur Discord : tant
   * qu'il en reste, le nom ci-dessus ne s'affiche chez presque personne.
   */
  traduite: boolean;
  /**
   * Discord ne lance plus l'Activité lui-même : il prévient l'application,
   * qui répond. Sans adresse où la prévenir, le bouton du lanceur ne mène
   * alors nulle part.
   */
  parLeSite: boolean;
};

/** Les règles de Discord pour un nom de commande : minuscules, chiffres, tirets, 32 au plus. */
export const FORME_NOM_COMMANDE = /^[-_\p{Ll}\p{N}]{1,32}$/u;
export const DESCRIPTION_COMMANDE_MAX = 100;

/** Une commande qui se tape, telle que Discord la connaît. */
export type CommandeTapee = { id: string; nom: string };

/** Les commandes d'une application, vues d'ici. */
export type Commandes = {
  commande: CommandeDEntree;
  /** Les commandes qui se tapent. Une seule quand c'est le site qui l'a créée. */
  tapees: CommandeTapee[];
  /**
   * Tout ce qui n'est pas la commande d'entrée, commandes tapées comprises.
   * S'il y en a alors que le site n'en a créé aucune, un bot s'en occupe
   * ailleurs — et il ne faut pas lui prendre ses interactions.
   */
  autres: number;
};

export type Refus = {
  ok: false;
  motif:
    | "identifiants-refuses"
    | "sans-commande"
    | "refusee"
    | "discord-injoignable"
    /** Discord n'a pas pu vérifier l'adresse des interactions qu'on lui déclarait. */
    | "adresse-refusee";
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

type Brute = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
  name_localizations?: unknown;
  handler?: unknown;
};

function lire(brute: Brute | null | undefined): CommandeDEntree | null {
  if (!brute || typeof brute.id !== "string" || typeof brute.name !== "string") return null;
  const traductions = brute.name_localizations;
  return {
    id: brute.id,
    nom: brute.name,
    description: typeof brute.description === "string" ? brute.description : "",
    traduite: Boolean(traductions && typeof traductions === "object" && Object.keys(traductions).length > 0),
    parLeSite: brute.handler === LANCEE_PAR_L_APPLICATION,
  };
}

/** Le message d'erreur de Discord, tel qu'il le donne : court, et en anglais. */
function detailDe(corps: unknown): string | undefined {
  const message = (corps as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message.slice(0, 200) : undefined;
}

export async function commandeDEntree(acces: AccesCommandes): Promise<({ ok: true } & Commandes) | Refus> {
  try {
    const qui = await autorisation(acces);
    if (!qui) return { ok: false, motif: "identifiants-refuses" };
    // Sans ce paramètre, Discord tait les noms traduits.
    const reponse = await fetch(`${API}/applications/${acces.application}/commands?with_localizations=true`, {
      headers: { Authorization: qui },
      cache: "no-store",
    });
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    const corps: unknown = await reponse.json().catch(() => null);
    if (!reponse.ok || !Array.isArray(corps)) return { ok: false, motif: "discord-injoignable" };
    const toutes = corps as Brute[];
    const commande = lire(toutes.find((c) => c.type === COMMANDE_D_ENTREE));
    if (!commande) return { ok: false, motif: "sans-commande" };
    const tapees = toutes
      .filter((c) => c.type === COMMANDE_TAPEE)
      .flatMap((c) => (typeof c.id === "string" && typeof c.name === "string" ? [{ id: c.id, nom: c.name }] : []));
    return { ok: true, commande, tapees, autres: toutes.filter((c) => c.type !== COMMANDE_D_ENTREE).length };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

/**
 * Renomme la commande d'entrée, **pour toutes les langues** : les noms et les
 * descriptions traduits de la commande par défaut sont effacés du même coup.
 * Sans cela, un Discord en français continue d'afficher « /lancer », et le
 * nouveau nom n'apparaît nulle part — constaté sur une vraie application.
 *
 * La commande tapée, si le site en a créé une, suit : les deux portent le
 * même nom, pour que le bouton du lanceur et ce qu'on tape disent pareil.
 */
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
      body: JSON.stringify({ name: nom, description, name_localizations: null, description_localizations: null }),
      cache: "no-store",
    });
    const corps: unknown = await reponse.json().catch(() => null);
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    if (reponse.status === 400) return { ok: false, motif: "refusee", detail: detailDe(corps) };
    // La réponse d'une modification ne dit rien des traductions : elles
    // viennent d'être effacées, on le note sans la relire.
    const lue = reponse.ok ? lire(corps as Brute) : null;
    if (!lue) return { ok: false, motif: "discord-injoignable", detail: detailDe(corps) };
    const [tapee, ...autresTapees] = actuelle.tapees;
    if (tapee && autresTapees.length === 0) {
      const suivie = await fetch(`${API}/applications/${acces.application}/commands/${tapee.id}`, {
        method: "PATCH",
        headers: { Authorization: qui, "Content-Type": "application/json" },
        body: JSON.stringify({ name: nom, description }),
        cache: "no-store",
      });
      if (!suivie.ok) {
        const pourquoi: unknown = await suivie.json().catch(() => null);
        return { ok: false, motif: "refusee", detail: detailDe(pourquoi) };
      }
    }
    return { ok: true, commande: { ...lue, traduite: false } };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

/**
 * Dit à Discord qui lance l'Activité depuis le bouton du lanceur : lui, comme
 * à l'origine, ou l'application — qu'il prévient alors à son adresse
 * d'interactions, et dont il attend la réponse.
 */
export async function confierLancement(
  acces: AccesCommandes,
  commande: string,
  auSite: boolean,
): Promise<{ ok: true } | Refus> {
  try {
    const qui = await autorisation(acces);
    if (!qui) return { ok: false, motif: "identifiants-refuses" };
    const reponse = await fetch(`${API}/applications/${acces.application}/commands/${commande}`, {
      method: "PATCH",
      headers: { Authorization: qui, "Content-Type": "application/json" },
      body: JSON.stringify({ handler: auSite ? LANCEE_PAR_L_APPLICATION : LANCEE_PAR_DISCORD }),
      cache: "no-store",
    });
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    const corps: unknown = await reponse.json().catch(() => null);
    if (reponse.status === 400) return { ok: false, motif: "refusee", detail: detailDe(corps) };
    // Ce que Discord a retenu, pas ce qu'on lui a demandé.
    const retenue = reponse.ok ? lire(corps as Brute) : null;
    if (!retenue || retenue.parLeSite !== auSite) {
      return { ok: false, motif: "discord-injoignable", detail: detailDe(corps) };
    }
    return { ok: true };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

// ---------------------------------------------------------------------------
// La commande tapée
// ---------------------------------------------------------------------------

/** Ce que Discord sait de l'application et qui sert ici : sa clé, et où il envoie ses interactions. */
export type Branchement = { clePublique: string; adresseInteractions: string | null };

/**
 * Lit l'application auprès de Discord. Avec le jeton de bot, seul : un jeton
 * obtenu par l'identifiant et le secret n'ouvre pas cette lecture.
 */
export async function branchement(jetonBot: string): Promise<({ ok: true } & Branchement) | Refus> {
  try {
    const reponse = await fetch(`${API}/applications/@me`, {
      headers: { Authorization: `Bot ${jetonBot}` },
      cache: "no-store",
    });
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    const corps = (await reponse.json().catch(() => null)) as {
      verify_key?: unknown;
      interactions_endpoint_url?: unknown;
    } | null;
    if (!reponse.ok || typeof corps?.verify_key !== "string") return { ok: false, motif: "discord-injoignable" };
    const adresse = corps.interactions_endpoint_url;
    return {
      ok: true,
      clePublique: corps.verify_key,
      adresseInteractions: typeof adresse === "string" && adresse ? adresse : null,
    };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

/**
 * Déclare à Discord où envoyer ses interactions, ou le lui fait oublier
 * (`null`). Discord essaie l'adresse sur-le-champ, avec une requête bien
 * signée et une autre mal signée : le site doit déjà connaître la clé de
 * l'application, et être joignable depuis internet.
 */
export async function declarerAdresseInteractions(
  jetonBot: string,
  adresse: string | null,
): Promise<{ ok: true } | Refus> {
  try {
    const reponse = await fetch(`${API}/applications/@me`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${jetonBot}`, "Content-Type": "application/json" },
      body: JSON.stringify({ interactions_endpoint_url: adresse }),
      cache: "no-store",
    });
    if (reponse.ok) return { ok: true };
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    const corps: unknown = await reponse.json().catch(() => null);
    return reponse.status === 400
      ? { ok: false, motif: "adresse-refusee", detail: detailDe(corps) }
      : { ok: false, motif: "discord-injoignable", detail: detailDe(corps) };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

/** Crée la commande qui se tape. Sans option : elle lance l'Activité, rien d'autre. */
export async function creerCommandeTapee(
  acces: AccesCommandes,
  nom: string,
  description: string,
): Promise<{ ok: true } | Refus> {
  try {
    const qui = await autorisation(acces);
    if (!qui) return { ok: false, motif: "identifiants-refuses" };
    const reponse = await fetch(`${API}/applications/${acces.application}/commands`, {
      method: "POST",
      headers: { Authorization: qui, "Content-Type": "application/json" },
      body: JSON.stringify({ type: COMMANDE_TAPEE, name: nom, description }),
      cache: "no-store",
    });
    if (reponse.ok) return { ok: true };
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    const corps: unknown = await reponse.json().catch(() => null);
    return reponse.status === 400
      ? { ok: false, motif: "refusee", detail: detailDe(corps) }
      : { ok: false, motif: "discord-injoignable", detail: detailDe(corps) };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}

export async function supprimerCommande(acces: AccesCommandes, id: string): Promise<{ ok: true } | Refus> {
  try {
    const qui = await autorisation(acces);
    if (!qui) return { ok: false, motif: "identifiants-refuses" };
    const reponse = await fetch(`${API}/applications/${acces.application}/commands/${id}`, {
      method: "DELETE",
      headers: { Authorization: qui },
      cache: "no-store",
    });
    // Déjà disparue : c'est ce qu'on voulait.
    if (reponse.ok || reponse.status === 404) return { ok: true };
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, motif: "identifiants-refuses" };
    return { ok: false, motif: "discord-injoignable" };
  } catch {
    return { ok: false, motif: "discord-injoignable" };
  }
}
