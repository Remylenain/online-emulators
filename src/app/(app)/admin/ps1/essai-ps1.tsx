"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { BOUTONS_PSX, CoeurLibretro } from "@/lib/emulator/libretro";

/** Le commit du cœur, dans l'adresse : un cœur recompilé ne ressort pas du cache. */
const URL_COEUR = "/pcsx-rearmed/pcsx-rearmed.js?v=7b0e8f8";

const CLAVIER: Record<string, number> = {
  arrowup: BOUTONS_PSX.UP,
  arrowdown: BOUTONS_PSX.DOWN,
  arrowleft: BOUTONS_PSX.LEFT,
  arrowright: BOUTONS_PSX.RIGHT,
  x: BOUTONS_PSX.CROIX,
  c: BOUTONS_PSX.ROND,
  s: BOUTONS_PSX.CARRE,
  d: BOUTONS_PSX.TRIANGLE,
  a: BOUTONS_PSX.L1,
  e: BOUTONS_PSX.R1,
  q: BOUTONS_PSX.L2,
  r: BOUTONS_PSX.R2,
  enter: BOUTONS_PSX.START,
  backspace: BOUTONS_PSX.SELECT,
};

/** Une manette à numérotation standard : l'indice du bouton → le bouton PlayStation. */
const MANETTE: [number, number][] = [
  [0, BOUTONS_PSX.CROIX],
  [1, BOUTONS_PSX.ROND],
  [2, BOUTONS_PSX.CARRE],
  [3, BOUTONS_PSX.TRIANGLE],
  [4, BOUTONS_PSX.L1],
  [5, BOUTONS_PSX.R1],
  [6, BOUTONS_PSX.L2],
  [7, BOUTONS_PSX.R2],
  [8, BOUTONS_PSX.SELECT],
  [9, BOUTONS_PSX.START],
  [10, BOUTONS_PSX.L3],
  [11, BOUTONS_PSX.R3],
  [12, BOUTONS_PSX.UP],
  [13, BOUTONS_PSX.DOWN],
  [14, BOUTONS_PSX.LEFT],
  [15, BOUTONS_PSX.RIGHT],
];

function masqueManette(): number {
  if (typeof navigator.getGamepads !== "function") return 0;
  const manette = [...navigator.getGamepads()].find((m) => m && m.connected);
  if (!manette) return 0;
  let masque = 0;
  for (const [indice, bouton] of MANETTE) if (manette.buttons[indice]?.pressed) masque |= bouton;
  const [x = 0, y = 0] = manette.axes;
  if (x < -0.5) masque |= BOUTONS_PSX.LEFT;
  if (x > 0.5) masque |= BOUTONS_PSX.RIGHT;
  if (y < -0.5) masque |= BOUTONS_PSX.UP;
  if (y > 0.5) masque |= BOUTONS_PSX.DOWN;
  return masque;
}

const enMo = (octets: number) => `${(octets / 1024 / 1024).toFixed(1)} Mo`;

/** Une image posée sur le serveur, telle que la liste la donne. */
type DisqueServeur = { nom: string; taille: number };

type Mesures = { ips: number; cible: number; msParImage: number; tas: number; definition: string };
type Reprise = {
  brut: number;
  compresse: number;
  /** L'écran au moment de la prise, pour savoir où l'on reviendra. */
  vignette: string | null;
  heure: string;
};

/**
 * Essai de l'émulation PlayStation : le cœur PCSX-ReARMed, compilé en
 * WebAssembly par `outils/pcsx-rearmed/build.sh`, piloté par le même hôte
 * libretro que le câble link.
 *
 * C'est un banc d'essai, pas un lecteur : pas de sauvegarde vers le serveur,
 * pas de manette tactile, des touches fixes. Il répond à trois questions —
 * le jeu démarre-t-il sans BIOS, le cœur tient-il la cadence sur cet
 * appareil, et combien pèsent un point de reprise et la carte mémoire.
 *
 * Le cœur tourne ici dans la page elle-même. Un vrai lecteur le mettrait dans
 * un fil à part, pour qu'une image lente ne fige pas l'interface.
 */
export function EssaiPs1({ disquesServeur }: { disquesServeur: DisqueServeur[] }) {
  const [disque, setDisque] = useState<File | null>(null);
  /** Part reçue de l'image en cours de téléchargement, de 0 à 1 ; `null` hors téléchargement. */
  const [progression, setProgression] = useState<number | null>(null);
  const [titre, setTitre] = useState<string | null>(null);
  const [bios, setBios] = useState<File | null>(null);
  const [etat, setEtat] = useState<"attente" | "chargement" | "en-jeu" | "erreur">("attente");
  const [erreur, setErreur] = useState<string | null>(null);
  const [mesures, setMesures] = useState<Mesures | null>(null);
  const [reprise, setReprise] = useState<Reprise | null>(null);
  const [carte, setCarte] = useState<number | null>(null);
  const [journal, setJournal] = useState<string[]>([]);

  const toile = useRef<HTMLCanvasElement>(null);
  const coeurRef = useRef<CoeurLibretro | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const clavierRef = useRef(0);
  const prochainSon = useRef(0);
  const pointRef = useRef<Uint8Array | null>(null);

  const jouerSon = useCallback((lots: Int16Array[], frequence: number) => {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running") return;
    const trames = lots.reduce((somme, lot) => somme + lot.length, 0) / 2;
    if (trames === 0) return;

    const tampon = audio.createBuffer(2, trames, frequence);
    const gauche = tampon.getChannelData(0);
    const droite = tampon.getChannelData(1);
    let i = 0;
    for (const lot of lots) {
      for (let k = 0; k < lot.length; k += 2) {
        gauche[i] = lot[k]! / 32768;
        droite[i] = lot[k + 1]! / 32768;
        i++;
      }
    }
    // Les tampons s'enchaînent bout à bout. Si la file s'est vidée, ou qu'elle
    // a pris trop d'avance, on repart d'un petit délai devant l'instant présent.
    const maintenant = audio.currentTime;
    if (prochainSon.current < maintenant + 0.02 || prochainSon.current > maintenant + 0.3) {
      prochainSon.current = maintenant + 0.06;
    }
    const source = audio.createBufferSource();
    source.buffer = tampon;
    source.connect(audio.destination);
    source.start(prochainSon.current);
    prochainSon.current += tampon.duration;
  }, []);

  // La boucle : avancer le cœur à sa cadence, dessiner, jouer le son, mesurer.
  useEffect(() => {
    if (etat !== "en-jeu") return;
    const coeur = coeurRef.current;
    const contexte = toile.current?.getContext("2d");
    if (!coeur || !contexte) return;

    let demande = 0;
    let echeance = 0;
    let images = 0;
    let cout = 0;
    let debutMesure = performance.now();

    const boucle = (instant: number) => {
      demande = requestAnimationFrame(boucle);
      const pas = 1000 / coeur.ips;
      // Onglet resté en arrière-plan : on ne rattrape pas le temps perdu.
      if (echeance === 0 || instant - echeance > 250) echeance = instant;

      let faites = 0;
      while (instant >= echeance && faites < 3) {
        const depart = performance.now();
        coeur.avancer([clavierRef.current | masqueManette()]);
        cout += performance.now() - depart;
        echeance += pas;
        images++;
        faites++;
      }
      if (faites > 0) {
        const image = coeur.image;
        if (image) {
          const cadre = contexte.canvas;
          if (cadre.width !== image.width || cadre.height !== image.height) {
            cadre.width = image.width;
            cadre.height = image.height;
          }
          contexte.putImageData(image, 0, 0);
        }
        jouerSon(coeur.prendreSon(), coeur.frequence);
      }

      const ecoule = instant - debutMesure;
      if (ecoule >= 1000) {
        setMesures({
          ips: (images * 1000) / ecoule,
          cible: coeur.ips,
          msParImage: images > 0 ? cout / images : 0,
          tas: coeur.memoire,
          definition: coeur.image ? `${coeur.image.width} × ${coeur.image.height}` : "—",
        });
        images = 0;
        cout = 0;
        debutMesure = instant;
      }
    };
    demande = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(demande);
  }, [etat, jouerSon]);

  // Le clavier : les touches du jeu ne doivent pas faire défiler la page.
  useEffect(() => {
    if (etat !== "en-jeu") return;
    const surTouche = (evenement: KeyboardEvent, enfonce: boolean) => {
      const bouton = CLAVIER[evenement.key.toLowerCase()];
      if (!bouton || evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
      evenement.preventDefault();
      clavierRef.current = enfonce ? clavierRef.current | bouton : clavierRef.current & ~bouton;
    };
    const bas = (evenement: KeyboardEvent) => surTouche(evenement, true);
    const haut = (evenement: KeyboardEvent) => surTouche(evenement, false);
    const relacher = () => {
      clavierRef.current = 0;
    };
    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    window.addEventListener("blur", relacher);
    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
      window.removeEventListener("blur", relacher);
    };
  }, [etat]);

  // En quittant la page, le cœur et le son s'arrêtent avec elle.
  useEffect(
    () => () => {
      coeurRef.current?.arreter();
      coeurRef.current = null;
      void audioRef.current?.close().catch(() => {});
    },
    [],
  );

  /**
   * Télécharge une image du serveur, en entier. Le tableau est alloué d'emblée
   * à la taille du disque et rempli au fil de l'eau : assembler des morceaux
   * à la fin doublerait, le temps d'une copie, plusieurs centaines de Mo.
   */
  async function telecharger(source: DisqueServeur): Promise<Uint8Array> {
    const reponse = await fetch(`/api/admin/ps1/disques?nom=${encodeURIComponent(source.nom)}`);
    if (!reponse.ok || !reponse.body) throw new Error(`Le serveur a répondu ${reponse.status}.`);
    const donnees = new Uint8Array(source.taille);
    const lecteur = reponse.body.getReader();
    let recu = 0;
    let affiche = -1;
    setProgression(0);
    try {
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        if (recu + value.length > donnees.length) throw new Error("Le disque reçu est plus gros qu'annoncé.");
        donnees.set(value, recu);
        recu += value.length;
        const pourcent = Math.floor((recu / donnees.length) * 100);
        if (pourcent !== affiche) {
          affiche = pourcent;
          setProgression(recu / donnees.length);
        }
      }
    } finally {
      setProgression(null);
    }
    if (recu !== donnees.length) throw new Error("Le téléchargement s'est arrêté avant la fin.");
    return donnees;
  }

  async function demarrer(source: File | DisqueServeur | null = disque) {
    if (!source) return;
    const nomSource = source instanceof File ? source.name : source.nom;
    setEtat("chargement");
    setTitre(nomSource.replace(/\.[^.]+$/, ""));
    setErreur(null);
    setJournal([]);
    setReprise(null);
    setCarte(null);
    pointRef.current = null;

    // Le son se demande pendant le clic : après une attente, le navigateur
    // ne le tient plus pour un geste de l'utilisateur.
    audioRef.current ??= new AudioContext();
    void audioRef.current.resume();

    try {
      coeurRef.current?.arreter();
      const coeur = new CoeurLibretro(URL_COEUR);
      coeur.surJournal = (texte) => setJournal((lignes) => [...lignes.slice(-13), texte]);

      // Le cœur reconnaît le format à l'extension ; le reste du nom ne compte pas.
      const extension = nomSource.includes(".") ? nomSource.slice(nomSource.lastIndexOf(".")).toLowerCase() : "";
      const donnees = source instanceof File ? new Uint8Array(await source.arrayBuffer()) : await telecharger(source);
      const image = { nom: `disque${extension}`, donnees, fichier: true };
      const systeme = bios ? [{ nom: "bios.bin", donnees: new Uint8Array(await bios.arrayBuffer()) }] : [];
      await coeur.charger([image], undefined, systeme);

      coeurRef.current = coeur;
      setEtat("en-jeu");
    } catch (cause) {
      coeurRef.current = null;
      setErreur(cause instanceof Error ? cause.message : "Le cœur n'a pas démarré.");
      setEtat("erreur");
    }
  }

  async function prendreReprise() {
    const point = coeurRef.current?.etat();
    if (!point) {
      setErreur("Le cœur n'a pas rendu de point de reprise.");
      return;
    }
    pointRef.current = point;
    // L'image est prise tout de suite : après l'attente de la compression, le
    // jeu a avancé et la vignette ne montrerait plus l'instant enregistré.
    let vignette: string | null = null;
    try {
      vignette = toile.current?.toDataURL("image/jpeg", 0.85) ?? null;
    } catch {
      // Sans vignette, le point de reprise reste utilisable.
    }
    const heure = new Date().toLocaleTimeString("fr-FR");
    const flux = new Blob([point as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
    const compresse = (await new Response(flux).arrayBuffer()).byteLength;
    setReprise({ brut: point.length, compresse, vignette, heure });
    setCarte(coeurRef.current?.lireMemoire(0)?.length ?? null);
  }

  function revenirReprise() {
    const point = pointRef.current;
    if (!point || !coeurRef.current) return;
    if (!coeurRef.current.restaurerEtat(point)) setErreur("Le cœur a refusé ce point de reprise.");
  }

  const enJeu = etat === "en-jeu";
  const marge = mesures && mesures.msParImage > 0 ? 1000 / mesures.cible / mesures.msParImage : null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">Essai PlayStation</h2>
      <p className="text-sm text-ink-400">
        Banc d&apos;essai, visible des administrateurs seulement. Rien n&apos;est envoyé au serveur, rien
        n&apos;est sauvegardé. Le but est de voir si le cœur tient la cadence sur cet appareil.
      </p>

      <div className="flex flex-col gap-3 rounded-panel border border-ink-800 p-4">
        <h3 className="text-sm font-semibold text-ink-200">Disques du serveur</h3>
        {disquesServeur.length === 0 ? (
          <p className="text-xs text-ink-400">
            Aucun pour l&apos;instant. Pose des images (<code>.chd</code> de préférence) ou des liens vers
            elles dans le dossier <code>psx</code> de la bibliothèque du serveur, puis recharge la page.
          </p>
        ) : (
          <>
            <p className="text-xs text-ink-400">
              Le disque choisi est téléchargé en entier sur cet appareil avant de démarrer.
            </p>
            <ul className="flex flex-col divide-y divide-ink-800">
              {disquesServeur.map((source) => (
                <li key={source.nom} className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-50">
                    {source.nom.replace(/\.[^.]+$/, "")}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">{enMo(source.taille)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void demarrer(source)}
                    disabled={etat === "chargement"}
                  >
                    Lancer
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-panel border border-ink-800 p-4">
        <h3 className="text-sm font-semibold text-ink-200">Disque de cet appareil</h3>
        <label className="flex flex-col gap-1 text-sm text-ink-200">
          Image du disque (CHD ou PBP de préférence ; ISO, BIN ou IMG d&apos;une seule piste)
          <input
            type="file"
            accept=".chd,.pbp,.iso,.bin,.img"
            onChange={(evenement) => setDisque(evenement.target.files?.[0] ?? null)}
            className="text-xs text-ink-400 file:mr-3 file:rounded-lg file:border file:border-ink-700 file:bg-transparent file:px-3 file:py-1.5 file:text-ink-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-200">
          BIOS (facultatif, vaut aussi pour un disque du serveur)
          <span className="text-xs text-ink-400">
            Sans lui, le cœur se sert de son BIOS de remplacement, un peu moins compatible.
          </span>
          <input
            type="file"
            accept=".bin"
            onChange={(evenement) => setBios(evenement.target.files?.[0] ?? null)}
            className="text-xs text-ink-400 file:mr-3 file:rounded-lg file:border file:border-ink-700 file:bg-transparent file:px-3 file:py-1.5 file:text-ink-200"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void demarrer()} disabled={!disque || etat === "chargement"}>
            {etat === "chargement" ? "Chargement…" : enJeu ? "Redémarrer" : "Démarrer"}
          </Button>
          {disque && <span className="text-xs text-ink-400">{enMo(disque.size)}</span>}
        </div>
      </div>

      {progression !== null && (
        <div className="flex flex-col gap-1" role="status">
          <p className="text-sm text-ink-200">
            Téléchargement de {titre} : {Math.floor(progression * 100)} %
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full bg-accent-500" style={{ width: `${progression * 100}%` }} />
          </div>
        </div>
      )}

      {erreur && <Alert>{erreur}</Alert>}

      {enJeu && titre && <p className="text-sm text-ink-200">{titre}</p>}

      <canvas
        ref={toile}
        width={320}
        height={240}
        className={`aspect-[4/3] w-full max-w-3xl rounded-panel border border-ink-800 bg-black [image-rendering:pixelated] ${
          enJeu ? "" : "hidden"
        }`}
      />

      {enJeu && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-400">Cadence</dt>
              <dd className="text-ink-50">
                {mesures ? `${mesures.ips.toFixed(1)} / ${mesures.cible.toFixed(1)} images par seconde` : "…"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Calcul d&apos;une image</dt>
              <dd className="text-ink-50">
                {mesures ? `${mesures.msParImage.toFixed(2)} ms` : "…"}
                {marge !== null && <span className="text-ink-400"> — marge ×{marge.toFixed(1)}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Image</dt>
              <dd className="text-ink-50">{mesures?.definition ?? "…"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Mémoire du cœur</dt>
              <dd className="text-ink-50">{mesures ? enMo(mesures.tas) : "…"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Point de reprise</dt>
              <dd className="text-ink-50">
                {reprise ? `${enMo(reprise.brut)}, ${enMo(reprise.compresse)} compressé` : "pas encore pris"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Carte mémoire</dt>
              <dd className="text-ink-50">{carte ? `${Math.round(carte / 1024)} Ko` : "—"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={() => void prendreReprise()}>
              Prendre un point de reprise
            </Button>
            <Button type="button" variant="ghost" onClick={revenirReprise} disabled={!reprise}>
              Y revenir
            </Button>
          </div>

          {reprise && (
            <figure className="flex items-center gap-3">
              {reprise.vignette && (
                // Une image en mémoire, de taille variable : rien à optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reprise.vignette}
                  alt="L'écran au moment du point de reprise"
                  className="aspect-[4/3] w-40 rounded-lg border border-ink-800 bg-black"
                />
              )}
              <figcaption className="text-xs text-ink-400">
                Point de reprise pris à {reprise.heure}. « Y revenir » ramène le jeu à cet instant.
              </figcaption>
            </figure>
          )}

          <p className="text-xs text-ink-400">
            Clavier : flèches, <kbd>X</kbd> croix, <kbd>C</kbd> rond, <kbd>S</kbd> carré, <kbd>D</kbd> triangle,{" "}
            <kbd>A</kbd> L1, <kbd>E</kbd> R1, <kbd>Q</kbd> L2, <kbd>R</kbd> R2, <kbd>Entrée</kbd> Start,{" "}
            <kbd>Retour arrière</kbd> Select. Une manette reconnue par le navigateur marche aussi.
          </p>
        </>
      )}

      {journal.length > 0 && (
        <pre className="max-h-48 overflow-auto rounded-panel border border-ink-800 p-3 text-xs text-ink-400">
          {journal.join("\n")}
        </pre>
      )}
    </section>
  );
}
