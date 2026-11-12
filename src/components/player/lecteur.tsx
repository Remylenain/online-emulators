"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FichierSauvegarde, telechargerSauvegarde } from "./fichier-sauvegarde";
import { ChoixHabillage, type Habillage } from "./habillage";
import { Manette } from "./manette";
import { usePleinEcranAuto } from "./plein-ecran";
import { ManetteConfig } from "./manette-config";
import { Touches } from "./touches";
import { useManette } from "./use-manette";
import { INTERVALLE_AUTO, Savestates, type AccesEtats } from "./savestates";
import { ChoixVitesse, Commande, lireVolumeRetenu, retenirVolume, Volume } from "./commandes";
import { Accentue, useLangue, useT } from "@/components/langue";
import { deballerEtat, emballerEtat, estPng } from "@/lib/emulator/etat-png";
import { EmulateurMgba } from "@/lib/emulator/mgba";
import { EmulateurMgs } from "@/lib/emulator/mgs";
import {
  appareilVibrant,
  cartoucheAMoteur,
  lireVibrationRetenue,
  retenirVibration,
  Vibreur,
} from "@/lib/emulator/vibration";
import { choisirHabillage } from "@/lib/bezel/actions";
import {
  choisirHabillageInvite,
  demanderPersistance,
  enregistreurInvite,
  requeteInvite,
  vignetteInvite,
} from "@/lib/invite/stockage";
import type { Bouton, Emulateur } from "@/lib/emulator/adapter";
import { BUTTONS, toucheDeEvenement, type ButtonName, type Touche } from "@/lib/consoles";
import { REGION } from "@/lib/i18n/langues";

const BOUTONS_SIMPLES = [...BUTTONS.common] as ButtonName[];
const BOUTONS_AVEC_GACHETTES = [...BUTTONS.common, ...BUTTONS.shoulder] as ButtonName[];

export type JeuLecteur = {
  id: string;
  titre: string;
  slug: string;
  consoleSlug: string;
  fichier: string;
  taille: number;
  /** Empreinte de la ROM, qui sert de numéro de version dans son adresse. */
  empreinte: string;
  /** Où mène « Quitter ». */
  retour: string;
};

export type ConsoleLecteur = {
  nom: string;
  largeur: number;
  hauteur: number;
  gachettes: boolean;
};

type Etat = "chargement" | "en-jeu" | "en-pause" | "erreur";

type EtatSauvegarde =
  | { etat: "inconnu" }
  | { etat: "envoi" }
  | { etat: "enregistree"; quand: Date }
  | { etat: "conflit"; message: string }
  | { etat: "echec"; message: string };

/**
 * Délai avant d'envoyer une sauvegarde au serveur.
 *
 * Le cœur signale chaque écriture du jeu dans sa SRAM, ce qui arrive plusieurs
 * fois d'affilée — à chaque pas dans l'herbe, par exemple. Attendre un moment
 * de calme évite d'envoyer dix fois le même fichier.
 */
const DELAI_SAUVEGARDE = 2500;

/**
 * Emplacement du cœur utilisé comme simple passage pour les savestates.
 * Les cinq emplacements du joueur sont tenus par le serveur.
 */
const PASSAGE = 1;

/**
 * Taille maximale d'un envoi `keepalive`. La limite de 64 Ko vaut pour tous
 * les envois de ce type en cours ; on garde une marge pour les en-têtes.
 */
const LIMITE_KEEPALIVE = 60 * 1024;

/** Vrai si les deux sauvegardes ont exactement le même contenu. */
function memeContenu(a: Uint8Array, b: Uint8Array | null): boolean {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Le lecteur.
 *
 * Le cœur s'initialise une seule fois, dans une ref : un rendu React ne doit
 * jamais le relancer. En développement, le mode strict monte chaque composant
 * deux fois, ce qui démarrerait deux émulateurs sur le même canvas — d'où le
 * verrou `demarrage`.
 */
export function Lecteur({
  jeu,
  console: consoleInfo,
  touches: touchesInitiales,
  manette: manetteInitiale,
  manettes: manettesInitiales,
  habillages,
  habillageInitial,
  coeurVibrant,
  invite = false,
}: {
  jeu: JeuLecteur;
  console: ConsoleLecteur;
  touches: Record<Touche, string>;
  /** Disposition de la manette (API Gamepad), même principe que les touches. */
  manette: Record<Touche, string>;
  /** Celles des manettes que le navigateur ne reconnaît pas, par « appareil|nom ». */
  manettes: Record<string, Record<Touche, string>>;
  /** Les habillages de cette console, dans l'ordre du scan. */
  habillages: Habillage[];
  /** Celui du compte, ou `null` pour aucun. */
  habillageInitial: string | null;
  /**
   * Où charger le cœur « une console », celui de l'Activité Discord. Le
   * lecteur le prend à la place du cœur ordinaire pour un jeu dont la
   * cartouche vibre : lui seul rapporte le moteur. Sans ces adresses, tous les
   * jeux gardent le cœur ordinaire.
   */
  coeurVibrant?: { js: string; wasm: string };
  /**
   * Un invité de la vitrine, sans compte : sauvegarde, points de reprise et
   * réglages restent dans son navigateur (`src/lib/invite/stockage.ts`), et
   * le lecteur le lui rappelle au moment de partir.
   */
  invite?: boolean;
}) {
  /**
   * Par où passent les enregistrements : le réseau, ou pour un invité un
   * `fetch` qui répond comme les routes du site depuis le navigateur. Tout
   * le reste du lecteur ignore la différence.
   */
  const requete: typeof fetch = invite ? requeteInvite : fetch;
  const t = useT();
  const langue = useLangue();
  /**
   * La disposition vit dans l'état du composant : une touche réattribuée doit
   * agir immédiatement, sans recharger la page ni redemander au serveur.
   */
  const [touches, setTouches] = useState(touchesInitiales);
  const [habillageId, setHabillageId] = useState(habillageInitial);
  const habillage = habillages.find((h) => h.id === habillageId) ?? null;
  const changerHabillage = useCallback(
    (id: string | null) => {
      setHabillageId(id);
      // Le choix s'applique tout de suite ; l'enregistrement suit sans bloquer.
      // S'il échoue, seule la prochaine partie l'ignore : rien à signaler.
      if (invite) choisirHabillageInvite(jeu.consoleSlug, id);
      else void choisirHabillage(jeu.consoleSlug, id);
    },
    [jeu.consoleSlug, invite],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emulateurRef = useRef<Emulateur | null>(null);
  /**
   * Le cœur « une console », quand c'est lui qui tourne (jeu dont la cartouche
   * vibre) ; `null` avec le cœur ordinaire. Ses états sont bruts, et son son
   * attend un geste du joueur : le lecteur fait la différence par cette ref.
   */
  const mgsRef = useRef<EmulateurMgs | null>(null);
  const vibreurRef = useRef<Vibreur | null>(null);
  /** Le réglage de l'appareil, comme le volume ; `moteur` : ce jeu-ci vibre. */
  const [vibration, setVibration] = useState(true);
  const [moteur, setMoteur] = useState(false);
  const demarrage = useRef(false);

  const [etat, setEtat] = useState<Etat>("chargement");
  const [progression, setProgression] = useState(t.commun.preparation);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vitesse, setVitesse] = useState(1);
  const vitesseRef = useRef(1);
  /** La touche d'accélération est tenue. */
  const [accelere, setAccelere] = useState(false);
  const [muet, setMuet] = useState(false);
  const muetRef = useRef(false);
  /**
   * Le volume, de 0 à 100, retenu dans le navigateur : on ne le règle pas à
   * chaque partie. Lu après le montage pour que le rendu serveur et le
   * premier rendu client restent identiques.
   */
  const [volume, setVolume] = useState(100);
  const volumeRef = useRef(100);
  useEffect(() => {
    setVibration(lireVibrationRetenue());
    // Rien d'enregistré, ou stockage indisponible : 100 % fera l'affaire.
    const retenu = lireVolumeRetenu();
    if (retenu === null) return;
    volumeRef.current = retenu;
    setVolume(retenu);
    emulateurRef.current?.volume(muetRef.current ? 0 : retenu);
  }, []);
  const [sauvegarde, setSauvegarde] = useState<EtatSauvegarde>({ etat: "inconnu" });
  /**
   * La disposition a-t-elle été arrêtée ? Le démarrage du cœur l'attend.
   *
   * Déclaré ici, avec les autres états, parce que l'effet de démarrage en
   * dépend — et qu'un effet ne peut pas lire une variable déclarée plus bas.
   */
  const [layoutPret, setLayoutPret] = useState(false);

  /**
   * Dimensions réellement produites par le cœur.
   *
   * La fiche de la console donne une taille attendue, mais c'est le cœur qui
   * dimensionne son rendu une fois le jeu chargé. On relit donc le canvas
   * après le démarrage : si les deux divergent, c'est le cœur qui a raison, et
   * l'écran garde ses proportions au lieu d'être étiré ou comprimé.
   */
  const [dimensions, setDimensions] = useState({
    largeur: consoleInfo.largeur,
    hauteur: consoleInfo.hauteur,
  });

  /** Révision sur laquelle cette partie est bâtie, pour détecter un conflit. */
  const revisionRef = useRef<number | null>(null);
  /** Attente en cours avant l'envoi, pour grouper les écritures rapprochées. */
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Copie du dernier contenu envoyé, pour ne pas renvoyer l'identique. */
  const dernierEnvoiRef = useRef<Uint8Array | null>(null);

  /**
   * Envoie la sauvegarde au serveur.
   *
   * `garder` demande un envoi qui survit à la fermeture de l'onglet : le
   * navigateur annule les requêtes en cours quand la page disparaît, et une
   * partie se perdrait sur une simple fermeture d'onglet.
   */
  const urlSauvegarde = `/api/save/${jeu.id}`;

  const envoyerSauvegarde = useCallback(
    async (garder = false, forcer = false) => {
      const emulateur = emulateurRef.current;
      if (!emulateur) return;

      const donnees = emulateur.lireSauvegarde();
      if (!donnees || donnees.length === 0) return;

      /*
       * On compare le contenu entier, et non une empreinte sommaire.
       *
       * L'ancienne empreinte — la taille et trois octets : premier, milieu,
       * dernier — laissait passer de vraies sauvegardes. Vérifié sur Pokémon
       * Prism : une sauvegarde en jeu change une cinquantaine d'octets, aucun
       * de ces trois, et la taille ne bouge jamais. Elle était tenue pour
       * identique et restait dans le navigateur. Comparer quelques dizaines de
       * Ko à chaque écriture ne coûte rien.
       */
      if (!garder && memeContenu(donnees, dernierEnvoiRef.current)) return;
      // Copie : le cœur peut réutiliser le tampon qu'il nous a rendu.
      const envoi = new Uint8Array(donnees);

      const entetes: Record<string, string> = { "Content-Type": "application/octet-stream" };
      // Sans `X-Revision`, le serveur écrit sans vérifier : c'est ce que
      // demande un joueur qui tranche un conflit en connaissance de cause. La
      // version écrasée part quand même en sauvegarde de secours.
      if (!forcer && revisionRef.current !== null) {
        entetes["X-Revision"] = String(revisionRef.current);
      }

      setSauvegarde({ etat: "envoi" });
      try {
        const reponse = await requete(urlSauvegarde, {
          method: "PUT",
          headers: entetes,
          body: envoi,
          // Le navigateur refuse d'emblée un envoi `keepalive` de plus de
          // 64 Ko, sans même l'essayer. Les sauvegardes Game Boy Advance font
          // souvent 128 Ko : avec `keepalive`, elles n'arrivaient jamais, pas
          // même par le bouton « Envoyer au serveur ». Au-delà, on envoie
          // normalement, quitte à ce que la fermeture de l'onglet l'interrompe.
          keepalive: garder && envoi.length <= LIMITE_KEEPALIVE,
        });

        if (reponse.status === 409) {
          // Le texte du conflit vient du dictionnaire et non de la réponse :
          // celle du serveur est en français, quelle que soit la langue.
          setSauvegarde({
            etat: "conflit",
            message: invite ? t.lecteur.sauvegarde.conflitLocal : t.lecteur.sauvegarde.conflit,
          });
          return;
        }
        if (!reponse.ok) {
          setSauvegarde({
            etat: "echec",
            message: invite
              ? t.lecteur.sauvegarde.refuseeLocale
              : t.lecteur.sauvegarde.refusee(reponse.status),
          });
          return;
        }

        const corps = await reponse.json();
        revisionRef.current = corps.revision;
        dernierEnvoiRef.current = envoi;
        setSauvegarde({ etat: "enregistree", quand: new Date() });
      } catch {
        setSauvegarde({
          etat: "echec",
          message: t.lecteur.sauvegarde.sansReponse,
        });
      }
    },
    [urlSauvegarde, requete, invite, t],
  );

  /**
   * Invité : lui reste-t-il une partie à emporter ?
   *
   * Sa sauvegarde ne vit que dans ce navigateur. Dès que le jeu écrit dans sa
   * mémoire de sauvegarde — une vraie sauvegarde faite *dans* le jeu —, on le
   * note, dans le navigateur aussi pour que la question survive à un
   * rechargement ; télécharger ou importer un fichier l'efface. Tant que la
   * note est là, le lecteur prévient le joueur avant de le laisser partir.
   *
   * On ne compare pas les révisions : la sauvegarde d'un jeu à horloge change
   * à chaque enregistrement, l'heure en fait partie, et un simple changement
   * d'onglet aurait fait croire à une partie plus récente que le fichier
   * tout juste téléchargé.
   */
  const cleAEmporter = `oe_invite_a_emporter:${jeu.id}`;
  const aEmporterRef = useRef(false);
  /** Un départ que le joueur a confirmé, ou un rechargement après import : plus d'alerte. */
  const departAssumeRef = useRef(false);
  useEffect(() => {
    if (!invite) return;
    try {
      aEmporterRef.current = localStorage.getItem(cleAEmporter) === "1";
    } catch {
      // Stockage illisible : la prochaine sauvegarde en jeu reposera la note.
    }
  }, [invite, cleAEmporter]);

  const noterAEmporter = useCallback(
    (reste: boolean) => {
      // Le cœur signale chaque écriture du jeu, souvent en rafale : inutile
      // de reposer une note déjà là. L'effacement, lui, se fait toujours.
      if (reste && aEmporterRef.current) return;
      aEmporterRef.current = reste;
      try {
        if (reste) localStorage.setItem(cleAEmporter, "1");
        else localStorage.removeItem(cleAEmporter);
      } catch {
        // Sans stockage, la note vaut pour cette visite seulement.
      }
    },
    [cleAEmporter],
  );

  const resteAEmporter = useCallback(
    () => invite && !departAssumeRef.current && aEmporterRef.current,
    [invite],
  );

  /**
   * Télécharge la sauvegarde de l'invité et la tient pour emportée.
   *
   * La partie est d'abord enregistrée : le fichier vient de la mémoire du
   * cœur, qui peut avoir un temps d'avance sur le dernier enregistrement, et
   * le navigateur doit garder la même chose que le fichier emporté.
   */
  const emporter = useCallback(async (): Promise<boolean> => {
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    await envoyerSauvegarde();
    const donnees = emulateurRef.current?.lireSauvegarde() ?? null;
    if (telechargerSauvegarde(jeu.titre, donnees) === null) return false;
    noterAEmporter(false);
    return true;
  }, [envoyerSauvegarde, jeu.titre, noterAEmporter]);

  /**
   * Fermer l'onglet ou recharger la page avec une partie pas encore emportée :
   * le navigateur demande confirmation. Le texte est le sien, on ne peut pas
   * le choisir, et les navigateurs de téléphone l'ignorent souvent — le vrai
   * rappel est celui du bouton « Quitter », plus bas.
   */
  useEffect(() => {
    if (!invite) return;
    const avertir = (evenement: BeforeUnloadEvent) => {
      if (!resteAEmporter()) return;
      evenement.preventDefault();
      // Les anciens navigateurs attendent cette affectation plutôt que l'appel.
      evenement.returnValue = "";
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [invite, resteAEmporter]);

  /** Le rappel affiché quand un invité clique « Quitter » sans avoir emporté sa partie. */
  const [depart, setDepart] = useState<"non" | "demande" | "emportee">("non");
  const surQuitter = useCallback(
    (evenement: React.MouseEvent) => {
      if (!resteAEmporter()) return;
      evenement.preventDefault();
      setDepart("demande");
    },
    [resteAEmporter],
  );
  const partir = useCallback(() => {
    departAssumeRef.current = true;
    // Vraie navigation, comme le lien : voir « Quitter » plus bas.
    window.location.href = jeu.retour;
  }, [jeu.retour]);

  const accesEtats = useMemo<AccesEtats | undefined>(
    () =>
      invite
        ? {
            liste: `/api/state/${jeu.id}`,
            emplacement: (segment) => `/api/state/${jeu.id}/${segment}`,
            vignette: (segment) => vignetteInvite(jeu.id, segment),
            requete: requeteInvite,
          }
        : undefined,
    [invite, jeu.id],
  );

  /**
   * Le démarrage attend que la disposition soit arrêtée.
   *
   * Le lecteur a deux dispositions — ordinateur et tactile — et le premier
   * rendu ne sait pas encore laquelle s'applique : la détection ne peut avoir
   * lieu que dans le navigateur. Si le cœur démarrait tout de suite, il
   * s'accrocherait au canvas de la première disposition ; la bascule vers
   * l'autre en créerait un nouveau, et le cœur continuerait de dessiner dans
   * un canvas détaché de la page. Écran noir, sans la moindre erreur.
   */
  useEffect(() => {
    if (!layoutPret) return;
    if (demarrage.current) return;
    demarrage.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;

    (async () => {
      try {
        /**
         * L'isolation cross-origin est une propriété du **document**, fixée à
         * son chargement. Arriver ici par une navigation côté client — un
         * `<Link>` oublié, un retour arrière — donne la bonne URL mais le
         * document précédent, servi sans les en-têtes : le cœur refuserait de
         * démarrer alors que la configuration est bonne.
         *
         * Plutôt que d'accuser le navigateur, on recharge une fois. Le drapeau
         * dans l'URL empêche une boucle si l'isolation manque vraiment.
         */
        if (!self.crossOriginIsolated) {
          const url = new URL(window.location.href);
          if (!url.searchParams.has("recharge")) {
            url.searchParams.set("recharge", "1");
            window.location.replace(url.toString());
            return;
          }
          throw new Error(t.lecteur.erreurs.isolation);
        }

        setProgression(t.lecteur.chargement.partie);
        // La sauvegarde d'abord : elle doit être en place avant le chargement
        // du jeu, le cœur la lisant à l'ouverture.
        let ancienne: Uint8Array | null = null;
        const reponseSauvegarde = await requete(urlSauvegarde, { cache: "no-store" });
        if (reponseSauvegarde.status === 200) {
          ancienne = new Uint8Array(await reponseSauvegarde.arrayBuffer());
          const entete = reponseSauvegarde.headers.get("X-Revision");
          revisionRef.current = entete ? Number(entete) : null;
        }
        if (invite) demanderPersistance();

        setProgression(t.lecteur.chargement.jeu((jeu.taille / 1048576).toFixed(0)));
        /**
         * L'empreinte fait partie de l'adresse, et c'est ce qui rend la mise
         * en cache sûre : une ROM corrigée change d'empreinte, donc d'adresse,
         * et le navigateur la retélécharge. Sans cela, il resservirait
         * l'ancienne version pendant des jours — l'adresse, elle, ne bouge pas.
         */
        const reponse = await fetch(`/api/rom/${jeu.id}?v=${jeu.empreinte}`);
        if (!reponse.ok) throw new Error(t.lecteur.erreurs.jeuIndisponible(reponse.status));
        const rom = new Uint8Array(await reponse.arrayBuffer());

        setProgression(t.lecteur.chargement.console);
        /**
         * Deux cœurs. L'ordinaire, pour presque tout. Et pour une cartouche
         * Game Boy à moteur — son en-tête l'annonce — celui de l'Activité
         * Discord, le seul qui rapporte la vibration. Le choix tient au jeu,
         * jamais à l'appareil : les points de reprise d'un jeu passent ainsi
         * toujours par le même cœur, sur le téléphone comme sur l'ordinateur.
         */
        let emulateur: Emulateur;
        if (coeurVibrant && jeu.consoleSlug !== "gba" && cartoucheAMoteur(rom)) {
          const vibreur = new Vibreur();
          vibreur.activer(lireVibrationRetenue());
          vibreurRef.current = vibreur;
          const mgs = new EmulateurMgs(coeurVibrant, t.link.coeur);
          mgsRef.current = mgs;
          emulateur = mgs;
          setMoteur(true);
        } else {
          emulateur = new EmulateurMgba(t.link.coeur);
        }
        await emulateur.demarrer({
          canvas,
          rom: { nom: jeu.fichier, donnees: rom },
          sauvegarde: ancienne,
          surVibration: (intensite) => vibreurRef.current?.regler(intensite),
          surSauvegardeModifiee: () => {
            if (invite) noterAEmporter(true);
            if (minuterieRef.current) clearTimeout(minuterieRef.current);
            minuterieRef.current = setTimeout(() => {
              void envoyerSauvegarde();
            }, DELAI_SAUVEGARDE);
          },
          surPlantage: () => {
            setErreur(t.lecteur.erreurs.coeurArrete);
            setEtat("erreur");
          },
        });

        emulateurRef.current = emulateur;
        emulateur.volume(muetRef.current ? 0 : volumeRef.current);

        // Le cœur a pu redimensionner son canvas en chargeant le jeu.
        if (canvas.width > 0 && canvas.height > 0) {
          setDimensions({ largeur: canvas.width, hauteur: canvas.height });
        }

        setEtat("en-jeu");
      } catch (e) {
        setErreur(e instanceof Error ? e.message : t.lecteur.erreurs.demarrage);
        setEtat("erreur");
      }
    })();

    return () => {
      if (minuterieRef.current) clearTimeout(minuterieRef.current);
      emulateurRef.current?.arreter();
      emulateurRef.current = null;
      mgsRef.current = null;
    };
    // Le lecteur ne redémarre pas sur changement de props : changer de jeu
    // passe par une navigation, donc un nouveau montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutPret]);

  /**
   * Dernier envoi au moment où la page disparaît.
   *
   * `pagehide` et non `beforeunload` : c'est le seul événement que les
   * navigateurs mobiles déclenchent de façon fiable quand on bascule
   * d'application ou qu'on ferme un onglet. `visibilitychange` complète pour
   * le cas où l'onglet passe simplement en arrière-plan sans être fermé.
   */
  useEffect(() => {
    function enregistrerMaintenant() {
      if (minuterieRef.current) clearTimeout(minuterieRef.current);
      void envoyerSauvegarde(true);
    }

    function surVisibilite() {
      if (document.visibilityState === "hidden") enregistrerMaintenant();
    }

    window.addEventListener("pagehide", enregistrerMaintenant);
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      window.removeEventListener("pagehide", enregistrerMaintenant);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [envoyerSauvegarde]);

  /**
   * Accéléré passager : le jeu passe à `cible` (×4 pour la touche tenue, ×3
   * pour le bouton tactile), sans toucher à la vitesse de la liste, à
   * laquelle il revient dès qu'on arrête.
   */
  const accelerer = useCallback((actif: boolean, cible: number) => {
    const emulateur = emulateurRef.current;
    if (!emulateur) return;
    emulateur.vitesse(actif ? cible : vitesseRef.current);
    setAccelere(actif);
  }, []);

  /**
   * La manette, traduite comme le clavier : l'accéléré à tenir, le reste
   * va au cœur.
   */
  const surToucheManette = useCallback(
    (touche: Touche, enfonce: boolean) => {
      if (touche === "FAST") accelerer(enfonce, VITESSE_TOUCHE);
      else emulateurRef.current?.bouton(touche, enfonce);
    },
    [accelerer],
  );
  const manettePhysique = useManette(
    jeu.consoleSlug,
    manetteInitiale,
    manettesInitiales,
    surToucheManette,
    true,
    invite ? enregistreurInvite : undefined,
  );
  const manetteBranchee = manettePhysique.branchee;

  /**
   * Le clavier, traduit en boutons de console.
   *
   * Deux raisons de le faire ici plutôt que de laisser le cœur écouter :
   *
   * 1. Les touches de jeu ne doivent pas agir sur la page. Les flèches la font
   *    défiler et l'espace la fait sauter d'un écran — en pleine partie,
   *    l'image bougerait sous les doigts. On intercepte donc les codes
   *    associés à un bouton, et eux seuls : le reste du clavier garde son
   *    comportement, raccourcis du navigateur compris.
   * 2. On décide nous-mêmes comment identifier une touche : par la lettre
   *    qu'elle produit, et non par sa position physique. Voir
   *    `toucheDeEvenement` — c'est ce qui fait que le A du Game Boy tombe sur
   *    le A du clavier, AZERTY ou QWERTY.
   *
   * `event.repeat` est écarté : maintenir une direction envoie une rafale de
   * `keydown`, dont le cœur n'a que faire — le bouton est déjà enfoncé.
   */
  useEffect(() => {
    const parTouche = new Map<string, Touche>();
    for (const [bouton, touche] of Object.entries(touches)) {
      parTouche.set(touche, bouton as Touche);
    }

    function dansUnChamp(cible: EventTarget | null): boolean {
      const element = cible as HTMLElement | null;
      return Boolean(element && /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
    }

    function enfoncer(evenement: KeyboardEvent) {
      const bouton = parTouche.get(toucheDeEvenement(evenement));
      if (!bouton || dansUnChamp(evenement.target)) return;
      evenement.preventDefault();
      if (evenement.repeat) return;
      if (bouton === "FAST") accelerer(true, VITESSE_TOUCHE);
      else emulateurRef.current?.bouton(bouton, true);
    }

    function relacher(evenement: KeyboardEvent) {
      const bouton = parTouche.get(toucheDeEvenement(evenement));
      if (!bouton || dansUnChamp(evenement.target)) return;
      evenement.preventDefault();
      if (bouton === "FAST") accelerer(false, VITESSE_TOUCHE);
      else emulateurRef.current?.bouton(bouton, false);
    }

    /**
     * Changer d'onglet pendant qu'une direction est tenue laisserait le bouton
     * enfoncé : le `keyup` part vers l'autre fenêtre. Le personnage
     * continuerait à marcher tout seul au retour.
     */
    function toutRelacher() {
      for (const bouton of parTouche.values()) {
        if (bouton === "FAST") accelerer(false, VITESSE_TOUCHE);
        else emulateurRef.current?.bouton(bouton, false);
      }
    }

    window.addEventListener("keydown", enfoncer, { passive: false });
    window.addEventListener("keyup", relacher, { passive: false });
    window.addEventListener("blur", toutRelacher);
    return () => {
      window.removeEventListener("keydown", enfoncer);
      window.removeEventListener("keyup", relacher);
      window.removeEventListener("blur", toutRelacher);
    };
  }, [touches, accelerer]);

  /**
   * La manette tactile s'affiche sur les appareils dont le pointeur est
   * « grossier » — un doigt. Testé après le montage et non au rendu serveur,
   * qui ne sait rien de l'appareil : l'afficher puis la retirer provoquerait
   * un saut visible, l'inverse laisserait un téléphone sans commandes.
   */
  const [tactile, setTactile] = useState(false);
  /** Téléphone tenu à l'horizontale : l'écran au centre, la manette de part et d'autre. */
  const [paysage, setPaysage] = useState(false);
  /** Le menu plein écran du lecteur tactile. */
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Sur téléphone, le premier appui fait disparaître les barres du système.
  usePleinEcranAuto(tactile);
  useEffect(() => {
    const requete = window.matchMedia("(pointer: coarse)");
    const orientation = window.matchMedia("(orientation: landscape)");
    setTactile(requete.matches);
    setPaysage(orientation.matches);
    setLayoutPret(true);
    const surChangement = (e: MediaQueryListEvent) => setTactile(e.matches);
    const surRotation = (e: MediaQueryListEvent) => setPaysage(e.matches);
    requete.addEventListener("change", surChangement);
    orientation.addEventListener("change", surRotation);
    return () => {
      requete.removeEventListener("change", surChangement);
      orientation.removeEventListener("change", surRotation);
    };
  }, []);

  /**
   * La surface réellement visible, mesurée plutôt que confiée au navigateur.
   *
   * Après une rotation, un navigateur mobile donnait au lecteur — `fixed`,
   * collé aux quatre bords — tantôt la bonne hauteur, tantôt celle d'avant le
   * repli de sa barre d'adresse, au hasard. Le lecteur dépassait alors sous
   * l'écran : L et R restaient en haut, tout ce qui est centré descendait, et
   * le bas sortait de l'écran.
   *
   * `visualViewport` donne ce que le joueur voit vraiment. On remesure à
   * chaque redimensionnement, et deux fois encore après une rotation : le
   * navigateur finit d'ajuster sa barre un peu après l'avoir annoncée.
   *
   * Seulement une fois la partie lancée, jamais pendant le démarrage du cœur :
   * redimensionner le lecteur à ce moment-là laissait l'écran du jeu noir
   * (vérifié). Jusque-là, `100dvh` tient lieu de mesure.
   */
  const partieLancee = etat === "en-jeu" || etat === "en-pause";
  const [visible, setVisible] = useState<{ largeur: number; hauteur: number } | null>(null);
  useEffect(() => {
    if (!tactile || !partieLancee) return;
    const vue = window.visualViewport;
    const mesurer = () =>
      setVisible({
        largeur: Math.round(vue?.width ?? window.innerWidth),
        hauteur: Math.round(vue?.height ?? window.innerHeight),
      });
    const minuteries: ReturnType<typeof setTimeout>[] = [];
    const apresRotation = () => {
      // Une page restée défilée décalerait le haut de l'écran visible.
      window.scrollTo(0, 0);
      mesurer();
      minuteries.push(setTimeout(mesurer, 250), setTimeout(mesurer, 700));
    };

    mesurer();
    vue?.addEventListener("resize", mesurer);
    window.addEventListener("resize", mesurer);
    window.addEventListener("orientationchange", apresRotation);
    const orientation = window.matchMedia("(orientation: landscape)");
    orientation.addEventListener("change", apresRotation);
    return () => {
      vue?.removeEventListener("resize", mesurer);
      window.removeEventListener("resize", mesurer);
      window.removeEventListener("orientationchange", apresRotation);
      orientation.removeEventListener("change", apresRotation);
      minuteries.forEach(clearTimeout);
    };
  }, [tactile, partieLancee]);

  const appuyerBouton = useCallback((bouton: Bouton, enfonce: boolean) => {
    emulateurRef.current?.bouton(bouton, enfonce);
  }, []);

  /**
   * Signale la partie en cours, au lancement puis à intervalle régulier.
   *
   * C'est ce qui alimente la rangée « Reprendre » de l'accueil et le tri par
   * jeux les plus joués. Le serveur décide seul s'il s'agit d'une nouvelle
   * partie ou de la suite de la précédente : recharger la page ne doit pas
   * compter une partie de plus.
   */
  useEffect(() => {
    if (etat !== "en-jeu") return;

    const signaler = () => {
      void requete(`/api/play/${jeu.id}`, { method: "POST" }).catch(() => {
        // Une partie non comptée n'est pas un problème : on retentera.
      });
    };

    signaler();
    const battement = setInterval(signaler, 60 * 1000);
    return () => clearInterval(battement);
  }, [etat, jeu.id, requete]);

  /**
   * Un point de reprise, tel que le site le range : un PNG qui porte l'état
   * et l'image de l'écran. Le cœur ordinaire l'écrit ainsi de lui-même ; le
   * cœur « une console » rend un état brut, qu'on range dans ce même format
   * (`etat-png.ts`) — routes, vignettes et stockage de l'invité n'y voient
   * aucune différence.
   */
  const ecrireEtat = useCallback((): Uint8Array | null => {
    const etat = emulateurRef.current?.ecrireEtat(PASSAGE) ?? null;
    if (!etat || !mgsRef.current) return etat;
    const canvas = canvasRef.current;
    return canvas ? emballerEtat(canvas, etat) : null;
  }, []);

  /** L'inverse : le cœur « une console » reprend l'état brut tiré du PNG. */
  const lireEtat = useCallback(async (donnees: Uint8Array): Promise<boolean> => {
    const emulateur = emulateurRef.current;
    if (!emulateur) return false;
    if (!mgsRef.current || !estPng(donnees)) return emulateur.lireEtat(PASSAGE, donnees);
    const brut = await deballerEtat(donnees);
    return brut ? emulateur.lireEtat(PASSAGE, brut) : false;
  }, []);

  /**
   * Le son du cœur « une console » ne part qu'après un geste du joueur dans
   * la page, et le jeu démarre ici sans en attendre : on le relance au
   * premier appui, quel qu'il soit.
   */
  useEffect(() => {
    if (etat !== "en-jeu" && etat !== "en-pause") return;
    if (!mgsRef.current) return;
    const reveiller = () => mgsRef.current?.reveillerSon();
    window.addEventListener("pointerdown", reveiller);
    window.addEventListener("keydown", reveiller);
    return () => {
      window.removeEventListener("pointerdown", reveiller);
      window.removeEventListener("keydown", reveiller);
    };
  }, [etat]);

  const changerVibration = useCallback((allumee: boolean) => {
    setVibration(allumee);
    retenirVibration(allumee);
    vibreurRef.current?.activer(allumee);
  }, []);

  /**
   * Rotation automatique des points de reprise.
   *
   * Elle vit dans le lecteur et non dans le panneau qui les affiche : sur
   * téléphone, ce panneau n'est monté que lorsque le menu est ouvert, et la
   * rotation s'arrêtait donc au moment précis où l'on referme le menu pour
   * jouer. Ici, elle tourne tant que la partie tourne.
   *
   * L'emplacement visé est redemandé au serveur à chaque tour plutôt que
   * compté localement : deux appareils sur la même partie ne se marcheraient
   * ainsi pas dessus, et un rechargement de page ne repart pas du premier.
   */
  useEffect(() => {
    if (etat !== "en-jeu") return;

    const minuterie = setInterval(async () => {
      const emulateur = emulateurRef.current;
      if (!emulateur) return;

      try {
        const liste = await requete(`/api/state/${jeu.id}`, { cache: "no-store" });
        if (!liste.ok) return;
        const { etats } = (await liste.json()) as {
          etats: Array<{ emplacement: number; auto: boolean; creeLe: string }>;
        };

        const autos = etats.filter((e) => e.auto);
        const libre = [1, 2, 3, 4, 5].find((n) => !autos.some((e) => e.emplacement === n));
        const cible =
          libre ??
          autos.reduce((vieux, e) =>
            Date.parse(e.creeLe) < Date.parse(vieux.creeLe) ? e : vieux,
          ).emplacement;

        const donnees = ecrireEtat();
        if (!donnees) return;

        await requete(`/api/state/${jeu.id}/a${cible}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Uint8Array(donnees),
        });
      } catch {
        // Réseau indisponible : on retentera au tour suivant, la partie
        // continue sans être interrompue par un échec d'enregistrement.
      }
    }, INTERVALLE_AUTO);

    return () => clearInterval(minuterie);
  }, [etat, jeu.id, requete, ecrireEtat]);

  const basculerPause = useCallback(() => {
    const emulateur = emulateurRef.current;
    if (!emulateur) return;
    setEtat((precedent) => {
      if (precedent === "en-jeu") {
        emulateur.pause();
        return "en-pause";
      }
      if (precedent === "en-pause") {
        emulateur.reprendre();
        return "en-jeu";
      }
      return precedent;
    });
  }, []);

  const changerVitesse = useCallback((multiplicateur: number) => {
    const emulateur = emulateurRef.current;
    if (!emulateur) return;
    vitesseRef.current = multiplicateur;
    emulateur.vitesse(multiplicateur);
    setVitesse(multiplicateur);
  }, []);

  const changerVolume = useCallback((pourcentage: number) => {
    volumeRef.current = pourcentage;
    setVolume(pourcentage);
    retenirVolume(pourcentage);
    if (!muetRef.current) emulateurRef.current?.volume(pourcentage);
  }, []);

  const basculerSon = useCallback(() => {
    const emulateur = emulateurRef.current;
    if (!emulateur) return;
    const muetMaintenant = !muetRef.current;
    muetRef.current = muetMaintenant;
    emulateur.volume(muetMaintenant ? 0 : volumeRef.current);
    setMuet(muetMaintenant);
  }, []);

  const reinitialiser = useCallback(() => {
    emulateurRef.current?.reinitialiser();
    setEtat("en-jeu");
  }, []);

  const enPartie = etat === "en-jeu" || etat === "en-pause";

  const cadre = habillage
    ? { largeur: habillage.largeur, hauteur: habillage.hauteur }
    : { largeur: dimensions.largeur, hauteur: dimensions.hauteur };
  const zone = habillage ? habillage.ecran : { x: 0, y: 0, largeur: 1, hauteur: 1 };

  const ecran = (
    <canvas
      ref={canvasRef}
      width={consoleInfo.largeur}
      height={consoleInfo.hauteur}
      /*
       * `object-contain` est un filet : même si la boîte prenait de mauvaises
       * proportions, l'image resterait juste, avec des bandes noires plutôt
       * qu'étirée.
       */
      className={
        tactile
          ? paysage
            ? "h-full max-w-full object-contain"
            : "max-h-full w-full object-contain"
          : "h-full w-full object-contain"
      }
      style={{
        imageRendering: "pixelated",
        aspectRatio: `${dimensions.largeur} / ${dimensions.hauteur}`,
      }}
    />
  );

  const commandes = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Commande onClick={basculerPause}>
        {etat === "en-pause" ? t.lecteur.reprendre : t.lecteur.pause}
      </Commande>
      {/*
        « Redémarrer la console » et non « Réinitialiser » : le jeu repart de
        son écran-titre et recharge la sauvegarde, exactement comme si on
        éteignait et rallumait la Game Boy. Il ne repart pas d'une partie
        vierge — ce serait effacer la sauvegarde, et aucun bouton du site ne
        doit pouvoir le faire par malentendu.
      */}
      <Commande onClick={reinitialiser}>{t.lecteur.redemarrer}</Commande>
      {/*
        « Envoyer au serveur » et non « Enregistrer » : ce bouton ne sauvegarde
        pas la partie, il transmet la sauvegarde du jeu. Dire « Enregistrer »
        laissait croire qu'il remplaçait la sauvegarde dans le jeu, et
        promettait donc une reprise qu'il ne tenait pas.
      */}
      {/* Un invité n'a pas de serveur où envoyer : sa partie s'enregistre sur place. */}
      {!invite && <Commande onClick={() => void envoyerSauvegarde(true)}>{t.lecteur.envoyerAuServeur}</Commande>}
      <ChoixVitesse
        valeur={vitesse}
        accelere={accelere}
        surChoix={changerVitesse}
        toucheAcceleration={tactile ? null : touches.FAST}
      />
      <Volume valeur={volume} muet={muet} surChangement={changerVolume} surMuet={basculerSon} />
      {/* Seulement pour un jeu dont la cartouche vibre, et là où quelque chose peut vibrer. */}
      {moteur && appareilVibrant(tactile) && (
        <Commande onClick={() => changerVibration(!vibration)} actif={vibration}>
          {vibration ? t.lecteur.vibration.allumee : t.lecteur.vibration.coupee}
        </Commande>
      )}
    </div>
  );

  const panneau = (
    <>
      {commandes}
      <EtatDeSauvegarde
        etat={sauvegarde}
        local={invite}
        surForcer={() => void envoyerSauvegarde(true, true)}
      />

      {/* L'habillage n'existe que sur ordinateur, pour l'instant. */}
      {!tactile && (
        <ChoixHabillage
          habillages={habillages}
          choisi={habillageId}
          surChoix={changerHabillage}
        />
      )}

      <FichierSauvegarde
        gameId={jeu.id}
        titre={jeu.titre}
        lireSauvegarde={() => emulateurRef.current?.lireSauvegarde() ?? null}
        {...(invite && {
          local: true,
          requete,
          surTelecharger: emporter,
          // Le fichier importé, le joueur l'a déjà : rien de plus à emporter,
          // et le rechargement qui suit ne doit pas le lui redemander.
          surImport: () => {
            noterAEmporter(false);
            departAssumeRef.current = true;
          },
        })}
      />

      {/* Au clavier seulement : sur un écran tactile, il n'y a rien à mapper. */}
      {!tactile && (
        <Touches
          consoleSlug={jeu.consoleSlug}
          boutons={consoleInfo.gachettes ? BOUTONS_AVEC_GACHETTES : BOUTONS_SIMPLES}
          touches={touches}
          surChangement={setTouches}
          {...(invite && { enregistreur: enregistreurInvite, local: true })}
        />
      )}
      <ManetteConfig
        boutons={consoleInfo.gachettes ? BOUTONS_AVEC_GACHETTES : BOUTONS_SIMPLES}
        disposition={manettePhysique.disposition}
        identite={manettePhysique.identite}
        aRegler={manettePhysique.aRegler}
        changer={manettePhysique.changer}
        retablir={manettePhysique.retablir}
      />
      {/*
        Les emplacements du cœur et ceux du site sont deux choses différentes.
        Le cœur ne sert que de passage : on lui fait toujours écrire et relire
        son emplacement 1, dont on récupère ou dépose les octets aussitôt. Les
        emplacements du joueur, eux, vivent sur le serveur — sans quoi un état
        pris sur le PC resterait sur le PC.
      */}
      <Savestates
        gameId={jeu.id}
        acces={accesEtats}
        surEcrire={ecrireEtat}
        surLire={lireEtat}
      />
    </>
  );

  const messages = (
    <>
      {etat === "chargement" && (
        <p className="text-center text-sm text-ink-400">{progression}</p>
      )}
      {etat === "erreur" && erreur && (
        <p
          role="alert"
          className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200"
        >
          {erreur}
        </p>
      )}
    </>
  );


  const rappel = depart !== "non" && (
    <AvantDePartir
      emportee={depart === "emportee"}
      surEmporter={async () => {
        if (await emporter()) setDepart("emportee");
      }}
      surPartir={partir}
      surRester={() => setDepart("non")}
    />
  );

  /**
   * Sur écran tactile, le lecteur prend toute la fenêtre.
   *
   * L'en-tête du site et le pied de page passeraient sinon devant l'essentiel :
   * il fallait faire défiler la page pour atteindre Start et Select, ce qui
   * n'a aucun sens en pleine partie. `fixed inset-0` recouvre tout, et les
   * commandes passent dans un menu qu'on ouvre à la demande.
   *
   * `min-h-0` sur la zone d'écran n'est pas décoratif : sans lui, un enfant en
   * flex refuse de descendre sous sa taille naturelle, et la manette serait
   * poussée hors de la fenêtre.
   */
  if (tactile) {
    const boutonsLecteur = (
      <>
        <button
          type="button"
          onClick={() => setMenuOuvert(true)}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200"
        >
          {t.lecteur.menu}
        </button>
        {/*
          Accéléré d'un tapotement, sans ouvrir le menu : un bouton qui bascule,
          puisqu'un doigt ne peut pas rester posé dessus en jouant. ×3, sans
          toucher à la vitesse de la liste du menu.
        */}
        <button
          type="button"
          onClick={() => accelerer(!accelere, VITESSE_TACTILE)}
          aria-pressed={accelere}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            accelere ? "border-accent-600 bg-accent-600/15 text-accent-400" : "border-ink-700 text-ink-200"
          }`}
        >
          {accelere ? `×${VITESSE_TACTILE} ▶▶` : "▶▶"}
        </button>
        <a
          href={jeu.retour}
          onClick={surQuitter}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200"
        >
          {t.lecteur.quitter}
        </a>
      </>
    );

    /*
     * Une seule arborescence pour les deux orientations, et ce n'est pas un
     * détail : le cœur dessine dans **ce** canvas. Si tourner le téléphone
     * remplaçait l'arbre, React créerait un nouveau canvas et le jeu
     * continuerait de dessiner dans l'ancien, détaché — écran noir. Les
     * emplacements restent donc les mêmes (un bloc absent laisse sa place
     * vide plutôt que de décaler les suivants) ; seules les classes changent.
     *
     * En paysage, l'écran prend toute la hauteur, au centre. Les deux côtés,
     * réservés par `--cote`, reçoivent la manette par-dessus : croix à gauche,
     * boutons à droite, gâchettes dans les coins du haut.
     */
    return (
      <div
        lang={langue}
        className={`fixed left-0 top-0 z-50 flex flex-col bg-ink-950 ${
          visible ? "" : "h-dvh w-full"
        }`}
        style={
          (visible
            ? {
                width: `${visible.largeur}px`,
                height: `${visible.hauteur}px`,
                "--cote": `${Math.round(visible.largeur * 0.22)}px`,
                "--haut": `${visible.hauteur}px`,
                // En plein écran, la page va jusqu'au bord : la barre du haut
                // ne doit pas passer sous l'encoche de la caméra.
                paddingTop: "env(safe-area-inset-top)",
              }
            : {
                "--cote": "22vw",
                "--haut": "100dvh",
                paddingTop: "env(safe-area-inset-top)",
              }) as unknown as React.CSSProperties
        }
      >
        {/* En paysage, la barre ne s'affiche que hors partie : en jeu, Menu
            et Quitter passent sous la croix, et la hauteur va à l'écran. */}
        {(!paysage || !enPartie) && (
          <div className="flex shrink-0 items-center gap-3 px-3 py-2">
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-50">
              {jeu.titre}
            </h1>
            {boutonsLecteur}
          </div>
        )}

        {/*
          En portrait, l'écran garde sa taille naturelle — toute la largeur,
          hauteur selon ses proportions — et la manette prend tout ce qui
          reste. L'inverse laissait une large bande noire autour d'un jeu
          minuscule.
        */}
        <div
          className={
            paysage
              ? "flex min-h-0 flex-1 items-center justify-center bg-black"
              : "flex shrink-0 justify-center border-y-4 border-ink-800 bg-black"
          }
          style={
            paysage
              ? {
                  paddingLeft: "calc(var(--cote) + env(safe-area-inset-left))",
                  paddingRight: "calc(var(--cote) + env(safe-area-inset-right))",
                }
              : undefined
          }
        >
          {ecran}
        </div>

        <div
          className={
            paysage
              ? "pointer-events-none absolute inset-0"
              : "flex min-h-0 flex-1 flex-col justify-start pt-2"
          }
        >
          {enPartie && manetteBranchee ? (
            // Une vraie manette est branchée : l'écran reste au jeu, il ne
            // reste que Menu, Quitter et l'accéléré.
            <div className={paysage ? "pointer-events-auto absolute bottom-3 left-3 flex gap-2" : "flex justify-center gap-2 px-3 py-4"}>
              {boutonsLecteur}
            </div>
          ) : enPartie ? (
            <Manette
              gachettes={consoleInfo.gachettes}
              surBouton={appuyerBouton}
              paysage={paysage}
              basGauche={boutonsLecteur}
            />
          ) : (
            <div className={paysage ? "absolute inset-x-0 bottom-4 px-3" : "px-3 py-6"}>
              {messages}
            </div>
          )}
        </div>

        {menuOuvert && (
          <div className="absolute inset-0 z-10 flex flex-col bg-ink-950/95 backdrop-blur">
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm font-semibold text-ink-50">{t.lecteur.menu}</span>
              <span className="flex gap-2">
                {/*
                  Le plein écran se prend tout seul au premier appui
                  (`usePleinEcranAuto`) ; ce bouton sert à en sortir, ou à y
                  revenir après l'avoir quitté. Absent là où le navigateur ne
                  le permet pas — Safari sur iPhone.
                */}
                {typeof document !== "undefined" && document.fullscreenEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        if (document.fullscreenElement) void document.exitFullscreen();
                        else void document.documentElement.requestFullscreen().catch(() => {});
                        setMenuOuvert(false);
                      }}
                      className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200"
                    >
                      {typeof document !== "undefined" && document.fullscreenElement
                        ? t.lecteur.quitterPleinEcran
                        : t.lecteur.pleinEcran}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setMenuOuvert(false)}
                  className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200"
                >
                  {t.lecteur.fermer}
                </button>
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-6">
              {panneau}
            </div>
          </div>
        )}
        {rappel}
      </div>
    );
  }

  return (
    <div lang={langue} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ink-50">{jeu.titre}</h1>
        <span className="text-xs text-ink-700">{consoleInfo.nom}</span>
        {/*
          Vraie navigation : quitter côté client garderait le document isolé
          sur les pages suivantes, où `require-corp` bloquerait le captcha
          chargé depuis Cloudflare.
        */}
        <a
          href={jeu.retour}
          onClick={surQuitter}
          className="ml-auto text-sm text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
        >
          {t.lecteur.quitter}
        </a>
      </div>

      {/*
        L'écran occupe au moins 75 % de la hauteur de la fenêtre, comme
        demandé. `image-rendering: pixelated` évite le flou : 160×144 étirés
        en 900 px doivent rester des pixels nets.
      */}
      {/*
        Pleine largeur de la fenêtre, hors de la colonne de texte : un écran de
        jeu n'a aucune raison d'être limité à la largeur confortable d'un
        paragraphe, et la Game Boy Advance y perdait le plus.
      */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 px-3">
        <div className="flex justify-center rounded-panel border border-ink-800 bg-black p-2 lg:p-3">
          {/*
            Le cadre a les proportions de l'habillage, ou celles du jeu sans
            habillage ; l'écran se pose dans la zone mesurée par le scan, en
            pourcentages, et le jeu s'y loge sans se déformer.

            La largeur est le plus petit des deux : la place disponible, ou
            celle qu'exige la hauteur voulue. Imposer une hauteur **et** une
            largeur maximale déformait la Game Boy Advance, plus large.

            Le canvas reste à la même place dans l'arbre avec ou sans
            habillage : le cœur dessine dans ce canvas-là, et le remplacer en
            pleine partie donnerait un écran noir. L'image vient après lui.
          */}
          <div
            className="relative"
            style={{
              width: `min(100%, calc(82vh * ${cadre.largeur} / ${cadre.hauteur}))`,
              aspectRatio: `${cadre.largeur} / ${cadre.hauteur}`,
            }}
          >
            <div
              className="absolute flex items-center justify-center bg-black"
              style={{
                left: `${zone.x * 100}%`,
                top: `${zone.y * 100}%`,
                width: `${zone.largeur * 100}%`,
                height: `${zone.hauteur * 100}%`,
              }}
            >
              {ecran}
            </div>
            {habillage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={habillage.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none"
              />
            )}
          </div>
        </div>
      </div>

      {messages}

      {enPartie && panneau}
      {rappel}
    </div>
  );
}

/**
 * Le rappel fait à un invité qui s'en va sans avoir emporté sa partie.
 *
 * Une question et non un obstacle : il peut partir sans télécharger, sa
 * partie reste dans ce navigateur. Mais c'est le seul moment où l'on peut lui
 * dire, avec nos mots, qu'elle n'existe nulle part ailleurs.
 */
function AvantDePartir({
  emportee,
  surEmporter,
  surPartir,
  surRester,
}: {
  emportee: boolean;
  surEmporter: () => void;
  surPartir: () => void;
  surRester: () => void;
}) {
  const bouton = "rounded-lg border px-3 py-2 text-sm transition-colors";
  const t = useT().lecteur.depart;
  const quitter = useT().lecteur.quitter;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avant-de-partir"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-panel border border-ink-700 bg-ink-900 p-5">
        <h2 id="avant-de-partir" className="text-base font-semibold text-ink-50">
          {emportee ? t.titreEmportee : t.titre}
        </h2>
        {emportee ? (
          <p className="text-sm text-ink-200">{t.emportee}</p>
        ) : (
          <>
            <p className="text-sm text-ink-200">
              <Accentue texte={t.explication} />
            </p>
            <p className="text-sm text-ink-200">{t.conseil}</p>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {!emportee && (
            <button
              type="button"
              onClick={surEmporter}
              className={`${bouton} border-accent-600 bg-accent-600/15 text-accent-400 hover:bg-accent-600/25`}
            >
              {t.telecharger}
            </button>
          )}
          <button
            type="button"
            onClick={surPartir}
            className={`${bouton} border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50`}
          >
            {emportee ? quitter : t.quitterSans}
          </button>
          <button
            type="button"
            onClick={surRester}
            className={`${bouton} border-transparent text-ink-400 hover:text-ink-50`}
          >
            {t.rester}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * L'état de la sauvegarde, en permanence sous les commandes.
 *
 * Un joueur doit pouvoir répondre d'un coup d'œil à « est-ce que ma partie est
 * en sécurité ? ». Un conflit ou un échec restent affichés jusqu'au prochain
 * enregistrement réussi : ce sont les seuls cas où il risque de perdre
 * quelque chose, et ils ne doivent pas s'effacer tout seuls.
 */
function EtatDeSauvegarde({
  etat,
  local = false,
  surForcer,
}: {
  etat: EtatSauvegarde;
  /** Invité : la partie reste dans le navigateur, et le texte le dit. */
  local?: boolean;
  surForcer: () => void;
}) {
  const t = useT().lecteur.sauvegarde;
  const langue = useLangue();

  if (etat.etat === "inconnu") {
    return (
      <p className="mx-auto max-w-prose text-center text-xs text-ink-700">
        <Accentue texte={local ? t.explicationLocale : t.explication} balise="em" />
      </p>
    );
  }

  if (etat.etat === "envoi") {
    return <p className="text-center text-xs text-ink-400">{t.envoi}</p>;
  }

  if (etat.etat === "enregistree") {
    const heure = etat.quand.toLocaleTimeString(REGION[langue], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <p className="text-center text-xs text-accent-400">
        {local ? t.enregistreeLocale(heure) : t.enregistree(heure)}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-prose flex-col items-center gap-2 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-center text-xs text-red-200"
    >
      <p>{etat.message}</p>
      {/*
        Un conflit sans issue serait pire que le conflit : le joueur ne
        pourrait plus rien enregistrer. On lui laisse donc trancher, en
        sachant que la version écrasée part en sauvegarde de secours.
      */}
      {etat.etat === "conflit" && (
        <button
          type="button"
          onClick={surForcer}
          className="rounded-md border border-red-700 px-3 py-1 text-red-100 transition-colors hover:bg-red-900/50"
        >
          {t.garderCelleCi}
        </button>
      )}
    </div>
  );
}

/** Vitesse de la touche d'accélération tenue (Maj gauche par défaut). */
const VITESSE_TOUCHE = 4;
/** Vitesse du bouton ▶▶ de la disposition tactile. */
const VITESSE_TACTILE = 3;
