import type { Metadata } from "next";
import Link from "next/link";
import { SalonLink } from "@/components/link/salon-link";
import { requireUser } from "@/lib/auth/guard";
import { textes } from "@/lib/i18n/serveur";
import { dispositionsDuCompte } from "@/lib/keymap/lecture";
import { salons } from "@/lib/link/registre";

export async function generateMetadata(): Promise<Metadata> {
  const t = await textes();
  return { title: t.link.titre };
}

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
  const t = await textes();

  if (!salon) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-lg font-semibold text-ink-50">{t.link.page.introuvable.titre}</p>
        <p className="text-sm text-ink-400">{t.link.page.introuvable.explication}</p>
        <Link href="/" className="text-sm text-accent-400 hover:underline">
          {t.link.page.introuvable.retour}
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
        <p className="text-lg font-semibold text-ink-50">{t.link.page.complet.titre}</p>
        <p className="text-sm text-ink-400">
          {/* Une partie en jeu a ses deux joueurs ; le « ? » n'est là que pour le type. */}
          {t.link.page.complet.explication(salon.places[0].pseudo, salon.places[1]?.pseudo ?? "?")}
        </p>
        <Link href={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`} className="text-sm text-accent-400 hover:underline">
          {t.link.retourFiche}
        </Link>
      </div>
    );
  }

  const { touches, manette, manettes } = dispositionsDuCompte(user.id);

  return (
    <SalonLink
      salonId={salon.id}
      consoleSlug={salon.jeu.consoleSlug}
      touches={touches}
      manette={manette}
      manettes={manettes}
      spectateur={spectateur}
      retour={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`}
    />
  );
}
