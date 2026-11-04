"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  basculerPublication,
  enregistrerRetouches,
  type Resultat,
} from "@/lib/admin/actions";
import { Alert, Button } from "@/components/ui";
import { nomDeLangue } from "@/lib/catalog-options";

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
  coverPath: string | null;
  romSize: number;
  updatedAt: Date;
  /** Champs que ce jeu retouche par rapport à son `game.json`. */
  retouches: string[];
};

type EtatScan = { enCours: boolean; journal: string; termineLe: string | null };

/** Langues proposées en suggestion. La saisie reste libre. */
const LANGUES_COURANTES = ["fr", "en", "es", "de", "it", "ja", "pt"];

/**
 * La bibliothèque vue par l'administration.
 *
 * Le scan se lance d'ici, et non plus en ligne de commande : le service tourne
 * déjà sous l'utilisateur propriétaire des données, donc le scan n'a besoin
 * d'aucun privilège supplémentaire.
 */
export function Bibliotheque({
  jeux,
  inscriptible,
}: {
  jeux: JeuAdmin[];
  /** Le serveur peut-il enregistrer des retouches ? */
  inscriptible: boolean;
}) {
  const router = useRouter();
  const [scan, setScan] = useState<EtatScan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retour, setRetour] = useState<Resultat | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const tournaitAvant = useRef(false);

  const relire = useCallback(async () => {
    try {
      const reponse = await fetch("/api/admin/scan", { cache: "no-store" });
      if (!reponse.ok) return;
      const etat: EtatScan = await reponse.json();
      setScan(etat);

      // Le scan vient de se terminer : la liste des jeux a changé sous nos
      // pieds, on la redemande au serveur.
      if (tournaitAvant.current && !etat.enCours) router.refresh();
      tournaitAvant.current = etat.enCours;
    } catch {
      // Le serveur n'a pas répondu : on retentera au prochain battement.
    }
  }, [router]);

  useEffect(() => {
    void relire();
  }, [relire]);

  /** Pendant le scan seulement : inutile d'interroger un serveur au repos. */
  useEffect(() => {
    if (!scan?.enCours) return;
    const battement = setInterval(() => void relire(), 2000);
    return () => clearInterval(battement);
  }, [scan?.enCours, relire]);

  async function lancer() {
    setErreur(null);
    const reponse = await fetch("/api/admin/scan", { method: "POST" });
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}));
      setErreur(corps.erreur ?? "Le scan n'a pas pu démarrer.");
      return;
    }
    tournaitAvant.current = true;
    setScan({ enCours: true, journal: "", termineLe: null });
    void relire();
  }

  const publies = jeux.filter((jeu) => jeu.isPublished).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void lancer()} disabled={scan?.enCours}>
          {scan?.enCours ? "Scan en cours…" : "Relancer le scan"}
        </Button>
        <p className="text-xs text-ink-400">
          {publies} publié{publies > 1 ? "s" : ""} sur {jeux.length}
          {scan?.termineLe &&
            ` · dernier scan le ${new Date(scan.termineLe).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}`}
        </p>
      </div>

      {erreur && <Alert tone="error">{erreur}</Alert>}
      {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

      {!inscriptible && (
        <Alert tone="error">
          Le serveur ne peut pas écrire dans son dossier de données : les
          corrections ci-dessous échoueront.
        </Alert>
      )}

      {scan?.journal && (
        <pre className="max-h-72 overflow-auto rounded-panel border border-ink-800 bg-ink-950/60 p-3 font-mono text-xs whitespace-pre-wrap text-ink-400">
          {scan.journal}
        </pre>
      )}

      <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
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

      <p className="text-xs text-ink-700">
        Les corrections sont enregistrées à côté de la bibliothèque, qui reste en
        lecture seule pour le site. Le scan les réapplique à chaque passage.
        Vider un champ le fait repartir du <code>game.json</code>.
      </p>
    </section>
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <span className="w-10 shrink-0 text-xs uppercase text-ink-700">
          {jeu.consoleSlug}
        </span>
        <button
          type="button"
          onClick={basculer}
          aria-expanded={ouvert}
          className="min-w-0 flex-1 truncate text-left text-sm text-ink-50 hover:text-accent-400"
        >
          {jeu.title}
        </button>
        <span className="shrink-0 text-xs text-ink-700">
          {jeu.language ? nomDeLangue(jeu.language) : "langue à renseigner"}
          {" · "}
          {(jeu.romSize / 1048576).toFixed(0)} Mio
          {!jeu.coverPath && " · sans jaquette"}
          {jeu.retouches.length > 0 &&
            ` · ${jeu.retouches.length} retouche${jeu.retouches.length > 1 ? "s" : ""}`}
        </span>
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
