"use client";

import { useActionState } from "react";
import { definirMargeCableLink, definirNomDuSite, type Resultat } from "@/lib/admin/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import type { EtatCapacite } from "@/lib/link/capacite";

export function Reglages({
  nom,
  description,
  application,
  capacite,
}: {
  nom: string;
  description: string;
  /** Nom sous l'icône une fois le site installé sur un téléphone ; vide = nom du site. */
  application: string;
  capacite: EtatCapacite;
}) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(
    definirNomDuSite,
    null,
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink-50">Réglages</h2>
      <Panel className="max-w-xl">
        <form action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-200">Identité du site</h3>
          {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}
          <Field label="Nom du site" htmlFor="nom" hint="Affiché dans l'en-tête, les onglets et sur la page de connexion.">
            <Input id="nom" name="nom" defaultValue={nom} required maxLength={40} />
          </Field>
          <Field label="Phrase d'accueil" htmlFor="description" hint="Sous le nom, sur la page de connexion.">
            <Input id="description" name="description" defaultValue={description} maxLength={120} />
          </Field>
          <Field
            label="Nom de l'application installée"
            htmlFor="application"
            hint="Sous l'icône, quand le site est ajouté à l'écran d'accueil d'un téléphone. Vide : le nom du site. Un téléphone n'affiche qu'une douzaine de caractères."
          >
            <Input id="application" name="application" defaultValue={application} maxLength={40} placeholder={nom} />
          </Field>
          <Button type="submit" disabled={enCours} className="self-start">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </Panel>
      <CableLink capacite={capacite} />
    </section>
  );
}

/**
 * Combien de salons le serveur accepte en même temps. Les coûts viennent
 * d'une mesure faite sur le serveur ; seule la marge se règle ici.
 */
function CableLink({ capacite }: { capacite: EtatCapacite }) {
  const [retour, action, enCours] = useActionState<Resultat | null, FormData>(
    definirMargeCableLink,
    null,
  );
  const mesure = capacite.charges.gb !== null || capacite.charges.gba !== null;

  return (
    <Panel className="max-w-xl">
      <form action={action} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink-200">Câble link</h3>
        {retour && <Alert tone={retour.ok ? "success" : "error"}>{retour.message}</Alert>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-400">Processeur</dt>
          <dd className="text-ink-50">
            {capacite.coeurs} cœur{capacite.coeurs > 1 ? "s" : ""}, dont {capacite.budget.toFixed(1)} pour le câble link
            à {capacite.marge} %
          </dd>
          <dt className="text-ink-400">Un salon GB / GBC</dt>
          <dd className="text-ink-50">
            {capacite.charges.gb === null ? "pas mesuré" : `${capacite.charges.gb.toFixed(2)} cœur`}
          </dd>
          <dt className="text-ink-400">Un salon GBA</dt>
          <dd className="text-ink-50">
            {capacite.charges.gba === null ? "pas mesuré" : `${capacite.charges.gba.toFixed(2)} cœur`}
          </dd>
          <dt className="text-ink-400">En ce moment</dt>
          <dd className="text-ink-50">
            {capacite.salonsOuverts === 0
              ? "aucun salon ouvert"
              : `${capacite.salonsOuverts} salon${capacite.salonsOuverts > 1 ? "s" : ""} ouvert${capacite.salonsOuverts > 1 ? "s" : ""}, ${capacite.enCours.toFixed(2)} cœur pris`}
            {mesure && (
              <>
                {" "}
                — encore {capacite.libres.gb ?? "∞"} salon{(capacite.libres.gb ?? 2) > 1 ? "s" : ""} GB / GBC ou{" "}
                {capacite.libres.gba ?? "∞"} GBA
              </>
            )}
          </dd>
        </dl>

        {!mesure && (
          <Alert tone="info">
            Aucune limite pour l&apos;instant. Pour en poser une, lance sur le serveur{" "}
            <code className="font-mono text-xs">npm run link:capacite -- --appliquer</code> : il mesure ce
            que coûte un salon de chaque console et l&apos;enregistre ici.
          </Alert>
        )}

        <Field
          label="Part du processeur réservée au câble link"
          htmlFor="marge"
          hint="En pour cent. Le reste sert au site lui-même. 60 à 70 % laisse de quoi voir venir."
        >
          <Input id="marge" name="marge" type="number" min={10} max={100} step={1} defaultValue={capacite.marge} className="w-28" />
        </Field>
        <Button type="submit" disabled={enCours} className="self-start">
          {enCours ? "Enregistrement…" : "Enregistrer la marge"}
        </Button>
      </form>
    </Panel>
  );
}
