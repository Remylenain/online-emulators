/**
 * Le verrou de l'Activité : n'être jouable que dans certains serveurs Discord.
 *
 * Discord n'a pas de réglage pour cela. Il a mieux : une route qui dit, pour
 * une instance d'Activité en cours, **où** elle tourne et **qui** s'y trouve.
 * C'est notre serveur qui la consulte, avec le jeton de bot de l'application ;
 * rien de ce que la page affirme n'entre dans la décision, sinon le nom de
 * l'instance à regarder — et un nom inventé ne correspond à aucune instance.
 *
 * Ce module ne lit pas la configuration et n'importe rien du site : on lui
 * donne ce dont il a besoin. Il doit pouvoir vivre ailleurs que dans ce site.
 */
const API = "https://discord.com/api";

/** `i-<lancement>-gc-<serveur>-<salon>` et ses variantes : jamais autre chose. */
const FORME_INSTANCE = /^i-[A-Za-z0-9-]{8,150}$/;

/** Le temps de laisser Discord inscrire le joueur dans l'instance qu'il vient d'ouvrir. */
const ATTENTE_MS = 900;
const TENTATIVES = 3;

export type Verrou = {
  /** Identifiant de l'application Discord. */
  application: string;
  jetonBot: string;
  /** Les seuls serveurs où l'Activité accepte d'être jouée. */
  serveurs: readonly string[];
};

export type Lieu =
  /** `serveur` : celui des serveurs permis où l'instance tourne — c'est là qu'on regardera les rôles du joueur. */
  | { permis: true; serveur: string }
  | {
      permis: false;
      /** Pour le journal du serveur ; la page ne reçoit qu'un message général. */
      motif: "instance-absente" | "instance-inconnue" | "autre-serveur" | "joueur-absent" | "discord-injoignable";
    };

type Instance = { location?: { guild_id?: unknown }; users?: unknown };

async function lireInstance(verrou: Verrou, instance: string): Promise<Instance | null | "erreur"> {
  const reponse = await fetch(
    `${API}/applications/${verrou.application}/activity-instances/${encodeURIComponent(instance)}`,
    { headers: { Authorization: `Bot ${verrou.jetonBot}` }, cache: "no-store" },
  );
  if (reponse.status === 404) return null;
  if (!reponse.ok) {
    // 401 : le jeton de bot est faux. Sans rien de secret au journal.
    console.warn(`[discord] lecture de l'instance refusée : ${reponse.status}`);
    return "erreur";
  }
  return (await reponse.json()) as Instance;
}

/**
 * L'utilisateur joue-t-il bien dans l'un des serveurs permis ?
 *
 * Trois conditions, toutes attestées par Discord : l'instance existe, elle
 * tourne dans l'un de ces serveurs, et cet utilisateur en fait partie. La dernière
 * empêche de présenter l'instance de quelqu'un d'autre pour jouer d'ailleurs.
 *
 * En cas de doute — Discord injoignable, jeton de bot refusé —, c'est non :
 * un verrou qui s'ouvre quand il ne peut pas vérifier n'en est pas un.
 */
export async function verifierLieu(verrou: Verrou, instance: unknown, utilisateur: string): Promise<Lieu> {
  if (typeof instance !== "string" || !FORME_INSTANCE.test(instance)) {
    return { permis: false, motif: "instance-absente" };
  }

  for (let essai = 1; essai <= TENTATIVES; essai++) {
    let lue: Awaited<ReturnType<typeof lireInstance>>;
    try {
      lue = await lireInstance(verrou, instance);
    } catch {
      return { permis: false, motif: "discord-injoignable" };
    }
    if (lue === "erreur") return { permis: false, motif: "discord-injoignable" };
    if (lue === null) return { permis: false, motif: "instance-inconnue" };
    const serveur = lue.location?.guild_id;
    if (typeof serveur !== "string" || !verrou.serveurs.includes(serveur)) {
      return { permis: false, motif: "autre-serveur" };
    }

    const presents = Array.isArray(lue.users) ? lue.users : [];
    if (presents.includes(utilisateur)) return { permis: true, serveur };

    // L'instance est la bonne mais le joueur n'y figure pas encore : il vient
    // de l'ouvrir, et Discord met un instant à l'y inscrire.
    if (essai < TENTATIVES) await new Promise((suite) => setTimeout(suite, ATTENTE_MS));
  }
  return { permis: false, motif: "joueur-absent" };
}
