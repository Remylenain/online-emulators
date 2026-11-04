import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { and, eq } from "drizzle-orm";
import type { WebSocket } from "ws";
import { db } from "@/db";
import { games } from "@/db/schema";
import { conditionAcces, jeuAccessible } from "@/lib/acces";
import { paths } from "@/lib/paths";
import { ecrireSauvegarde, lireSauvegarde } from "@/lib/saves";
import { findConsole } from "@/lib/consoles";
import type { Compte } from "./auth";
import type { DescriptionCoeur } from "./moteurs";
import { ENTETE_AUDIO, ENTETE_IMAGE, TRAME, type MessageServeur } from "./protocole";
import { salonDuCompte, salons, type Salon } from "./registre";

/**
 * Vie d'un salon : création, arrivée des joueurs, émulation, fin.
 *
 * Le serveur est seul maître du jeu. Les deux consoles tournent dans un fil
 * de travail (`ouvrier.ts`), les navigateurs ne font qu'envoyer des boutons
 * et afficher ce qu'on leur envoie. Les sauvegardes des deux comptes sont
 * lues au départ et réécrites à la fin — jamais entre les deux, pour qu'une
 * session interrompue laisse les parties telles qu'elles étaient.
 */

/** Le cœur d'un salon, tel que l'ouvrier le recevra — le `.wasm` lu au démarrage. */
type Coeur = Omit<Extract<DescriptionCoeur, { type: "tgbdual" }>, "wasm"> | Omit<Extract<DescriptionCoeur, { type: "mgs" }>, "wasm">;

/**
 * Cœur par console.
 *
 * GB et GBC : TGB Dual, deux Game Boy dans une image côte à côte. GBA : mGBA
 * Splitscreen, deux GBA reliées par le câble lockstep de mGBA (voir
 * `coeurs/mgba-splitscreen/LISEZMOI.md`).
 */
const COEURS: Record<string, Coeur> = {
  gb: coeurTgbDual(),
  gbc: coeurTgbDual(),
  gba: {
    type: "mgs",
    js: path.join(process.cwd(), "coeurs", "mgba-splitscreen", "mgba-splitscreen-web.cjs"),
  },
};

function coeurTgbDual(): Coeur {
  return {
    type: "tgbdual",
    js: path.join(process.cwd(), "public", "tgbdual", "tgbdual.js"),
    options: {
      tgbdual_gblink_enable: "enabled",
      tgbdual_screen_placement: "left-right",
      tgbdual_switch_screens: "normal",
      tgbdual_single_screen_mp: "both players",
      tgbdual_audio_output: "Game Boy #1",
    },
    typeSpecial: 0x101, // RETRO_GAME_TYPE_GAMEBOY_LINK_2P
    srams: [0x100, 0x300],
  };
}

/** Un salon sans personne depuis ce délai est clos, sauvegardes enregistrées. */
const ABANDON_MS = 10 * 60 * 1000;
/**
 * Sans son hôte depuis ce temps, un salon se ferme, qu'il attende ou qu'il
 * joue : c'est lui qui l'a ouvert, c'est à lui d'y être. L'invité est
 * prévenu, et les sauvegardes des deux sont écrites comme à toute fin.
 */
const HOTE_ABSENT_MS = 5 * 60 * 1000;
/** Un salon jamais rejoint disparaît au bout de ce délai. */
const ATTENTE_MAX_MS = 60 * 60 * 1000;

type Interne = {
  ouvrier: Worker | null;
  prises: [Set<WebSocket>, Set<WebSocket>];
  geometrie: { largeur: number; hauteur: number } | null;
  /** Dernière image envoyée à chaque joueur : un nouvel onglet la reçoit d'emblée. */
  dernieresImages: [Buffer | null, Buffer | null];
  cloture: Promise<void> | null;
};

function interne(salon: Salon): Interne {
  salon.interne ??= {
    ouvrier: null,
    prises: [new Set(), new Set()],
    geometrie: null,
    dernieresImages: [null, null],
    cloture: null,
  } satisfies Interne;
  return salon.interne as Interne;
}

/** Code lisible à dicter : six caractères sans ambiguïté. */
function nouveauCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (const octet of randomBytes(6)) code += alphabet[octet % alphabet.length];
  return salons().has(code) ? nouveauCode() : code;
}

export type Refus = { erreur: string };

export async function creerSalon(jeuId: string, compte: Compte, prive: boolean): Promise<Salon | Refus> {
  const deja = salonDuCompte(compte.id);
  if (deja) return { erreur: `Tu es déjà dans le salon ${deja.id}.` };

  const jeu = await db
    .select({
      id: games.id,
      titre: games.title,
      slug: games.slug,
      consoleSlug: games.consoleSlug,
      romPath: games.romPath,
    })
    .from(games)
    .where(and(eq(games.id, jeuId), conditionAcces(compte)))
    .get();
  if (!jeu) return { erreur: "Jeu introuvable." };
  if (!COEURS[jeu.consoleSlug]) return { erreur: "Le câble link n'est pas encore disponible pour cette console." };

  const salon: Salon = {
    id: nouveauCode(),
    jeu: { id: jeu.id, titre: jeu.titre, slug: jeu.slug, consoleSlug: jeu.consoleSlug, romPath: jeu.romPath },
    places: [{ userId: compte.id, pseudo: compte.pseudo, connexions: 0, absentDepuis: Date.now() }, null],
    etat: "attente",
    prive,
    creeLe: Date.now(),
    derniereActivite: Date.now(),
  };
  salons().set(salon.id, salon);
  console.log(`[link] ${salon.id} : salon ${prive ? "privé " : ""}ouvert par ${compte.pseudo} sur ${jeu.titre}`);
  return salon;
}

/** Place d'un compte dans un salon, en l'y asseyant s'il reste une chaise. */
async function placer(salon: Salon, compte: Compte): Promise<0 | 1 | Refus> {
  const index = salon.places.findIndex((place) => place?.userId === compte.id);
  if (index !== -1) return index as 0 | 1;
  if (salon.etat !== "attente") return { erreur: "Ce salon est déjà complet." };
  // L'invité doit lui aussi avoir accès au jeu : un compte restreint n'entre
  // pas dans un salon sur un jeu qu'il ne voit pas.
  if (!(await jeuAccessible(compte, salon.jeu.id))) return { erreur: "Jeu introuvable." };
  if (salonDuCompte(compte.id)) return { erreur: "Tu es déjà dans un autre salon." };
  salon.places[1] = { userId: compte.id, pseudo: compte.pseudo, connexions: 0, absentDepuis: Date.now() };
  return 1;
}

/**
 * Un navigateur arrive sur un salon.
 *
 * Même compte sur deux onglets : les deux reçoivent l'écran, les deux peuvent
 * appuyer. C'est voulu, un téléphone qui perd le réseau rouvre la page sans
 * que la partie s'arrête.
 */
export async function attacher(salon: Salon, compte: Compte, prise: WebSocket): Promise<void> {
  const place = await placer(salon, compte);
  if (typeof place !== "number") {
    envoyer(prise, { t: "erreur", message: place.erreur });
    prise.close();
    return;
  }

  const etat = interne(salon);
  etat.prises[place].add(prise);
  salon.places[place]!.connexions += 1;
  salon.places[place]!.absentDepuis = null;
  salon.derniereActivite = Date.now();
  console.log(`[link] ${salon.id} : ${compte.pseudo} arrive en place ${place + 1} (${salon.etat})`);

  prise.on("message", (brut) => {
    let message: unknown;
    try {
      message = JSON.parse(String(brut));
    } catch {
      return;
    }
    const m = message as { t?: string; masque?: unknown };
    if (m.t === "boutons" && typeof m.masque === "number") {
      salon.derniereActivite = Date.now();
      etat.ouvrier?.postMessage({ t: "boutons", joueur: place, masque: m.masque & 0xfff });
    } else if (m.t === "terminer") {
      void terminer(salon, `à la demande de ${compte.pseudo}`);
    }
  });

  prise.on("error", (erreur) => {
    console.log(`[link] ${salon.id} : prise de ${compte.pseudo} en erreur : ${erreur.message}`);
  });

  prise.on("close", (code, raison) => {
    console.log(`[link] ${salon.id} : ${compte.pseudo} part (${code}${raison.length ? ` ${raison}` : ""})`);
    etat.prises[place].delete(prise);
    const occupant = salon.places[place];
    if (occupant) occupant.connexions = Math.max(0, occupant.connexions - 1);
    // Un joueur parti ne doit pas laisser un bouton enfoncé derrière lui.
    if (occupant?.connexions === 0) {
      occupant.absentDepuis = Date.now();
      etat.ouvrier?.postMessage({ t: "boutons", joueur: place, masque: 0 });
    }
    salon.derniereActivite = Date.now();
    diffuserEtat(salon);
  });

  if (salon.etat === "attente" && salon.places[1]) {
    await demarrer(salon);
  }

  diffuserEtat(salon);
  // L'écran tel qu'il est, sans attendre que quelque chose y bouge.
  const image = etat.dernieresImages[place];
  if (image && prise.readyState === prise.OPEN) prise.send(image);
}

async function demarrer(salon: Salon): Promise<void> {
  const etat = interne(salon);
  if (etat.ouvrier) return;
  const coeur = COEURS[salon.jeu.consoleSlug]!;

  const [rom, wasm, s1, s2] = await Promise.all([
    fs.readFile(paths.library(salon.jeu.romPath)),
    fs.readFile(coeur.js.replace(/\.c?js$/, ".wasm")),
    lireSauvegarde(salon.places[0].userId, salon.jeu.id),
    lireSauvegarde(salon.places[1]!.userId, salon.jeu.id),
  ]);

  const ouvrier = new Worker(new URL("./ouvrier.ts", import.meta.url));
  etat.ouvrier = ouvrier;
  salon.etat = "en-jeu";
  console.log(`[link] ${salon.id} : démarrage de ${salon.jeu.titre} (${salon.places[0].pseudo} / ${salon.places[1]!.pseudo})`);

  ouvrier.on("message", (message: { t: string } & Record<string, unknown>) => {
    switch (message.t) {
      case "pret":
        etat.geometrie = { largeur: message.largeur as number, hauteur: message.hauteur as number };
        diffuserEtat(salon);
        break;
      case "image": {
        const joueur = message.joueur as 0 | 1;
        const trame = trameImage(joueur, message.largeur as number, message.hauteur as number, message.donnees as ArrayBuffer);
        etat.dernieresImages[joueur] = trame;
        for (const prise of etat.prises[joueur]) envoyerBinaire(prise, trame);
        break;
      }
      case "audio": {
        // Un son par joueur quand le moteur le permet, sinon le même aux deux.
        const trame = trameAudio(message.frequence as number, message.pcm as ArrayBuffer);
        const joueur = message.joueur as 0 | 1 | null;
        const groupes = joueur === null ? etat.prises : [etat.prises[joueur]];
        for (const groupe of groupes) for (const prise of groupe) envoyerBinaire(prise, trame);
        break;
      }
      case "erreur":
        diffuser(salon, { t: "erreur", message: message.message as string });
        void terminer(salon, "le cœur a échoué", false);
        break;
    }
  });
  ouvrier.on("error", (erreur: Error) => {
    diffuser(salon, { t: "erreur", message: erreur.message });
    void terminer(salon, "le fil de travail a planté", false);
  });

  const sauvegardes: [ArrayBuffer | null, ArrayBuffer | null] = [
    s1 ? copie(s1.donnees) : null,
    s2 ? copie(s2.donnees) : null,
  ];
  ouvrier.postMessage({
    t: "demarrer",
    coeur: { ...coeur, wasm: copie(wasm) } satisfies DescriptionCoeur,
    rom: copie(rom),
    nom: path.basename(salon.jeu.romPath),
    saves: sauvegardes,
  });
}

function copie(donnees: Uint8Array): ArrayBuffer {
  return donnees.buffer.slice(donnees.byteOffset, donnees.byteOffset + donnees.byteLength) as ArrayBuffer;
}

/**
 * Fin de session : les deux SRAM sont enregistrées sur les deux comptes.
 *
 * `enregistrer` à faux quand le cœur a échoué : on ne sait pas dans quel état
 * sont ses mémoires, et les sauvegardes d'avant valent mieux qu'un doute.
 */
export function terminer(salon: Salon, raison: string, enregistrer = true): Promise<void> {
  const etat = interne(salon);
  if (etat.cloture) return etat.cloture;

  etat.cloture = (async () => {
    salon.etat = "termine";
    let ecrit = false;

    const ouvrier = etat.ouvrier;
    if (ouvrier && enregistrer) {
      const srams = await new Promise<[ArrayBuffer, ArrayBuffer] | null>((resolve) => {
        // L'ouvrier continue d'émettre des images jusqu'à son dernier tic :
        // on attend *le* message des SRAM, pas le prochain message venu.
        const fil = ouvrier;
        const minuterie = setTimeout(() => {
          fil.off("message", attendre);
          resolve(null);
        }, 5000);
        function attendre(message: { t: string; srams?: [ArrayBuffer, ArrayBuffer] }): void {
          if (message.t !== "srams") return;
          clearTimeout(minuterie);
          fil.off("message", attendre);
          resolve(message.srams ?? null);
        }
        fil.on("message", attendre);
        fil.postMessage({ t: "arreter" });
      });
      if (srams) {
        for (const [i, place] of salon.places.entries()) {
          if (!place || srams[i]!.byteLength === 0) continue;
          await ecrireSauvegarde(place.userId, salon.jeu.id, new Uint8Array(srams[i]!), null);
        }
        ecrit = true;
      }
    }
    await ouvrier?.terminate().catch(() => {});
    etat.ouvrier = null;

    console.log(`[link] ${salon.id} : fin (${raison}), sauvegardes ${ecrit ? "enregistrées" : "laissées telles quelles"}`);
    diffuser(salon, { t: "termine", enregistre: ecrit, raison });
    for (const groupe of etat.prises) for (const prise of groupe) prise.close();
    salons().delete(salon.id);
  })();
  return etat.cloture;
}

/** Passe régulièrement sur les salons abandonnés. À appeler une fois au démarrage. */
export function surveillerAbandons(): void {
  setInterval(() => {
    const maintenant = Date.now();
    for (const salon of salons().values()) {
      const hote = salon.places[0];
      const sansHote = hote.absentDepuis !== null && maintenant - hote.absentDepuis > HOTE_ABSENT_MS;
      const personne = salon.places.every((place) => !place || place.connexions === 0);
      if (sansHote && salon.etat === "en-jeu") {
        void terminer(salon, `${hote.pseudo} a quitté le salon depuis cinq minutes`);
      } else if (sansHote && salon.etat === "attente") {
        console.log(`[link] ${salon.id} : fermé, ${hote.pseudo} parti depuis cinq minutes`);
        salons().delete(salon.id);
      } else if (salon.etat === "en-jeu" && personne && maintenant - salon.derniereActivite > ABANDON_MS) {
        void terminer(salon, "salon abandonné");
      } else if (salon.etat === "attente" && maintenant - salon.creeLe > ATTENTE_MAX_MS) {
        salons().delete(salon.id);
      }
    }
  }, 30_000).unref();
}

// --- Envoi --------------------------------------------------------------

function trameImage(joueur: 0 | 1, largeur: number, hauteur: number, donnees: ArrayBuffer): Buffer {
  const trame = Buffer.alloc(ENTETE_IMAGE + donnees.byteLength);
  trame[0] = TRAME.IMAGE;
  trame[1] = joueur;
  trame.writeUInt16LE(largeur, 2);
  trame.writeUInt16LE(hauteur, 4);
  Buffer.from(donnees).copy(trame, ENTETE_IMAGE);
  return trame;
}

function trameAudio(frequence: number, pcm: ArrayBuffer): Buffer {
  const trame = Buffer.alloc(ENTETE_AUDIO + pcm.byteLength);
  trame[0] = TRAME.AUDIO;
  trame.writeUInt32LE(frequence, 4);
  Buffer.from(pcm).copy(trame, ENTETE_AUDIO);
  return trame;
}

/** Une prise qui n'absorbe plus se voit sauter des images, pas accumuler du retard. */
const FILE_MAX = 256 * 1024;

function envoyerBinaire(prise: WebSocket, trame: Buffer): void {
  if (prise.readyState !== prise.OPEN || prise.bufferedAmount > FILE_MAX) return;
  prise.send(trame);
}

function envoyer(prise: WebSocket, message: MessageServeur): void {
  if (prise.readyState === prise.OPEN) prise.send(JSON.stringify(message));
}

function diffuser(salon: Salon, message: MessageServeur): void {
  for (const groupe of interne(salon).prises) for (const prise of groupe) envoyer(prise, message);
}

function diffuserEtat(salon: Salon): void {
  const etat = interne(salon);
  const console_ = findConsole(salon.jeu.consoleSlug);
  const geometrie = etat.geometrie
    ? { largeur: etat.geometrie.largeur, hauteur: etat.geometrie.hauteur }
    : { largeur: console_?.screenWidth ?? 160, hauteur: console_?.screenHeight ?? 144 };
  const gachettes = console_?.hasShoulderButtons ?? false;
  const joueurs = salon.places.map((place) =>
    place ? { pseudo: place.pseudo, present: place.connexions > 0 } : null,
  ) as [{ pseudo: string; present: boolean }, { pseudo: string; present: boolean } | null];

  for (const joueur of [0, 1] as const) {
    for (const prise of etat.prises[joueur]) {
      envoyer(prise, {
        t: "etat",
        etat: salon.etat,
        prive: salon.prive,
        joueur,
        joueurs,
        jeu: { titre: salon.jeu.titre, ...geometrie, gachettes },
      });
    }
  }
}
