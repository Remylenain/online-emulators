"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword, type FormState } from "@/lib/auth/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

export function ResetPasswordForm({
  token,
  invitation = false,
}: {
  token: string;
  /** Vrai quand le lien ouvre un compte neuf plutôt qu'il n'en débloque un. */
  invitation?: boolean;
}) {
  const [state, action, pending] = useActionState(resetPassword, initial);

  if (state.done) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">
            {invitation ? "Bienvenue" : "C'est fait"}
          </h1>
          <Alert tone="success">
            {invitation
              ? "Ton mot de passe est enregistré. Tu peux te connecter et commencer à jouer."
              : state.message}
          </Alert>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-500"
          >
            Se connecter
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">
          {invitation ? "Choisis ton mot de passe" : "Nouveau mot de passe"}
        </h1>
        {invitation && (
          <p className="text-sm text-ink-400">
            Ton compte est prêt. Il ne manque que le mot de passe avec lequel tu te
            connecteras.
          </p>
        )}
        <input type="hidden" name="token" value={token} />

        {state.message && <Alert>{state.message}</Alert>}

        <Field
          label={invitation ? "Mot de passe" : "Nouveau mot de passe"}
          htmlFor="password"
          error={state.errors?.password}
          hint="Au moins 10 caractères. Une phrase dont tu te souviens vaut mieux qu'un mot compliqué."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
          />
        </Field>

        <Field
          label="Confirmation"
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
          {pending
            ? "Enregistrement…"
            : invitation
              ? "Enregistrer et continuer"
              : "Changer le mot de passe"}
        </Button>
      </form>
    </Panel>
  );
}
