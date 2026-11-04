import type { Bouton, Emulateur, OptionsDemarrage } from "./adapter";

/**
 * Implémentation de l'adaptateur sur le cœur mGBA compilé en WebAssembly.
 *
 * Le module est chargé depuis `/mgba/mgba.js`, servi par notre domaine : le
 * cœur utilise des threads, donc l'isolation cross-origin, qui interdit de
 * charger le script d'un worker depuis une autre origine. Un CDN ne
 * fonctionnerait pas.
 *
 * Vérifié sur la version 2.6.0 : `.gb`, `.gbc` et `.gba` se chargent tous les
 * trois, le fast forward, les savestates et la lecture de la sauvegarde
 * répondent.
 */

/** Les noms que le cœur attend, pour les boutons comme pour les touches. */
const NOMS_COEUR: Record<Bouton, string> = {
  A: "A",
  B: "B",
  START: "Start",
  SELECT: "Select",
  UP: "Up",
  DOWN: "Down",
  LEFT: "Left",
  RIGHT: "Right",
  L: "L",
  R: "R",
};

type ModuleMgba = {
  FSInit(): Promise<void>;
  FSSync(): Promise<void>;
  filePaths(): { gamePath: string; savePath: string; saveStatePath: string };
  loadGame(romPath: string, savePathOverride?: string): boolean;
  buttonPress(name: string): void;
  buttonUnpress(name: string): void;
  setFastForwardMultiplier(multiplier: number): void;
  getFastForwardMultiplier(): number;
  getSave(): Uint8Array | null;
  saveStateSlot(slot: number, flags?: number): boolean;
  loadStateSlot(slot: number, flags?: number): boolean;
  screenshot(fileName?: string): boolean;
  setVolume(percent: number): void;
  toggleInput(enabled: boolean): void;
  setCoreSettings(reglages: {
    autoSaveStateEnable?: boolean;
    restoreAutoSaveStateOnLoad?: boolean;
  }): void;
  pauseGame(): void;
  resumeGame(): void;
  quickReload(): void;
  quitGame(): void;
  quitMgba(): void;
  addCoreCallbacks(callbacks: Record<string, (() => void) | null>): void;
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
};

/**
 * Efface les fichiers laissés par la convention de nommage précédente.
 *
 * Les ROMs étaient rangées sous le nom du fichier de la bibliothèque — donc
 * `rom.gba` pour **tous** les jeux d'une console. Dans le stockage persistant
 * du navigateur, ils partageaient ainsi une seule sauvegarde : un jeu
 * démarrait sur la partie d'un autre et se bloquait.
 *
 * Ce ménage peut disparaître une fois que plus personne ne traîne ces
 * fichiers — ils ne gênent plus, mais occupent une place considérable.
 */
function menageAncienneConvention(
  module: ModuleMgba,
  chemins: { gamePath: string; savePath: string; saveStatePath: string },
): void {
  const suspects = [
    `${chemins.savePath}/rom.sav`,
    ...[".gb", ".gbc", ".gba"].map((extension) => `${chemins.gamePath}/rom${extension}`),
    ...[1, 2, 3, 4, 5].map((n) => `${chemins.saveStatePath}/rom.ss${n}`),
  ];

  for (const chemin of suspects) {
    try {
      module.FS.unlink(chemin);
    } catch {
      // Le fichier n'existe pas : c'est le cas attendu.
    }
  }
}

export class EmulateurMgba implements Emulateur {
  private module: ModuleMgba | null = null;
  private cheminSauvegarde = "";
  /** Nom de la ROM sans extension : le cœur nomme ses fichiers d'après lui. */
  private nomBase = "";

  readonly capacites = {
    vitesse: true,
    etats: true,
    capture: true,
    // Le câble link existe, mais seulement entre deux consoles émulées dans la
    // même page. Relier deux joueurs distants reste à écrire.
    cableLink: false,
  };

  async demarrer(options: OptionsDemarrage): Promise<void> {
    // Chemin passé par une variable, et non en littéral : il désigne une URL
    // servie à l'exécution, pas un module du projet. En littéral, TypeScript
    // chercherait à le résoudre à la compilation et l'empaqueteur tenterait de
    // l'embarquer — alors que le fichier n'existe que dans `public/`.
    const urlCoeur = "/mgba/mgba.js";
    const { default: mGBA } = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ urlCoeur
    )) as { default: (o: { canvas: HTMLCanvasElement }) => Promise<ModuleMgba> };

    const module = await mGBA({ canvas: options.canvas });
    this.module = module;

    // Monte le système de fichiers virtuel du cœur. À faire avant toute
    // écriture, sinon les dossiers n'existent pas encore.
    await module.FSInit();

    const chemins = module.filePaths();
    this.nomBase = options.rom.nom.replace(/\.[^.]+$/, "");
    const cheminRom = `${chemins.gamePath}/${options.rom.nom}`;
    this.cheminSauvegarde = `${chemins.savePath}/${this.nomBase}.sav`;

    menageAncienneConvention(module, chemins);

    module.FS.writeFile(cheminRom, options.rom.donnees);

    // La sauvegarde du compte est déposée avant le chargement : le cœur la lit
    // à l'ouverture du jeu, et la reprendre après coup demanderait un
    // redémarrage de la partie.
    if (options.sauvegarde && options.sauvegarde.length > 0) {
      module.FS.writeFile(this.cheminSauvegarde, options.sauvegarde);
    }

    /**
     * Le cœur écoute le clavier de son côté, avec ses propres touches par
     * défaut — celles de mGBA sur ordinateur : X pour A, Z pour B, A pour L,
     * S pour R. Elles s'ajoutaient aux nôtres, si bien que X déclenchait A et
     * que notre A déclenchait aussi L.
     *
     * Invisible sur Game Boy, qui n'a pas de gâchettes ; très visible sur
     * Game Boy Advance. On coupe donc son écoute : le lecteur est seul à
     * traduire les touches, et `buttonPress` continue de fonctionner — vérifié.
     */
    module.toggleInput(false);

    /**
     * Le cœur capture un état toutes les trente secondes et le recharge
     * **après chaque chargement ou réinitialisation**, les deux réglages étant
     * actifs par défaut.
     *
     * Conséquence : lancer un jeu reprenait silencieusement là où on l'avait
     * laissé, au lieu de démarrer la console, et « redémarrer la console » ne
     * faisait rien de visible — le cœur réinitialisait bien, puis remettait
     * aussitôt l'état d'avant.
     *
     * On veut l'inverse : démarrer la console, écran-titre compris, et laisser
     * le joueur reprendre où il veut, soit par la sauvegarde du jeu, soit par
     * un point de reprise qu'il choisit. Le site tient d'ailleurs sa propre
     * rotation automatique, côté serveur, et visible.
     */
    module.setCoreSettings({
      autoSaveStateEnable: false,
      restoreAutoSaveStateOnLoad: false,
    });

    if (!module.loadGame(cheminRom, this.cheminSauvegarde)) {
      throw new Error("Le cœur a refusé cette ROM.");
    }

    /**
     * Les rappels s'enregistrent **après** `loadGame`, jamais avant.
     *
     * `addCoreCallbacks` les accroche au cœur en place, et `loadGame` en crée
     * un nouveau sans les reprendre. Enregistrés avant, ils ne se
     * déclenchaient jamais, sans la moindre erreur. Le site n'apprenait donc
     * pas que le jeu avait sauvegardé, et la partie ne remontait qu'en
     * quittant la page. Vérifié dans les sources du cœur (2.6.0,
     * `src/platform/wasm/main.c`).
     */
    module.addCoreCallbacks({
      saveDataUpdatedCallback: options.surSauvegardeModifiee ?? null,
      coreCrashedCallback: options.surPlantage ?? null,
    });
  }

  private exige(): ModuleMgba {
    if (!this.module) throw new Error("Le cœur n'est pas démarré.");
    return this.module;
  }

  /**
   * Arrête la partie sans démonter le module.
   *
   * `quitMgba()` existe et semblerait la suite logique — mais il termine le
   * moteur Emscripten, threads compris, et faire cela pendant que la page vit
   * encore fait planter l'onglet : quitter le lecteur par un lien interne
   * donnait un « cette page n'a pas pu se charger ».
   *
   * Le module est de toute façon détruit avec la page, et quitter le lecteur
   * passe par une vraie navigation. On se contente donc d'arrêter le jeu et
   * le son.
   */
  arreter(): void {
    if (!this.module) return;
    try {
      this.module.setVolume(0);
      this.module.pauseGame();
      this.module.quitGame();
    } catch {
      // Le cœur peut déjà être hors d'état : rien à sauver ici, et une
      // exception empêcherait le démontage propre du composant.
    } finally {
      this.module = null;
    }
  }

  pause(): void {
    this.exige().pauseGame();
  }

  reprendre(): void {
    this.exige().resumeGame();
  }

  reinitialiser(): void {
    // `quickReload` et non un rechargement complet : la sauvegarde en cours
    // reste en place, comme quand on éteint et rallume la console.
    this.exige().quickReload();
  }

  bouton(nom: Bouton, enfonce: boolean): void {
    const module = this.exige();
    if (enfonce) module.buttonPress(NOMS_COEUR[nom]);
    else module.buttonUnpress(NOMS_COEUR[nom]);
  }

  /*
   * `bindKey` du cœur n'est pas utilisé.
   *
   * Vérifié dans le navigateur : `buttonPress` agit bien sur le jeu, mais
   * aucune touche associée par `bindKey` ne déclenche quoi que ce soit — et
   * sans la moindre erreur, la partie démarre normalement. Le cœur écoute le
   * clavier par les rappels HTML5 d'Emscripten, dont la cible et le format de
   * touche attendus ne sont pas documentés.
   *
   * Le lecteur traduit donc lui-même les touches en appels à `bouton()`. Il y
   * gagne de toute façon : il décide quelles touches intercepter pour que les
   * flèches ne fassent pas défiler la page, il raisonne sur `event.code` —
   * donc la même disposition physique sur AZERTY et QWERTY —, et le remappage
   * prend effet sans rien redemander au cœur.
   */

  vitesse(multiplicateur: number): void {
    this.exige().setFastForwardMultiplier(multiplicateur);
  }

  vitesseActuelle(): number {
    return this.module?.getFastForwardMultiplier() ?? 1;
  }

  lireSauvegarde(): Uint8Array | null {
    return this.module?.getSave() ?? null;
  }

  /**
   * Chemin du fichier d'état d'un emplacement, dans le système de fichiers
   * du cœur. Convention relevée à l'exécution : `<nom de la ROM>.ss<n>`.
   */
  private cheminEtat(emplacement: number): string {
    return `${this.exige().filePaths().saveStatePath}/${this.nomBase}.ss${emplacement}`;
  }

  /**
   * `saveStateSlot` et non `saveState`, bien que la documentation du cœur
   * recommande le second et marque le premier comme déprécié.
   *
   * Vérifié sur la version 2.6.0 : `saveState(n)` rend `false` et n'écrit
   * aucun fichier, sans erreur ni message. `saveStateSlot(n)` fonctionne. Même
   * chose pour `loadState` contre `loadStateSlot`. À retester si le cœur est
   * mis à jour.
   */
  ecrireEtat(emplacement: number): Uint8Array | null {
    const module = this.exige();
    if (!module.saveStateSlot(emplacement)) return null;
    try {
      // Le fichier produit est un PNG : mGBA y range l'état de la console
      // *et* l'image de l'écran. Il sert donc aussi de vignette, sans qu'on
      // ait à capturer quoi que ce soit en plus.
      return module.FS.readFile(this.cheminEtat(emplacement));
    } catch {
      return null;
    }
  }

  lireEtat(emplacement: number, donnees: Uint8Array): boolean {
    const module = this.exige();
    try {
      module.FS.writeFile(this.cheminEtat(emplacement), donnees);
    } catch {
      return false;
    }
    return module.loadStateSlot(emplacement);
  }

  volume(pourcentage: number): void {
    this.exige().setVolume(pourcentage);
  }
}
