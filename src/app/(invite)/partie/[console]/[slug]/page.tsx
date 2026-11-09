import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bezels } from "@/db/schema";
import { FournisseurLangue } from "@/components/langue";
import { LecteurInvite } from "@/components/player/lecteur-invite";
import { jeuAccessible } from "@/lib/acces";
import { getCurrentUser } from "@/lib/auth/session";
import { findConsole } from "@/lib/consoles";
import { langueDuCode } from "@/lib/i18n/langues";
import { langueChoisie, langueDeLaRequete } from "@/lib/i18n/serveur";
import { jeuInviteParSlug } from "@/lib/vitrine";

type Params = { console: string; slug: string };

/** Extension du fichier, point compris, ou chaîne vide s'il n'en a pas. */
function extensionDe(chemin: string): string {
  const point = chemin.lastIndexOf(".");
  return point === -1 ? "" : chemin.slice(point).toLowerCase();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { console: consoleSlug, slug } = await params;
  const game = await jeuInviteParSlug(consoleSlug, slug);
  return { title: game ? game.title : undefined };
}

/**
 * Le lecteur d'un invité : un jeu de la vitrine, lancé sans compte.
 *
 * Le pendant de `/jouer/…`, sans rien qui tienne à un compte : pas de
 * dispositions ni d'habillage lus en base, pas de partie comptée. Tout ce que
 * le joueur produit reste dans son navigateur (`LecteurInvite`).
 */
export default async function PartieInvite({ params }: { params: Promise<Params> }) {
  const { console: consoleSlug, slug } = await params;
  const console = findConsole(consoleSlug);
  const game = console ? await jeuInviteParSlug(console.slug, slug) : undefined;
  if (!console || !game) notFound();

  // Un compte connecté a mieux : le même jeu, avec sa partie sur le serveur.
  const user = await getCurrentUser();
  if (user && (await jeuAccessible(user, game.id))) redirect(`/jouer/${console.slug}/${game.slug}`);

  const lignes = await db
    .select()
    .from(bezels)
    .where(eq(bezels.consoleSlug, console.slug))
    .orderBy(asc(bezels.sortOrder))
    .all();

  /*
   * La langue du lecteur : celle que le visiteur a choisie s'il en a choisi
   * une, sinon celle du jeu qu'il lance — un bouton « Play in English » mène
   * à un lecteur en anglais, quel que soit le navigateur —, sinon celle de
   * la requête. Seul le lecteur est concerné : l'en-tête de la page garde la
   * langue du visiteur.
   */
  const langue = (await langueChoisie()) ?? langueDuCode(game.language) ?? (await langueDeLaRequete());

  return (
    <FournisseurLangue langue={langue}>
    <LecteurInvite
      jeu={{
        id: game.id,
        titre: game.title,
        slug: game.slug,
        consoleSlug: console.slug,
        // Propre à ce jeu, comme sur `/jouer/…` : voir le commentaire là-bas.
        fichier: `${game.id}${extensionDe(game.romPath)}`,
        taille: game.romSize,
        empreinte: game.romSha1.slice(0, 16),
        retour: "/",
      }}
      console={{
        nom: console.name,
        largeur: console.screenWidth,
        hauteur: console.screenHeight,
        gachettes: console.hasShoulderButtons,
      }}
      habillages={lignes.map((ligne) => ({
        id: ligne.id,
        nom: ligne.name,
        url: `/api/bezel/${ligne.id}?v=${ligne.hash}`,
        largeur: ligne.width,
        hauteur: ligne.height,
        ecran: { x: ligne.screenX, y: ligne.screenY, largeur: ligne.screenW, hauteur: ligne.screenH },
      }))}
    />
    </FournisseurLangue>
  );
}
