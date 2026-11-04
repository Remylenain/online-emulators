"use client";

import { useActionState } from "react";
import { register, type FormState } from "@/lib/auth/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

/** Création d'un compte par la personne invitée : pseudo et mot de passe. */
export function RegisterForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(register, initial);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">Crée ton compte</h1>
        <p className="text-sm text-ink-400">
          Choisis le pseudo sous lequel tu joueras, et ton mot de passe. Tu seras
          connecté dans la foulée.
        </p>
        <input type="hidden" name="token" value={token} />

        {state.message && <Alert>{state.message}</Alert>}

        <Field
          label="Pseudo"
          htmlFor="pseudo"
          error={state.errors?.pseudo}
          hint="De 3 à 24 caractères : lettres, chiffres, espaces, tirets et soulignés."
        >
          <Input id="pseudo" name="pseudo" autoComplete="username" required autoFocus />
        </Field>

        <Field
          label="Mot de passe"
          htmlFor="password"
          error={state.errors?.password}
          hint="Au moins 10 caractères. Une phrase dont tu te souviens vaut mieux qu'un mot compliqué."
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>

        <Field label="Confirmation" htmlFor="passwordConfirm" error={state.errors?.passwordConfirm}>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
    </Panel>
  );
}
