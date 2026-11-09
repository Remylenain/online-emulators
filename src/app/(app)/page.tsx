import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { GameGrid } from "@/components/game-grid";
import { requireUser } from "@/lib/auth/guard";
import { countByConsole, favorisDe, latestGames, recentlyPlayed } from "@/lib/catalog";
import { nomDeLangue } from "@/lib/catalog-options";
import { CONSOLES } from "@/lib/consoles";
import { jeuAccessible } from "@/lib/acces";
import type { SessionUser } from "@/lib/auth/session";
import { formatDate, formatDuree } from "@/lib/format";
import type { Dictionnaire } from "@/lib/i18n/dictionnaires";
import type { Langue } from "@/lib/i18n/langues";
import { langueDeLaRequete, textes } from "@/lib/i18n/serveur";
import { salonDuCompte, salons, salonsRegardables } from "@/lib/link/registre";
import type { TitrePartie } from "@/lib/jeu-resume";
import { partieEnCours, titreComplet, type PartieEnCours } from "@/lib/mes-jeux";
import { quiJoue, type Presence } from "@/lib/presence";

type Textes = Dictionnaire["catalogue"];

/**
 * L'accueil : d'abord la partie en cours, parce que c'est pour elle qu'on
 * revient ; puis les salons où un ami attend ; puis le catalogue.
 */
export default async function HomePage() {
  const user = await requireUser();
  const langue = await langueDeLaRequete();
  const tout = await textes();
  const catalogue = tout.catalogue;
  const t = catalogue.accueil;
  const [enCours, presents, favoris, latest, recent, parConsole] = await Promise.all([
    partieEnCours(user),
    quiJoue(user),
    favorisDe(user, 10),
    latestGames(user, 8, langue),
    recentlyPlayed(user, 9),
    countByConsole(user, langue),
  ]);

  // Le jeu en tête n'a pas à réapparaître juste dessous.
  const recentsSansEnCours = recent.filter((jeu) => jeu.id !== enCours?.jeu.id).slice(0, 8);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold text-ink-50">{t.salut(user.pseudo)}</h1>
        {enCours ? (
          <Reprendre partie={enCours} catalogue={catalogue} titrePartie={tout.mesJeux.titrePartie} langue={langue} />
        ) : (
          <p className="rounded-panel border border-dashed border-ink-800 px-5 py-8 text-center text-sm text-ink-400">
            {t.aucunePartie}
          </p>
        )}
      </section>

      <EnCeMoment presents={presents} t={t.enCeMoment} />

      <Salons moi={user} t={t.salons} langue={langue} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink-50">{t.consoles}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CONSOLES.map((console) => (
            <Link
              key={console.slug}
              href={`/consoles/${console.slug}`}
              className="flex items-baseline justify-between rounded-panel border border-ink-800 bg-ink-900/60 px-5 py-4 transition-colors hover:border-accent-600/60"
            >
              <span className="text-sm font-semibold text-ink-50">{console.name}</span>
              <span className="text-xs text-ink-400">{catalogue.nombreDeJeux(parConsole[console.slug] ?? 0)}</span>
            </Link>
          ))}
        </div>
      </section>

      {favoris.length > 0 && <Section title={t.favoris} games={favoris} />}

      {recentsSansEnCours.length > 0 && <Section title={t.recents} games={recentsSansEnCours} />}

      <Section
        title={t.nouveautes}
        empty={t.aucuneNouveaute(nomDeLangue(langue, langue))}
        games={latest}
      />
    </div>
  );
}

/**
 * Pose des éléments dans une phrase du dictionnaire, à la place de ses
 * repères entre accolades : « {joueur} joue à {jeu} ». La phrase reste
 * entière dans le dictionnaire, dans l'ordre des mots de sa langue ; le
 * pseudo en gras et le lien vers le jeu sont posés ici. Ce qu'on y pose
 * n'est jamais relu : un titre de jeu peut contenir des accolades.
 */
function Phrase({ texte, elements }: { texte: string; elements: Record<string, ReactNode> }) {
  return (
    <>
      {texte.split(/\{(\w+)\}/).map((morceau, rang) => (
        <Fragment key={rang}>{rang % 2 === 1 ? elements[morceau] : morceau}</Fragment>
      ))}
    </>
  );
}

/**
 * Le dernier jeu ouvert, en grand : jaquette, temps passé, dernière partie,
 * date de la sauvegarde, et le bouton pour y retourner.
 */
function Reprendre({
  partie,
  catalogue,
  titrePartie,
  langue,
}: {
  partie: PartieEnCours;
  catalogue: Textes;
  /** Le « · partie 3 » d'un jeu en plusieurs morceaux, dans la langue du visiteur. */
  titrePartie: TitrePartie;
  langue: Langue;
}) {
  const t = catalogue.accueil.reprendre;
  const { jeu, stats } = partie;
  const console = CONSOLES.find((c) => c.slug === jeu.consoleSlug);

  return (
    <div className="flex flex-col gap-5 rounded-panel border border-ink-800 bg-ink-900/60 p-5 sm:flex-row sm:items-center">
      <Link href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`} className="shrink-0 self-center sm:self-auto">
        {jeu.coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/cover/${jeu.id}?t=lg`}
            alt={t.jaquette(jeu.title)}
            className="w-40 rounded-md border border-ink-800 bg-ink-950/60 sm:w-48"
          />
        ) : (
          <span className="flex aspect-square w-40 items-center justify-center rounded-md border border-ink-800 bg-ink-950/60 text-xs text-ink-700 sm:w-48">
            {catalogue.cartes.pasDeJaquette}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-accent-400 uppercase">{t.etiquette}</span>
          <Link
            href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`}
            className="text-2xl font-semibold text-ink-50 hover:underline"
          >
            {titreComplet(jeu, titrePartie)}
          </Link>
          <span className="text-sm text-ink-400">{console?.name ?? jeu.consoleSlug}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Chiffre label={t.tempsDeJeu} valeur={formatDuree(stats.secondes, langue)} />
          <Chiffre
            label={t.dernierePartie}
            valeur={stats.derniere ? formatDate(stats.derniere, false, langue) : "—"}
          />
          <Chiffre
            label={t.sauvegarde}
            valeur={stats.sauvegarde ? formatDate(stats.sauvegarde, true, langue) : t.aucuneSauvegarde}
          />
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          {/* Un `<a>` et non un `<Link>` : le lecteur a besoin d'un document
              chargé avec ses en-têtes d'isolation (voir la fiche du jeu). */}
          <a
            href={`/jouer/${jeu.consoleSlug}/${jeu.slug}`}
            className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-6 py-2.5 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-500"
          >
            {t.jouer}
          </a>
          <Link
            href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`}
            className="text-sm text-ink-400 underline-offset-4 hover:text-ink-50 hover:underline"
          >
            {t.voirLaFiche}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Chiffre({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-700">{label}</dt>
      <dd className="text-ink-200">{valeur}</dd>
    </div>
  );
}

/**
 * Qui joue en ce moment, et à quoi : c'est ce qui donne envie de lancer une
 * partie ou d'ouvrir un salon. Rien ne s'affiche quand personne ne joue.
 */
function EnCeMoment({ presents, t }: { presents: Presence[]; t: Textes["accueil"]["enCeMoment"] }) {
  if (presents.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>
      <ul className="flex flex-wrap gap-2">
        {presents.map((presence) => (
          <li
            key={presence.pseudo}
            className="flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/60 py-1.5 pr-4 pl-3 text-sm text-ink-200"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-400" />
            <span>
              <Phrase
                texte={t.joue}
                elements={{
                  joueur: <strong className="text-ink-50">{presence.pseudo}</strong>,
                  jeu: (
                    <Link
                      href={`/jeux/${presence.jeu.consoleSlug}/${presence.jeu.slug}`}
                      className="text-ink-50 hover:underline"
                    >
                      {presence.jeu.titre}
                    </Link>
                  ),
                }}
              />
              {presence.link && <span className="text-ink-400">{t.auCableLink(presence.link.avec)}</span>}
            </span>
            {presence.link?.regardable && (
              <Link href={`/link/${presence.link.salon}`} className="text-xs text-accent-400 hover:underline">
                {t.regarder}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Les salons de câble link où quelqu'un attend, tous jeux confondus, et le
 * mien s'il y en a un. Les salons vivent en mémoire dans le serveur, pas en
 * base : l'accueil les lit directement dans le registre.
 */
async function Salons({
  moi,
  t,
  langue,
}: {
  moi: SessionUser;
  t: Textes["accueil"]["salons"];
  langue: Langue;
}) {
  const mien = salonDuCompte(moi.id);
  const candidats = [...salons().values()]
    .filter((s) => s.etat === "attente" && !s.prive && s.id !== mien?.id)
    .sort((a, b) => b.creeLe - a.creeLe);
  // Un compte restreint ne voit que les salons des jeux qu'il peut lancer.
  const visibles = await Promise.all(candidats.map((s) => jeuAccessible(moi, s.jeu.id)));
  const ouverts = candidats.filter((_, i) => visibles[i]);
  // Et les parties en cours qu'on peut regarder.
  const candidatsRegardables = salonsRegardables().filter((s) => s.id !== mien?.id);
  const regardablesVisibles = await Promise.all(candidatsRegardables.map((s) => jeuAccessible(moi, s.jeu.id)));
  const regardables = candidatsRegardables.filter((_, i) => regardablesVisibles[i]);

  if (!mien && ouverts.length === 0 && regardables.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>
      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
        {mien && (
          <li className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-accent-600/10 px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink-200">
              <Phrase
                texte={mien.etat === "attente" ? t.tienEnAttente : t.tienEnCours}
                elements={{ jeu: <strong className="text-ink-50">{mien.jeu.titre}</strong> }}
              />
              {mien.prive && <span className="ml-2 text-xs text-ink-400">{t.prive}</span>}
            </span>
            <Link
              href={`/link/${mien.id}`}
              className="rounded-lg bg-accent-600 px-4 py-1.5 text-sm font-semibold text-ink-950 hover:bg-accent-500"
            >
              {t.retourner}
            </Link>
          </li>
        )}
        {ouverts.map((salon) => (
          <li key={salon.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-900/40 px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink-200">
              <Phrase
                texte={t.attend}
                elements={{
                  joueur: <strong className="text-ink-50">{salon.places[0].pseudo}</strong>,
                  jeu: (
                    <Link
                      href={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`}
                      className="text-ink-50 hover:underline"
                    >
                      {salon.jeu.titre}
                    </Link>
                  ),
                }}
              />
              <span className="ml-2 text-xs text-ink-700">
                {t.depuis(formatDate(new Date(salon.creeLe), true, langue))}
              </span>
            </span>
            {!mien && (
              <Link
                href={`/link/${salon.id}`}
                className="rounded-lg border border-ink-700 px-4 py-1.5 text-sm text-ink-200 hover:border-ink-400 hover:text-ink-50"
              >
                {t.rejoindre}
              </Link>
            )}
          </li>
        ))}
        {regardables.map((salon) => (
          <li key={salon.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-900/40 px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink-200">
              <Phrase
                texte={t.jouent}
                elements={{
                  premier: <strong className="text-ink-50">{salon.places[0].pseudo}</strong>,
                  second: <strong className="text-ink-50">{salon.places[1]?.pseudo}</strong>,
                  jeu: (
                    <Link
                      href={`/jeux/${salon.jeu.consoleSlug}/${salon.jeu.slug}`}
                      className="text-ink-50 hover:underline"
                    >
                      {salon.jeu.titre}
                    </Link>
                  ),
                }}
              />
              <span className="ml-2 text-xs text-ink-700">{t.spectateurs(salon.nombreSpectateurs)}</span>
            </span>
            <Link
              href={`/link/${salon.id}`}
              className="rounded-lg border border-ink-700 px-4 py-1.5 text-sm text-ink-200 hover:border-ink-400 hover:text-ink-50"
            >
              {t.regarder}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Section({
  title,
  games,
  empty,
}: {
  title: string;
  games: Awaited<ReturnType<typeof latestGames>>;
  empty?: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">{title}</h2>
      {games.length === 0 ? (
        <p className="rounded-panel border border-dashed border-ink-800 px-5 py-8 text-center text-sm text-ink-400">
          {empty}
        </p>
      ) : (
        <GameGrid games={games} />
      )}
    </section>
  );
}
