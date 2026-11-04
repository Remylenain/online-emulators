import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { nomDeFichier } from "@/lib/format";
import { mesSauvegardes, titreComplet } from "@/lib/mes-jeux";
import { lireCopie, lireSauvegarde } from "@/lib/saves";
import { lireEtat } from "@/lib/states";
import { fluxZip, type EntreeZip } from "@/lib/zip";

/**
 * Toutes les sauvegardes du compte connecté, en une archive.
 *
 * C'est la meilleure protection qui soit contre une perte : une copie chez
 * soi, hors du site. L'archive range par console puis par jeu :
 *
 *     gba/Pokemon Emeraude Plus.sav
 *     gba/Pokemon Emeraude Plus/copies/2026-11-03 21h14 (rev 12).sav
 *     gba/Pokemon Emeraude Plus/etat-1.state
 *
 * Les points de reprise automatiques restent dehors : ils tournent sans
 * arrêt, et ne sont utiles que sur le site.
 */
export async function GET() {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Non autorisé", { status: 401 });

  const sauvegardes = await mesSauvegardes(viewer.id);
  const userId = viewer.id;

  async function* entrees(): AsyncGenerator<EntreeZip> {
    for (const s of sauvegardes) {
      const dossier = `${s.jeu.consoleSlug}/${nomDeFichier(titreComplet(s.jeu))}`;

      const courante = await lireSauvegarde(userId, s.jeu.id);
      if (courante) {
        yield { nom: `${dossier}.sav`, donnees: courante.donnees, modifie: courante.modifiee };
      }

      for (const copie of s.copies) {
        const lue = await lireCopie(userId, copie.id);
        if (!lue) continue;
        yield {
          nom: `${dossier}/copies/${horodatage(copie.creeLe)} (rev ${copie.revision}).sav`,
          donnees: lue.donnees,
          modifie: copie.creeLe,
        };
      }

      for (let emplacement = 1; emplacement <= 5; emplacement++) {
        const etat = await lireEtat(userId, s.jeu.id, emplacement, false);
        if (etat) {
          yield { nom: `${dossier}/etat-${emplacement}.state`, donnees: etat, modifie: new Date() };
        }
      }
    }
  }

  const nom = `sauvegardes-${nomDeFichier(viewer.pseudo)}-${horodatage(new Date()).slice(0, 10)}.zip`;
  return new NextResponse(fluxZip(entrees()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** « 2026-11-03 21h14 » : lisible, et trié par ordre chronologique dans un dossier. */
function horodatage(date: Date): string {
  const p = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const v = (type: string) => p.find((x) => x.type === type)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}h${v("minute")}`;
}
