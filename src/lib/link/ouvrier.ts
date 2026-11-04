/**
 * L'ouvrier : deux consoles reliées, dans un fil à part.
 *
 * Tout le travail du câble link se passe ici — faire tourner le moteur,
 * convertir les images, les compresser — pour que le fil principal, qui sert
 * aussi le site, n'ait qu'à relayer des messages. Un salon, un ouvrier.
 *
 * Reçoit :
 *   { t: "demarrer", ... }      la ROM, les deux sauvegardes, le cœur
 *   { t: "boutons", joueur, masque }
 *   { t: "arreter" }            répond par les deux SRAM, puis s'arrête
 *
 * Émet :
 *   { t: "pret", largeur, hauteur, ips, frequence }
 *   { t: "image", joueur, largeur, hauteur, donnees }   un écran changé
 *   { t: "audio", joueur, frequence, pcm }              Int16 mono ; joueur null = pour les deux
 *   { t: "srams", srams: [ArrayBuffer, ArrayBuffer] }
 *   { t: "erreur", message }
 */
import { parentPort } from "node:worker_threads";
import { deflateRawSync } from "node:zlib";
import { demarrerMoteur, type DescriptionCoeur } from "./moteurs.ts";

type Demarrage = {
  t: "demarrer";
  coeur: DescriptionCoeur;
  rom: ArrayBuffer;
  nom: string;
  saves: [ArrayBuffer | null, ArrayBuffer | null];
};

type Entrant = Demarrage | { t: "boutons"; joueur: 0 | 1; masque: number } | { t: "arreter" };

const port = parentPort;
if (!port) throw new Error("Cet ouvrier doit être lancé comme fil de travail.");

/** Images par tic au maximum : au-delà, on laisse filer plutôt que de rattraper. */
const RATTRAPAGE_MAX = 4;

async function demarrer(ordre: Demarrage): Promise<void> {
  const moteur = await demarrerMoteur(
    ordre.coeur,
    new Uint8Array(ordre.rom),
    ordre.nom,
    [
      ordre.saves[0] ? new Uint8Array(ordre.saves[0]) : null,
      ordre.saves[1] ? new Uint8Array(ordre.saves[1]) : null,
    ],
  );

  const boutons: [number, number] = [0, 0];
  let arret: (() => void) | null = null;

  port!.on("message", (message: Entrant) => {
    if (message.t === "boutons") {
      boutons[message.joueur] = message.masque;
    } else if (message.t === "arreter") {
      arret = () => {
        const srams = moteur.srams().map((sram) =>
          sram ? sram.buffer.slice(sram.byteOffset, sram.byteOffset + sram.byteLength) : new ArrayBuffer(0),
        ) as [ArrayBuffer, ArrayBuffer];
        port!.postMessage({ t: "srams", srams }, srams);
        moteur.arreter();
      };
    }
  });

  port!.postMessage({
    t: "pret",
    largeur: moteur.largeur,
    hauteur: moteur.hauteur,
    ips: moteur.ips,
    frequence: moteur.frequence,
  });

  const precedentes: [Buffer | null, Buffer | null] = [null, null];
  const periode = 1000 / moteur.ips;
  let dernier = performance.now();
  let retard = 0;

  function envoyerSon(joueur: 0 | 1 | null, pcm: Int16Array): void {
    if (pcm.length === 0) return;
    const copie = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
    port!.postMessage({ t: "audio", joueur, frequence: moteur.frequence, pcm: copie }, [copie]);
  }

  function tic(): void {
    if (arret) {
      arret();
      return;
    }
    const maintenant = performance.now();
    retard += (maintenant - dernier) / periode;
    dernier = maintenant;

    let images = Math.floor(retard);
    if (images > RATTRAPAGE_MAX) {
      // Le fil a été occupé ailleurs : on repart du présent plutôt que de
      // jouer une rafale d'images en accéléré.
      images = RATTRAPAGE_MAX;
      retard = 0;
    } else {
      retard -= images;
    }

    for (let i = 0; i < images; i++) moteur.avancer(boutons);

    if (images > 0) {
      for (const joueur of [0, 1] as const) {
        const ecran = moteur.image(joueur);
        if (precedentes[joueur] && precedentes[joueur]!.equals(ecran)) continue;
        precedentes[joueur] = ecran;
        const donnees = deflateRawSync(ecran, { level: 6 });
        const copie = donnees.buffer.slice(donnees.byteOffset, donnees.byteOffset + donnees.byteLength);
        port!.postMessage(
          { t: "image", joueur, largeur: moteur.largeur, hauteur: moteur.hauteur, donnees: copie },
          [copie],
        );
      }

      if (moteur.sonParJoueur) {
        for (const joueur of [0, 1] as const) envoyerSon(joueur, moteur.prendreSon(joueur));
      } else {
        envoyerSon(null, moteur.prendreSon(0));
      }
    }

    const ecoule = performance.now() - maintenant;
    setTimeout(tic, Math.max(0, periode - ecoule));
  }

  tic();
}

port.once("message", (message: Entrant) => {
  if (message.t !== "demarrer") {
    port.postMessage({ t: "erreur", message: "Le premier message doit démarrer la session." });
    return;
  }
  demarrer(message).catch((erreur: unknown) => {
    port.postMessage({
      t: "erreur",
      message: erreur instanceof Error ? erreur.message : "Démarrage impossible.",
    });
  });
});
