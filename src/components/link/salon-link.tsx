"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { Manette } from "@/components/player/manette";
import type { Bouton } from "@/lib/emulator/adapter";
import { toucheDeEvenement, type Touche } from "@/lib/consoles";
import { useManette } from "@/components/player/use-manette";
import {
  BITS,
  ENTETE_AUDIO,
  ENTETE_IMAGE,
  TRAME,
  type MessageClient,
  type MessageServeur,
  type Participant,
} from "@/lib/link/protocole";

/**
 * Le client léger d'un salon : un écran, des boutons, du son.
 *
 * Tout tourne sur le serveur. Ce composant ne fait que trois choses —
 * décompresser et dessiner les images qu'on lui envoie, jouer le son, et
 * renvoyer l'état des boutons dès qu'il change. Il n'y a pas de cœur
 * d'émulation ici, donc pas d'isolation cross-origin à exiger, et l'onglet
 * peut passer en arrière-plan sans que la partie s'arrête.
 *
 * En spectateur, même chose sans les boutons : les deux écrans arrivent,
 * chacun dans son canvas, et le son du joueur 1.
 */

export function SalonLink({
  salonId,
  touches,
  manette,
  spectateur = false,
  retour,
}: {
  salonId: string;
  touches: Record<Touche, string>;
  /** Disposition de la manette ; l'accéléré n'a pas de sens ici. */
  manette: Record<Touche, string>;
  /** Regarder sans jouer : deux écrans, pas de touches, pas de fin de session. */
  spectateur?: boolean;
  retour: string;
}) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const priseRef = useRef<WebSocket | null>(null);
  const masqueRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const prochainSonRef = useRef(0);
  const muetRef = useRef(false);

  const [etat, setEtat] = useState<MessageServeur & { t: "etat" }>();
  const [fin, setFin] = useState<{ enregistre: boolean; raison: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [muet, setMuet] = useState(false);
  const [tactile, setTactile] = useState(false);

  useEffect(() => {
    const requete = window.matchMedia("(pointer: coarse)");
    setTactile(requete.matches);
    const suivre = (e: MediaQueryListEvent) => setTactile(e.matches);
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  }, []);

  const envoyer = useCallback((message: MessageClient) => {
    const prise = priseRef.current;
    if (prise?.readyState === WebSocket.OPEN) prise.send(JSON.stringify(message));
  }, []);

  /** Pose ou retire un bouton dans le masque, et prévient le serveur si ça change. */
  const bouton = useCallback(
    (nom: Bouton, enfonce: boolean) => {
      const bit = BITS[nom];
      const avant = masqueRef.current;
      const apres = enfonce ? avant | bit : avant & ~bit;
      if (apres === avant) return;
      masqueRef.current = apres;
      envoyer({ t: "boutons", masque: apres });
    },
    [envoyer],
  );

  // La manette, comme le clavier : seuls les boutons de la console comptent.
  const surToucheManette = useCallback(
    (touche: Touche, enfonce: boolean) => {
      if (touche in BITS) bouton(touche as Bouton, enfonce);
    },
    [bouton],
  );
  useManette(manette, surToucheManette, !spectateur);

  // Connexion, et tout ce qui en découle.
  useEffect(() => {
    const protocole = location.protocol === "https:" ? "wss" : "ws";
    const prise = new WebSocket(
      `${protocole}://${location.host}/link/ws?salon=${encodeURIComponent(salonId)}${spectateur ? "&spectateur=1" : ""}`,
    );
    prise.binaryType = "arraybuffer";
    priseRef.current = prise;

    /**
     * Un écran par canvas. Les images arrivent plus vite qu'on ne les
     * décompresse si l'onglet est à la peine : on ne garde que la dernière en
     * attente par écran. Mieux vaut sauter une image que de prendre du retard
     * pour de bon.
     */
    type Ecran = { enCours: boolean; enAttente: ArrayBuffer | null; image: ImageData | null };
    const ecrans: Ecran[] = [
      { enCours: false, enAttente: null, image: null },
      { enCours: false, enAttente: null, image: null },
    ];

    async function dessiner(index: number, trame: ArrayBuffer): Promise<void> {
      const canvas = canvasRefs.current[index];
      const contexte = canvas?.getContext("2d");
      if (!canvas || !contexte) return;
      const ecran = ecrans[index]!;
      const vue = new DataView(trame);
      const largeur = vue.getUint16(2, true);
      const hauteur = vue.getUint16(4, true);
      const comprime = new Blob([trame.slice(ENTETE_IMAGE)]);
      const brut = new Uint8Array(
        await new Response(comprime.stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer(),
      );
      if (!ecran.image || ecran.image.width !== largeur || ecran.image.height !== hauteur) {
        ecran.image = new ImageData(largeur, hauteur);
        canvas.width = largeur;
        canvas.height = hauteur;
      }
      const sortie = ecran.image.data;
      for (let i = 0, o = 0; i < brut.length; i += 2, o += 4) {
        const p = brut[i]! | (brut[i + 1]! << 8);
        sortie[o] = ((p >> 11) & 0x1f) << 3;
        sortie[o + 1] = ((p >> 5) & 0x3f) << 2;
        sortie[o + 2] = (p & 0x1f) << 3;
        sortie[o + 3] = 255;
      }
      contexte.putImageData(ecran.image, 0, 0);
    }

    function recevoirImage(trame: ArrayBuffer): void {
      // Un joueur ne reçoit que son écran, qu'il dessine dans le premier
      // canvas ; un spectateur reçoit les deux, chacun dans le sien.
      const index = spectateur ? new Uint8Array(trame, 1, 1)[0]! & 1 : 0;
      const ecran = ecrans[index]!;
      if (ecran.enCours) {
        ecran.enAttente = trame;
        return;
      }
      ecran.enCours = true;
      dessiner(index, trame)
        .catch(() => {})
        .finally(() => {
          ecran.enCours = false;
          const suivante = ecran.enAttente;
          ecran.enAttente = null;
          if (suivante) recevoirImage(suivante);
        });
    }

    function recevoirAudio(trame: ArrayBuffer): void {
      const audio = audioRef.current;
      if (!audio || audio.state !== "running" || muetRef.current) return;
      const frequence = new DataView(trame).getUint32(4, true);
      const pcm = new Int16Array(trame, ENTETE_AUDIO);
      if (pcm.length === 0) return;
      const tampon = audio.createBuffer(1, pcm.length, frequence);
      const canal = tampon.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) canal[i] = pcm[i]! / 32768;
      const maintenant = audio.currentTime;
      // Une petite avance absorbe la gigue du réseau ; au-delà d'un quart de
      // seconde de retard, on laisse tomber plutôt que de s'éloigner du jeu.
      if (prochainSonRef.current < maintenant) prochainSonRef.current = maintenant + 0.08;
      if (prochainSonRef.current > maintenant + 0.25) return;
      const source = audio.createBufferSource();
      source.buffer = tampon;
      source.connect(audio.destination);
      source.start(prochainSonRef.current);
      prochainSonRef.current += tampon.duration;
    }

    /*
     * En développement, React monte, démonte et remonte l'effet : la première
     * prise est fermée avant d'être ouverte, et ses événements de fermeture
     * arrivent après l'ouverture de la seconde. Chaque gestionnaire vérifie
     * donc qu'il parle encore de la prise en service.
     */
    const courante = () => priseRef.current === prise;
    prise.onopen = () => courante() && setConnecte(true);
    prise.onclose = () => courante() && setConnecte(false);
    prise.onerror = () => courante() && setErreur("La connexion au salon a échoué.");
    prise.onmessage = (evenement) => {
      if (!courante()) return;
      if (evenement.data instanceof ArrayBuffer) {
        const type = new Uint8Array(evenement.data, 0, 1)[0];
        if (type === TRAME.IMAGE) recevoirImage(evenement.data);
        else if (type === TRAME.AUDIO) recevoirAudio(evenement.data);
        return;
      }
      const message = JSON.parse(String(evenement.data)) as MessageServeur;
      if (message.t === "etat") setEtat(message);
      else if (message.t === "termine") setFin({ enregistre: message.enregistre, raison: message.raison });
      else if (message.t === "erreur") setErreur(message.message);
    };

    // Le son ne peut démarrer qu'après un geste : on l'arme au premier.
    const armerSon = () => {
      if (!audioRef.current) {
        try {
          audioRef.current = new AudioContext();
        } catch {
          return;
        }
      }
      void audioRef.current.resume();
    };
    window.addEventListener("pointerdown", armerSon);

    if (spectateur) {
      // Rien à envoyer : ni touches, ni relâchement.
      return () => {
        window.removeEventListener("pointerdown", armerSon);
        if (priseRef.current === prise) priseRef.current = null;
        prise.close();
        void audioRef.current?.close().catch(() => {});
        audioRef.current = null;
      };
    }

    const inverse = Object.fromEntries(
      Object.entries(touches).map(([nom, touche]) => [touche, nom as Touche]),
    ) as Record<string, Touche>;
    const clavier = (evenement: KeyboardEvent, enfonce: boolean) => {
      const nom = inverse[toucheDeEvenement(evenement)] ?? inverse[evenement.code];
      // Les actions du lecteur (accélérer) n'existent pas sur le câble link :
      // le serveur tient la cadence pour les deux joueurs.
      if (!nom || !(nom in BITS)) return;
      evenement.preventDefault();
      bouton(nom as Bouton, enfonce);
    };
    const bas = (e: KeyboardEvent) => {
      armerSon();
      clavier(e, true);
    };
    const haut = (e: KeyboardEvent) => clavier(e, false);
    const toutLacher = () => {
      if (masqueRef.current === 0) return;
      masqueRef.current = 0;
      envoyer({ t: "boutons", masque: 0 });
    };

    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    window.addEventListener("blur", toutLacher);

    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
      window.removeEventListener("blur", toutLacher);
      window.removeEventListener("pointerdown", armerSon);
      if (priseRef.current === prise) priseRef.current = null;
      prise.close();
      void audioRef.current?.close().catch(() => {});
      audioRef.current = null;
    };
  }, [salonId, touches, bouton, envoyer, spectateur]);

  const jeu = etat?.jeu;
  const moi = etat?.joueur ?? 0;
  const autre = etat?.joueurs[1 - moi] ?? null;
  const largeur = jeu?.largeur ?? 160;
  const hauteur = jeu?.hauteur ?? 144;

  if (fin) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-lg font-semibold text-ink-50">Session terminée</p>
        <p className="text-sm text-ink-400">
          {spectateur
            ? "La partie est finie."
            : fin.enregistre
              ? "Les deux parties sont enregistrées sur vos comptes."
              : "Les parties n'ont pas été enregistrées : vos sauvegardes d'avant la session sont intactes."}
          <br />
          <span className="text-ink-700">({fin.raison})</span>
        </p>
        <Link href={retour} className="text-sm text-accent-400 hover:underline">
          Retour à la fiche du jeu
        </Link>
      </div>
    );
  }

  const canvas = (index: number, pleineLargeur: boolean) => (
    <canvas
      ref={(element) => {
        canvasRefs.current[index] = element;
      }}
      width={largeur}
      height={hauteur}
      className="mx-auto block bg-black"
      style={{
        imageRendering: "pixelated",
        aspectRatio: `${largeur} / ${hauteur}`,
        width: pleineLargeur ? "100%" : `min(100%, calc(70vh * ${largeur} / ${hauteur}))`,
      }}
    />
  );

  const ecran = spectateur ? (
    // Les deux consoles côte à côte, l'une sous l'autre sur un téléphone.
    <div className="grid gap-4 sm:grid-cols-2">
      {([0, 1] as const).map((index) => (
        <figure key={index} className="flex flex-col gap-1">
          {canvas(index, true)}
          <figcaption className="text-center text-xs text-ink-400">
            {etat?.joueurs[index]?.pseudo ?? `Joueur ${index + 1}`}
          </figcaption>
        </figure>
      ))}
    </div>
  ) : (
    canvas(0, tactile)
  );

  const spectateurs = etat?.spectateurs;
  const bandeau = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-semibold text-ink-50">{jeu?.titre ?? "Salon"}</span>
      <span className="text-ink-400">
        salon <span className="font-mono text-ink-200">{salonId}</span>
      </span>
      {spectateur ? (
        <>
          <Presence participant={etat?.joueurs[0] ?? null} />
          <Presence participant={etat?.joueurs[1] ?? null} />
          <span className="text-ink-400">tu regardes</span>
        </>
      ) : (
        <>
          <Presence participant={etat?.joueurs[moi] ?? null} moi />
          <Presence participant={autre} />
        </>
      )}
      {spectateurs && spectateurs.ouverts && (
        <span className="text-xs text-ink-700">
          {spectateurs.nombre === 0
            ? "aucun spectateur"
            : `${spectateurs.nombre} spectateur${spectateurs.nombre > 1 ? "s" : ""}`}{" "}
          (sur {spectateurs.max})
        </span>
      )}
      {!connecte && <span className="text-red-300">déconnecté</span>}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        onClick={() => {
          muetRef.current = !muet;
          setMuet(!muet);
        }}
      >
        {muet ? "Son coupé" : "Son"}
      </Button>
      {!spectateur && (
        <Button
          onClick={() => {
            if (confirm("Terminer la session ? Les deux parties seront enregistrées sur vos comptes.")) {
              envoyer({ t: "terminer" });
            }
          }}
          disabled={etat?.etat !== "en-jeu"}
        >
          Terminer et enregistrer
        </Button>
      )}
      <Link href={retour} className="text-xs text-ink-400 hover:text-ink-200">
        {spectateur ? "Arrêter de regarder" : "Quitter sans terminer"}
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {bandeau}
      {erreur && <Alert tone="error">{erreur}</Alert>}
      {etat?.etat === "attente" && !spectateur && (
        <Alert tone="info">
          {etat.prive
            ? "Salon privé : il n'apparaît pas sur la fiche du jeu. Donne ce code à ton partenaire, il le saisira dans « Rejoindre avec un code » : "
            : "En attente d'un second joueur. Dis-lui d'ouvrir la fiche du jeu et de rejoindre le salon "}
          <strong className="font-mono">{salonId}</strong>.
        </Alert>
      )}
      {ecran}
      {tactile && !spectateur && etat?.etat === "en-jeu" && (
        <Manette gachettes={etat.jeu.gachettes} surBouton={bouton} />
      )}
      {actions}
      {!tactile && !spectateur && (
        <p className="text-xs text-ink-700">
          Les touches sont celles de ton compte pour cette console. Le jeu tourne sur le serveur :
          tu peux changer d&apos;onglet, la partie continue.
        </p>
      )}
      {spectateur && (
        <p className="text-xs text-ink-700">
          Tu entends la console de {etat?.joueurs[0]?.pseudo ?? "gauche"}. Le son démarre au premier clic.
        </p>
      )}
    </div>
  );
}

function Presence({ participant, moi = false }: { participant: Participant | null; moi?: boolean }) {
  if (!participant) return <span className="text-ink-700">— en attente —</span>;
  return (
    <span className={participant.present ? "text-ink-200" : "text-ink-700"}>
      <span
        className={`mr-1 inline-block size-2 rounded-full ${participant.present ? "bg-green-400" : "bg-ink-700"}`}
      />
      {participant.pseudo}
      {moi && " (toi)"}
    </span>
  );
}
