"use client";

import { useActionState } from "react";
import { confirmRegistration, type FormState } from "@/lib/auth/actions";
import { Accentue, useT } from "@/components/langue";
import { Alert, Button, Panel } from "@/components/ui";

const initial: FormState = {};

export function ConfirmForm({
  token,
  pseudo,
  email,
}: {
  token: string;
  pseudo: string;
  email: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(confirmRegistration, initial);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">{t.connexion.confirmation.titre}</h1>
        {/* Le pseudo et l'adresse sont mis en valeur : ce sont eux qu'on relit avant de confirmer. */}
        <p className="text-sm text-ink-400 [&_strong]:text-ink-50">
          <Accentue texte={t.connexion.confirmation.explication(pseudo, email)} />
        </p>
        <input type="hidden" name="token" value={token} />

        {state.message && <Alert>{state.message}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? t.connexion.inscription.creation : t.connexion.inscription.creer}
        </Button>
      </form>
    </Panel>
  );
}
