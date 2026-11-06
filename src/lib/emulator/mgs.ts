import type { Bouton, Emulateur, OptionsDemarrage } from "./adapter";

/**
 * Implémentation de l'adaptateur sur mGBA « une console ».
 *
 * C'est le cœur du câble link (`coeurs/mgba-splitscreen`), dans sa variante à
 * une console, compilé **sans threads** : pas de `SharedArrayBuffer`, donc pas
 * d'isolation cross-origin. Il tourne là où le cœur du lecteur ne peut pas —
 * dans l'iframe d'une Activité Discord, notamment. Un seul module couvre GB,
 * GBC et GBA (seuls GB et GBC ont été essayés ici).
 *
 * Ce cœur est nu : il calcule une image quand on le lui demande et rien
 * d'autre. Tout ce que l'autre fait seul est donc ici — le rythme, le dessin,
 * le son, et la surveillance de la sauvegarde.
 */

/** Bits des boutons tels que mGBA les lit. */
const BITS: Record<Bouton, number> = {
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

/**
 * Images par seconde. La Game Boy (4 194 304 Hz / 70 224 cycles) et la GBA
 * (16 777 216 Hz / 280 896 cycles) tombent sur la même valeur.
 */
const IPS = 4194304 / 70224;

/**
 * Fréquence visée pour le son rendu au navigateur. Le cœur produit du
 * 131 072 Hz sur Game Boy et du 65 536 Hz sur GBA : au-delà de ce que Safari
 * accepte dans un tampon audio. On moyenne donc par paquets entiers, ce qui
 * ramène les deux à 32 768 Hz.
 */
const FREQUENCE_CIBLE = 32768;

/** Avance du son sur l'horloge audio : assez pour absorber une image en retard. */
const AVANCE_SON = 0.06;
/** Au-delà, le son accumulé est en retard sur l'image : on jette plutôt que de traîner. */
const RETARD_MAX = 0.2;

/** Toutes les combien d'images on regarde si le jeu a écrit sa sauvegarde. */
const IMAGES_ENTRE_CONTROLES = 90;

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
  _mgs_get_platform(joueur: number): number;
  _mgs_load_save_file(joueur: number, pointeur: number, taille: number): number;
  _mgs_export_save(joueur: number): number;
  _mgs_save_ptr(): number;
  _mgs_save_state(joueur: number): number;
  _mgs_state_ptr(): number;
  _mgs_load_state_bytes(joueur: number, pointeur: number, taille: number): number;
  _mgs_quit(): void;
};

type Fabrique = (options: {
  instantiateWasm: (
    imports: WebAssembly.Imports,
    pret: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ) => object;
  print?: (texte: string) => void;
  printErr?: (texte: string) => void;
}) => Promise<ModuleMgs>;

/**
 * Le cœur est publié en UMD : chargé par une balise `<script>`, il pose sa
 * fabrique dans une variable globale. Un `import()` ne donnerait rien, le
 * fichier n'ayant pas d'export ES.
 */
function chargerFabrique(url: string): Promise<Fabrique> {
  const global = window as unknown as { MgbaUneConsole?: Fabrique };
  if (global.MgbaUneConsole) return Promise.resolve(global.MgbaUneConsole);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (global.MgbaUneConsole) resolve(global.MgbaUneConsole);
      else reject(new Error("Le cœur d'émulation s'est chargé sans se déclarer."));
    };
    script.onerror = () => reject(new Error("Le cœur d'émulation n'a pas pu être téléchargé."));
    document.head.appendChild(script);
  });
}

/** `mgs_get_platform` : 1 pour une Game Boy (ou Color), 0 pour une GBA. */
const PLATEFORME_GB = 1;

/** Taille du pied que mGBA ajoute au `.sav` d'une cartouche Game Boy à horloge. */
const PIED_HORLOGE_GB = 48;

/** Octet 0x147 de l'en-tête : MBC3 avec horloge (et pile), avec ou sans RAM. */
function cartoucheAHorloge(rom: Uint8Array): boolean {
  return rom[0x147] === 0x0f || rom[0x147] === 0x10;
}

/**
 * La sauvegarde d'une partie qui n'a jamais été jouée, pour une cartouche à
 * horloge : la mémoire telle que le cœur la donne, suivie d'un pied d'horloge
 * à zéro daté de maintenant. Sans lui, le cœur n'aurait nulle part où noter
 * l'heure, et l'horloge du jeu repartirait de zéro à chaque lancement.
 */
function sauvegardeVierge(memoire: Uint8Array): Uint8Array {
  const vierge = new Uint8Array(memoire.length + PIED_HORLOGE_GB);
  vierge.set(memoire);
  // Dix registres sur 32 bits, puis l'instant du dernier relevé, sur 64.
  new DataView(vierge.buffer).setBigUint64(memoire.length + 40, BigInt(Math.floor(Date.now() / 1000)), true);
  return vierge;
}

/**
 * La partie de la sauvegarde que le jeu écrit lui-même. mGBA ajoute après
 * elle l'état de l'horloge temps réel (48 octets sur Game Boy, 16 sur GBA),
 * qui change sans que le joueur ait sauvegardé : on ne compare que le reste.
 */
function corpsSauvegarde(sauvegarde: Uint8Array): Uint8Array {
  return sauvegarde.subarray(0, sauvegarde.length - (sauvegarde.length % 1024));
}

function identiques(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class EmulateurMgs implements Emulateur {
  private readonly adresses: { js: string; wasm: string };

  private module: ModuleMgs | null = null;
  private options: OptionsDemarrage | null = null;

  private contexte: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  private largeur = 0;
  private hauteur = 0;

  private masque = 0;
  /** Boutons relâchés avant qu'une image ne les ait vus enfoncés. */
  private relachesDifferes = 0;
  /** Boutons qu'au moins une image a vus enfoncés depuis leur appui. */
  private vus = 0;
  private enPause = false;
  private multiplicateur = 1;
  private animation = 0;
  private dernierInstant = 0;
  /** Images dues et pas encore calculées, fraction comprise. */
  private dette = 0;
  private imagesDepuisControle = 0;
  private derniereSauvegarde: Uint8Array | null = null;

  private audio: AudioContext | null = null;
  private gain: GainNode | null = null;
  private volumeActuel = 1;
  private frequenceCoeur = 0;
  /** Par combien de trames du cœur on en fait une pour le navigateur. */
  private pas = 1;
  /** Trames stéréo sorties du cœur et pas encore rendues (gauche, droite, …). */
  private enAttente: number[] = [];
  private prochainSon = 0;

  readonly capacites = {
    vitesse: true,
    etats: true,
    capture: false,
    cableLink: false,
  };

  constructor(adresses: { js: string; wasm: string }) {
    this.adresses = adresses;
  }

  /**
   * Ouvre la sortie son. À appeler **dans** le geste du joueur — l'appui sur
   * « Jouer » —, avant tout téléchargement : le navigateur ne laisse démarrer
   * le son que depuis un geste, et ne considère plus qu'on y est après une
   * attente. `demarrer` le fait à défaut, mais il arrive alors trop tard sur
   * les navigateurs stricts.
   */
  armerSon(): void {
    if (this.audio) return;
    try {
      this.audio = new AudioContext();
      this.gain = this.audio.createGain();
      this.gain.gain.value = this.volumeActuel;
      this.gain.connect(this.audio.destination);
      void this.audio.resume();
    } catch {
      // Pas de son sur ce navigateur : le jeu reste jouable.
      this.audio = null;
    }
  }

  async demarrer(options: OptionsDemarrage): Promise<void> {
    this.options = options;
    this.armerSon();

    const fabrique = await chargerFabrique(this.adresses.js);
    const urlWasm = this.adresses.wasm;
    const module = await fabrique({
      // Ce build ignore `wasmBinary` et `locateFile` ne connaît pas notre
      // adresse versionnée : on instancie nous-mêmes.
      instantiateWasm: (imports, pret) => {
        fetch(urlWasm)
          .then((reponse) => {
            if (!reponse.ok) throw new Error(`Cœur indisponible (${reponse.status}).`);
            return reponse.arrayBuffer();
          })
          .then((octets) => WebAssembly.instantiate(octets, imports))
          .then((resultat) => pret(resultat.instance, resultat.module))
          .catch((erreur: unknown) => {
            console.error("[mgs]", erreur);
            options.surPlantage?.();
          });
        return {};
      },
      print: () => {},
      printErr: () => {},
    });
    this.module = module;

    this.inserer(module, options);

    module._mgs_run_frame();
    this.largeur = module._mgs_get_video_width(0);
    this.hauteur = module._mgs_get_video_height(0);
    options.canvas.width = this.largeur;
    options.canvas.height = this.hauteur;
    this.contexte = options.canvas.getContext("2d");
    this.image = new ImageData(this.largeur, this.hauteur);

    // Sur la source « mélange » du départ, le cœur annonce une fréquence
    // figée et fausse ; sur un joueur, la vraie.
    module._mgs_set_audio_source(1);
    this.frequenceCoeur = module._mgs_get_audio_rate();
    this.pas = Math.max(1, Math.round(this.frequenceCoeur / FREQUENCE_CIBLE));
    this.viderSon(false);

    this.derniereSauvegarde = this.lireSauvegarde();
    this.dessiner();

    this.dernierInstant = performance.now();
    this.animation = requestAnimationFrame(this.boucle);
  }

  /** Met la cartouche dans la console : la ROM, puis la sauvegarde s'il y en a une. */
  private inserer(module: ModuleMgs, options: OptionsDemarrage): void {
    module._mgs_init(1);

    // La ROM reste allouée : le cœur garde son adresse.
    const pRom = module._malloc(options.rom.donnees.length);
    module.HEAPU8.set(options.rom.donnees, pRom);
    const charge = module._mgs_load_rom(pRom, options.rom.donnees.length);
    if (charge !== 0) throw new Error(`Le cœur a refusé ce jeu (${charge}).`);

    let sauvegarde = this.derniereSauvegarde ?? options.sauvegarde ?? null;
    if (
      (!sauvegarde || sauvegarde.length === 0) &&
      module._mgs_get_platform(0) === PLATEFORME_GB &&
      cartoucheAHorloge(options.rom.donnees)
    ) {
      const memoire = this.lireSauvegarde();
      if (memoire) sauvegarde = sauvegardeVierge(memoire);
    }
    if (sauvegarde && sauvegarde.length > 0) {
      // Chargée comme un fichier, et non copiée en mémoire : c'est ce qui
      // fait lire au cœur le pied d'horloge, et le lui fait tenir à jour.
      const p = module._malloc(sauvegarde.length);
      module.HEAPU8.set(sauvegarde, p);
      const accepte = module._mgs_load_save_file(0, p, sauvegarde.length);
      module._free(p);
      if (accepte !== 0) throw new Error(`La sauvegarde n'a pas été acceptée (${accepte}).`);
    }
  }

  /**
   * Une passe par rafraîchissement de l'écran. On ne calcule pas « une image
   * par passe » : l'écran du joueur bat à 60, 90 ou 120 Hz, la console à
   * 59,73. On compte donc le temps écoulé en images de console, et on calcule
   * celles qui sont dues.
   */
  private boucle = (instant: number): void => {
    this.animation = requestAnimationFrame(this.boucle);
    const module = this.module;
    if (!module) return;

    // Onglet masqué, fenêtre réduite : au retour, on ne rattrape pas le temps
    // perdu, le jeu reprend où il était.
    const ecoule = Math.min(instant - this.dernierInstant, 100);
    this.dernierInstant = instant;
    if (this.enPause) return;

    this.dette += (ecoule * IPS * this.multiplicateur) / 1000;
    const plafond = Math.ceil(this.multiplicateur) * 2 + 1;
    let calculees = 0;
    while (this.dette >= 1 && calculees < plafond) {
      module._mgs_set_keys(0, this.masque);
      module._mgs_run_frame();
      this.vus |= this.masque;
      this.masque &= ~this.relachesDifferes;
      this.relachesDifferes = 0;
      this.viderSon(this.multiplicateur === 1);
      this.dette -= 1;
      calculees += 1;
    }
    // Machine trop lente pour suivre : on renonce au retard plutôt que de
    // l'empiler.
    if (this.dette > plafond) this.dette = 0;
    if (calculees === 0) return;

    this.dessiner();
    this.jouerSon();

    this.imagesDepuisControle += calculees;
    if (this.imagesDepuisControle >= IMAGES_ENTRE_CONTROLES) {
      this.imagesDepuisControle = 0;
      this.controlerSauvegarde();
    }
  };

  private dessiner(): void {
    const module = this.module;
    if (!module || !this.contexte || !this.image) return;
    const p = module._mgs_get_video(0);
    this.image.data.set(module.HEAPU8.subarray(p, p + this.largeur * this.hauteur * 4));
    this.contexte.putImageData(this.image, 0, 0);
  }

  /** Sort du cœur le son de l'image qui vient d'être calculée. */
  private viderSon(garder: boolean): void {
    const module = this.module;
    if (!module) return;
    for (;;) {
      const p = module._mgs_get_audio();
      const trames = module._mgs_audio_frames();
      if (trames <= 0) break;
      if (garder && this.audio) {
        const stereo = module.HEAP16.subarray(p >> 1, (p >> 1) + trames * 2);
        for (let i = 0; i < stereo.length; i++) this.enAttente.push(stereo[i]!);
      }
      if (trames < 2048) break;
    }
  }

  /** Programme sur l'horloge audio le son accumulé pendant cette passe. */
  private jouerSon(): void {
    const audio = this.audio;
    if (!audio || !this.gain) return;
    const pas = this.pas;
    const sorties = Math.floor(this.enAttente.length / (2 * pas));
    if (sorties === 0) return;
    if (audio.state !== "running") {
      // Son pas encore autorisé ou contexte suspendu : rien ne s'accumule.
      this.enAttente.length = 0;
      return;
    }

    const tampon = audio.createBuffer(2, sorties, this.frequenceCoeur / pas);
    const gauche = tampon.getChannelData(0);
    const droite = tampon.getChannelData(1);
    const diviseur = pas * 32768;
    for (let s = 0, i = 0; s < sorties; s++) {
      let g = 0;
      let d = 0;
      for (let k = 0; k < pas; k++, i += 2) {
        g += this.enAttente[i]!;
        d += this.enAttente[i + 1]!;
      }
      gauche[s] = g / diviseur;
      droite[s] = d / diviseur;
    }
    this.enAttente.splice(0, sorties * 2 * pas);

    const maintenant = audio.currentTime;
    if (this.prochainSon < maintenant) this.prochainSon = maintenant + AVANCE_SON;
    if (this.prochainSon > maintenant + RETARD_MAX) return;
    const source = audio.createBufferSource();
    source.buffer = tampon;
    source.connect(this.gain);
    source.start(this.prochainSon);
    this.prochainSon += tampon.duration;
  }

  /**
   * Le cœur ne prévient pas quand le jeu sauvegarde : on relit la mémoire de
   * sauvegarde de temps en temps et on la compare à la précédente. Une
   * mémoire qui apparaît compte aussi — sur GBA, mGBA ne découvre le type de
   * sauvegarde qu'à la première écriture du jeu.
   */
  private controlerSauvegarde(): void {
    const actuelle = this.lireSauvegarde();
    if (!actuelle) return;
    const precedente = this.derniereSauvegarde;
    this.derniereSauvegarde = actuelle;
    if (!precedente || !identiques(corpsSauvegarde(precedente), corpsSauvegarde(actuelle))) {
      this.options?.surSauvegardeModifiee?.();
    }
  }

  arreter(): void {
    cancelAnimationFrame(this.animation);
    void this.audio?.close().catch(() => {});
    this.audio = null;
    this.gain = null;
    try {
      this.module?._mgs_quit();
    } catch {
      // Le module est jeté avec la page de toute façon.
    }
    this.module = null;
  }

  pause(): void {
    this.enPause = true;
    void this.audio?.suspend().catch(() => {});
  }

  reprendre(): void {
    this.enPause = false;
    this.dette = 0;
    void this.audio?.resume().catch(() => {});
  }

  /**
   * Éteindre et rallumer la console : le cœur n'a pas de bouton « reset », on
   * retire donc la cartouche et on la remet, avec la sauvegarde telle qu'elle
   * est à cet instant.
   */
  reinitialiser(): void {
    const module = this.module;
    if (!module || !this.options) return;
    this.derniereSauvegarde = this.lireSauvegarde() ?? this.derniereSauvegarde;
    module._mgs_quit();
    this.inserer(module, this.options);
    module._mgs_set_audio_source(1);
    this.enAttente.length = 0;
    this.dette = 0;
  }

  /**
   * La console lit ses boutons une fois par image. Un appui plus bref qu'une
   * image — un tapotement vif, une touche à peine effleurée — serait relâché
   * avant d'avoir été lu : on le garde alors enfoncé jusqu'à l'image suivante.
   */
  bouton(nom: Bouton, enfonce: boolean): void {
    const bit = BITS[nom];
    if (enfonce) {
      this.masque |= bit;
      this.vus &= ~bit;
      this.relachesDifferes &= ~bit;
    } else if (this.vus & bit) {
      this.masque &= ~bit;
    } else {
      this.relachesDifferes |= bit;
    }
  }

  vitesse(multiplicateur: number): void {
    this.multiplicateur = Math.max(1, multiplicateur);
    // En accéléré, le son n'a pas de sens : on repart d'une file vide.
    this.enAttente.length = 0;
  }

  vitesseActuelle(): number {
    return this.multiplicateur;
  }

  lireSauvegarde(): Uint8Array | null {
    const module = this.module;
    if (!module) return null;
    const taille = module._mgs_export_save(0);
    if (!taille) return null;
    const p = module._mgs_save_ptr();
    return module.HEAPU8.slice(p, p + taille);
  }

  /**
   * Le cœur n'a pas d'emplacements : il rend l'état, à l'appelant de le
   * ranger. Le numéro ne sert donc à rien ici.
   */
  ecrireEtat(): Uint8Array | null {
    const module = this.module;
    if (!module) return null;
    const taille = module._mgs_save_state(0);
    if (!taille) return null;
    const p = module._mgs_state_ptr();
    return module.HEAPU8.slice(p, p + taille);
  }

  lireEtat(_emplacement: number, donnees: Uint8Array): boolean {
    const module = this.module;
    if (!module) return false;
    const p = module._malloc(donnees.length);
    try {
      module.HEAPU8.set(donnees, p);
      return module._mgs_load_state_bytes(0, p, donnees.length) === 0;
    } finally {
      module._free(p);
    }
  }

  volume(pourcentage: number): void {
    this.volumeActuel = Math.min(1, Math.max(0, pourcentage / 100));
    if (this.gain) this.gain.gain.value = this.volumeActuel;
  }
}
