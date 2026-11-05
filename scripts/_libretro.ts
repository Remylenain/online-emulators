/**
 * Retrouver une jaquette dans la collection de vignettes de libretro
 * (thumbnails.libretro.com) sans exiger que la ROM porte, à la lettre, son nom
 * No-Intro du jour.
 *
 * libretro range ses images sous le nom No-Intro courant du jeu :
 * « Donkey Kong (World) (Rev 1) (SGB Enhanced).png ». Une ROM nommée d'après
 * une liste plus ancienne (« (Rev A) », « (UE) »), privée d'une étiquette
 * (« (GB Compatible) ») ou renommée à la main (« Pokemon Rouge ») ne tombe
 * donc jamais sur l'adresse exacte. On lit alors la liste complète du système
 * — une seule demande par console — et on compare les **titres**, étiquettes
 * entre parenthèses mises à part :
 *
 * 1. même titre, aux accents, à la ponctuation, à la casse, aux articles et à
 *    l'ordre des mots près (« The Simpsons… » = « Simpsons, The… »,
 *    « Pokémon Rouge » = « Pokemon - Version Rouge ») ;
 * 2. à défaut, le titre le plus proche, s'il l'est franchement et porte les
 *    mêmes numéros — « Harvest Moon 2 » ne doit pas hériter de la jaquette de
 *    « Harvest Moon 3 » ;
 * 3. à défaut encore, un titre contenu dans l'autre, sous-titre en plus ou en
 *    moins, s'il n'y en a qu'un.
 *
 * Les rapprochements 2 et 3 sont signalés (`approchee`) : le journal les
 * marque d'un « ≈ » pour qu'on puisse les vérifier d'un coup d'œil.
 *
 * Entre plusieurs éditions du même titre, on prend celle dont la région est
 * celle de la ROM, sinon France, Europe, Monde, États-Unis ; les prototypes,
 * démos et copies pirates passent en dernier. Un jeu Game Boy Color absent de
 * sa liste est cherché dans celle de la Game Boy, et inversement : les
 * cartouches noires « compatibles » sont rangées tantôt d'un côté, tantôt de
 * l'autre.
 */

const SYSTEMES: Record<string, string> = {
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  gba: "Nintendo - Game Boy Advance",
};
const VOISINES: Record<string, string[]> = { gb: ["gbc"], gbc: ["gb"], gba: [] };

const base = (consoleSlug: string) =>
  `https://thumbnails.libretro.com/${encodeURIComponent(SYSTEMES[consoleSlug]!)}/Named_Boxarts/`;

/** Mots qui ne distinguent pas deux jeux : articles, liaisons, « Version ». */
const MOTS_VIDES = new Set(["the", "a", "an", "le", "la", "les", "l", "un", "une", "and", "et", "version"]);
const ROMAINS: Record<string, string> = { ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8", ix: "9" };

/** Le titre, sans les étiquettes « (Europe) », « [Raw Dump] » ni l'extension. */
function titreNu(nom: string): string {
  return nom
    .replace(/\.(gb|gbc|gba|png|zip)$/i, "")
    .replace(/\s*[([].*$/, "")
    .trim();
}

function mots(titre: string): string[] {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot && !MOTS_VIDES.has(mot))
    .map((mot) => ROMAINS[mot] ?? mot);
}

const cle = (liste: string[]) => [...liste].sort().join(" ");
const numeros = (liste: string[]) => liste.filter((mot) => /^\d+$/.test(mot)).sort().join(" ");

/** Coefficient de Dice entre deux ensembles de mots : 1 pour deux titres identiques. */
function proximite(a: string[], b: string[]): number {
  const ensembleA = new Set(a);
  const ensembleB = new Set(b);
  if (ensembleA.size === 0 || ensembleB.size === 0) return 0;
  let communs = 0;
  for (const mot of ensembleA) if (ensembleB.has(mot)) communs++;
  return (2 * communs) / (ensembleA.size + ensembleB.size);
}

type Entree = { nom: string; consoleSlug: string; mots: string[]; cle: string };

const listes = new Map<string, Promise<Entree[]>>();

/** La liste des jaquettes d'un système, lue une fois par passage. Vide si libretro ne répond pas. */
function listeDe(consoleSlug: string): Promise<Entree[]> {
  let liste = listes.get(consoleSlug);
  if (!liste) {
    liste = (async () => {
      try {
        const reponse = await fetch(base(consoleSlug), { signal: AbortSignal.timeout(60_000) });
        if (!reponse.ok) return [];
        const page = await reponse.text();
        const entrees: Entree[] = [];
        for (const [, lien] of page.matchAll(/href="([^"?/][^"]*\.png)"/g)) {
          let nom: string;
          try {
            nom = decodeURIComponent(lien!).replace(/&amp;/g, "&").replace(/\.png$/, "");
          } catch {
            continue;
          }
          const liste = mots(titreNu(nom));
          entrees.push({ nom, consoleSlug, mots: liste, cle: cle(liste) });
        }
        return entrees;
      } catch {
        return [];
      }
    })();
    listes.set(consoleSlug, liste);
  }
  return liste;
}

/** Les régions nommées dans les étiquettes d'une ROM, y compris les sigles des anciennes listes. */
function regionsDe(nomRom: string): string[] {
  const etiquettes = (nomRom.match(/\(([^)]*)\)/g) ?? []).join(" ");
  const regions: string[] = [];
  for (const region of ["France", "Europe", "World", "USA", "Japan"]) if (etiquettes.includes(region)) regions.push(region);
  if (/\((F|Fr)\)/.test(etiquettes)) regions.push("France");
  if (/\((E|UE|EU)\)/.test(etiquettes)) regions.push("Europe");
  if (/\((U|UE|EU|JU)\)/.test(etiquettes)) regions.push("USA");
  if (/\((W|JUE)\)/.test(etiquettes)) regions.push("World");
  return regions;
}

/** Plus la note est haute, plus l'édition convient. */
function note(entree: Entree, regions: string[]): number {
  let points = 0;
  for (const region of regions) if (entree.nom.includes(region)) points += 6;
  if (entree.nom.includes("France")) points += 4;
  else if (/\bFr\b/.test(entree.nom)) points += 3;
  if (entree.nom.includes("Europe")) points += 3;
  if (entree.nom.includes("World")) points += 3;
  if (entree.nom.includes("USA")) points += 2;
  if (/\((Beta|Proto|Demo|Sample|Pirate|Unl|Aftermarket)[^)]*\)/.test(entree.nom)) points -= 10;
  return points;
}

function meilleure(candidates: Entree[], regions: string[]): Entree | undefined {
  // À note égale, le nom le plus court : l'édition ordinaire avant ses rééditions.
  return [...candidates].sort((a, b) => note(b, regions) - note(a, regions) || a.nom.length - b.nom.length)[0];
}

export type JaquetteTrouvee = { adresse: string; nom: string; approchee: boolean };

/**
 * L'adresse de la jaquette d'un jeu, ou `null`. `titres` : le titre de la
 * fiche et le nom du fichier ROM, dans l'ordre de confiance.
 */
export async function chercherJaquetteLibretro(
  consoleSlug: string,
  nomRom: string,
  titres: string[],
): Promise<JaquetteTrouvee | null> {
  if (!SYSTEMES[consoleSlug]) return null;
  const regions = regionsDe(nomRom);
  const recherches = [...new Set([titreNu(nomRom), ...titres.map(titreNu)])].map(mots).filter((liste) => liste.length > 0);
  const adresse = (entree: Entree) => `${base(entree.consoleSlug)}${encodeURIComponent(entree.nom)}.png`;

  const consoles = [consoleSlug, ...(VOISINES[consoleSlug] ?? [])];

  // 1. Le même titre, dans la liste de la console puis dans celle de sa voisine.
  for (const console of consoles) {
    const liste = await listeDe(console);
    for (const recherche of recherches) {
      const voulue = cle(recherche);
      const collee = recherche.join("");
      // « Water World » et « Waterworld » : mêmes lettres, découpées autrement.
      const trouvee = meilleure(
        liste.filter((entree) => entree.cle === voulue || entree.mots.join("") === collee),
        regions,
      );
      if (trouvee) return { adresse: adresse(trouvee), nom: trouvee.nom, approchee: false };
    }
  }

  // 2. Le titre le plus proche, s'il l'est franchement et porte les mêmes numéros.
  for (const console of consoles) {
    const liste = await listeDe(console);
    let seuil = 0.8;
    let proches: Entree[] = [];
    for (const recherche of recherches) {
      if (recherche.length < 2) continue; // un seul mot ne suffit pas à rapprocher deux titres
      for (const entree of liste) {
        if (numeros(entree.mots) !== numeros(recherche)) continue;
        const score = proximite(recherche, entree.mots);
        if (score > seuil) {
          seuil = score;
          proches = [entree];
        } else if (score === seuil && proches.length > 0) {
          proches.push(entree);
        }
      }
    }
    // Plusieurs titres différents à égalité : on ne tranche pas au hasard.
    if (proches.length > 0 && new Set(proches.map((entree) => entree.cle)).size === 1) {
      const trouvee = meilleure(proches, regions)!;
      return { adresse: adresse(trouvee), nom: trouvee.nom, approchee: true };
    }
  }

  // 3. Un titre contenu dans l'autre — sous-titre en plus ou en moins :
  //    « Spider-Man - X-Men » et « Spider-Man - X-Men - Arcade's Revenge »,
  //    « Barbie - Shelly Club » et « Shelly Club ». Il faut au moins deux mots
  //    en commun, les mêmes numéros, et un seul titre possible.
  for (const console of consoles) {
    const liste = await listeDe(console);
    let ecart = Infinity;
    let contenus: Entree[] = [];
    for (const recherche of recherches) {
      const voulus = new Set(recherche);
      for (const entree of liste) {
        if (numeros(entree.mots) !== numeros(recherche)) continue;
        const siens = new Set(entree.mots);
        const [petit, grand] = voulus.size <= siens.size ? [voulus, siens] : [siens, voulus];
        if (petit.size < 2 || ![...petit].every((mot) => grand.has(mot))) continue;
        // Un titre de la liste plus court que le nôtre est souvent le jeu de
        // base d'une suite (« Asterix & Obelix » pour « Asterix & Obelix vs
        // Caesar ») : on exige alors qu'il couvre nettement plus de la moitié.
        const couverture = petit.size / grand.size;
        if (couverture < (petit === siens && siens.size < voulus.size ? 0.6 : 0.5)) continue;
        const difference = grand.size - petit.size;
        if (difference < ecart) {
          ecart = difference;
          contenus = [entree];
        } else if (difference === ecart) {
          contenus.push(entree);
        }
      }
    }
    if (contenus.length > 0 && new Set(contenus.map((entree) => entree.cle)).size === 1) {
      const trouvee = meilleure(contenus, regions)!;
      return { adresse: adresse(trouvee), nom: trouvee.nom, approchee: true };
    }
  }
  return null;
}
