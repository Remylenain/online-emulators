"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  basculerPublication,
  enregistrerRetouches,
  type Resultat,
} from "@/lib/admin/actions";
import { Alert, Button } from "@/components/ui";
import {
  ETATS,
  PAR_PAGE,
  TYPES_ADMIN,
  type ComptesBibliotheque,
  type EtatKey,
  type FiltresBibliotheque,
  type TypeAdmin,
} from "@/lib/admin/filtres-bibliotheque";
import { nomDeLangue } from "@/lib/catalog-options";
import { CONSOLES } from "@/lib/consoles";

export type JeuAdmin = {
  id: string;
  title: string;
  consoleSlug: string;
  slug: string;
  description: string | null;
  author: string | null;
  version: string | null;
  language: string | null;
  baseGame: string | null;
  year: number | null;
  isPublished: boolean;
  isOfficial: boolean;
  coverPath: string | null;
  romSize: number;
  /** Champs que ce jeu retouche par rapport à son `game.json`. */
  retouches: string[];
};

type EtatScan = { enCours: boolean; journal: string; termineLe: string | null };

/** Ce qui se déplie sous les boutons : un seul volet à la fois. */
type Volet = "scan" | "scraper" | "export" | "aide";

/** Langues proposées en suggestion. La saisie reste libre. */
const LANGUES_COURANTES = ["fr", "en", "es", "de", "it", "ja", "pt"];

/**
 * La bibliothèque vue par l'administration.
 *
 * Le scan se lance d'ici, et non plus en ligne de commande : le service tourne
 * déjà sous l'utilisateur propriétaire des données, donc le scan n'a besoin
 * d'aucun privilège supplémentaire.
 *
 * La page ne reçoit que les jeux à afficher : la recherche, les filtres et le
 * découpage en pages sont faits par le serveur, d'après l'adresse. Tout ce
 * qui n'est pas la liste — journaux, export, explications — se replie dans un
 * volet, pour que la liste reste à portée de main.
 */
export function Bibliotheque({
  jeux,
  filtres,
  comptes,
  inscriptible,
}: {
  /** Les jeux de la page courante, déjà filtrés. */
  jeux: JeuAdmin[];
  filtres: FiltresBibliotheque;
  comptes: ComptesBibliotheque;
  /** Le serveur peut-il enregistrer des retouches ? */
  inscriptible: boolean;
}) {
  const router = useRouter();
  const [scan, setScan] = useState<EtatScan | null>(null);
  const [scraper, setScraper] = useState<EtatScan | null>(null);
  const scraperTournaitAvant = useRef(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [volet, setVolet] = useState<Volet | null>(null);
  const tournaitAvant = useRef(false);
  const hautDeListe = useRef<HTMLDivElement>(null);
  const [naviguer, enRoute] = useNaviguer();

  const relire = useCallback(async () => {
    try {
      const reponse = await fetch("/api/admin/scan", { cache: "no-store" });
      if (!reponse.ok) return;
      const etat: EtatScan = await reponse.json();
      const reponseScraper = await fetch("/api/admin/scraper", { cache: "no-store" });
      const etatScraper: EtatScan | null = reponseScraper.ok ? await reponseScraper.json() : null;

      setScan(etat);
      if (etatScraper) setScraper(etatScraper);

      // Une tâche qui démarre — ou qui tournait déjà à l'ouverture de la
      // page — déplie son journal. Il reste ouvert une fois la tâche finie :
      // c'est à ce moment-là qu'on veut lire ce qu'elle a trouvé.
      if (etatScraper?.enCours && !scraperTournaitAvant.current) setVolet("scraper");
      else if (etat.enCours && !tournaitAvant.current && !etatScraper?.enCours) setVolet("scan");

      // Le scan vient de se terminer : la liste des jeux a changé sous nos
      // pieds, on la redemande au serveur.
      if (tournaitAvant.current && !etat.enCours) router.refresh();
      tournaitAvant.current = etat.enCours;
      if (etatScraper) {
        if (scraperTournaitAvant.current && !etatScraper.enCours) router.refresh();
        scraperTournaitAvant.current = etatScraper.enCours;
      }
    } catch {
      // Le serveur n'a pas répondu : on retentera au prochain battement.
    }
  }, [router]);

  useEffect(() => {
    void relire();
  }, [relire]);

  /** Pendant le scan seulement : inutile d'interroger un serveur au repos. */
  const tacheEnCours = Boolean(scan?.enCours || scraper?.enCours);

  /**
   * La console sur laquelle portent le scan et la complétion des fiches ;
   * vide pour toutes. Elle suit le filtre de la liste — on agit d'ordinaire
   * sur ce qu'on regarde — mais reste un choix à part, affiché à côté des
   * boutons : rien ne se limite à une console sans qu'on le voie.
   */
  const [portee, setPortee] = useState(filtres.console);
  const [filtreVu, setFiltreVu] = useState(filtres.console);
  if (filtreVu !== filtres.console) {
    setFiltreVu(filtres.console);
    setPortee(filtres.console);
  }
  const suffixe = portee ? `?console=${encodeURIComponent(portee)}` : "";
  useEffect(() => {
    if (!tacheEnCours) return;
    const battement = setInterval(() => void relire(), 2000);
    return () => clearInterval(battement);
  }, [tacheEnCours, relire]);

  /**
   * « Compléter les fiches » : va chercher description, année et jaquette des
   * jeux officiels (ScreenScraper si un compte est réglé, libretro sinon),
   * puis relance le scan. Voir `scripts/scraper.ts`.
   */
  async function lancerScraper() {
    setErreur(null);
    const reponse = await fetch(`/api/admin/scraper${suffixe}`, { method: "POST" });
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}));
      setErreur(corps.erreur ?? "Le scraper n'a pas pu démarrer.");
      return;
    }
    scraperTournaitAvant.current = true;
    setScraper({ enCours: true, journal: "", termineLe: null });
    setVolet("scraper");
    void relire();
  }

  async function lancer() {
    setErreur(null);
    const reponse = await fetch(`/api/admin/scan${suffixe}`, { method: "POST" });
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}));
      setErreur(corps.erreur ?? "Le scan n'a pas pu démarrer.");
      return;
    }
    tournaitAvant.current = true;
    setScan({ enCours: true, journal: "", termineLe: null });
    setVolet("scan");
    void relire();
  }

  const volets: { nom: Volet; libelle: string }[] = [
    ...(scan?.journal ? [{ nom: "scan" as const, libelle: "Journal du scan" }] : []),
    ...(scraper?.journal ? [{ nom: "scraper" as const, libelle: "Journal des fiches" }] : []),
    { nom: "export", libelle: "Exporter les fiches" },
    { nom: "aide", libelle: "Aide" },
  ];
  const journal = volet === "scan" ? scan?.journal : volet === "scraper" ? scraper?.journal : null;

  const premier = (filtres.page - 1) * PAR_PAGE + 1;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void lancer()} disabled={tacheEnCours}>
          {scan?.enCours ? "Scan en cours…" : "Relancer le scan"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void lancerScraper()} disabled={tacheEnCours}>
          {scraper?.enCours ? "Recherche en cours…" : "Compléter les fiches"}
        </Button>
        <label htmlFor="portee-taches" className="sr-only">
          Console sur laquelle portent le scan et la complétion des fiches
        </label>
        <select
          id="portee-taches"
          value={portee}
          onChange={(evenement) => setPortee(evenement.target.value)}
          disabled={tacheEnCours}
          className={selectClasses}
        >
          <option value="">Sur toutes les consoles</option>
          {CONSOLES.map((definition) => (
            <option key={definition.slug} value={definition.slug}>
              Sur {definition.name} seulement
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-400">
          {comptes.publies} publié{comptes.publies > 1 ? "s" : ""} sur {comptes.total}
          {scan?.termineLe &&
            ` · dernier scan le ${new Date(scan.termineLe).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {volets.map(({ nom, libelle }) => (
          <button
            key={nom}
            type="button"
            aria-expanded={volet === nom}
            onClick={() => setVolet((actuel) => (actuel === nom ? null : nom))}
            className={`transition-colors ${
              volet === nom ? "text-accent-400" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            {libelle} {volet === nom ? "▾" : "▸"}
          </button>
        ))}
      </div>

      {journal && (
        <pre className="max-h-72 overflow-auto rounded-panel border border-ink-800 bg-ink-950/60 p-3 font-mono text-xs whitespace-pre-wrap text-ink-400">
          {journal}
        </pre>
      )}
      {volet === "export" && <ExportFiches />}
      {volet === "aide" && (
        <div className="flex flex-col gap-2 rounded-panel border border-ink-800 p-3 text-xs text-ink-400">
          <p>
            « Relancer le scan » relit le dossier de la bibliothèque : nouveaux jeux, jaquettes,
            manifestes modifiés.
          </p>
          <p>
            « Compléter les fiches » cherche la description, l&apos;année et la jaquette des jeux
            officiels qui n&apos;en ont pas, sans rien écraser, puis relance le scan. Le compte du
            scraper se règle dans Réglages ; sans lui, seules les jaquettes sont cherchées.
          </p>
          <p>
            Un clic sur un titre ouvre sa fiche. Les corrections sont enregistrées à côté de la
            bibliothèque, qui reste en lecture seule pour le site ; le scan les réapplique à chaque
            passage. Vider un champ le fait repartir du <code>game.json</code>.
          </p>
        </div>
      )}

      {erreur && <Alert tone="error">{erreur}</Alert>}
      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

      {!inscriptible && (
        <Alert tone="error">
          Le serveur ne peut pas écrire dans son dossier de données : les
          corrections ci-dessous échoueront.
        </Alert>
      )}

      <div ref={hautDeListe} className="scroll-mt-20">
        <Filtres filtres={filtres} comptes={comptes} naviguer={naviguer} />
      </div>

      <p className="text-xs text-ink-400" aria-live="polite">
        {comptes.trouves === 0
          ? "Aucun jeu ne correspond."
          : `${premier}–${premier + jeux.length - 1} sur ${comptes.trouves} jeu${comptes.trouves > 1 ? "x" : ""}`}
      </p>

      {jeux.length > 0 && (
        <ul
          aria-busy={enRoute}
          className={`flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800 transition-opacity ${
            enRoute ? "opacity-50" : ""
          }`}
        >
          {jeux.map((jeu) => (
            <FicheJeu
              key={jeu.id}
              jeu={jeu}
              ouvert={ouvert === jeu.id}
              basculer={() => setOuvert((actuel) => (actuel === jeu.id ? null : jeu.id))}
              rapporter={setRetour}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={filtres.page}
        pages={comptes.pages}
        aller={(page) => {
          naviguer({ page: page > 1 ? String(page) : "" });
          // La page suivante se lit depuis son début, pas depuis le bas de
          // celle qu'on quitte.
          hautDeListe.current?.scrollIntoView({ block: "start" });
        }}
      />
    </section>
  );
}

/**
 * Change les filtres dans l'adresse. Rend aussi `enRoute`, vrai tant que la
 * liste demandée n'est pas arrivée.
 *
 * Tout changement de filtre ramène à la première page : rester en page 4
 * d'une liste qui n'en compte plus que deux n'aurait pas de sens.
 *
 * Deux changements rapprochés — une recherche tapée, puis une pastille
 * cliquée avant que la liste ne revienne — doivent se cumuler. Partir chaque
 * fois de l'adresse affichée ferait oublier le premier : le second
 * repartirait d'une adresse où il n'est pas encore. On repart donc de la
 * dernière adresse demandée, tant qu'elle est en route.
 */
function useNaviguer(): [(modifications: Record<string, string>) => void, boolean] {
  const router = useRouter();
  const chemin = usePathname();
  const parametres = useSearchParams();
  const [enRoute, demarrer] = useTransition();
  const suivi = useRef<{ affichee: string; demandee: string | null }>({
    affichee: parametres.toString(),
    demandee: null,
  });

  useEffect(() => {
    suivi.current.affichee = parametres.toString();
    if (!enRoute) suivi.current.demandee = null;
  });

  const naviguer = useCallback(
    (modifications: Record<string, string>) => {
      const suivants = new URLSearchParams(suivi.current.demandee ?? suivi.current.affichee);
      if (!("page" in modifications)) suivants.delete("page");
      for (const [cle, valeur] of Object.entries(modifications)) {
        if (valeur) suivants.set(cle, valeur);
        else suivants.delete(cle);
      }
      const requete = suivants.toString();
      suivi.current.demandee = requete;
      demarrer(() => router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false }));
    },
    [router, chemin],
  );

  return [naviguer, enRoute];
}

const selectClasses =
  "max-w-full min-w-0 rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-200 focus:border-accent-500 focus:outline-none";

/**
 * Recherche, console, type, et ce qu'il reste à traiter.
 *
 * Les états — sans jaquette, sans description… — sont des pastilles et non
 * une liste déroulante : leurs nombres sont la liste de ce qu'il reste à
 * faire, et doivent se lire sans rien ouvrir. Une pastille à zéro disparaît.
 */
function Filtres({
  filtres,
  comptes,
  naviguer,
}: {
  filtres: FiltresBibliotheque;
  comptes: ComptesBibliotheque;
  naviguer: (modifications: Record<string, string>) => void;
}) {
  const [saisie, setSaisie] = useState(filtres.q);
  /** La dernière recherche que ce champ a demandée. */
  const [envoyee, setEnvoyee] = useState(filtres.q);
  const [vue, setVue] = useState(filtres.q);

  // L'adresse fait foi quand elle change sous nos pieds — retour arrière du
  // navigateur, « Tout afficher » —, mais pas quand elle ne fait que
  // rattraper ce qu'on vient de lui envoyer : recopier « pok » dans le champ
  // alors qu'on a déjà tapé « poke » pendant l'aller-retour effacerait une
  // lettre.
  if (vue !== filtres.q) {
    setVue(filtres.q);
    if (filtres.q !== envoyee) {
      setSaisie(filtres.q);
      setEnvoyee(filtres.q);
    }
  }

  // Frappe au clavier : on attend une pause avant de relancer la requête.
  useEffect(() => {
    const voulue = saisie.trim();
    if (voulue === envoyee) return;
    const minuterie = setTimeout(() => {
      setEnvoyee(voulue);
      naviguer({ q: voulue });
    }, 250);
    return () => clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie]);

  const etats = (Object.keys(ETATS) as EtatKey[]).filter(
    (nom) => comptes.etats[nom] > 0 || filtres.etat === nom,
  );
  const filtre = Boolean(filtres.q || filtres.console || filtres.type || filtres.etat);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-48 sm:max-w-xs">
          <label htmlFor="recherche-bibliotheque" className="sr-only">
            Rechercher un jeu
          </label>
          <input
            id="recherche-bibliotheque"
            type="search"
            value={saisie}
            onChange={(evenement) => setSaisie(evenement.target.value)}
            placeholder="Titre, auteur, jeu de base…"
            className="w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-700 focus:border-accent-500 focus:ring-2 focus:ring-accent-600/30 focus:outline-none"
          />
        </div>

        <label htmlFor="filtre-console" className="sr-only">
          Console
        </label>
        <select
          id="filtre-console"
          value={filtres.console}
          onChange={(evenement) => naviguer({ console: evenement.target.value })}
          className={selectClasses}
        >
          <option value="">Toutes les consoles ({comptes.toutesConsoles})</option>
          {CONSOLES.map((definition) => (
            <option key={definition.slug} value={definition.slug}>
              {definition.name} ({comptes.consoles[definition.slug] ?? 0})
            </option>
          ))}
        </select>

        <label htmlFor="filtre-type" className="sr-only">
          Type de jeu
        </label>
        <select
          id="filtre-type"
          value={filtres.type}
          onChange={(evenement) => naviguer({ type: evenement.target.value })}
          className={selectClasses}
        >
          <option value="">Tous les jeux ({comptes.tousTypes})</option>
          {(Object.keys(TYPES_ADMIN) as TypeAdmin[]).map((nom) => (
            <option key={nom} value={nom}>
              {TYPES_ADMIN[nom]} ({comptes.types[nom]})
            </option>
          ))}
        </select>

        {filtre && (
          <button
            type="button"
            onClick={() => naviguer({ q: "", console: "", type: "", etat: "" })}
            className="text-xs text-ink-400 hover:text-ink-200"
          >
            Tout afficher
          </button>
        )}
      </div>

      {etats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="À traiter">
          {etats.map((nom) => {
            const actif = filtres.etat === nom;
            return (
              <button
                key={nom}
                type="button"
                aria-pressed={actif}
                onClick={() => naviguer({ etat: actif ? "" : nom })}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  actif
                    ? "border-accent-500 bg-accent-600/15 text-accent-400"
                    : "border-ink-700 text-ink-400 hover:border-ink-400 hover:text-ink-200"
                }`}
              >
                {ETATS[nom]} <span className="tabular-nums opacity-70">{comptes.etats[nom]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Les numéros à proposer : la première, la dernière, et les voisines de la
 * page courante. `null` marque un trou. Jusqu'à neuf pages, toutes.
 */
function numerosDePages(page: number, pages: number): (number | null)[] {
  const voulus = new Set<number>([1, pages, page - 1, page, page + 1]);
  if (pages <= 9) for (let numero = 1; numero <= pages; numero++) voulus.add(numero);
  const tries = [...voulus].filter((numero) => numero >= 1 && numero <= pages).sort((a, b) => a - b);
  const sortie: (number | null)[] = [];
  for (const numero of tries) {
    const precedent = sortie.at(-1);
    if (typeof precedent === "number" && numero - precedent > 1) sortie.push(null);
    sortie.push(numero);
  }
  return sortie;
}

function Pagination({
  page,
  pages,
  aller,
}: {
  page: number;
  pages: number;
  aller: (page: number) => void;
}) {
  if (pages <= 1) return null;

  const bouton =
    "rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200 transition-colors hover:border-ink-400 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pages">
      <button type="button" className={bouton} disabled={page <= 1} onClick={() => aller(page - 1)}>
        ‹ Précédente
      </button>
      {numerosDePages(page, pages).map((numero, rang) =>
        numero === null ? (
          <span key={`trou-${rang}`} className="text-xs text-ink-700">
            …
          </span>
        ) : (
          <button
            key={numero}
            type="button"
            aria-current={numero === page ? "page" : undefined}
            onClick={() => aller(numero)}
            className={`min-w-8 rounded-lg px-2 py-1.5 text-xs tabular-nums transition-colors ${
              numero === page ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            {numero}
          </button>
        ),
      )}
      <button type="button" className={bouton} disabled={page >= pages} onClick={() => aller(page + 1)}>
        Suivante ›
      </button>
    </nav>
  );
}

/**
 * Export des fiches au format EmulationStation (`gamelist.xml` + images),
 * pour les reprendre sur Recalbox, Batocera, RetroPie ou ES-DE. Un simple
 * lien de téléchargement : l'archive est produite par `/api/admin/gamelist`.
 */
function ExportFiches() {
  const [consoleSlug, setConsoleSlug] = useState("");
  const [tout, setTout] = useState(false);
  const parametres = new URLSearchParams();
  if (consoleSlug) parametres.set("console", consoleSlug);
  if (tout) parametres.set("tout", "1");
  const adresse = `/api/admin/gamelist${parametres.size > 0 ? `?${parametres}` : ""}`;

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-ink-800 p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-ink-200">Exporter les fiches</p>
        <label htmlFor="export-console" className="sr-only">
          Console
        </label>
        <select
          id="export-console"
          value={consoleSlug}
          onChange={(evenement) => setConsoleSlug(evenement.target.value)}
          className="max-w-full min-w-0 rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-200 focus:border-accent-500 focus:outline-none"
        >
          <option value="">Toutes les consoles</option>
          {CONSOLES.map((definition) => (
            <option key={definition.slug} value={definition.slug}>
              {definition.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-400">
          <input type="checkbox" checked={tout} onChange={(evenement) => setTout(evenement.target.checked)} />
          Avec les jeux officiels
        </label>
        <a
          href={adresse}
          download
          className="inline-flex items-center justify-center rounded-lg border border-ink-700 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50"
        >
          Télécharger (.zip)
        </a>
      </div>
      <p className="text-xs text-ink-700">
        Un <code>gamelist.xml</code> et un dossier d&apos;images par console, au format
        d&apos;EmulationStation (Recalbox, Batocera, RetroPie, ES-DE) : titre, description, année,
        auteur, langue et jaquette, rattachés au nom du fichier ROM. Aucune ROM n&apos;est dans
        l&apos;archive.
      </p>
    </div>
  );
}

function FicheJeu({
  jeu,
  ouvert,
  basculer,
  rapporter,
}: {
  jeu: JeuAdmin;
  ouvert: boolean;
  basculer: () => void;
  rapporter: (resultat: Resultat) => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  const retouche = (champ: string) => jeu.retouches.includes(champ);

  return (
    <li className="flex flex-col bg-ink-900/40">
      {/* Sur un écran étroit, le titre et ses détails s'empilent : côte à
          côte, les détails prenaient toute la largeur et le titre se
          réduisait à une lettre. */}
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        <span className="w-7 shrink-0 text-xs uppercase text-ink-700">
          {jeu.consoleSlug}
        </span>
        {jeu.coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/cover/${jeu.id}`}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded border border-ink-800 bg-ink-950/60 object-contain"
          />
        ) : (
          <span className="size-9 shrink-0 rounded border border-dashed border-ink-700" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={basculer}
            aria-expanded={ouvert}
            className={`min-w-0 truncate text-left text-sm hover:text-accent-400 sm:flex-1 ${
              ouvert ? "text-accent-400" : "text-ink-50"
            }`}
          >
            {jeu.title}
          </button>
          <span className="min-w-0 truncate text-xs text-ink-400 sm:shrink-0">
            {jeu.isOfficial && "officiel · "}
            {jeu.language ? nomDeLangue(jeu.language) : "langue à renseigner"}
            {" · "}
            {(jeu.romSize / 1048576).toFixed(0)} Mio
            {!jeu.coverPath && " · sans jaquette"}
            {jeu.retouches.length > 0 &&
              ` · ${jeu.retouches.length} retouche${jeu.retouches.length > 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          type="button"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              rapporter(await basculerPublication(jeu.id));
              router.refresh();
            })
          }
          className={`shrink-0 rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
            jeu.isPublished
              ? "border-ink-700 text-ink-200 hover:border-ink-400"
              : "border-red-900 text-red-300 hover:bg-red-950/50"
          }`}
        >
          {jeu.isPublished ? "Publié" : "Retiré"}
        </button>
      </div>

      {ouvert && (
        <form
          action={(donnees) =>
            demarrer(async () => {
              rapporter(await enregistrerRetouches(jeu.id, donnees));
              router.refresh();
            })
          }
          className="flex flex-col gap-3 border-t border-ink-800 bg-ink-950/40 px-4 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Retouchable libelle="Titre" marque={retouche("titre")}>
              <input
                name="titre"
                defaultValue={jeu.title}
                className={champClasses}
                maxLength={120}
              />
            </Retouchable>

            <Retouchable libelle="Langue" marque={retouche("langue")}>
              <input
                name="langue"
                list="langues-connues"
                defaultValue={jeu.language ?? ""}
                placeholder="fr, en…"
                className={champClasses}
                maxLength={10}
              />
              <datalist id="langues-connues">
                {LANGUES_COURANTES.map((code) => (
                  <option key={code} value={code}>
                    {nomDeLangue(code)}
                  </option>
                ))}
              </datalist>
            </Retouchable>

            <Retouchable libelle="Auteur" marque={retouche("auteur")}>
              <input
                name="auteur"
                defaultValue={jeu.author ?? ""}
                className={champClasses}
                maxLength={120}
              />
            </Retouchable>

            <Retouchable libelle="Version" marque={retouche("version")}>
              <input
                name="version"
                defaultValue={jeu.version ?? ""}
                className={champClasses}
                maxLength={40}
              />
            </Retouchable>

            <Retouchable libelle="Jeu de base" marque={retouche("jeuDeBase")}>
              <input
                name="jeuDeBase"
                defaultValue={jeu.baseGame ?? ""}
                className={champClasses}
                maxLength={120}
              />
            </Retouchable>

            <Retouchable libelle="Année" marque={retouche("annee")}>
              <input
                name="annee"
                type="number"
                min={1989}
                max={2100}
                defaultValue={jeu.year ?? ""}
                className={champClasses}
              />
            </Retouchable>
          </div>

          <Retouchable libelle="Description" marque={retouche("description")}>
            <textarea
              name="description"
              defaultValue={jeu.description ?? ""}
              rows={5}
              maxLength={4000}
              className={`${champClasses} resize-y`}
            />
          </Retouchable>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <button
              type="button"
              onClick={basculer}
              className="text-xs text-ink-400 hover:text-ink-200"
            >
              Fermer
            </button>
            <Link
              href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`}
              className="ml-auto text-xs text-ink-400 hover:text-ink-200"
            >
              Voir la fiche du jeu →
            </Link>
          </div>
        </form>
      )}
    </li>
  );
}

const champClasses =
  "w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-700 focus:border-accent-500 focus:outline-none";

/** Un champ du formulaire, marqué quand il s'écarte du manifeste. */
function Retouchable({
  libelle,
  marque,
  children,
}: {
  libelle: string;
  marque: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-xs text-ink-400">
        {libelle}
        {marque && (
          <span
            className="rounded bg-accent-600/20 px-1.5 py-0.5 text-[10px] text-accent-400"
            title="Cette valeur est saisie ici, elle ne vient pas du game.json."
          >
            retouché
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
