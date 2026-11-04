"use client";

import { useActionState } from "react";
import { confirmRegistration, type FormState } from "@/lib/auth/actions";
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
  const [state, action, pending] = useActionState(confirmRegistration, initial);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">Confirme ton inscription</h1>
        <p className="text-sm text-ink-400">
          Le compte <strong className="text-ink-50">{pseudo}</strong> sera créé avec
          l&apos;adresse <strong className="text-ink-50">{email}</strong>, et tu seras connecté dans
          la foulée.
        </p>
        <input type="hidden" name="token" value={token} />

        {state.message && <Alert>{state.message}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
    </Panel>
  );
}
