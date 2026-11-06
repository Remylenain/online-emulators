/**
 * Moteur libretro minimal, piloté image par image.
 *
 * Un cœur libretro ne fait rien seul : on lui fournit l'image, le son, les
 * boutons et le rythme. Ce module s'en tient au strict nécessaire, et laisse
 * le rythme à l'appelant : `image(boutons)` avance d'une image avec les
 * boutons de chaque joueur. C'est ce que demandera le câble link en ligne,
 * où deux navigateurs doivent calculer exactement la même image à partir
 * des mêmes boutons.
 *
 * Utilisé par le banc d'essai du câble link (TGB Dual, deux Game Boy reliées
 * dans un seul cœur).
 */

/** Bits des boutons dans l'API libretro (RETRO_DEVICE_ID_JOYPAD_*). */
export const BOUTONS_LIBRETRO = {
  B: 1 << 0,
  SELECT: 1 << 2,
  START: 1 << 3,
  UP: 1 << 4,
  DOWN: 1 << 5,
  LEFT: 1 << 6,
  RIGHT: 1 << 7,
  A: 1 << 8,
  L: 1 << 10,
  R: 1 << 11,
} as const;

// Commandes d'environnement libretro (voir libretro.h).
const ENV_GET_CAN_DUPE = 3;
const ENV_SET_PIXEL_FORMAT = 10;
const ENV_GET_VARIABLE = 15;
const ENV_GET_VARIABLE_UPDATE = 17;
const ENV_SET_GEOMETRY = 37;
const ENV_GET_INPUT_BITMASKS = 51 | 0x10000;

const FORMAT_XRGB8888 = 1;
const FORMAT_RGB565 = 2;

const DEVICE_JOYPAD = 1;
const ID_MASQUE = 256;

type ModuleLibretro = {
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU32: Uint32Array;
  addFunction(fonction: (...args: number[]) => number | void, signature: string): number;
  _malloc(taille: number): number;
  _free(pointeur: number): void;
  _retro_init(): void;
  _retro_deinit(): void;
  _retro_set_environment(rappel: number): void;
  _retro_set_video_refresh(rappel: number): void;
  _retro_set_audio_sample(rappel: number): void;
  _retro_set_audio_sample_batch(rappel: number): void;
  _retro_set_input_poll(rappel: number): void;
  _retro_set_input_state(rappel: number): void;
  _retro_get_system_av_info(pointeur: number): void;
  _retro_load_game(pointeur: number): number;
  _retro_load_game_special?(type: number, pointeur: number, nombre: number): number;
  _retro_unload_game(): void;
  _retro_run(): void;
  _retro_reset(): void;
  _retro_serialize_size(): number;
  _retro_serialize(pointeur: number, taille: number): number;
  _retro_unserialize(pointeur: number, taille: number): number;
  _retro_get_memory_data(id: number): number;
  _retro_get_memory_size(id: number): number;
};

export type Jeu = { nom: string; donnees: Uint8Array };

export class CoeurLibretro {
  private module: ModuleLibretro | null = null;
  private formatPixels = FORMAT_XRGB8888;
  private boutons: number[] = [0, 0, 0, 0];
  private chaines = new Map<string, number>();

  /** Dernière image produite, en RVBA. */
  image: ImageData | null = null;
  /** Son produit depuis le dernier `prendreSon()`, stéréo entrelacé. */
  private son: Int16Array[] = [];

  ips = 60;
  frequence = 44100;

  private readonly urlModule: string;
  /** Options fixées par le site (clé → valeur), lues par le cœur au démarrage. */
  private readonly options: Record<string, string>;
  /**
   * Le `.wasm` déjà lu, pour les environnements sans `fetch` de fichiers.
   *
   * Le cœur est compilé pour le navigateur, où il va chercher son `.wasm`
   * lui-même. Sous Node — le serveur du câble link —, on le lui donne en
   * mémoire et il n'a plus rien à chercher : c'est ce qui permet de servir
   * le même fichier des deux côtés sans le recompiler.
   */
  private readonly wasm: Uint8Array | undefined;

  /*
   * Des champs déclarés puis affectés, et non des propriétés de paramètre
   * (`constructor(private x)`) : Node exécute ce fichier tel quel côté
   * serveur, en ne faisant que retirer les types, et cette tournure-là lui
   * demanderait une vraie transformation.
   */
  constructor(urlModule: string, options: Record<string, string> = {}, wasm?: Uint8Array) {
    this.urlModule = urlModule;
    this.options = options;
    this.wasm = wasm;
  }

  async charger(jeux: Jeu[], typeSpecial?: number): Promise<void> {
    const url = this.urlModule;
    const { default: creer } = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ url
    )) as {
      default: (options: {
        locateFile?: (fichier: string, prefixe: string) => string;
        wasmBinary?: Uint8Array;
        print?: (texte: string) => void;
        printErr?: (texte: string) => void;
      }) => Promise<ModuleLibretro>;
    };

    let module: ModuleLibretro;
    if (this.wasm) {
      module = await creer({ wasmBinary: this.wasm, print: () => {}, printErr: () => {} });
    } else {
      // Le `.wasm` est cherché à côté du `.js`, avec la même version dans
      // l'adresse. Sans elle, le navigateur resservait un ancien cœur en cache
      // (la version qui figeait l'image), sans la moindre erreur.
      const version = new URL(url, window.location.href).search;
      module = await creer({
        locateFile: (fichier: string, prefixe: string) => `${prefixe}${fichier}${version}`,
      });
    }
    this.module = module;
    this.brancherRappels(module);
    module._retro_init();

    // struct retro_game_info { path; data; size; meta; } — 16 octets chacune.
    const pInfos = module._malloc(16 * jeux.length);
    jeux.forEach((jeu, i) => {
      const pNom = this.chaineC(jeu.nom);
      const pDonnees = module._malloc(jeu.donnees.length);
      module.HEAPU8.set(jeu.donnees, pDonnees);
      // La ROM et son nom restent alloués : le cœur garde leurs adresses.
      module.HEAPU32.set([pNom, pDonnees, jeu.donnees.length, 0], (pInfos >> 2) + i * 4);
    });

    const charge =
      typeSpecial !== undefined
        ? module._retro_load_game_special?.(typeSpecial, pInfos, jeux.length)
        : module._retro_load_game(pInfos);
    module._free(pInfos);
    if (!charge) throw new Error("Le cœur a refusé ce jeu.");

    this.lireCadence();
  }

  private exige(): ModuleLibretro {
    if (!this.module) throw new Error("Le cœur n'est pas démarré.");
    return this.module;
  }

  private chaineC(texte: string): number {
    const connue = this.chaines.get(texte);
    if (connue) return connue;
    const module = this.exige();
    const octets = new TextEncoder().encode(`${texte}\0`);
    const pointeur = module._malloc(octets.length);
    module.HEAPU8.set(octets, pointeur);
    this.chaines.set(texte, pointeur);
    return pointeur;
  }

  private brancherRappels(module: ModuleLibretro): void {
    const environnement = module.addFunction((commande: number, donnees: number) => {
      switch (commande) {
        case ENV_GET_CAN_DUPE:
          module.HEAPU8[donnees] = 1;
          return 1;
        case ENV_SET_PIXEL_FORMAT: {
          const format = module.HEAPU32[donnees >> 2]!;
          if (format !== FORMAT_XRGB8888 && format !== FORMAT_RGB565) return 0;
          this.formatPixels = format;
          return 1;
        }
        case ENV_GET_VARIABLE: {
          const cle = lireChaine(module.HEAPU8, module.HEAPU32[donnees >> 2]!);
          const valeur = this.options[cle];
          if (valeur === undefined) return 0;
          module.HEAPU32[(donnees >> 2) + 1] = this.chaineC(valeur);
          return 1;
        }
        case ENV_GET_VARIABLE_UPDATE:
          module.HEAPU8[donnees] = 0;
          return 1;
        case ENV_SET_GEOMETRY:
        case ENV_GET_INPUT_BITMASKS:
          return 1;
        default:
          return 0;
      }
    }, "iii");

    const video = module.addFunction(
      (pointeur: number, largeur: number, hauteur: number, pas: number) => {
        if (pointeur) this.convertirImage(pointeur, largeur, hauteur, pas);
      },
      "viiii",
    );
    const echantillon = module.addFunction((gauche: number, droite: number) => {
      this.son.push(Int16Array.of(gauche, droite));
    }, "vii");
    const lot = module.addFunction((pointeur: number, trames: number) => {
      this.son.push(module.HEAP16.slice(pointeur >> 1, (pointeur >> 1) + trames * 2));
      return trames;
    }, "iii");
    const sondage = module.addFunction(() => {}, "v");
    const etatBouton = module.addFunction(
      (port: number, appareil: number, _index: number, id: number) => {
        if (appareil !== DEVICE_JOYPAD) return 0;
        const masque = this.boutons[port] ?? 0;
        return id === ID_MASQUE ? masque : (masque >> id) & 1;
      },
      "iiiii",
    );

    module._retro_set_environment(environnement);
    module._retro_set_video_refresh(video);
    module._retro_set_audio_sample(echantillon);
    module._retro_set_audio_sample_batch(lot);
    module._retro_set_input_poll(sondage);
    module._retro_set_input_state(etatBouton);
  }

  private lireCadence(): void {
    const module = this.exige();
    // struct retro_system_av_info : géométrie (5 × 4 octets + 4 de
    // remplissage), puis fps et sample_rate en double précision.
    const p = module._malloc(40);
    module._retro_get_system_av_info(p);
    const vue = new DataView(module.HEAPU8.buffer, p, 40);
    this.ips = vue.getFloat64(24, true) || 60;
    this.frequence = vue.getFloat64(32, true) || 44100;
    module._free(p);
  }

  private convertirImage(pointeur: number, largeur: number, hauteur: number, pas: number): void {
    if (!this.image || this.image.width !== largeur || this.image.height !== hauteur) {
      // `ImageData` n'existe pas sous Node : un objet de même forme suffit au
      // serveur, qui ne dessine pas mais relit `data`, `width` et `height`.
      this.image =
        typeof ImageData === "function"
          ? new ImageData(largeur, hauteur)
          : ({
              width: largeur,
              height: hauteur,
              data: new Uint8ClampedArray(largeur * hauteur * 4),
              colorSpace: "srgb",
            } as ImageData);
    }
    const sortie = this.image.data;
    const tas = this.exige().HEAPU8;
    for (let y = 0; y < hauteur; y++) {
      const ligne = pointeur + y * pas;
      for (let x = 0; x < largeur; x++) {
        const o = (y * largeur + x) * 4;
        if (this.formatPixels === FORMAT_XRGB8888) {
          const i = ligne + x * 4;
          sortie[o] = tas[i + 2]!;
          sortie[o + 1] = tas[i + 1]!;
          sortie[o + 2] = tas[i]!;
        } else {
          const i = ligne + x * 2;
          const p = tas[i]! | (tas[i + 1]! << 8);
          sortie[o] = ((p >> 11) & 0x1f) << 3;
          sortie[o + 1] = ((p >> 5) & 0x3f) << 2;
          sortie[o + 2] = (p & 0x1f) << 3;
        }
        sortie[o + 3] = 255;
      }
    }
  }

  /** Avance d'une image, avec les boutons de chaque joueur (un masque par port). */
  avancer(boutons: number[]): void {
    this.boutons = boutons;
    this.exige()._retro_run();
  }

  /** Rend le son accumulé depuis l'appel précédent. */
  prendreSon(): Int16Array[] {
    const son = this.son;
    this.son = [];
    return son;
  }

  reinitialiser(): void {
    this.exige()._retro_reset();
  }

  lireMemoire(id: number): Uint8Array | null {
    const module = this.exige();
    const taille = module._retro_get_memory_size(id);
    const pointeur = module._retro_get_memory_data(id);
    if (!taille || !pointeur) return null;
    return module.HEAPU8.slice(pointeur, pointeur + taille);
  }

  /** Dépose des octets dans une mémoire du cœur (SRAM…). Rend faux si elle n'existe pas. */
  ecrireMemoire(id: number, donnees: Uint8Array): boolean {
    const module = this.exige();
    const taille = module._retro_get_memory_size(id);
    const pointeur = module._retro_get_memory_data(id);
    if (!taille || !pointeur) return false;
    module.HEAPU8.set(donnees.subarray(0, taille), pointeur);
    return true;
  }

  /** État complet du cœur : sert aux points de reprise, et à comparer deux navigateurs. */
  etat(): Uint8Array | null {
    const module = this.exige();
    const taille = module._retro_serialize_size();
    if (!taille) return null;
    const p = module._malloc(taille);
    try {
      return module._retro_serialize(p, taille) ? module.HEAPU8.slice(p, p + taille) : null;
    } finally {
      module._free(p);
    }
  }

  /** Remet le cœur dans un état rendu par `etat()`. Faux si le cœur le refuse. */
  restaurerEtat(donnees: Uint8Array): boolean {
    const module = this.exige();
    const p = module._malloc(donnees.length);
    try {
      module.HEAPU8.set(donnees, p);
      return Boolean(module._retro_unserialize(p, donnees.length));
    } finally {
      module._free(p);
    }
  }

  arreter(): void {
    try {
      this.module?._retro_unload_game();
      this.module?._retro_deinit();
    } catch {
      // Le module est jeté avec la page de toute façon.
    }
    this.module = null;
  }
}

function lireChaine(tas: Uint8Array, pointeur: number): string {
  let fin = pointeur;
  while (tas[fin] !== 0) fin++;
  return new TextDecoder().decode(tas.subarray(pointeur, fin));
}
