import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bezelChoices, bezels, keymaps } from "@/db/schema";
import { Lecteur } from "@/components/player/lecteur";
import { requireUser } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { gameBySlug } from "@/lib/catalog";
import { DEFAULT_KEYMAP, findConsole, type ButtonName } from "@/lib/consoles";

type Params = { console: string; slug: string };

/** Extension du fichier, point compris, ou chaîne vide s'il n'en a pas. */
function extensionDe(chemin: string): string {
  const point = chemin.lastIndexOf(".");
  return point === -1 ? "" : chemin.slice(point).toLowerCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { console: consoleSlug, slug } = await params;
  const user = await getCurrentUser();
  const game = user ? await gameBySlug(user, consoleSlug, slug) : undefined;
  return { title: game ? game.title : undefined };
}

export default async function PlayPage({ params }: { params: Promise<Params> }) {
  const user = await requireUser();

  const { console: consoleSlug, slug } = await params;
  const console = findConsole(consoleSlug);
  const game = console ? await gameBySlug(user, console.slug, slug) : undefined;
  if (!console || !game) notFound();

  // La disposition du compte si elle existe, sinon celle par défaut. Lue ici
  // plutôt que dans le navigateur : le lecteur doit pouvoir démarrer avec les
  // bonnes touches dès la première image, sans attendre une requête.
  const enregistree = await db
    .select({ mapping: keymaps.mapping })
    .from(keymaps)
    .where(and(eq(keymaps.userId, user.id), eq(keymaps.consoleSlug, console.slug)))
    .get();

  let touches: Record<ButtonName, string> = DEFAULT_KEYMAP;
  if (enregistree) {
    try {
      touches = { ...DEFAULT_KEYMAP, ...JSON.parse(enregistree.mapping) };
    } catch {
      // Disposition illisible : on repart du défaut plutôt que de bloquer la
      // partie. Elle sera réécrite à la prochaine modification.
    }
  }

  /**
   * Habillages de la console, et celui du compte.
   *
   * Sans choix enregistré, le premier de la liste : l'habillage est une
   * bonne surprise à la première partie, et « Aucun » reste à un clic. Un
   * choix qui ne correspond plus à aucun fichier retombe sur ce défaut.
   */
  const lignes = await db
    .select()
    .from(bezels)
    .where(eq(bezels.consoleSlug, console.slug))
    .orderBy(asc(bezels.sortOrder))
    .all();
  const habillages = lignes.map((ligne) => ({
    id: ligne.id,
    nom: ligne.name,
    url: `/api/bezel/${ligne.id}?v=${ligne.hash}`,
    largeur: ligne.width,
    hauteur: ligne.height,
    ecran: { x: ligne.screenX, y: ligne.screenY, largeur: ligne.screenW, hauteur: ligne.screenH },
  }));

  const choix = await db
    .select({ bezelId: bezelChoices.bezelId })
    .from(bezelChoices)
    .where(and(eq(bezelChoices.userId, user.id), eq(bezelChoices.consoleSlug, console.slug)))
    .get();
  const parDefaut = habillages[0]?.id ?? null;
  const habillageInitial =
    choix === undefined
      ? parDefaut
      : choix.bezelId === null
        ? null
        : habillages.some((h) => h.id === choix.bezelId)
          ? choix.bezelId
          : parDefaut;

  return (
    <Lecteur
      jeu={{
        id: game.id,
        titre: game.title,
        slug: game.slug,
        consoleSlug: console.slug,
        /**
         * Le nom sous lequel le cœur rangera la ROM, sa sauvegarde et ses
         * états — et il doit être **propre à ce jeu**.
         *
         * Dans la bibliothèque, tous les fichiers s'appellent `rom.gba` :
         * reprendre ce nom faisait partager à tous les jeux d'une console le
         * même fichier de sauvegarde dans le stockage persistant du
         * navigateur. Un jeu démarrait alors sur la sauvegarde d'un autre, et
         * se bloquait.
         */
        fichier: `${game.id}${extensionDe(game.romPath)}`,
        taille: game.romSize,
        empreinte: game.romSha1.slice(0, 16),
        retour: `/jeux/${console.slug}/${game.slug}`,
      }}
      console={{
        nom: console.name,
        largeur: console.screenWidth,
        hauteur: console.screenHeight,
        gachettes: console.hasShoulderButtons,
      }}
      touches={touches}
      habillages={habillages}
      habillageInitial={habillageInitial}
    />
  );
}
