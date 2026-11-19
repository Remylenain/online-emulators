"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Resultat } from "@/lib/admin/actions";
import {
  basculerGroupeParDefaut,
  creerGroupe,
  definirJeuxDuGroupe,
  definirMembresDuGroupe,
  modifierGroupe,
  supprimerGroupe,
} from "@/lib/admin/actions-groupes";
import { CONSOLES } from "@/lib/consoles";
import { REGLES_GROUPE, type RegleGroupe } from "@/lib/regles-groupe";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

export type GroupeAdmin = {
  id: string;
  nom: string;
  regle: RegleGroupe;
  parDefaut: boolean;
  /** Les jeux cochés ; ne comptent que pour la règle « liste ». */
  jeux: string[];
  membres: string[];
};

export type JeuGroupe = {
  id: string;
  titre: string;
  console: string;
  publie: boolean;
  officiel: boolean;
  /** Titre, auteur et jeu de base, sans accents ni majuscules (`games.search_text`). */
  recherche: string;
};

export type CompteGroupe = {
  id: string;
  pseudo: string;
  admin: boolean;
  actif: boolean;
  discord: boolean;
  /** Le compte n'est dans aucun groupe. */
  sansGroupe: boolean;
};

/** Au-delà, la liste ne montre pas tout : on précise la recherche. */
const AFFICHES_MAX = 300;

const champ =
  "rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-700 focus:border-accent-500 focus:outline-none";

/** Comme `normalizeForSearch` côté serveur : sans accents ni majuscules, mot à mot. */
function mots(saisie: string): string[] {
  return saisie
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((mot) => mot.length > 0);
}

/**
 * Les groupes d'accès.
 *
 * Un groupe dit ce qu'il ouvre — une liste de jeux, toutes les rom hacks, ou
 * toute la bibliothèque — et qui en fait partie. Un compte voit la réunion de
 * ses groupes : c'est ce qui permet de n'ouvrir que quelques jeux aux nouveaux
 * venus, et tout le catalogue aux proches, sur le même site.
 */
export function Groupes({
  groupes,
  jeux,
  comptes,
}: {
  groupes: GroupeAdmin[];
  jeux: JeuGroupe[];
  comptes: CompteGroupe[];
}) {
  const t = useT().adminGroupes;
  const router = useRouter();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [message, setMessage] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();

  function agir(operation: () => Promise<Resultat>, ensuite?: (resultat: Resultat) => void) {
    demarrer(async () => {
      const resultat = await operation();
      setMessage(resultat);
      ensuite?.(resultat);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-50">{t.titre}</h2>
        <p className="max-w-3xl text-sm text-ink-400">{t.intro}</p>
      </div>

      {message?.message && <Alert tone={message.ok ? "success" : "error"}>{message.message}</Alert>}

      <Nouveau surCreation={() => router.refresh()} />

      {groupes.length === 0 ? (
        <p className="text-sm text-ink-400">{t.aucun}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
          {groupes.map((groupe) => (
            <Carte
              key={groupe.id}
              groupe={groupe}
              jeux={jeux}
              comptes={comptes}
              ouvert={ouvert === groupe.id}
              basculer={() => setOuvert(ouvert === groupe.id ? null : groupe.id)}
              agir={agir}
              enCours={enCours}
              surSuppression={() => setOuvert(null)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Nouveau({ surCreation }: { surCreation: () => void }) {
  const t = useT().adminGroupes;
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(async (etat, donnees) => {
    const reponse = await creerGroupe(etat, donnees);
    if (reponse.ok) surCreation();
    return reponse;
  }, null);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink-200">{t.nouveau.titre}</h3>
        {resultat?.message && <Alert tone={resultat.ok ? "success" : "error"}>{resultat.message}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={t.nouveau.nom} htmlFor="groupe-nom">
            {/* Remis à vide après une création : la clé change avec le message. */}
            <Input id="groupe-nom" name="nom" maxLength={60} required key={resultat?.ok ? resultat.message : "nom"} />
          </Field>
          <Field label={t.nouveau.regle} htmlFor="groupe-regle">
            <select id="groupe-regle" name="regle" defaultValue="liste" className={champ}>
              {REGLES_GROUPE.map((regle) => (
                <option key={regle} value={regle}>
                  {t.regles[regle].libelle}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={enCours}>
            {enCours ? t.nouveau.creation : t.nouveau.creer}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Carte({
  groupe,
  jeux,
  comptes,
  ouvert,
  basculer,
  agir,
  enCours,
  surSuppression,
}: {
  groupe: GroupeAdmin;
  jeux: JeuGroupe[];
  comptes: CompteGroupe[];
  ouvert: boolean;
  basculer: () => void;
  agir: (operation: () => Promise<Resultat>, ensuite?: (resultat: Resultat) => void) => void;
  enCours: boolean;
  surSuppression: () => void;
}) {
  const t = useT().adminGroupes;
  const [nom, setNom] = useState(groupe.nom);
  const [regle, setRegle] = useState<RegleGroupe>(groupe.regle);
  const change = nom.trim() !== groupe.nom || regle !== groupe.regle;

  return (
    <li className="bg-ink-900/40">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink-50">{groupe.nom}</span>
            {groupe.parDefaut && (
              <span className="rounded border border-accent-600/50 px-1.5 py-0.5 text-[10px] text-accent-400">
                {t.carte.parDefaut}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-ink-400">
            {t.regles[groupe.regle].libelle} ·{" "}
            {t.carte.resume(groupe.membres.length, groupe.regle === "liste" ? groupe.jeux.length : null)}
          </div>
        </div>
        <button
          type="button"
          onClick={basculer}
          aria-expanded={ouvert}
          className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors ${
            ouvert
              ? "border-ink-400 bg-ink-800 text-ink-50"
              : "border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50"
          }`}
        >
          {ouvert ? t.carte.fermer : t.carte.gerer}
        </button>
      </div>

      {ouvert && (
        <div className="flex flex-col gap-6 border-t border-ink-800 bg-ink-950/40 px-4 py-4">
          <Bloc titre={t.reglages.titre}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={t.reglages.nom} htmlFor={`nom-${groupe.id}`}>
                <Input id={`nom-${groupe.id}`} value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} />
              </Field>
              <Field label={t.reglages.regle} htmlFor={`regle-${groupe.id}`}>
                <select
                  id={`regle-${groupe.id}`}
                  value={regle}
                  onChange={(e) => setRegle(e.target.value as RegleGroupe)}
                  className={champ}
                >
                  {REGLES_GROUPE.map((valeur) => (
                    <option key={valeur} value={valeur}>
                      {t.regles[valeur].libelle}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="button"
                disabled={enCours || !change}
                onClick={() => agir(() => modifierGroupe(groupe.id, nom, regle))}
              >
                {t.reglages.enregistrer}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={enCours}
                onClick={() => agir(() => basculerGroupeParDefaut(groupe.id))}
              >
                {groupe.parDefaut ? t.reglages.plusParDefaut : t.reglages.rendreParDefaut}
              </Button>
              <button
                type="button"
                disabled={enCours}
                onClick={() => {
                  if (!window.confirm(t.reglages.confirmerSuppression(groupe.nom, groupe.membres.length))) return;
                  agir(
                    () => supprimerGroupe(groupe.id),
                    (resultat) => resultat.ok && surSuppression(),
                  );
                }}
                className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-950/50 disabled:opacity-40"
              >
                {t.reglages.supprimer}
              </button>
            </div>
            <p className="text-xs text-ink-400">{t.reglages.aideParDefaut}</p>
          </Bloc>

          <Bloc titre={t.jeux.titre}>
            {groupe.regle === "liste" ? (
              <ListeJeux groupe={groupe} jeux={jeux} agir={agir} enCours={enCours} />
            ) : (
              <p className="text-sm text-ink-400">{t.jeux.sansListe(t.regles[groupe.regle].detail)}</p>
            )}
          </Bloc>

          <Bloc titre={t.membres.titre}>
            <ListeMembres groupe={groupe} comptes={comptes} agir={agir} enCours={enCours} />
          </Bloc>
        </div>
      )}
    </li>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-700">{titre}</h4>
      {children}
    </div>
  );
}

/** Le même ensemble, à l'ordre près ? Pour dire s'il reste quelque chose à enregistrer. */
function memes(a: Set<string>, b: string[]): boolean {
  return a.size === b.length && b.every((valeur) => a.has(valeur));
}

/**
 * Les jeux d'un groupe à liste : des cases, une recherche, des filtres, et de
 * quoi cocher d'un coup tout ce qui est affiché. Rien ne part avant
 * « Enregistrer ».
 */
function ListeJeux({
  groupe,
  jeux,
  agir,
  enCours,
}: {
  groupe: GroupeAdmin;
  jeux: JeuGroupe[];
  agir: (operation: () => Promise<Resultat>) => void;
  enCours: boolean;
}) {
  const t = useT().adminGroupes.jeux;
  const [coches, setCoches] = useState(() => new Set(groupe.jeux));
  const [recherche, setRecherche] = useState("");
  const [console_, setConsole] = useState("");
  const [type, setType] = useState<"" | "romhacks" | "officiels">("");
  const [seulementCoches, setSeulementCoches] = useState(false);

  const trouves = useMemo(() => {
    const cherches = mots(recherche);
    return jeux.filter(
      (jeu) =>
        (!console_ || jeu.console === console_) &&
        (!type || jeu.officiel === (type === "officiels")) &&
        (!seulementCoches || coches.has(jeu.id)) &&
        cherches.every((mot) => jeu.recherche.includes(mot)),
    );
  }, [jeux, recherche, console_, type, seulementCoches, coches]);
  const affiches = trouves.slice(0, AFFICHES_MAX);
  const consoles = CONSOLES.filter((definition) => jeux.some((jeu) => jeu.console === definition.slug));

  function basculer(id: string) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
  }
  function cocherAffiches(cocher: boolean) {
    setCoches((avant) => {
      const apres = new Set(avant);
      for (const jeu of trouves) {
        if (cocher) apres.add(jeu.id);
        else apres.delete(jeu.id);
      }
      return apres;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t.chercher}
          aria-label={t.chercher}
          className={champ}
        />
        <select value={console_} onChange={(e) => setConsole(e.target.value)} aria-label={t.toutesConsoles} className={champ}>
          <option value="">{t.toutesConsoles}</option>
          {consoles.map((definition) => (
            <option key={definition.slug} value={definition.slug}>
              {definition.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "" | "romhacks" | "officiels")}
          aria-label={t.tousTypes}
          className={champ}
        >
          <option value="">{t.tousTypes}</option>
          <option value="romhacks">{t.romhacks}</option>
          <option value="officiels">{t.officiels}</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-200">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={seulementCoches}
            onChange={(e) => setSeulementCoches(e.target.checked)}
            className="size-4"
          />
          {t.seulementCoches}
        </label>
        <button
          type="button"
          onClick={() => cocherAffiches(true)}
          disabled={trouves.length === 0}
          className="text-accent-400 hover:underline disabled:opacity-40"
        >
          {t.cocherAffiches(trouves.length)}
        </button>
        <button
          type="button"
          onClick={() => cocherAffiches(false)}
          disabled={trouves.length === 0}
          className="text-ink-400 hover:underline disabled:opacity-40"
        >
          {t.decocherAffiches(trouves.length)}
        </button>
        <span className="ml-auto text-ink-400">{t.compte(coches.size, jeux.length)}</span>
      </div>

      {affiches.length === 0 ? (
        <p className="text-xs text-ink-400">{t.aucun}</p>
      ) : (
        <ul className="grid max-h-96 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-ink-800 p-3 sm:grid-cols-2">
          {affiches.map((jeu) => (
            <li key={jeu.id}>
              <label className="flex items-center gap-2 text-xs text-ink-200">
                <input type="checkbox" checked={coches.has(jeu.id)} onChange={() => basculer(jeu.id)} className="size-4 shrink-0" />
                <span className="w-7 shrink-0 uppercase text-ink-700">{jeu.console}</span>
                <span className="truncate">{jeu.titre}</span>
                {jeu.officiel && <span className="shrink-0 text-[10px] text-ink-700">{t.officiel}</span>}
                {!jeu.publie && <span className="shrink-0 text-[10px] text-red-300">{t.nonPublie}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {trouves.length > affiches.length && (
        <p className="text-xs text-ink-400">{t.tronque(affiches.length, trouves.length)}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={enCours || memes(coches, groupe.jeux)}
          onClick={() => agir(() => definirJeuxDuGroupe(groupe.id, [...coches]))}
        >
          {enCours ? t.enregistrement : t.enregistrer}
        </Button>
        {!memes(coches, groupe.jeux) && <span className="text-xs text-accent-400">{t.nonEnregistre}</span>}
      </div>
    </div>
  );
}

/** Les membres d'un groupe : la même liste à cocher, sur les comptes. */
function ListeMembres({
  groupe,
  comptes,
  agir,
  enCours,
}: {
  groupe: GroupeAdmin;
  comptes: CompteGroupe[];
  agir: (operation: () => Promise<Resultat>) => void;
  enCours: boolean;
}) {
  const t = useT().adminGroupes.membres;
  const [coches, setCoches] = useState(() => new Set(groupe.membres));
  const [recherche, setRecherche] = useState("");
  const [seulementCoches, setSeulementCoches] = useState(false);

  const trouves = useMemo(() => {
    const cherches = mots(recherche);
    return comptes.filter((compte) => {
      const pseudo = mots(compte.pseudo).join(" ");
      return (!seulementCoches || coches.has(compte.id)) && cherches.every((mot) => pseudo.includes(mot));
    });
  }, [comptes, recherche, seulementCoches, coches]);
  const affiches = trouves.slice(0, AFFICHES_MAX);
  const sansGroupe = comptes.filter((compte) => compte.sansGroupe && !coches.has(compte.id));

  function basculer(id: string) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-200">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t.chercher}
          aria-label={t.chercher}
          className={`${champ} min-w-48 flex-1`}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={seulementCoches}
            onChange={(e) => setSeulementCoches(e.target.checked)}
            className="size-4"
          />
          {t.seulementCoches}
        </label>
        {sansGroupe.length > 0 && (
          <button
            type="button"
            onClick={() => setCoches((avant) => new Set([...avant, ...sansGroupe.map((compte) => compte.id)]))}
            className="text-accent-400 hover:underline"
          >
            {t.cocherSansGroupe(sansGroupe.length)}
          </button>
        )}
        <span className="ml-auto text-ink-400">{t.compte(coches.size, comptes.length)}</span>
      </div>

      {affiches.length === 0 ? (
        <p className="text-xs text-ink-400">{t.aucun}</p>
      ) : (
        <ul className="grid max-h-72 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-ink-800 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {affiches.map((compte) => (
            <li key={compte.id}>
              <label className="flex items-center gap-2 text-xs text-ink-200">
                <input
                  type="checkbox"
                  checked={coches.has(compte.id)}
                  onChange={() => basculer(compte.id)}
                  className="size-4 shrink-0"
                />
                <span className="truncate">{compte.pseudo}</span>
                {compte.admin && <span className="shrink-0 text-[10px] text-accent-400">{t.admin}</span>}
                {compte.discord && <span className="shrink-0 text-[10px] text-ink-700">{t.discord}</span>}
                {!compte.actif && <span className="shrink-0 text-[10px] text-red-300">{t.desactive}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={enCours || memes(coches, groupe.membres)}
          onClick={() => agir(() => definirMembresDuGroupe(groupe.id, [...coches]))}
        >
          {enCours ? t.enregistrement : t.enregistrer}
        </Button>
        {!memes(coches, groupe.membres) && <span className="text-xs text-accent-400">{t.nonEnregistre}</span>}
      </div>
    </div>
  );
}
