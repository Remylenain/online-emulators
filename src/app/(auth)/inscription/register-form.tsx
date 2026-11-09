"use client";

import { useActionState } from "react";
import { register, type FormState } from "@/lib/auth/actions";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

/** Création d'un compte par la personne invitée : pseudo et mot de passe. */
export function RegisterForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(register, initial);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">{t.connexion.inscription.titre}</h1>
        <p className="text-sm text-ink-400">{t.connexion.inscription.explicationInvitation}</p>
        <input type="hidden" name="token" value={token} />

        {state.message && <Alert>{state.message}</Alert>}

        <Field
          label={t.connexion.champs.pseudo}
          htmlFor="pseudo"
          error={state.errors?.pseudo}
          hint={t.connexion.champs.aidePseudo}
        >
          <Input id="pseudo" name="pseudo" autoComplete="username" required autoFocus />
        </Field>

        <Field
          label={t.connexion.champs.motDePasse}
          htmlFor="password"
          error={state.errors?.password}
          hint={t.connexion.champs.aideMotDePasse}
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>

        <Field
          label={t.connexion.champs.confirmation}
          htmlFor="passwordConfirm"
          error={state.errors?.passwordConfirm}
        >
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? t.connexion.inscription.creation : t.connexion.inscription.creer}
        </Button>
      </form>
    </Panel>
  );
}
