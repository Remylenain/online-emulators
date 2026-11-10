"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLangue, useT } from "@/components/langue";
import { ChoixVitesse, Commande, lireVolumeRetenu, retenirVolume, Volume } from "@/components/player/commandes";
import { Manette } from "@/components/player/manette";
import { Savestates, type AccesEtats } from "@/components/player/savestates";
import { useManette } from "@/components/player/use-manette";
import { DEFAULT_KEYMAP, toucheDeEvenement, type Touche } from "@/lib/consoles";
import type { Bouton } from "@/lib/emulator/adapter";
import { EmulateurMgs } from "@/lib/emulator/mgs";
import type { Dictionnaire } from "@/lib/i18n/dictionnaires";
import { REGION } from "@/lib/i18n/langues";
import type { Enregistreur, ResultatTouches } from "@/lib/keymap/actions";
import { MANETTE_PAR_DEFAUT } from "@/lib/manette";
import { Duo } from "./duo";
import { PartieActivite } from "./partie";
import { ReglagesActivite } from "./reglages";

/**
 * L'Activité Discord : un jeu du site, joué dans Discord.
 *
 * Trois temps :
 * 1. **Qui joue.** Le SDK de Discord remet un code, que le serveur échange
 *    contre l'identité de l'utilisateur et un jeton pour nos routes.
 * 2. **L'accueil.** Seul, à deux, ou régler ses touches. Un appui est de
 *    toute façon indispensable : sans geste du joueur, le navigateur ne
 *    laisse pas démarrer le son.
 * 3. **La partie.** Seul, le cœur tourne dans la page et la sauvegarde part
 *    vers le serveur chaque fois que le jeu l'écrit. À deux, c'est le câble
 *    link du site : le salon vocal devient le salon de jeu, l'émulation tourne
 *    sur le serveur (voir `./duo.tsx`).
 *
 * Touches et manette sont celles du compte, les mêmes que sur le site,
 * enregistrées par `/api/discord/touches` avec le jeton de l'Activité. En
 * solo, le joueur a aussi la vitesse, le son, et un menu de pause : cinq
 * points de reprise — posés à la main seulement, par `/api/discord/etat` —
 * et les astuces de l'administrateur qui défilent.
 */

type Session = {
  jeton: string;
  /** Jeton d'accès Discord, pour terminer la poignée de main du SDK. */
  jetonDiscord: string | null;
  pseudo: string;
  jeu: { id: string; titre: string; console: string; taille: number; empreinte: string };
  coeur: { js: string; wasm: string };
  /** La clé du salon de cette instance, pour jouer à deux ; `null` hors de Discord sans essai. */
  instance: string | null;
  /** Le mot de l'administrateur, et ses astuces dans un ordre tiré au sort pour ce lancement. */
  accueil: { mot: string; astuces: string[] };
};

type Dispositions = {
  touches: Record<Touche, string>;
  manette: Record<Touche, string>;
  manettes: Record<string, Record<Touche, string>>;
};

type Etape = "connexion" | "accueil" | "chargement" | "jeu" | "duo" | "erreur";
type EtatSauvegarde = "aucun" | "envoi" | "ok" | "echec" | "conflit";

/** Délai entre l'écriture du jeu et l'envoi : une sauvegarde s'écrit en plusieurs fois. */
const DELAI_ENVOI_MS = 1500;
/** Multiplicateur de la touche d'accélération tenue. */
const VITESSE_RAPIDE = 3;

/**
 * Téléphone couché : ce dont la manette s'écarte encore des bords, en plus des
 * marges sûres que Discord annonce.
 */
const GARDE_COUCHE = "1rem";

/**
 * Le sens dans lequel l'appareil est tenu, suivi tant que l'Activité est
 * ouverte : un téléphone se tourne en pleine partie.
 */
const ORIENTATION = "(orientation: landscape)";

function suivreOrientation(rappel: () => void): () => void {
  const requete = window.matchMedia(ORIENTATION);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

function usePaysage(): boolean {
  return useSyncExternalStore(
    suivreOrientation,
    () => window.matchMedia(ORIENTATION).matches,
    () => false,
  );
}

/** Emplacement de passage du cœur : les emplacements du joueur vivent sur le serveur. */
const PASSAGE = 1;

/** Au-delà, `fetch` refuse l'option `keepalive`, qui laisse finir un envoi page fermée. */
const TAILLE_MAX_DERNIER_ENVOI = 60_000;

function messageDe(erreur: unknown, defaut: string): string {
  return erreur instanceof Error && erreur.message ? erreur.message : defaut;
}

/**
 * Le refus de `/api/discord/session`, dans la langue du joueur. Le serveur
 * répond en français : quand le code HTTP suffit à dire pourquoi, le texte
 * vient du dictionnaire. Le 403 a trois motifs que seul leur texte distingue
 * (le verrou du serveur Discord, un compte désactivé, l'essai local fermé),
 * le 400 en a deux : là, c'est le texte du serveur qui s'affiche.
 */
function refusDeSession(textes: Dictionnaire["activite"]["erreurs"], code: number, duServeur?: string): string {
  switch (code) {
    case 401:
      return textes.nonReconnu;
    case 429:
      return textes.tropDeTentatives;
    case 503:
      return textes.jeuIntrouvable;
    default:
      return duServeur ?? textes.connexionImpossible(code);
  }
}

/**
 * Les écritures de touches et de manette, par le jeton de l'Activité.
 *
 * Un réglage que le serveur a lu puis refusé (deux boutons sur la même
 * touche…) revient avec son explication, en français et sans code : elle est
 * transmise telle quelle aux écrans de réglage.
 */
function enregistreurDiscord(jeton: string, textes: Dictionnaire["activite"]["reglages"]): Enregistreur {
  async function envoyer(corps: Record<string, unknown>): Promise<ResultatTouches> {
    try {
      const reponse = await fetch("/api/discord/touches", {
        method: "PUT",
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) return { ok: false, message: textes.refuse(reponse.status) };
      return (await reponse.json()) as ResultatTouches;
    } catch {
      return { ok: false, message: textes.sansReponse };
    }
  }
  return {
    touches: (console_, mapping) => envoyer({ action: "touches", console: console_, mapping }),
    retablirTouches: (console_) => envoyer({ action: "retablirTouches", console: console_ }),
    manette: (console_, mapping, cle) => envoyer({ action: "manette", console: console_, mapping, cle }),
    retablirManette: (console_, cle) => envoyer({ action: "retablirManette", console: console_, cle }),
  };
}

const DISPOSITIONS_PAR_DEFAUT: Dispositions = {
  touches: { ...DEFAULT_KEYMAP },
  manette: { ...MANETTE_PAR_DEFAUT },
  manettes: {},
};

export function Activite({ clientId, essaiLocal }: { clientId: string; essaiLocal: boolean }) {
  const t = useT();
  const langue = useLangue();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emulateurRef = useRef<EmulateurMgs | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const connexionLancee = useRef(false);

  const revisionRef = useRef<number | null>(null);
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aEnvoyerRef = useRef(false);
  const envoiEnCoursRef = useRef(false);

  const [etape, setEtape] = useState<Etape>("connexion");
  const [session, setSession] = useState<Session | null>(null);
  const [dispositions, setDispositions] = useState<Dispositions>(DISPOSITIONS_PAR_DEFAUT);
  const [touches, setTouches] = useState<Record<Touche, string>>(DISPOSITIONS_PAR_DEFAUT.touches);
  const [reglages, setReglages] = useState(false);
  const [erreur, setErreur] = useState("");
  const [progression, setProgression] = useState("");
  const [etatSauvegarde, setEtatSauvegarde] = useState<EtatSauvegarde>("aucun");
  const [muet, setMuet] = useState(false);
  const [volume, setVolume] = useState(100);
  const volumeRef = useRef(100);
  /** La vitesse choisie dans la liste ; la touche d'accélération passe par-dessus le temps d'un appui. */
  const [vitesse, setVitesse] = useState(1);
  const vitesseRef = useRef(1);
  const [accelere, setAccelere] = useState(false);
  /**
   * Ce qui s'affiche par-dessus le jeu, console en pause : le menu de pause,
   * ou les touches et la manette, qu'on ouvre depuis lui et qui y ramènent.
   */
  const [panneau, setPanneau] = useState<"pause" | "reglages" | null>(null);
  const [tactile, setTactile] = useState(false);
  /** Téléphone tenu à l'horizontale : l'écran au centre, la manette de part et d'autre. */
  const paysage = usePaysage();
  /** La place qu'occupent l'écran et la manette, mesurée : la manette couchée s'y taille. */
  const zoneRef = useRef<HTMLDivElement>(null);
  const [zone, setZone] = useState<{ largeur: number; hauteur: number } | null>(null);
  const [isolation, setIsolation] = useState<boolean | null>(null);

  // -------------------------------------------------------------------------
  // 1. Qui joue
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Le mode strict de React rejoue les effets en développement : un code
    // d'autorisation ne sert qu'une fois.
    if (connexionLancee.current) return;
    connexionLancee.current = true;

    const parametres = new URLSearchParams(window.location.search);

    (async () => {
      // `?muet=1` : pour essayer la page sans bruit. Discord n'ajoute jamais ce
      // paramètre ; il ne sert qu'à l'ouverture hors de Discord.
      if (parametres.has("muet")) setMuet(true);
      const volumeRetenu = lireVolumeRetenu();
      if (volumeRetenu !== null) {
        volumeRef.current = volumeRetenu;
        setVolume(volumeRetenu);
      }
      setIsolation(Boolean(window.crossOriginIsolated));
      setTactile(window.matchMedia("(pointer: coarse)").matches);

      // Discord ouvre l'iframe avec `frame_id` dans l'adresse ; le SDK refuse
      // de se construire sans lui.
      const dansDiscord = parametres.has("frame_id");
      let corps: { code: string; instance: string } | { essai: true; nom?: string; instance?: string };
      let authentifier: ((jeton: string) => Promise<unknown>) | null = null;

      if (dansDiscord && clientId) {
        const { DiscordSDK } = await import("@discord/embedded-app-sdk");
        const sdk = new DiscordSDK(clientId);
        await sdk.ready();
        const { code } = await sdk.commands.authorize({
          client_id: clientId,
          response_type: "code",
          state: "",
          prompt: "none",
          // Le strict nécessaire : savoir qui joue, pour retrouver sa partie.
          scope: ["identify"],
        });
        // Le nom de l'instance sert au verrou par serveur : c'est le serveur
        // du site qui demande à Discord où elle tourne, pas la page qui le dit.
        corps = { code, instance: sdk.instanceId };
        authentifier = (jeton) => sdk.commands.authenticate({ access_token: jeton });
      } else if (essaiLocal) {
        // `?essai=nom` : un second compte d'essai, pour ne pas partager la partie ;
        // `?instance=x` : deux onglets qui donnent le même se retrouvent dans
        // le même salon, comme deux joueurs d'un même salon vocal.
        corps = { essai: true, nom: parametres.get("essai") ?? undefined, instance: parametres.get("instance") ?? undefined };
      } else {
        throw new Error(t.activite.erreurs.horsDiscord);
      }

      const reponse = await fetch("/api/discord/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) {
        const detail = (await reponse.json().catch(() => null)) as { erreur?: string } | null;
        throw new Error(refusDeSession(t.activite.erreurs, reponse.status, detail?.erreur));
      }
      const recue = (await reponse.json()) as Session;
      if (authentifier && recue.jetonDiscord) await authentifier(recue.jetonDiscord);

      sessionRef.current = recue;
      setSession(recue);

      // Les touches et la manette du compte ; à défaut, celles par défaut.
      try {
        const reponseTouches = await fetch("/api/discord/touches", {
          headers: { Authorization: `Bearer ${recue.jeton}` },
          cache: "no-store",
        });
        if (reponseTouches.ok) {
          const lues = (await reponseTouches.json()) as Dispositions;
          setDispositions(lues);
          setTouches(lues.touches);
        }
      } catch {
        // Sans réglages, la partie se joue avec les touches par défaut.
      }
      setEtape("accueil");
    })().catch((cause: unknown) => {
      console.error("[discord]", cause);
      setErreur(messageDe(cause, t.activite.erreurs.connexion));
      setEtape("erreur");
    });
    // `t` ne change pas en cours de route, et la connexion ne se lance de toute façon qu'une fois.
  }, [clientId, essaiLocal, t]);

  // -------------------------------------------------------------------------
  // La sauvegarde
  // -------------------------------------------------------------------------
  const envoyerSauvegarde = useCallback(async (dernierEnvoi = false): Promise<void> => {
    const emulateur = emulateurRef.current;
    const courante = sessionRef.current;
    if (!emulateur || !courante) return;
    // Un envoi à la fois : celui qui arrive pendant un autre attend son tour,
    // sinon les deux partiraient avec la même révision et le second serait
    // pris pour un conflit.
    if (envoiEnCoursRef.current) {
      aEnvoyerRef.current = true;
      return;
    }
    const donnees = emulateur.lireSauvegarde();
    if (!donnees) return;

    envoiEnCoursRef.current = true;
    aEnvoyerRef.current = false;
    setEtatSauvegarde("envoi");
    try {
      const entetes: Record<string, string> = {
        Authorization: `Bearer ${courante.jeton}`,
        "Content-Type": "application/octet-stream",
      };
      if (revisionRef.current !== null) entetes["X-Revision"] = String(revisionRef.current);
      const reponse = await fetch("/api/discord/sauvegarde", {
        method: "PUT",
        headers: entetes,
        body: new Uint8Array(donnees),
        keepalive: dernierEnvoi && donnees.length <= TAILLE_MAX_DERNIER_ENVOI,
      });
      if (reponse.status === 409) {
        // Le serveur a refusé d'écraser une partie plus récente. On ne
        // réessaie pas : insister reviendrait à l'écraser.
        setEtatSauvegarde("conflit");
        return;
      }
      if (!reponse.ok) throw new Error(`Envoi refusé (${reponse.status}).`);
      const { revision } = (await reponse.json()) as { revision: number };
      revisionRef.current = revision;
      setEtatSauvegarde("ok");
    } catch (cause) {
      console.error("[discord] sauvegarde", cause);
      aEnvoyerRef.current = true;
      setEtatSauvegarde("echec");
    } finally {
      envoiEnCoursRef.current = false;
    }
  }, []);

  const planifierEnvoi = useCallback(() => {
    aEnvoyerRef.current = true;
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    minuterieRef.current = setTimeout(() => void envoyerSauvegarde(), DELAI_ENVOI_MS);
  }, [envoyerSauvegarde]);

  // Activité fermée, téléphone verrouillé, passage en incrustation : c'est le
  // dernier moment sûr pour envoyer ce qui ne l'a pas encore été.
  useEffect(() => {
    const dernierEnvoi = () => {
      if (document.visibilityState === "hidden" && aEnvoyerRef.current) void envoyerSauvegarde(true);
    };
    const fermeture = () => {
      if (aEnvoyerRef.current) void envoyerSauvegarde(true);
    };
    document.addEventListener("visibilitychange", dernierEnvoi);
    window.addEventListener("pagehide", fermeture);
    return () => {
      document.removeEventListener("visibilitychange", dernierEnvoi);
      window.removeEventListener("pagehide", fermeture);
    };
  }, [envoyerSauvegarde]);

  // -------------------------------------------------------------------------
  // 2. « Jouer »
  // -------------------------------------------------------------------------
  const jouer = useCallback(async () => {
    const courante = sessionRef.current;
    const canvas = canvasRef.current;
    if (!courante || !canvas || emulateurRef.current) return;

    const emulateur = new EmulateurMgs(courante.coeur, t.link.coeur);
    emulateurRef.current = emulateur;
    emulateur.volume(muet ? 0 : volumeRef.current);
    // Tout de suite, tant qu'on est dans l'appui : après les téléchargements,
    // le navigateur ne laisserait plus démarrer le son.
    emulateur.armerSon();
    setEtape("chargement");

    try {
      const autorisation = { Authorization: `Bearer ${courante.jeton}` };

      setProgression(t.activite.lancement.partie);
      let sauvegarde: Uint8Array | null = null;
      const reponseSauvegarde = await fetch("/api/discord/sauvegarde", {
        headers: autorisation,
        cache: "no-store",
      });
      if (reponseSauvegarde.status === 200) {
        sauvegarde = new Uint8Array(await reponseSauvegarde.arrayBuffer());
        const revision = Number(reponseSauvegarde.headers.get("X-Revision"));
        revisionRef.current = Number.isInteger(revision) ? revision : null;
      } else if (reponseSauvegarde.status !== 204) {
        // Démarrer sans la partie existante, puis l'écraser à la première
        // sauvegarde : c'est le pire qui puisse arriver ici. On s'arrête.
        throw new Error(t.activite.erreurs.partieNonRecuperee(reponseSauvegarde.status));
      }

      const mio = (courante.jeu.taille / 1048576).toLocaleString(REGION[langue], {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      setProgression(t.activite.lancement.jeu(mio));
      const reponseRom = await fetch(`/api/discord/rom?v=${courante.jeu.empreinte}`, { headers: autorisation });
      if (!reponseRom.ok) throw new Error(t.activite.erreurs.jeuIndisponible(reponseRom.status));
      const rom = new Uint8Array(await reponseRom.arrayBuffer());

      setProgression(t.activite.lancement.console);
      await emulateur.demarrer({
        canvas,
        rom: { nom: `jeu.${courante.jeu.console}`, donnees: rom },
        sauvegarde,
        surSauvegardeModifiee: planifierEnvoi,
        surPlantage: () => {
          setErreur(t.activite.erreurs.coeur);
          setEtape("erreur");
        },
      });
      setEtape("jeu");
    } catch (cause) {
      console.error("[discord]", cause);
      emulateur.arreter();
      emulateurRef.current = null;
      setErreur(messageDe(cause, t.activite.erreurs.demarrage));
      setEtape("erreur");
    }
  }, [muet, planifierEnvoi, t, langue]);

  // En quittant la page, on libère le cœur et sa sortie son.
  useEffect(
    () => () => {
      if (minuterieRef.current) clearTimeout(minuterieRef.current);
      emulateurRef.current?.arreter();
      emulateurRef.current = null;
    },
    [],
  );

  // -------------------------------------------------------------------------
  // 3. La partie : son, vitesse, clavier, manette, manette tactile
  // -------------------------------------------------------------------------
  useEffect(() => {
    emulateurRef.current?.volume(muet ? 0 : volume);
  }, [muet, volume]);

  const changerVolume = useCallback((pourcentage: number) => {
    volumeRef.current = pourcentage;
    setVolume(pourcentage);
    retenirVolume(pourcentage);
  }, []);

  const changerVitesse = useCallback((multiplicateur: number) => {
    vitesseRef.current = multiplicateur;
    setVitesse(multiplicateur);
    emulateurRef.current?.vitesse(multiplicateur);
  }, []);

  /** La touche d'accélération : ×3 tant qu'elle est tenue, puis retour à la vitesse de la liste. */
  const accelerer = useCallback((enfonce: boolean) => {
    emulateurRef.current?.vitesse(enfonce ? VITESSE_RAPIDE : vitesseRef.current);
    setAccelere(enfonce);
  }, []);

  /** Un panneau par-dessus le jeu met la console en pause ; la refermer la relance. */
  const ouvrirPanneau = useCallback((lequel: "pause" | "reglages" | null) => {
    const emulateur = emulateurRef.current;
    if (lequel) emulateur?.pause();
    else emulateur?.reprendre();
    setPanneau(lequel);
  }, []);

  // Les points de reprise, par les routes de l'Activité : le jeton en en-tête,
  // et dans l'adresse de la vignette, qu'une balise <img> charge sans en-tête.
  const accesEtats = useMemo<AccesEtats | null>(() => {
    const jeton = session?.jeton;
    if (!jeton) return null;
    return {
      liste: "/api/discord/etat",
      emplacement: (seg) => `/api/discord/etat/${seg}`,
      vignette: (seg, version) => `/api/discord/etat/${seg}?vignette=1&jeton=${encodeURIComponent(jeton)}&v=${version}`,
      vignetteEcriture: (seg) => `/api/discord/etat/${seg}?vignette=1`,
      entetes: { Authorization: `Bearer ${jeton}` },
    };
  }, [session?.jeton]);

  // Le cœur de l'Activité rend un état sans image : la vignette est l'écran
  // tel qu'il est, pris sur le canvas — en pause, c'est bien l'instant capturé.
  const capturerEcran = useCallback(
    () =>
      new Promise<Blob | null>((resoudre) => {
        const canvas = canvasRef.current;
        if (!canvas) return resoudre(null);
        canvas.toBlob((image) => resoudre(image), "image/png");
      }),
    [],
  );

  const enregistreur = useMemo(
    () => enregistreurDiscord(session?.jeton ?? "", t.activite.reglages),
    [session?.jeton, t],
  );

  // La manette du compte, en solo. À deux, c'est le client du salon qui la lit.
  const surToucheManette = useCallback(
    (touche: Touche, enfonce: boolean) => {
      const emulateur = emulateurRef.current;
      if (!emulateur) return;
      // Pendant le réglage en cours de partie, la manette est lue pour être
      // reconnue et réglée, pas pour jouer : ses appuis ne vont pas au jeu.
      // Les relâchements passent toujours, sans quoi un bouton tenu au moment
      // d'ouvrir la pause resterait enfoncé à la reprise.
      if (enfonce && panneau !== null) return;
      if (touche === "FAST") accelerer(enfonce);
      else emulateur.bouton(touche as Bouton, enfonce);
    },
    [accelerer, panneau],
  );
  const manette = useManette(
    session?.jeu.console ?? "gb",
    dispositions.manette,
    dispositions.manettes,
    surToucheManette,
    (etape === "jeu" && panneau !== "pause") || reglages,
    enregistreur,
  );

  useEffect(() => {
    if (etape !== "jeu" || reglages || panneau !== null) return;

    // Les touches du compte, les mêmes que sur le site.
    const parTouche = new Map<string, string>();
    for (const [bouton, touche] of Object.entries(touches)) if (touche) parTouche.set(touche, bouton);

    function appliquer(evenement: KeyboardEvent, enfonce: boolean) {
      const bouton = parTouche.get(toucheDeEvenement(evenement)) ?? parTouche.get(evenement.code);
      if (!bouton) return;
      // Sans cela, les flèches et la barre d'espace feraient défiler la page.
      evenement.preventDefault();
      if (evenement.repeat) return;
      const emulateur = emulateurRef.current;
      if (!emulateur) return;
      if (bouton === "FAST") accelerer(enfonce);
      else emulateur.bouton(bouton as Bouton, enfonce);
    }
    const enfoncer = (evenement: KeyboardEvent) => appliquer(evenement, true);
    const relacher = (evenement: KeyboardEvent) => appliquer(evenement, false);

    window.addEventListener("keydown", enfoncer, { passive: false });
    window.addEventListener("keyup", relacher, { passive: false });
    return () => {
      window.removeEventListener("keydown", enfoncer);
      window.removeEventListener("keyup", relacher);
    };
  }, [etape, touches, reglages, panneau, accelerer]);

  const surBouton = useCallback((bouton: Bouton, enfonce: boolean) => {
    emulateurRef.current?.bouton(bouton, enfonce);
  }, []);

  // Mesurée plutôt que déduite de la fenêtre : Discord retire ses marges sûres
  // tout autour, et la barre du bas va et vient.
  useEffect(() => {
    const element = zoneRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(([entree]) => {
      if (!entree) return;
      setZone({
        largeur: Math.round(entree.contentRect.width),
        hauteur: Math.round(entree.contentRect.height),
      });
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  /** La manette tactile est à l'écran. */
  const manetteTactile = tactile && etape === "jeu" && session !== null;
  /**
   * Téléphone couché, en partie : l'écran prend la hauteur, la croix et les
   * boutons se rangent sur les côtés, et la barre du bas s'efface — elle
   * revient avec le menu de pause. La pause et la vitesse passent sous la
   * croix.
   */
  const couche = manetteTactile && paysage;
  const debout = manetteTactile && !paysage;

  const libelleSauvegarde: Record<EtatSauvegarde, string> = {
    aucun: "",
    envoi: tactile ? t.activite.sauvegarde.court.envoi : t.activite.sauvegarde.envoi,
    ok: tactile ? t.activite.sauvegarde.court.ok : t.activite.sauvegarde.ok,
    echec: t.activite.sauvegarde.echec,
    conflit: t.activite.sauvegarde.conflit,
  };

  return (
    <main
      className="fixed inset-0 flex select-none flex-col bg-ink-950 text-ink-200"
      style={{
        // Discord donne ses propres marges sûres ; à défaut, celles du système.
        paddingTop: "var(--discord-safe-area-inset-top, env(safe-area-inset-top))",
        paddingBottom: "var(--discord-safe-area-inset-bottom, env(safe-area-inset-bottom))",
        paddingLeft: "var(--discord-safe-area-inset-left, env(safe-area-inset-left))",
        paddingRight: "var(--discord-safe-area-inset-right, env(safe-area-inset-right))",
      }}
    >
      {/*
        Une seule arborescence pour toutes les dispositions : le cœur dessine
        dans **ce** canvas, et tourner le téléphone ne doit pas en créer un
        autre. Seules les classes changent.

        - Ordinateur, et tout ce qui précède la partie : l'écran prend la place.
        - Téléphone debout : l'écran garde sa taille naturelle — toute la
          largeur — et la manette reçoit la hauteur qui reste, au lieu de la
          laisser en bandes vides autour du jeu.
        - Téléphone couché : l'écran prend la hauteur, et laisse de chaque
          côté une bande (`--cote`) où la manette se pose par-dessus.
      */}
      <div
        ref={zoneRef}
        className="relative flex min-h-0 flex-1 flex-col"
        style={
          couche
            ? ({
                "--cote": zone ? `${Math.round(zone.largeur * 0.22)}px` : "22vw",
                "--haut": zone ? `${zone.hauteur}px` : "100dvh",
                // Les marges sûres sont déjà retirées tout autour. Il reste une
                // garde : sur un téléphone Android couché, la marge que Discord
                // annonce s'est montrée plus étroite que la barre de navigation.
                "--marge-gauche": GARDE_COUCHE,
                "--marge-droite": GARDE_COUCHE,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className={`relative flex min-h-0 justify-center p-2 ${debout ? "shrink items-start" : "flex-1 items-center"}`}
          style={
            couche
              ? {
                  paddingLeft: `calc(var(--cote) + ${GARDE_COUCHE})`,
                  paddingRight: `calc(var(--cote) + ${GARDE_COUCHE})`,
                }
              : undefined
          }
        >
          {/*
            Le canvas existe dès le départ : le cœur en a besoin au démarrage,
            avant que l'écran de jeu ne soit affiché.
          */}
          <canvas
            ref={canvasRef}
            width={160}
            height={144}
            className={`w-full object-contain ${debout ? "max-h-full" : "h-full"} ${etape === "jeu" ? "" : "invisible"}`}
            style={{ imageRendering: "pixelated" }}
          />

          {etape !== "jeu" && (
            // Défilable, et centré sans rogner le haut : sur un téléphone
            // couché, l'accueil dépasse vite la hauteur de l'écran.
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center-safe gap-4 overflow-y-auto text-center ${
                etape === "duo" ? "p-0 text-left" : "p-6"
              }`}
            >
              {etape === "connexion" && <p className="text-ink-400">{t.activite.accueil.connexion}</p>}

              {etape === "accueil" && session && !reglages && (
                <>
                  <h1 className="text-2xl font-semibold text-ink-50">{session.jeu.titre}</h1>
                  {session.accueil.mot && (
                    <p className="max-w-lg whitespace-pre-line text-sm text-ink-200">{session.accueil.mot}</p>
                  )}
                  <p className="text-sm text-ink-400">{t.activite.accueil.partieGardee(session.pseudo)}</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void jouer()}
                      className="rounded-xl bg-accent-500 px-8 py-3 text-lg font-semibold text-ink-950 transition-colors hover:bg-accent-400"
                    >
                      {t.activite.accueil.jouerSeul}
                    </button>
                    {session.instance && (
                      <button
                        type="button"
                        onClick={() => setEtape("duo")}
                        className="rounded-xl border border-accent-500 px-8 py-3 text-lg font-semibold text-accent-400 transition-colors hover:bg-accent-600/20"
                      >
                        {t.activite.accueil.jouerADeux}
                      </button>
                    )}
                  </div>
                  {session.instance && (
                    <p className="max-w-md text-xs text-ink-400">{t.activite.accueil.explicationADeux}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setReglages(true)}
                    className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-ink-200"
                  >
                    {t.activite.reglages.titre}
                  </button>
                  <PartieActivite jeton={session.jeton} titre={session.jeu.titre} />
                  {session.accueil.astuces[0] !== undefined && <Astuce texte={session.accueil.astuces[0]} />}
                </>
              )}

              {etape === "accueil" && session && reglages && (
                <ReglagesActivite
                  consoleSlug={session.jeu.console}
                  tactile={tactile}
                  touches={touches}
                  surTouches={setTouches}
                  manette={manette}
                  enregistreur={enregistreur}
                  fermer={() => setReglages(false)}
                />
              )}

              {etape === "duo" && session && session.instance && (
                <div className="h-full w-full overflow-y-auto">
                  <Duo
                    jeton={session.jeton}
                    instance={session.instance}
                    jeu={{ id: session.jeu.id, console: session.jeu.console, titre: session.jeu.titre }}
                    dispositions={{ ...dispositions, touches }}
                    enregistreur={enregistreur}
                    surQuitter={() => setEtape("accueil")}
                  />
                </div>
              )}

              {etape === "chargement" && <p className="text-ink-400">{progression}</p>}

              {etape === "erreur" && (
                <>
                  <p className="max-w-md text-ink-200">{erreur}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm"
                  >
                    {t.activite.erreurs.reessayer}
                  </button>
                </>
              )}
            </div>
          )}

          {etape === "jeu" && panneau === "pause" && session && accesEtats && (
            <div className="absolute inset-0 z-10 flex flex-col gap-3 overflow-y-auto bg-ink-950/95 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink-50">{t.activite.pause.titre}</h2>
                <Commande onClick={() => ouvrirPanneau(null)}>{t.activite.pause.reprendre}</Commande>
              </div>
              {session.accueil.astuces.length > 0 && <AstucesQuiDefilent liste={session.accueil.astuces} />}
              {/* Les mêmes réglages qu'à l'accueil, sans quitter la partie. */}
              <Commande onClick={() => ouvrirPanneau("reglages")}>{t.activite.reglages.titre}</Commande>
              <p className="text-xs text-ink-400">{t.activite.pause.explication}</p>
              <Savestates
                gameId={session.jeu.id}
                acces={accesEtats}
                autos={false}
                surEcrire={() => emulateurRef.current?.ecrireEtat() ?? null}
                surLire={(donnees) => emulateurRef.current?.lireEtat(PASSAGE, donnees) ?? false}
                surVignette={capturerEcran}
              />
            </div>
          )}

          {etape === "jeu" && panneau === "reglages" && session && (
            <div className="absolute inset-0 z-10 flex justify-center overflow-y-auto bg-ink-950/95">
              <ReglagesActivite
                consoleSlug={session.jeu.console}
                tactile={tactile}
                touches={touches}
                surTouches={setTouches}
                manette={manette}
                enregistreur={enregistreur}
                // Retour au menu de pause : la console reste en pause.
                fermer={() => ouvrirPanneau("pause")}
              />
            </div>
          )}

        </div>

        {manetteTactile && session && (
          // Debout, la manette se centre dans la hauteur qui reste sous l'écran.
          // Couchée, elle se pose par-dessus toute la zone, et les menus (`z-10`)
          // passent devant elle.
          <div className={couche ? "pointer-events-none absolute inset-0" : "flex shrink-0 grow flex-col justify-center"}>
            <Manette
              gachettes={session.jeu.console === "gba"}
              surBouton={surBouton}
              paysage={couche}
              // Couché, la barre du bas est effacée : la pause et la vitesse,
              // qu'on change en pleine partie, se rangent sous la croix. Le
              // son reste dans la barre, qui revient avec le menu de pause.
              basGauche={
                <>
                  <Commande onClick={() => ouvrirPanneau("pause")}>{t.activite.pause.ouvrir}</Commande>
                  <ChoixVitesse
                    valeur={vitesse}
                    accelere={accelere}
                    surChoix={changerVitesse}
                    toucheAcceleration={null}
                    court
                  />
                </>
              }
            />
          </div>
        )}
      </div>

      {/*
        Sur téléphone, une seule ligne : chaque ligne de plus est prise à la
        manette. Les commandes ne se replient pas entre elles ; elles ne
        passent sous l'état de la sauvegarde que s'il est trop long pour tenir
        à côté — un refus, dont la phrase doit rester lisible en entier.
        Couché, la barre ne s'affiche qu'avec le menu de pause, d'où l'on
        règle la vitesse et le son.
      */}
      <footer
        className={`flex flex-wrap items-center justify-between gap-x-3 px-3 text-xs text-ink-400 ${
          tactile ? "gap-y-1 py-1.5" : "gap-y-2 py-2"
        } ${couche && panneau === null ? "hidden" : ""}`}
      >
        <span aria-live="polite">{libelleSauvegarde[etatSauvegarde]}</span>
        <span className={`flex items-center gap-2 ${tactile ? "grow justify-end" : "flex-wrap"}`}>
          {/* Constat du prototype : Discord n'isole pas ses iframes. */}
          {isolation !== null && etape !== "jeu" && (
            <span title="self.crossOriginIsolated">{t.activite.accueil.isolation(isolation)}</span>
          )}
          {etape === "jeu" && (
            <>
              <Commande onClick={() => ouvrirPanneau(panneau === null ? "pause" : null)} actif={panneau !== null}>
                {panneau === null ? t.activite.pause.ouvrir : t.activite.pause.fermer}
              </Commande>
              <ChoixVitesse
                valeur={vitesse}
                accelere={accelere}
                surChoix={changerVitesse}
                toucheAcceleration={tactile ? null : touches.FAST}
                vitesseTouche={VITESSE_RAPIDE}
                court={tactile}
              />
            </>
          )}
          <Volume
            valeur={volume}
            muet={muet}
            surChangement={changerVolume}
            surMuet={() => setMuet((valeur) => !valeur)}
            court={tactile}
          />
        </span>
      </footer>
    </main>
  );
}

/** Une astuce de l'administrateur : son texte s'affiche tel quel, seul le mot qui l'annonce est traduit. */
function Astuce({ texte }: { texte: string }) {
  const t = useT();
  return (
    <p className="max-w-lg rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-2 text-xs text-ink-300">
      <span className="font-semibold text-ink-100">{t.activite.accueil.astuce} </span>
      {texte}
    </p>
  );
}

/** Pendant la pause, les astuces défilent, une à la fois, à partir d'un point au hasard. */
const DEFILEMENT_MS = 7000;

function AstucesQuiDefilent({ liste }: { liste: string[] }) {
  const [depart] = useState(() => Math.floor(Math.random() * liste.length));
  const [pas, setPas] = useState(0);
  useEffect(() => {
    if (liste.length < 2) return;
    const minuterie = setInterval(() => setPas((p) => p + 1), DEFILEMENT_MS);
    return () => clearInterval(minuterie);
  }, [liste.length]);
  return <Astuce texte={liste[(depart + pas) % liste.length] ?? ""} />;
}
