/**
 * Le serveur du site : Next, plus le câble link.
 *
 *   node --import ./outils/node/charge-ts.mjs serveur.ts [-H hôte] [-p port]
 *
 * Next ne sait pas tenir une WebSocket dans ses routes. On garde donc la main
 * sur le serveur HTTP : tout ce qui commence par `/link/` et n'est pas une
 * page est servi ici — la WebSocket d'un salon, et deux petites routes pour
 * créer un salon ou lister ceux d'un jeu —, le reste va à Next comme avant.
 *
 * Un seul processus, un seul port : rien à changer côté Apache, qui relaie
 * déjà les demandes d'`Upgrade`.
 */
import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { parseArgs } from "node:util";
import next from "next";
import { WebSocketServer } from "ws";
import { compteDuLink } from "./src/lib/link/auth.ts";
import { salons } from "./src/lib/link/registre.ts";
import { attacher, creerSalon, MAX_SPECTATEURS, regarder, surveillerAbandons } from "./src/lib/link/salons.ts";
import { famille, placesLibres } from "./src/lib/link/capacite.ts";
import { attendre } from "./src/lib/link/file.ts";
import type { CodeErreur, MessageServeur, Refus } from "./src/lib/link/protocole.ts";
import { salonDInstance, salonsEnAttente, salonDuCompte, salonsRegardables } from "./src/lib/link/registre.ts";

const { values } = parseArgs({
  options: {
    H: { type: "string", default: "127.0.0.1" },
    p: { type: "string", default: process.env.PORT ?? "3000" },
  },
  strict: false,
});
const hote = String(values.H);
const port = Number(values.p);
const dev = process.env.NODE_ENV !== "production";

/**
 * Un serveur HTTP factice, pour que Next n'écoute pas `upgrade` sur le vrai.
 *
 * À la première requête qu'il sert, Next accroche son propre gestionnaire
 * d'`upgrade` au serveur dont elle provient (`req.socket.server`), ou à
 * l'objet `httpServer` qu'on lui donne. Ce gestionnaire ferme toute
 * WebSocket qui n'est pas la sienne — et donc celles du câble link, sept
 * millisecondes après leur ouverture. On lui donne un leurre à écouter, et
 * on lui transmet nous-mêmes les seules connexions qui le regardent : le
 * rechargement à chaud en développement.
 */
const leurre = new EventEmitter();
const app = next({
  dev,
  hostname: hote,
  port,
  turbopack: dev,
  httpServer: leurre as unknown as import("node:http").Server,
});
const wss = new WebSocketServer({ noServer: true });

/**
 * Un refus : le texte français, en repli, et le code d'après lequel le
 * navigateur le dira dans la langue du joueur (voir `src/lib/link/protocole.ts`).
 */
function refus(code: CodeErreur, erreur: string): Refus {
  return { erreur, code };
}

function json(reponse: ServerResponse, statut: number, corps: unknown): void {
  reponse.writeHead(statut, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  reponse.end(JSON.stringify(corps));
}

async function lireJson(requete: IncomingMessage): Promise<Record<string, unknown>> {
  const morceaux: Buffer[] = [];
  for await (const morceau of requete) {
    morceaux.push(morceau as Buffer);
    if (morceaux.reduce((n, m) => n + m.length, 0) > 4096) throw new Error("Corps trop long.");
  }
  const texte = Buffer.concat(morceaux).toString("utf8");
  return texte ? (JSON.parse(texte) as Record<string, unknown>) : {};
}

/** Les deux routes du câble link servies avant Next. Rend faux si ce n'est pas pour nous. */
async function routesLink(requete: IncomingMessage, reponse: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname !== "/link/salons") return false;

  const compte = await compteDuLink(requete.headers, url);
  if (!compte) {
    json(reponse, 401, refus("non-connecte", "Non connecté."));
    return true;
  }

  if (requete.method === "GET") {
    const jeu = url.searchParams.get("jeu") ?? "";
    const mien = salonDuCompte(compte.id);
    /*
     * Une Activité Discord demande le salon de son instance — celui que
     * quelqu'un du même salon vocal a peut-être déjà ouvert — et, avec
     * `attente=1`, sa place dans la file quand le serveur est au complet.
     */
    const instance = url.searchParams.get("instance");
    const salonInstance = instance ? salonDInstance(instance) : undefined;
    const consoleSlug = url.searchParams.get("console") ?? "";
    json(reponse, 200, {
      instance: instance
        ? {
            salon: salonInstance
              ? {
                  id: salonInstance.id,
                  etat: salonInstance.etat,
                  joueurs: salonInstance.places.map((place) => place?.pseudo ?? null),
                  spectateurs: salonInstance.nombreSpectateurs,
                  maPlace: salonInstance.places.findIndex((place) => place?.userId === compte.id),
                }
              : null,
            rang: !salonInstance && url.searchParams.get("attente") === "1" ? attendre(instance, consoleSlug) : null,
          }
        : undefined,
      enAttente: salonsEnAttente(jeu).map((salon) => ({
        id: salon.id,
        hote: salon.places[0].pseudo,
        depuis: salon.creeLe,
      })),
      mien: mien ? { id: mien.id, jeu: mien.jeu.id, etat: mien.etat } : null,
      // Parties en cours qu'on peut regarder sur ce jeu.
      regardables: salonsRegardables(jeu).map((salon) => ({
        id: salon.id,
        joueurs: [salon.places[0].pseudo, salon.places[1]?.pseudo ?? "?"],
        spectateurs: salon.nombreSpectateurs,
        max: MAX_SPECTATEURS,
      })),
      // Salons qu'on peut encore ouvrir pour ce jeu ; null tant que la
      // capacité du serveur n'a pas été mesurée (pas de limite).
      libres: placesLibres(famille(consoleSlug)),
    });
    return true;
  }

  if (requete.method === "POST") {
    let corps: Record<string, unknown>;
    try {
      corps = await lireJson(requete);
    } catch {
      json(reponse, 400, refus("requete-illisible", "Requête illisible."));
      return true;
    }
    // L'instance Discord : une clé opaque donnée par `/api/discord/session`, jamais un nom libre.
    const instance = typeof corps.instance === "string" && /^[a-z0-9]{8,64}$/.test(corps.instance) ? corps.instance : undefined;
    const resultat = await creerSalon(
      String(corps.jeu ?? ""),
      compte,
      corps.prive === true,
      corps.spectateurs === true || instance !== undefined,
      instance,
    );
    if ("erreur" in resultat) json(reponse, 409, resultat);
    else json(reponse, 201, { id: resultat.id });
    return true;
  }

  json(reponse, 405, refus("methode-non-permise", "Méthode non permise."));
  return true;
}

await app.prepare();
// Les deux gestionnaires n'existent qu'une fois Next préparé.
const versNext = app.getRequestHandler();
/**
 * `getUpgradeHandler()` renvoie celui du serveur de rendu, qui ignore le
 * rechargement à chaud. Celui que Next accroche lui-même — et que le leurre
 * lui cache — est `upgradeHandler`, propriété du serveur personnalisé : c'est
 * lui qui sait parler au client HMR en développement.
 */
type AvecUpgrade = { upgradeHandler?: (req: IncomingMessage, socket: Duplex, head: Buffer) => unknown };
const upgradeNext = (app as unknown as AvecUpgrade).upgradeHandler ?? app.getUpgradeHandler();
surveillerAbandons();

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url ?? "/", `http://${requete.headers.host ?? "localhost"}`);
  routesLink(requete, reponse, url)
    .then((servi) => {
      if (!servi) return versNext(requete, reponse);
    })
    .catch((erreur: unknown) => {
      console.error("[link]", erreur);
      if (!reponse.headersSent) json(reponse, 500, refus("erreur-interne", "Erreur interne."));
    });
});

serveur.on("upgrade", (requete, socket, tete) => {
  const url = new URL(requete.url ?? "/", `http://${requete.headers.host ?? "localhost"}`);
  if (url.pathname !== "/link/ws") {
    // Le rechargement à chaud de Next passe aussi par une WebSocket.
    return upgradeNext(requete, socket, tete);
  }

  void (async () => {
    const compte = await compteDuLink(requete.headers, url);
    const salon = salons().get(url.searchParams.get("salon") ?? "");
    if (!compte || !salon) {
      console.log(`[link] WebSocket refusée : ${compte ? "salon inconnu" : "pas de session"} (${url.search})`);
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    const entrer = url.searchParams.get("spectateur") === "1" ? regarder : attacher;
    wss.handleUpgrade(requete, socket, tete, (prise) => {
      entrer(salon, compte, prise).catch((erreur: unknown) => {
        // Une session qui ne démarre pas doit le dire au joueur, pas faire
        // tomber le serveur du site avec une promesse rejetée.
        console.error("[link] salon", salon.id, erreur);
        if (prise.readyState === prise.OPEN) {
          const erreur: MessageServeur = {
            t: "erreur",
            message: "Le salon n'a pas pu démarrer.",
            code: "salon-non-demarre",
          };
          prise.send(JSON.stringify(erreur));
          prise.close();
        }
      });
    });
  })().catch((erreur: unknown) => {
    console.error("[link] upgrade", erreur);
    socket.destroy();
  });
});

serveur.listen(port, hote, () => {
  console.log(`> Site et câble link sur http://${hote}:${port} (${dev ? "développement" : "production"})`);
});
