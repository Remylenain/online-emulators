import { ACTIONS, BUTTONS, DEFAULT_KEYMAP } from "@/lib/consoles";
import { ecrireDisposition, lireDisposition, type Disposition } from "@/lib/keymap/disposition";
import type { Enregistreur, ResultatTouches } from "@/lib/keymap/ecriture";
import { MANETTE_PAR_DEFAUT } from "@/lib/manette";

/**
 * Ce qu'un invité de la vitrine garde, et où : **dans son navigateur**, et
 * nulle part ailleurs. Le serveur ne reçoit ni sa sauvegarde, ni ses points
 * de reprise, ni ses réglages — il ne sait même pas qu'il joue.
 *
 * Le lecteur parle au serveur par quelques routes (`/api/save`, `/api/state`,
 * `/api/play`). Plutôt que de lui apprendre une seconde façon d'enregistrer,
 * ce fichier lui fournit un `fetch` de remplacement qui répond **comme ces
 * routes** — mêmes adresses, mêmes codes, mêmes en-têtes — depuis IndexedDB.
 * Le lecteur ne voit pas la différence, et une correction de sa logique
 * d'enregistrement vaut pour les deux.
 *
 * Les réglages (touches, manette, habillage) sont de petits objets : ils vont
 * dans `localStorage`, lisible d'un trait avant le démarrage du lecteur.
 *
 * Fragile par nature, et l'interface le dit au joueur : vider les données du
 * navigateur efface tout, rien ne suit d'un appareil à l'autre, et Safari
 * supprime le stockage d'un site resté sept jours sans visite. D'où le
 * téléchargement de la sauvegarde, proposé au moment de quitter.
 */

const BASE = "oe_invite";
const SAUVEGARDES = "sauvegardes";
const ETATS = "etats";

type Sauvegarde = { donnees: Uint8Array; revision: number; modifiee: number };
type Etat = { emplacement: number; auto: boolean; donnees: Uint8Array; creeLe: string };

let ouverture: Promise<IDBDatabase> | null = null;

function ouvrir(): Promise<IDBDatabase> {
  ouverture ??= new Promise<IDBDatabase>((resoudre, rejeter) => {
    const demande = indexedDB.open(BASE, 1);
    demande.onupgradeneeded = () => {
      const base = demande.result;
      if (!base.objectStoreNames.contains(SAUVEGARDES)) base.createObjectStore(SAUVEGARDES);
      if (!base.objectStoreNames.contains(ETATS)) base.createObjectStore(ETATS);
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
    demande.onblocked = () => rejeter(new Error("Stockage occupé par un autre onglet."));
  }).catch((erreur) => {
    // Un échec ne doit pas être définitif : le prochain appel réessaie.
    ouverture = null;
    throw erreur;
  });
  return ouverture;
}

/**
 * Une transaction, menée jusqu'à son terme. `travail` reçoit le magasin et
 * rend ce qu'il veut voir revenir ; la promesse n'aboutit qu'une fois la
 * transaction validée — avant, l'écriture pourrait encore être annulée.
 */
async function transaction<T>(
  magasin: string,
  mode: IDBTransactionMode,
  travail: (magasin: IDBObjectStore, rendre: (valeur: T) => void) => void,
): Promise<T> {
  const base = await ouvrir();
  return new Promise<T>((resoudre, rejeter) => {
    const tx = base.transaction(magasin, mode);
    let resultat!: T;
    tx.oncomplete = () => resoudre(resultat);
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error ?? new Error("Écriture annulée par le navigateur."));
    travail(tx.objectStore(magasin), (valeur) => {
      resultat = valeur;
    });
  });
}

function cleEtat(jeu: string, segment: string): string {
  return `${jeu}/${segment}`;
}

/** « 3 » pour le troisième emplacement manuel, « a3 » pour l'automatique — comme sur le serveur. */
function lireSegment(segment: string): { emplacement: number; auto: boolean } | null {
  const trouve = /^(a?)([1-5])$/.exec(segment);
  return trouve ? { emplacement: Number(trouve[2]), auto: trouve[1] === "a" } : null;
}

/* ------------------------------------------------------------------ */
/* Les vignettes                                                       */
/* ------------------------------------------------------------------ */

/**
 * Un point de reprise de mGBA est un PNG : il s'affiche tel quel. Sur le
 * site, la balise `<img>` le demande au serveur ; ici, elle reçoit une
 * adresse `blob:` tenue à jour à chaque lecture de la liste.
 */
const vignettes = new Map<string, { creeLe: string; url: string }>();

function retenirVignette(cle: string, etat: Etat): void {
  const connue = vignettes.get(cle);
  if (connue?.creeLe === etat.creeLe) return;
  if (connue) URL.revokeObjectURL(connue.url);
  vignettes.set(cle, {
    creeLe: etat.creeLe,
    url: URL.createObjectURL(new Blob([new Uint8Array(etat.donnees)], { type: "image/png" })),
  });
}

function oublierVignette(cle: string): void {
  const connue = vignettes.get(cle);
  if (connue) URL.revokeObjectURL(connue.url);
  vignettes.delete(cle);
}

/** L'adresse de la vignette d'un emplacement, connue après une lecture de la liste. */
export function vignetteInvite(jeu: string, segment: string): string {
  return vignettes.get(cleEtat(jeu, segment))?.url ?? "";
}

/* ------------------------------------------------------------------ */
/* Les routes, rejouées dans le navigateur                             */
/* ------------------------------------------------------------------ */

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
}

async function corpsDe(init?: RequestInit): Promise<Uint8Array> {
  if (!init?.body) return new Uint8Array();
  return new Uint8Array(await new Response(init.body).arrayBuffer());
}

function memeContenu(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function sauvegarde(jeu: string, methode: string, init?: RequestInit): Promise<Response> {
  if (methode === "GET") {
    const lue = await transaction<Sauvegarde | undefined>(SAUVEGARDES, "readonly", (magasin, rendre) => {
      const demande = magasin.get(jeu);
      demande.onsuccess = () => rendre(demande.result as Sauvegarde | undefined);
    });
    // 204 comme le serveur : pas de sauvegarde, c'est une première partie.
    if (!lue) return new Response(null, { status: 204 });
    return new Response(new Uint8Array(lue.donnees), {
      status: 200,
      headers: { "Content-Type": "application/octet-stream", "X-Revision": String(lue.revision) },
    });
  }

  if (methode === "PUT") {
    const donnees = await corpsDe(init);
    if (donnees.length === 0) return json({ erreur: "Sauvegarde vide." }, 400);
    const entete = new Headers(init?.headers).get("X-Revision");
    const attendue = entete === null || entete === "" ? null : Number(entete);

    /*
     * Lecture et écriture dans la même transaction : deux onglets ouverts sur
     * le même jeu ne s'écrasent pas en silence. Le second reçoit le même
     * conflit que le serveur aurait signalé, et le joueur tranche.
     */
    const resultat = await transaction<{ conflit: boolean; etat?: "ecrit" | "inchange"; revision: number }>(
      SAUVEGARDES,
      "readwrite",
      (magasin, rendre) => {
        const demande = magasin.get(jeu);
        demande.onsuccess = () => {
          const actuelle = demande.result as Sauvegarde | undefined;
          if (attendue !== null && actuelle && actuelle.revision !== attendue) {
            rendre({ conflit: true, revision: actuelle.revision });
            return;
          }
          /*
           * Le même contenu ne fait pas une nouvelle révision, comme sur le
           * serveur. Le lecteur renvoie la partie à chaque fois que l'onglet
           * passe à l'arrière-plan, changée ou non : sans cela, changer
           * d'onglet suffirait à faire croire au joueur qu'il a une partie
           * plus récente que le fichier qu'il vient de télécharger.
           */
          if (actuelle && memeContenu(actuelle.donnees, donnees)) {
            rendre({ conflit: false, etat: "inchange", revision: actuelle.revision });
            return;
          }
          const revision = (actuelle?.revision ?? 0) + 1;
          magasin.put({ donnees, revision, modifiee: Date.now() } satisfies Sauvegarde, jeu);
          rendre({ conflit: false, etat: "ecrit", revision });
        };
      },
    );

    if (resultat.conflit) {
      return json(
        {
          erreur:
            "Cette partie a été enregistrée depuis un autre onglet. La sauvegarde de l'autre onglet n'a pas été écrasée.",
          revision: resultat.revision,
        },
        409,
      );
    }
    return json({ etat: resultat.etat, revision: resultat.revision });
  }

  return new Response(null, { status: 405 });
}

async function listeDesEtats(jeu: string): Promise<Response> {
  const plage = IDBKeyRange.bound(`${jeu}/`, `${jeu}/￿`);
  const lus = await transaction<Array<{ cle: string; etat: Etat }>>(ETATS, "readonly", (magasin, rendre) => {
    const trouves: Array<{ cle: string; etat: Etat }> = [];
    const curseur = magasin.openCursor(plage);
    curseur.onsuccess = () => {
      const position = curseur.result;
      if (!position) {
        rendre(trouves);
        return;
      }
      trouves.push({ cle: String(position.key), etat: position.value as Etat });
      position.continue();
    };
  });

  for (const { cle, etat } of lus) retenirVignette(cle, etat);
  return json({
    etats: lus.map(({ etat }) => ({
      emplacement: etat.emplacement,
      auto: etat.auto,
      taille: etat.donnees.length,
      creeLe: etat.creeLe,
    })),
  });
}

async function etat(jeu: string, segment: string, methode: string, init?: RequestInit): Promise<Response> {
  const cible = lireSegment(segment);
  if (!cible) return json({ erreur: "Emplacement invalide." }, 400);
  const cle = cleEtat(jeu, segment);

  if (methode === "GET") {
    const lu = await transaction<Etat | undefined>(ETATS, "readonly", (magasin, rendre) => {
      const demande = magasin.get(cle);
      demande.onsuccess = () => rendre(demande.result as Etat | undefined);
    });
    if (!lu) return new Response("Introuvable", { status: 404 });
    return new Response(new Uint8Array(lu.donnees), { status: 200, headers: { "Content-Type": "image/png" } });
  }

  if (methode === "PUT") {
    const donnees = await corpsDe(init);
    if (donnees.length === 0) return json({ erreur: "État vide." }, 400);
    const nouveau: Etat = { ...cible, donnees, creeLe: new Date().toISOString() };
    await transaction<void>(ETATS, "readwrite", (magasin) => {
      magasin.put(nouveau, cle);
    });
    return json({ ok: true });
  }

  if (methode === "DELETE") {
    await transaction<void>(ETATS, "readwrite", (magasin) => {
      magasin.delete(cle);
    });
    oublierVignette(cle);
    return json({ ok: true });
  }

  return new Response(null, { status: 405 });
}

/**
 * Le `fetch` de l'invité : les routes d'enregistrement du lecteur, servies
 * par le navigateur lui-même. Toute autre adresse part sur le réseau, comme
 * d'habitude.
 *
 * Un stockage refusé (navigation privée, quota, données du site bloquées)
 * revient en 507 : le lecteur l'affiche comme un enregistrement refusé au
 * lieu de planter.
 */
export const requeteInvite: typeof fetch = async (entree, init) => {
  const adresse = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
  const chemin = new URL(adresse, window.location.origin).pathname;
  const trouve = /^\/api\/(save|state|play)\/([^/]+)(?:\/([^/]+))?$/.exec(chemin);
  if (!trouve) return fetch(entree, init);

  const [, route = "", jeu = "", segment] = trouve;
  const methode = (init?.method ?? "GET").toUpperCase();
  try {
    // Le serveur ne compte pas les parties d'un invité : rien à signaler.
    if (route === "play") return new Response(null, { status: 204 });
    if (route === "save") return await sauvegarde(jeu, methode, init);
    if (segment === undefined) return methode === "GET" ? await listeDesEtats(jeu) : new Response(null, { status: 405 });
    return await etat(jeu, segment, methode, init);
  } catch {
    return json({ erreur: "Le navigateur a refusé d'enregistrer." }, 507);
  }
};

/**
 * Demande au navigateur de ne pas effacer ce stockage de lui-même quand la
 * place vient à manquer. Il peut refuser, et ce n'est pas une garantie — un
 * joueur qui vide ses données efface tout quand même.
 */
export function demanderPersistance(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Navigateur sans cette API : rien à faire.
  }
}

/* ------------------------------------------------------------------ */
/* Les réglages                                                        */
/* ------------------------------------------------------------------ */

const BOUTONS = [...BUTTONS.common, ...BUTTONS.shoulder, ...ACTIONS] as const;

const CLE_TOUCHES = "oe_invite_touches";
const CLE_MANETTE = "oe_invite_manette";
const CLE_MANETTES = "oe_invite_manettes";
const CLE_HABILLAGE = "oe_invite_habillage";

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    // Stockage interdit : comme s'il n'y avait rien.
    return null;
  }
}

function lireObjet<T>(cle: string): Record<string, T> {
  try {
    const lu: unknown = JSON.parse(lire(cle) ?? "{}");
    return lu && typeof lu === "object" && !Array.isArray(lu) ? (lu as Record<string, T>) : {};
  } catch {
    return {};
  }
}

/** `null` efface la clé. */
function ecrire(cle: string, texte: string | null): ResultatTouches {
  try {
    if (texte === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, texte);
    return { ok: true };
  } catch {
    // Sans message : l'écran de réglage dit, dans la langue du joueur, que
    // le navigateur a refusé et que le réglage ne vaut que pour cette partie.
    return { ok: false };
  }
}

export type ReglagesInvite = {
  touches: Disposition;
  manette: Disposition;
  /** Les manettes que le navigateur ne reconnaît pas, par « appareil|nom ». */
  manettes: Record<string, Disposition>;
  /** `undefined` : jamais choisi ; `null` : « aucun », choisi exprès. */
  habillage: string | null | undefined;
};

/**
 * Les réglages de l'invité, lus avant de monter le lecteur. Relus par la même
 * règle que ceux d'un compte (`lireDisposition`) : un bouton jamais réglé
 * prend sa touche par défaut, un bouton laissé sans touche le reste.
 */
export function lireReglagesInvite(consoleSlug: string): ReglagesInvite {
  const habillages = lireObjet<string | null>(CLE_HABILLAGE);
  return {
    touches: lireDisposition(DEFAULT_KEYMAP, lire(CLE_TOUCHES)),
    manette: lireDisposition(MANETTE_PAR_DEFAUT, lire(CLE_MANETTE)),
    manettes: Object.fromEntries(
      Object.entries(lireObjet<unknown>(CLE_MANETTES)).map(([cle, valeur]) => [
        cle,
        lireDisposition(MANETTE_PAR_DEFAUT, JSON.stringify(valeur)),
      ]),
    ),
    habillage: consoleSlug in habillages ? habillages[consoleSlug] : undefined,
  };
}

export function choisirHabillageInvite(consoleSlug: string, id: string | null): void {
  ecrire(CLE_HABILLAGE, JSON.stringify({ ...lireObjet<string | null>(CLE_HABILLAGE), [consoleSlug]: id }));
}

/**
 * Le même contrat que les actions du site, tenu par le navigateur. Comme sur
 * un compte, une disposition vaut pour toutes les consoles, et un bouton
 * laissé sans touche est enregistré vide (`ecrireDisposition`).
 */
export const enregistreurInvite: Enregistreur = {
  async touches(_console, mapping) {
    return ecrire(CLE_TOUCHES, ecrireDisposition(BOUTONS, mapping));
  },
  async retablirTouches() {
    return ecrire(CLE_TOUCHES, null);
  },
  async manette(_console, mapping, cle) {
    const texte = ecrireDisposition(BOUTONS, mapping);
    if (!cle) return ecrire(CLE_MANETTE, texte);
    return ecrire(CLE_MANETTES, JSON.stringify({ ...lireObjet<unknown>(CLE_MANETTES), [cle]: JSON.parse(texte) }));
  },
  async retablirManette(_console, cle) {
    if (!cle) return ecrire(CLE_MANETTE, null);
    const nommees = lireObjet<unknown>(CLE_MANETTES);
    delete nommees[cle];
    return ecrire(CLE_MANETTES, JSON.stringify(nommees));
  },
};
