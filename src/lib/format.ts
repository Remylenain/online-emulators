/**
 * Mises en forme partagées : dates, durées, tailles, noms de fichiers.
 *
 * Le fuseau est fixé : un composant client rendu d'abord sur le serveur doit
 * produire le même texte des deux côtés, sinon React signale un écart à
 * l'hydratation. Le site est pour des joueurs en France, Paris fait l'affaire.
 */

const FUSEAU = "Europe/Paris";

export function formatDate(date: Date, avecHeure = true): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    ...(avecHeure ? { timeStyle: "short" } : {}),
    timeZone: FUSEAU,
  }).format(date);
}

/** « 3 h 12 min », « 12 min », « moins d'une minute ». */
export function formatDuree(secondes: number): string {
  const minutes = Math.round(secondes / 60);
  if (minutes < 1) return "moins d'une minute";
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return `${reste} min`;
  if (reste === 0) return `${heures} h`;
  return `${heures} h ${String(reste).padStart(2, "0")}`;
}

export function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1048576) return `${(octets / 1024).toFixed(0)} Kio`;
  return `${(octets / 1048576).toFixed(1)} Mio`;
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
