/**
 * Les moteurs du câble link : deux consoles reliées, vues de l'ouvrier.
 *
 * L'ouvrier ne connaît que cette interface. Derrière, deux cœurs très
 * différents : TGB Dual (libretro, deux Game Boy dans une image côte à côte)
 * et mGBA Splitscreen (un pont C maison, une GBA par tampon). Chacun a ses
 * conventions de boutons, d'image et de son ; elles sont ramenées ici à une
 * seule — masques libretro en entrée, RGB565 par joueur et son mono en
 * sortie — pour que le reste du serveur n'ait rien à en savoir.
 *
 * Ce module tourne sous Node, dans un fil de travail : pas d'alias `@/`, pas
 * de propriétés de paramètre, pas d'`enum`.
 */
import { pathToFileURL } from "node:url";
import { BOUTONS_LIBRETRO, CoeurLibretro, ErreurCoeur } from "../emulator/libretro.ts";
import type { CodeErreur, Valeurs } from "./protocole.ts";

/** Ce qu'il faut pour démarrer un moteur. Préparé par `salons.ts`, sérialisable. */
export type DescriptionCoeur =
  | {
      type: "tgbdual";
      js: string;
      wasm: ArrayBuffer;
      options: Record<string, string>;
      typeSpecial: number;
      srams: [number, number];
    }
  | { type: "mgs"; js: string; wasm: ArrayBuffer };

export type Joueur = 0 | 1;

/**
 * Un échec du démarrage que les joueurs liront : le code que leur navigateur
 * traduira, les valeurs que le texte cite, et le texte français en repli.
 */
function echec(code: CodeErreur, message: string, valeurs?: Valeurs): ErreurCoeur {
  return new ErreurCoeur(code, message, valeurs);
}

export type Moteur = {
  ips: number;
  largeur: number;
  hauteur: number;
  /** Fréquence du son rendu par `prendreSon`, en Hz. */
  frequence: number;
  /** Le moteur sait-il donner un son différent à chaque joueur ? */
  sonParJoueur: boolean;
  /** Avance d'une image, avec le masque libretro de chaque joueur. */
  avancer(boutons: readonly [number, number]): void;
  /** L'écran du joueur, en RGB565 (deux octets par pixel). */
  image(joueur: Joueur): Buffer;
  /** Le son accumulé depuis le dernier appel, mono. `joueur` ignoré sans son par joueur. */
  prendreSon(joueur: Joueur): Int16Array;
  srams(): [Uint8Array | null, Uint8Array | null];
  /**
   * L'état complet des deux consoles, pour reprendre une session interrompue :
   * un ou plusieurs blocs, opaques, à rendre tels quels à `restaurer`. `null`
   * si le cœur ne sait pas.
   */
  etat(): Uint8Array[] | null;
  /** Remet les deux consoles dans un état rendu par `etat()`. Faux si le cœur le refuse. */
  restaurer(etats: readonly Uint8Array[]): boolean;
  arreter(): void;
};

export async function demarrerMoteur(
  coeur: DescriptionCoeur,
  rom: Uint8Array,
  nom: string,
  saves: readonly [Uint8Array | null, Uint8Array | null],
): Promise<Moteur> {
  return coeur.type === "tgbdual"
    ? moteurTgbDual(coeur, rom, nom, saves)
    : moteurMgs(coeur, rom, saves);
}

// ---------------------------------------------------------------------------
// TGB Dual
// ---------------------------------------------------------------------------

async function moteurTgbDual(
  coeur: Extract<DescriptionCoeur, { type: "tgbdual" }>,
  rom: Uint8Array,
  nom: string,
  saves: readonly [Uint8Array | null, Uint8Array | null],
): Promise<Moteur> {
  const libretro = new CoeurLibretro(pathToFileURL(coeur.js).href, coeur.options, new Uint8Array(coeur.wasm));
  await libretro.charger(
    [
      { nom: `j1-${nom}`, donnees: rom },
      { nom: `j2-${nom}`, donnees: rom },
    ],
    coeur.typeSpecial,
  );
  for (const [i, sauvegarde] of saves.entries()) {
    if (sauvegarde && !libretro.ecrireMemoire(coeur.srams[i]!, sauvegarde)) {
      throw echec("coeur-sans-memoire", `Le cœur n'a pas de mémoire de sauvegarde pour le joueur ${i + 1}.`, {
        joueur: i + 1,
      });
    }
  }
  // Comme une cartouche qu'on insère : les consoles relisent leur sauvegarde.
  libretro.reinitialiser();
  // Une première image, pour connaître la géométrie.
  libretro.avancer([0, 0]);

  // Les deux Game Boy sont rendues côte à côte dans une seule image.
  const largeurTotale = libretro.image?.width ?? 0;
  const hauteur = libretro.image?.height ?? 0;
  const largeur = largeurTotale / 2;

  return {
    ips: libretro.ips,
    largeur,
    hauteur,
    frequence: libretro.frequence,
    sonParJoueur: false,
    avancer: (boutons) => libretro.avancer([...boutons]),
    image: (joueur) => {
      const rgba = libretro.image!.data;
      const sortie = Buffer.alloc(largeur * hauteur * 2);
      let o = 0;
      for (let y = 0; y < hauteur; y++) {
        let i = (y * largeurTotale + joueur * largeur) * 4;
        for (let x = 0; x < largeur; x++, i += 4) {
          const p = ((rgba[i]! >> 3) << 11) | ((rgba[i + 1]! >> 2) << 5) | (rgba[i + 2]! >> 3);
          sortie[o++] = p & 0xff;
          sortie[o++] = p >> 8;
        }
      }
      return sortie;
    },
    prendreSon: () => {
      // Stéréo entrelacée en entrée, mono en sortie. Le cœur ne produit le
      // son que d'une des deux Game Boy.
      const morceaux = libretro.prendreSon();
      let total = 0;
      for (const m of morceaux) total += m.length >> 1;
      const pcm = new Int16Array(total);
      let n = 0;
      for (const m of morceaux) for (let i = 0; i < m.length; i += 2) pcm[n++] = (m[i]! + m[i + 1]!) >> 1;
      return pcm;
    },
    srams: () => [libretro.lireMemoire(coeur.srams[0]), libretro.lireMemoire(coeur.srams[1])],
    // Un seul bloc : libretro sérialise les deux Game Boy et leur câble ensemble.
    etat: () => {
      const bloc = libretro.etat();
      return bloc ? [bloc] : null;
    },
    restaurer: (etats) => etats.length === 1 && libretro.restaurerEtat(etats[0]!),
    arreter: () => libretro.arreter(),
  };
}

// ---------------------------------------------------------------------------
// mGBA Splitscreen
// ---------------------------------------------------------------------------

/** Bits des boutons tels que mGBA les lit (voir coeurs/mgba-splitscreen/LISEZMOI.md). */
const BITS_MGBA: Record<keyof typeof BOUTONS_LIBRETRO, number> = {
  A: 0x001,
  B: 0x002,
  SELECT: 0x004,
  START: 0x008,
  RIGHT: 0x010,
  LEFT: 0x020,
  UP: 0x040,
  DOWN: 0x080,
  R: 0x100,
  L: 0x200,
};

function versMgba(masqueLibretro: number): number {
  let masque = 0;
  for (const nom of Object.keys(BITS_MGBA) as (keyof typeof BITS_MGBA)[]) {
    if (masqueLibretro & BOUTONS_LIBRETRO[nom]) masque |= BITS_MGBA[nom];
  }
  return masque;
}

type ModuleMgs = {
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  _malloc(taille: number): number;
  _free(pointeur: number): void;
  _mgs_init(nombre: number): void;
  _mgs_load_rom(pointeur: number, taille: number): number;
  _mgs_run_frame(): void;
  _mgs_get_video(joueur: number): number;
  _mgs_get_video_width(joueur: number): number;
  _mgs_get_video_height(joueur: number): number;
  _mgs_set_keys(joueur: number, masque: number): void;
  _mgs_get_audio(): number;
  _mgs_audio_frames(): number;
  _mgs_get_audio_rate(): number;
  _mgs_set_audio_source(n: number): void;
  _mgs_import_save(joueur: number, pointeur: number, taille: number): number;
  _mgs_export_save(joueur: number): number;
  _mgs_save_ptr(): number;
  _mgs_save_state(joueur: number): number;
  _mgs_state_ptr(): number;
  _mgs_load_state_bytes(joueur: number, pointeur: number, taille: number): number;
  _mgs_reset_sio(): void;
  _mgs_quit(): void;
};

/** Images par seconde de la GBA : 16 777 216 Hz / 280 896 cycles par image. */
const IPS_GBA = 16777216 / 280896;

/**
 * Le `.sav` de mGBA porte parfois seize octets de plus que la mémoire de
 * sauvegarde : l'état de l'horloge temps réel. Le pont ne les connaît pas ;
 * on les retire à l'import et on les remet à l'export, pour qu'une partie
 * revenue du câble link garde son heure dans le lecteur.
 */
const PIED_RTC = 16;

function separerPiedRtc(sauvegarde: Uint8Array): { donnees: Uint8Array; pied: Uint8Array | null } {
  if (sauvegarde.length > PIED_RTC && sauvegarde.length % 1024 === PIED_RTC) {
    return {
      donnees: sauvegarde.subarray(0, sauvegarde.length - PIED_RTC),
      pied: sauvegarde.subarray(sauvegarde.length - PIED_RTC),
    };
  }
  return { donnees: sauvegarde, pied: null };
}

async function moteurMgs(
  coeur: Extract<DescriptionCoeur, { type: "mgs" }>,
  rom: Uint8Array,
  saves: readonly [Uint8Array | null, Uint8Array | null],
): Promise<Moteur> {
  // Le pont est publié en UMD : chargé comme CommonJS, son export est la
  // fabrique du module. Ce build ignore `wasmBinary` ; on instancie nous-mêmes.
  const { default: creer } = (await import(pathToFileURL(coeur.js).href)) as {
    default: (options: {
      instantiateWasm: (imports: WebAssembly.Imports, pret: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) => object;
      print?: (t: string) => void;
      printErr?: (t: string) => void;
    }) => Promise<ModuleMgs>;
  };
  const wasm = new Uint8Array(coeur.wasm);
  const m = await creer({
    instantiateWasm: (imports, pret) => {
      WebAssembly.instantiate(wasm, imports).then((r) => pret(r.instance, r.module));
      return {};
    },
    print: () => {},
    printErr: () => {},
  });

  m._mgs_init(2);
  const pRom = m._malloc(rom.length);
  m.HEAPU8.set(rom, pRom);
  const charge = m._mgs_load_rom(pRom, rom.length);
  if (charge !== 0) throw echec("coeur-rom-refusee", `Le cœur a refusé cette ROM (${charge}).`, { code: charge });

  const pieds: [Uint8Array | null, Uint8Array | null] = [null, null];
  for (const [i, sauvegarde] of saves.entries()) {
    if (!sauvegarde) continue;
    const { donnees, pied } = separerPiedRtc(sauvegarde);
    pieds[i] = pied;
    const p = m._malloc(donnees.length);
    m.HEAPU8.set(donnees, p);
    const ok = m._mgs_import_save(i, p, donnees.length);
    m._free(p);
    if (ok !== 0) {
      throw echec("coeur-sauvegarde-refusee", `La sauvegarde du joueur ${i + 1} n'a pas été acceptée (${ok}).`, {
        joueur: i + 1,
        code: ok,
      });
    }
  }

  m._mgs_run_frame();
  const largeur = m._mgs_get_video_width(0);
  const hauteur = m._mgs_get_video_height(0);

  /*
   * Le son part tel que le pont le livre, à la fréquence qu'il annonce ; le
   * navigateur rééchantillonne lui-même. Un flux par joueur, vidé à chaque
   * image : le tampon du pont ne tient qu'un huitième de seconde.
   *
   * Le pont d'origine relisait des trames déjà rendues (bug de tenue de
   * livres dans `mgs_get_audio`, corrigé dans notre copie du C) : le flux
   * était 3,5 fois trop long, et s'entendait « aigu, en tuyau ». La trace
   * dans le journal sert à vérifier qu'on reste à ~1 097 trames par image.
   */
  // La fréquence annoncée dépend de la source choisie : sur la source
  // « mélange » (celle du départ), le pont répond un 32 768 Hz figé ; sur un
  // joueur, la vraie fréquence du cœur (65 536 Hz sur GBA).
  m._mgs_set_audio_source(1);
  const frequence = m._mgs_get_audio_rate();
  const reserves: [Int16Array[], Int16Array[]] = [[], []];
  let mesureImages = 0;
  let mesureTrames = 0;

  function vider(joueur: Joueur): Int16Array {
    m._mgs_set_audio_source(joueur + 1);
    const morceaux: Int16Array[] = [];
    for (;;) {
      const p = m._mgs_get_audio();
      const trames = m._mgs_audio_frames();
      if (trames <= 0) break;
      // Stéréo entrelacée : on garde la moyenne des deux voies.
      const stereo = m.HEAP16.subarray(p >> 1, (p >> 1) + trames * 2);
      const mono = new Int16Array(trames);
      for (let i = 0; i < trames; i++) mono[i] = (stereo[2 * i]! + stereo[2 * i + 1]!) >> 1;
      morceaux.push(mono);
      if (trames < 2048) break;
    }
    if (morceaux.length === 1) return morceaux[0]!;
    let total = 0;
    for (const x of morceaux) total += x.length;
    const tout = new Int16Array(total);
    let n = 0;
    for (const x of morceaux) {
      tout.set(x, n);
      n += x.length;
    }
    return tout;
  }

  const moteur: Moteur = {
    ips: IPS_GBA,
    largeur,
    hauteur,
    frequence,
    sonParJoueur: true,
    avancer: (boutons) => {
      m._mgs_set_keys(0, versMgba(boutons[0]));
      m._mgs_set_keys(1, versMgba(boutons[1]));
      m._mgs_run_frame();
      for (const joueur of [0, 1] as const) reserves[joueur].push(vider(joueur));
      if (mesureImages < 60) {
        mesureImages += 1;
        mesureTrames += reserves[0][reserves[0].length - 1]!.length;
        if (mesureImages === 60) {
          // Une fois par session, dans le journal du service.
          console.log(
            `[link] son GBA : ${(mesureTrames / mesureImages).toFixed(0)} trames par image ` +
              `(${(frequence / IPS_GBA).toFixed(0)} attendues à ${frequence} Hz)`,
          );
        }
      }
    },
    image: (joueur) => {
      const p = m._mgs_get_video(joueur);
      const rgba = m.HEAPU8.subarray(p, p + largeur * hauteur * 4);
      const sortie = Buffer.alloc(largeur * hauteur * 2);
      for (let i = 0, o = 0; i < rgba.length; i += 4, o += 2) {
        const v = ((rgba[i]! >> 3) << 11) | ((rgba[i + 1]! >> 2) << 5) | (rgba[i + 2]! >> 3);
        sortie[o] = v & 0xff;
        sortie[o + 1] = v >> 8;
      }
      return sortie;
    },
    prendreSon: (joueur) => {
      const morceaux = reserves[joueur];
      reserves[joueur] = [];
      let total = 0;
      for (const x of morceaux) total += x.length;
      const tout = new Int16Array(total);
      let n = 0;
      for (const x of morceaux) {
        tout.set(x, n);
        n += x.length;
      }
      return tout;
    },
    srams: () =>
      [0, 1].map((joueur) => {
        const taille = m._mgs_export_save(joueur);
        if (!taille) return null;
        const p = m._mgs_save_ptr();
        const donnees = m.HEAPU8.slice(p, p + taille);
        const pied = pieds[joueur as Joueur];
        if (!pied) return donnees;
        const avecPied = new Uint8Array(donnees.length + pied.length);
        avecPied.set(donnees);
        avecPied.set(pied, donnees.length);
        return avecPied;
      }) as [Uint8Array | null, Uint8Array | null],
    // Un bloc par console : chaque GBA a son propre état.
    etat: () => {
      const blocs: Uint8Array[] = [];
      for (const joueur of [0, 1]) {
        const taille = m._mgs_save_state(joueur);
        if (!taille) return null;
        const p = m._mgs_state_ptr();
        blocs.push(m.HEAPU8.slice(p, p + taille));
      }
      return blocs;
    },
    restaurer: (etats) => {
      if (etats.length !== 2) return false;
      for (const [joueur, bloc] of etats.entries()) {
        const p = m._malloc(bloc.length);
        try {
          m.HEAPU8.set(bloc, p);
          if (m._mgs_load_state_bytes(joueur, p, bloc.length) !== 0) return false;
        } finally {
          m._free(p);
        }
      }
      // Les files du câble reviennent avec les états, telles qu'elles étaient
      // en plein échange : laissées là, les jeux se figent ou ratent leur
      // première poignée de main. Le pont demande de remettre les pilotes à
      // zéro une fois tous les états chargés (voir mgs_reset_sio).
      m._mgs_reset_sio();
      return true;
    },
    arreter: () => {
      try {
        m._mgs_quit();
      } catch {
        // Le module est jeté avec le fil de toute façon.
      }
    },
  };
  return moteur;
}
