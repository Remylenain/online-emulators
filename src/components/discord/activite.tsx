"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Manette } from "@/components/player/manette";
import { DEFAULT_KEYMAP, toucheDeEvenement } from "@/lib/consoles";
import type { Bouton } from "@/lib/emulator/adapter";
import { EmulateurMgs } from "@/lib/emulator/mgs";

/**
 * L'Activité Discord : un jeu du site, joué dans Discord.
 *
 * Trois temps :
 * 1. **Qui joue.** Le SDK de Discord remet un code, que le serveur échange
 *    contre l'identité de l'utilisateur et un jeton pour nos routes.
 * 2. **« Jouer ».** Un appui est indispensable : sans geste du joueur, le
 *    navigateur ne laisse pas démarrer le son.
 * 3. **La partie.** Le cœur tourne dans la page ; la sauvegarde part vers le
 *    serveur chaque fois que le jeu l'écrit.
 *
 * Ce composant ne dépend du reste du site que par trois adresses —
 * `/api/discord/session`, `/rom` et `/sauvegarde` — et par la manette tactile.
 * C'est voulu : il doit pouvoir vivre ailleurs que dans ce site.
 */

type Session = {
  jeton: string;
  /** Jeton d'accès Discord, pour terminer la poignée de main du SDK. */
  jetonDiscord: string | null;
  pseudo: string;
  jeu: { titre: string; console: string; taille: number; empreinte: string };
  coeur: { js: string; wasm: string };
};

type Etape = "connexion" | "pret" | "chargement" | "jeu" | "erreur";
type EtatSauvegarde = "aucun" | "envoi" | "ok" | "echec" | "conflit";

/** Délai entre l'écriture du jeu et l'envoi : une sauvegarde s'écrit en plusieurs fois. */
const DELAI_ENVOI_MS = 1500;
/** Multiplicateur de la touche d'accélération. */
const VITESSE_RAPIDE = 3;

/** Au-delà, `fetch` refuse l'option `keepalive`, qui laisse finir un envoi page fermée. */
const TAILLE_MAX_DERNIER_ENVOI = 60_000;

function messageDe(erreur: unknown, defaut: string): string {
  return erreur instanceof Error && erreur.message ? erreur.message : defaut;
}

export function Activite({ clientId, essaiLocal }: { clientId: string; essaiLocal: boolean }) {
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
  const [erreur, setErreur] = useState("");
  const [progression, setProgression] = useState("");
  const [etatSauvegarde, setEtatSauvegarde] = useState<EtatSauvegarde>("aucun");
  const [muet, setMuet] = useState(false);
  const [tactile, setTactile] = useState(false);
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
      setIsolation(Boolean(window.crossOriginIsolated));
      setTactile(window.matchMedia("(pointer: coarse)").matches);

      // Discord ouvre l'iframe avec `frame_id` dans l'adresse ; le SDK refuse
      // de se construire sans lui.
      const dansDiscord = parametres.has("frame_id");
      let corps: { code: string } | { essai: true; nom?: string };
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
        corps = { code };
        authentifier = (jeton) => sdk.commands.authenticate({ access_token: jeton });
      } else if (essaiLocal) {
        // `?essai=nom` : un second compte d'essai, pour ne pas partager la partie.
        corps = { essai: true, nom: parametres.get("essai") ?? undefined };
      } else {
        throw new Error("Cette page s'ouvre depuis Discord, en lançant l'Activité.");
      }

      const reponse = await fetch("/api/discord/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) {
        const detail = (await reponse.json().catch(() => null)) as { erreur?: string } | null;
        throw new Error(detail?.erreur ?? `Connexion impossible (${reponse.status}).`);
      }
      const recue = (await reponse.json()) as Session;
      if (authentifier && recue.jetonDiscord) await authentifier(recue.jetonDiscord);

      sessionRef.current = recue;
      setSession(recue);
      setEtape("pret");
    })().catch((cause: unknown) => {
      console.error("[discord]", cause);
      setErreur(messageDe(cause, "La connexion à Discord a échoué."));
      setEtape("erreur");
    });
  }, [clientId, essaiLocal]);

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

    const emulateur = new EmulateurMgs(courante.coeur);
    emulateurRef.current = emulateur;
    emulateur.volume(muet ? 0 : 100);
    // Tout de suite, tant qu'on est dans l'appui : après les téléchargements,
    // le navigateur ne laisserait plus démarrer le son.
    emulateur.armerSon();
    setEtape("chargement");

    try {
      const autorisation = { Authorization: `Bearer ${courante.jeton}` };

      setProgression("Récupération de ta partie…");
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
        throw new Error(`Ta partie n'a pas pu être récupérée (${reponseSauvegarde.status}).`);
      }

      setProgression(`Téléchargement du jeu (${(courante.jeu.taille / 1048576).toFixed(1)} Mio)…`);
      const reponseRom = await fetch(`/api/discord/rom?v=${courante.jeu.empreinte}`, { headers: autorisation });
      if (!reponseRom.ok) throw new Error(`Jeu indisponible (${reponseRom.status}).`);
      const rom = new Uint8Array(await reponseRom.arrayBuffer());

      setProgression("Démarrage de la console…");
      await emulateur.demarrer({
        canvas,
        rom: { nom: `jeu.${courante.jeu.console}`, donnees: rom },
        sauvegarde,
        surSauvegardeModifiee: planifierEnvoi,
        surPlantage: () => {
          setErreur("Le cœur d'émulation n'a pas pu démarrer.");
          setEtape("erreur");
        },
      });
      setEtape("jeu");
    } catch (cause) {
      console.error("[discord]", cause);
      emulateur.arreter();
      emulateurRef.current = null;
      setErreur(messageDe(cause, "Le jeu n'a pas pu démarrer."));
      setEtape("erreur");
    }
  }, [muet, planifierEnvoi]);

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
  // 3. La partie : son, clavier, manette tactile
  // -------------------------------------------------------------------------
  useEffect(() => {
    emulateurRef.current?.volume(muet ? 0 : 100);
  }, [muet]);

  useEffect(() => {
    if (etape !== "jeu") return;

    // Les mêmes touches par défaut que le lecteur du site.
    const parTouche = new Map<string, string>();
    for (const [bouton, touche] of Object.entries(DEFAULT_KEYMAP)) parTouche.set(touche, bouton);

    function appliquer(evenement: KeyboardEvent, enfonce: boolean) {
      const bouton = parTouche.get(toucheDeEvenement(evenement));
      if (!bouton) return;
      // Sans cela, les flèches et la barre d'espace feraient défiler la page.
      evenement.preventDefault();
      if (evenement.repeat) return;
      const emulateur = emulateurRef.current;
      if (!emulateur) return;
      if (bouton === "FAST") emulateur.vitesse(enfonce ? VITESSE_RAPIDE : 1);
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
  }, [etape]);

  const surBouton = useCallback((bouton: Bouton, enfonce: boolean) => {
    emulateurRef.current?.bouton(bouton, enfonce);
  }, []);

  const libelleSauvegarde: Record<EtatSauvegarde, string> = {
    aucun: "",
    envoi: "Sauvegarde en cours…",
    ok: "Partie sauvegardée",
    echec: "Sauvegarde non envoyée, nouvel essai à la prochaine",
    conflit: "Partie plus récente sur le serveur : celle-ci n'est pas envoyée",
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
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        {/*
          Le canvas existe dès le départ : le cœur en a besoin au démarrage,
          avant que l'écran de jeu ne soit affiché.
        */}
        <canvas
          ref={canvasRef}
          width={160}
          height={144}
          className={`h-full w-full object-contain ${etape === "jeu" ? "" : "invisible"}`}
          style={{ imageRendering: "pixelated" }}
        />

        {etape !== "jeu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {etape === "connexion" && <p className="text-ink-400">Connexion à Discord…</p>}

            {etape === "pret" && session && (
              <>
                <h1 className="text-2xl font-semibold text-ink-50">{session.jeu.titre}</h1>
                <p className="text-sm text-ink-400">Ta partie est gardée pour {session.pseudo}.</p>
                <button
                  type="button"
                  onClick={() => void jouer()}
                  className="rounded-xl bg-accent-500 px-10 py-3 text-lg font-semibold text-ink-950 transition-colors hover:bg-accent-400"
                >
                  Jouer
                </button>
                {!tactile && (
                  <p className="text-xs text-ink-400">
                    Flèches pour se déplacer, A et Z pour les boutons A et B, Entrée pour Start, Espace pour
                    Select.
                  </p>
                )}
              </>
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
                  Réessayer
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {tactile && etape === "jeu" && session && (
        <Manette gachettes={session.jeu.console === "gba"} surBouton={surBouton} />
      )}

      <footer className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-ink-400">
        <span aria-live="polite">{libelleSauvegarde[etatSauvegarde]}</span>
        <span className="flex items-center gap-3">
          {/* Constat du prototype : Discord n'isole pas ses iframes. */}
          {isolation !== null && etape !== "jeu" && (
            <span title="self.crossOriginIsolated">Isolation cross-origin : {isolation ? "oui" : "non"}</span>
          )}
          <button
            type="button"
            onClick={() => setMuet((valeur) => !valeur)}
            aria-pressed={muet}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-ink-200"
          >
            {muet ? "Son coupé" : "Son actif"}
          </button>
        </span>
      </footer>
    </main>
  );
}
