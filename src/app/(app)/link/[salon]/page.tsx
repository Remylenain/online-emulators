import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { keymaps } from "@/db/schema";
import { SalonLink } from "@/components/link/salon-link";
import { requireUser } from "@/lib/auth/guard";
import { DEFAULT_KEYMAP, type Touche } from "@/lib/consoles";
import { salons } from "@/lib/link/registre";

export const metadata: Metadata = { title: "Câble link" };

/**
 * La page d'un salon.
 *
 * Elle ne fait qu'habiller le client léger : trouver le salon, lire les
 * touches du compte pour la console du jeu, et rendre. La connexion au salon
 * — et le contrôle de qui peut y entrer — se fait sur la WebSocket.
 */
export default async function SalonPage({ params }: { params: Promise<{ salon: string }> }) {
  const user = await requireUser();
  const { salon: id } = await params;
  const salon = salons().get(id.toUpperCase());

  if (!salon) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-lg font-semibold text-ink-50">Ce salon n&apos;existe plus</p>
        <p className="text-sm text-ink-400">
          Il a été fermé, ou le serveur a redémarré depuis. Les sauvegardes des joueurs n&apos;ont
          pas bougé.
        </p>
        <Link href="/" className="text-sm text-accent-400 hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  // Qui n'a pas de place dans une partie commencée vient la regarder — si
  // l'hôte l'a permis. Dans un salon qui attend encore, on prend la place.
  const joueur = salon.places.some((place) => place?.userId === user.id);
  const spectateur = !joueur && salon.etat === "en-jeu";
  if (spectateur && !salon.spectateurs) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-lg font-semibold text-ink-50">Ce salon est complet</p>
        <p className="text-sm text-ink-400">
          {salon.places[0].pseudo} et {salon.places[1]?.pseudo} jouent, et l&apos;hôte n&apos;a pas ouvert la
          partie aux spectateurs.
        </p>
        <Link href={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`} className="text-sm text-accent-400 hover:underline">
          Retour à la fiche du jeu
        </Link>
      </div>
    );
  }

  const enregistree = await db
    .select({ mapping: keymaps.mapping })
    .from(keymaps)
    .where(and(eq(keymaps.userId, user.id), eq(keymaps.consoleSlug, salon.jeu.consoleSlug)))
    .get();
  let touches: Record<Touche, string> = DEFAULT_KEYMAP;
  if (enregistree) {
    try {
      touches = { ...DEFAULT_KEYMAP, ...JSON.parse(enregistree.mapping) };
    } catch {
      // Disposition illisible : le défaut fera l'affaire.
    }
  }

  return (
    <SalonLink
      salonId={salon.id}
      touches={touches}
      spectateur={spectateur}
      retour={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`}
    />
  );
}
