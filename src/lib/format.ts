import { dictionnaire } from "@/lib/i18n/dictionnaires";
import { LANGUE_DE_REFERENCE, REGION, type Langue } from "@/lib/i18n/langues";

/**
 * Mises en forme partagées : dates, durées, tailles, noms de fichiers.
 *
 * Le fuseau est fixé : un composant client rendu d'abord sur le serveur doit
 * produire le même texte des deux côtés, sinon React signale un écart à
 * l'hydratation. Le site est pour des joueurs en France, Paris fait l'affaire.
 *
 * La langue est le dernier paramètre de chaque fonction, et il est
 * facultatif : sans lui, c'est le français, comme avant. Un écran traduit
 * passe la sienne — `await langueDeLaRequete()` côté serveur, `useLangue()`
 * côté navigateur.
 */

const FUSEAU = "Europe/Paris";

export function formatDate(date: Date, avecHeure = true, langue: Langue = LANGUE_DE_REFERENCE): string {
  return new Intl.DateTimeFormat(REGION[langue], {
    dateStyle: "medium",
    ...(avecHeure ? { timeStyle: "short" } : {}),
    timeZone: FUSEAU,
  }).format(date);
}

/** « 3 h 12 min », « 12 min », « moins d'une minute ». */
export function formatDuree(secondes: number, langue: Langue = LANGUE_DE_REFERENCE): string {
  const t = dictionnaire(langue).site.format.duree;
  const minutes = Math.round(secondes / 60);
  if (minutes < 1) return t.moinsDUneMinute;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return t.minutes(reste);
  if (reste === 0) return t.heures(heures);
  return t.heuresEtMinutes(heures, String(reste).padStart(2, "0"));
}

/**
 * Un nombre à décimales fixes, avec le séparateur décimal de la langue et
 * sans séparateur de milliers : celui du français est une espace insécable
 * que tous les moteurs n'écrivent pas de la même façon, ce qui suffirait à
 * créer un écart à l'hydratation.
 */
function decimales(valeur: number, chiffres: number, langue: Langue): string {
  return valeur.toLocaleString(REGION[langue], {
    minimumFractionDigits: chiffres,
    maximumFractionDigits: chiffres,
    useGrouping: false,
  });
}

export function formatTaille(octets: number, langue: Langue = LANGUE_DE_REFERENCE): string {
  const t = dictionnaire(langue).site.format.taille;
  if (octets < 1024) return t.octets(String(octets));
  if (octets < 1048576) return t.kio(decimales(octets / 1024, 0, langue));
  return t.mio(decimales(octets / 1048576, 1, langue));
}

/** La moyenne des notes d'un jeu, à une décimale : « 4,5 » en français, « 4.5 » en anglais. */
export function formatNote(note: number, langue: Langue = LANGUE_DE_REFERENCE): string {
  return decimales(note, 1, langue);
}

/**
 * Nom de fichier tiré d'un titre : sans accents ni caractères que les
 * systèmes de fichiers refusent. « Pokémon Émeraude Plus » devient
 * « Pokemon Emeraude Plus ».
 */
export function nomDeFichier(titre: string): string {
  return (
    titre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w .-]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "sans-titre"
  );
}
