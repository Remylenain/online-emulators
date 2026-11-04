/**
 * Point d'entrée des crochets de résolution pour Node.
 *
 *   node --import ./outils/node/charge-ts.mjs serveur.ts
 *
 * Node sait exécuter du TypeScript (il retire les types), mais il ne connaît
 * ni l'alias `@/` du projet, ni les imports relatifs sans extension que Next
 * accepte partout dans `src/`. Le résolveur enregistré ici comble ces deux
 * manques, pour que le serveur du câble link puisse charger les mêmes modules
 * que le site — la base, les sauvegardes, les chemins — sans les dupliquer.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { register } from "node:module";

/*
 * Next range ses contextes de requête dans `globalThis.AsyncLocalStorage`,
 * qu'il installe lui-même au démarrage de son serveur. Mais nos modules —
 * les sauvegardes, qui passent par `next/headers` — sont chargés avant, au
 * moment où Node lie les imports de `serveur.ts`. Sans ce global, Next crée
 * un contexte factice qui lève « AsyncLocalStorage accessed in runtime where
 * it is not available » à la première page. On le pose donc en premier.
 */
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

register("./resolveur.mjs", import.meta.url);
