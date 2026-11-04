"use client";

import { useActionState } from "react";
import { definirNomDuSite, type Resultat } from "@/lib/admin/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

export function Reglages({ nom, description }: { nom: string; description: string }) {
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
          <Button type="submit" disabled={enCours} className="self-start">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </Panel>
    </section>
  );
}
