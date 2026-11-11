"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvecCode } from "@/components/link/code-salon";
import { useT } from "@/components/langue";
import { Alert, Button } from "@/components/ui";
import { usePleinEcranAuto } from "@/components/player/plein-ecran";
import { Commande } from "@/components/player/commandes";
import { Manette } from "@/components/player/manette";
import { GARDE_COUCHE, MARGES_SURES, usePaysage, useZone, variablesCouche } from "@/components/player/orientation";
import type { Bouton } from "@/lib/emulator/adapter";
import { toucheDeEvenement, type Touche } from "@/lib/consoles";
import { useManette } from "@/components/player/use-manette";
import type { Enregistreur } from "@/lib/keymap/actions";
import {
  BITS,
  ENTETE_AUDIO,
  ENTETE_IMAGE,
  TRAME,
  type MessageClient,
  type MessageServeur,
  type Participant,
} from "@/lib/link/protocole";
import { texteErreurLink, texteFinLink } from "@/lib/link/textes";

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
 *
 * Le même composant sert l'Activité Discord, à trois différences près : le
 * jeton de l'Activité à la place du cookie, un bouton de retour à la place
 * d'un lien, et pas de code de salon à dicter — le salon vocal en tient lieu.
 *
 * Téléphone couché, en partie : la même disposition que le lecteur en solo —
 * l'écran prend la hauteur, la croix et les boutons se posent sur les côtés,
 * le son et la fin de session sous la croix. Le reste (bandeau, actions)
 * revient en tenant le téléphone debout.
 */

export function SalonLink({
  salonId,
  consoleSlug,
  touches,
  manette,
  manettes,
  spectateur = false,
  retour,
  jeton,
  surQuitter,
  enregistreur,
}: {
  salonId: string;
  /** Console du jeu. */
  consoleSlug: string;
  touches: Record<Touche, string>;
  /** Disposition de la manette ; l'accéléré n'a pas de sens ici. */
  manette: Record<Touche, string>;
  /** Celles des manettes que le navigateur ne reconnaît pas, par « appareil|nom ». */
  manettes: Record<string, Record<Touche, string>>;
  /** Regarder sans jouer : deux écrans, pas de touches, pas de fin de session. */
  spectateur?: boolean;
  retour: string;
  /** Jeton de l'Activité Discord, porté dans l'adresse de la WebSocket. */
  jeton?: string;
  /** À la place du lien de retour : l'Activité n'a pas de pages. */
  surQuitter?: () => void;
  /** Où enregistrer la manette ; les actions du site par défaut. */
  enregistreur?: Pick<Enregistreur, "manette" | "retablirManette">;
}) {
  const t = useT();
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const priseRef = useRef<WebSocket | null>(null);
  const masqueRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const prochainSonRef = useRef(0);
  const muetRef = useRef(false);

  const [etat, setEtat] = useState<MessageServeur & { t: "etat" }>();
  // Les messages du serveur sont gardés tels qu'ils arrivent, avec leur code :
  // c'est à l'affichage qu'ils prennent la langue du joueur.
  const [fin, setFin] = useState<(MessageServeur & { t: "termine" }) | null>(null);
  /** `"connexion"` : la WebSocket elle-même a échoué, le serveur n'a rien dit. */
  const [erreur, setErreur] = useState<(MessageServeur & { t: "erreur" }) | "connexion" | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [muet, setMuet] = useState(false);
  const [tactile, setTactile] = useState(false);
  // Sur téléphone, le premier appui fait disparaître les barres du système.
  usePleinEcranAuto(tactile);
  const paysage = usePaysage();
  const zoneRef = useRef<HTMLDivElement>(null);
  const zone = useZone(zoneRef);

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
  useManette(consoleSlug, manette, manettes, surToucheManette, !spectateur, enregistreur);
  const discord = jeton !== undefined;

  // Connexion, et tout ce qui en découle.
  useEffect(() => {
    const protocole = location.protocol === "https:" ? "wss" : "ws";
    const prise = new WebSocket(
      `${protocole}://${location.host}/link/ws?salon=${encodeURIComponent(salonId)}${spectateur ? "&spectateur=1" : ""}${
        jeton ? `&jeton=${encodeURIComponent(jeton)}` : ""
      }`,
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
    prise.onerror = () => courante() && setErreur("connexion");
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
      else if (message.t === "termine") setFin(message);
      else if (message.t === "erreur") setErreur(message);
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
  }, [salonId, touches, bouton, envoyer, spectateur, jeton]);

  const quitter = (libelle: string, classes: string) =>
    surQuitter ? (
      <button type="button" onClick={surQuitter} className={classes}>
        {libelle}
      </button>
    ) : (
      <Link href={retour} className={classes}>
        {libelle}
      </Link>
    );

  const jeu = etat?.jeu;
  const moi = etat?.joueur ?? 0;
  const autre = etat?.joueurs[1 - moi] ?? null;
  const largeur = jeu?.largeur ?? 160;
  const hauteur = jeu?.hauteur ?? 144;

  if (fin) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-lg font-semibold text-ink-50">{t.link.salon.fin.titre}</p>
        <p className="text-sm text-ink-400">
          {spectateur
            ? t.link.salon.fin.spectateur
            : fin.enregistre
              ? t.link.salon.fin.enregistree
              : t.link.salon.fin.nonEnregistree}
          <br />
          <span className="text-ink-700">({texteFinLink(t, fin, fin.raison)})</span>
        </p>
        {quitter(discord ? t.link.salon.retour : t.link.retourFiche, "text-sm text-accent-400 hover:underline")}
      </div>
    );
  }

  /** Téléphone couché, en partie : l'écran au centre, la manette de part et d'autre. */
  const couche = tactile && paysage && !spectateur && etat?.etat === "en-jeu";

  const canvas = (index: number, pleineLargeur: boolean) => (
    <canvas
      ref={(element) => {
        canvasRefs.current[index] = element;
      }}
      width={largeur}
      height={hauteur}
      className={couche ? "h-full w-full object-contain" : "mx-auto block bg-black"}
      style={
        couche
          ? { imageRendering: "pixelated" }
          : {
              imageRendering: "pixelated",
              aspectRatio: `${largeur} / ${hauteur}`,
              width: pleineLargeur ? "100%" : `min(100%, calc(70vh * ${largeur} / ${hauteur}))`,
            }
      }
    />
  );

  const ecran = spectateur ? (
    // Les deux consoles côte à côte, l'une sous l'autre sur un téléphone.
    <div className="grid gap-4 sm:grid-cols-2">
      {([0, 1] as const).map((index) => (
        <figure key={index} className="flex flex-col gap-1">
          {canvas(index, true)}
          <figcaption className="text-center text-xs text-ink-400">
            {etat?.joueurs[index]?.pseudo ?? t.link.salon.joueur(index + 1)}
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
      <span className="font-semibold text-ink-50">{jeu?.titre ?? t.link.salon.sansTitre}</span>
      {!discord && (
        <span className="text-ink-400">
          <AvecCode texte={t.link.salon.code(salonId)} classes="font-mono text-ink-200" />
        </span>
      )}
      {spectateur ? (
        <>
          <Presence participant={etat?.joueurs[0] ?? null} />
          <Presence participant={etat?.joueurs[1] ?? null} />
          <span className="text-ink-400">{t.link.salon.tuRegardes}</span>
        </>
      ) : (
        <>
          <Presence participant={etat?.joueurs[moi] ?? null} moi />
          <Presence participant={autre} />
        </>
      )}
      {spectateurs && spectateurs.ouverts && (
        <span className="text-xs text-ink-700">{t.link.salon.spectateurs(spectateurs.nombre, spectateurs.max)}</span>
      )}
      {!connecte && <span className="text-red-300">{t.link.salon.deconnecte}</span>}
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
        {muet ? t.partie.son.coupe : t.partie.son.actif}
      </Button>
      {!spectateur && (
        <Button
          onClick={() => {
            if (confirm(t.link.salon.confirmerFin)) {
              envoyer({ t: "terminer" });
            }
          }}
          disabled={etat?.etat !== "en-jeu"}
        >
          {t.link.salon.terminer}
        </Button>
      )}
      {quitter(
        spectateur ? t.link.salon.arreterDeRegarder : t.link.salon.quitterSansTerminer,
        "text-xs text-ink-400 hover:text-ink-200",
      )}
    </div>
  );

  /*
    Une seule arborescence pour les deux dispositions : le serveur dessine
    dans **ce** canvas, et tourner le téléphone ne doit pas en créer un
    autre. Couché, le salon couvre tout l'écran par-dessus la page, avec les
    marges sûres de Discord ; debout, il reprend sa place dans la page.
  */
  return (
    <div
      className={couche ? "fixed inset-0 z-20 flex flex-col bg-ink-950" : "flex flex-col gap-4"}
      style={couche ? MARGES_SURES : undefined}
    >
      <div className={couche ? "hidden" : "contents"}>{bandeau}</div>
      {erreur && (
        <Alert tone="error">
          {erreur === "connexion" ? t.link.salon.connexionEchouee : texteErreurLink(t, erreur, erreur.message)}
        </Alert>
      )}
      {etat?.etat === "attente" && !spectateur && (
        <Alert tone="info">
          {discord ? (
            t.link.salon.attente.discord(t.activite.accueil.jouerADeux)
          ) : (
            <AvecCode
              balise="strong"
              texte={etat.prive ? t.link.salon.attente.prive(salonId) : t.link.salon.attente.publique(salonId)}
            />
          )}
        </Alert>
      )}
      <div
        ref={zoneRef}
        className={couche ? "relative flex min-h-0 flex-1 flex-col" : "contents"}
        style={couche ? variablesCouche(zone) : undefined}
      >
        <div
          className={couche ? "flex min-h-0 flex-1 items-center justify-center p-2" : "contents"}
          style={
            couche
              ? {
                  paddingLeft: `calc(var(--cote) + ${GARDE_COUCHE})`,
                  paddingRight: `calc(var(--cote) + ${GARDE_COUCHE})`,
                }
              : undefined
          }
        >
          {ecran}
        </div>
        {tactile && !spectateur && etat?.etat === "en-jeu" && (
          // Couchée, la manette se pose par-dessus toute la zone ; le son et
          // la fin de session, d'ordinaire dans les actions, passent sous la croix.
          <div className={couche ? "pointer-events-none absolute inset-0" : "contents"}>
            <Manette
              gachettes={etat.jeu.gachettes}
              surBouton={bouton}
              paysage={couche}
              basGauche={
                couche ? (
                  // L'un sous l'autre : la bande de la croix est étroite.
                  <div className="flex flex-col items-center gap-1">
                    <Commande
                      onClick={() => {
                        muetRef.current = !muet;
                        setMuet(!muet);
                      }}
                      actif={muet}
                    >
                      {muet ? t.partie.son.coupe : t.partie.son.actif}
                    </Commande>
                    <Commande
                      onClick={() => {
                        if (confirm(t.link.salon.confirmerFin)) envoyer({ t: "terminer" });
                      }}
                    >
                      {t.link.salon.terminerCourt}
                    </Commande>
                  </div>
                ) : undefined
              }
            />
          </div>
        )}
      </div>
      <div className={couche ? "hidden" : "contents"}>
        {actions}
        {!tactile && !spectateur && (
          <p className="text-xs text-ink-700">{t.link.salon.aide}</p>
        )}
        {spectateur && (
          <p className="text-xs text-ink-700">{t.link.salon.sonSpectateur(etat?.joueurs[0]?.pseudo ?? null)}</p>
        )}
      </div>
    </div>
  );
}

function Presence({ participant, moi = false }: { participant: Participant | null; moi?: boolean }) {
  const t = useT();
  if (!participant) return <span className="text-ink-700">{t.link.salon.enAttente}</span>;
  return (
    <span className={participant.present ? "text-ink-200" : "text-ink-700"}>
      <span
        className={`mr-1 inline-block size-2 rounded-full ${participant.present ? "bg-green-400" : "bg-ink-700"}`}
      />
      {moi ? t.link.salon.toi(participant.pseudo) : participant.pseudo}
    </span>
  );
}
