"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type FormState } from "@/lib/auth/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

export function LoginForm({ inscriptionOuverte }: { inscriptionOuverte: boolean }) {
  const [state, action, pending] = useActionState(login, initial);
  // Page demandée avant la redirection vers la connexion, posée par le middleware.
  const next = useSearchParams().get("suite") ?? "";

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">Connexion</h1>
        {next && <input type="hidden" name="suite" value={next} />}

        {state.message && <Alert>{state.message}</Alert>}

        <Field label="Pseudo ou adresse e-mail" htmlFor="identifier" error={state.errors?.identifier}>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            required
            autoFocus
          />
        </Field>

        <Field label="Mot de passe" htmlFor="password" error={state.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </Button>

        <Link
          href="/mot-de-passe-oublie"
          className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
        {inscriptionOuverte && (
          <Link
            href="/inscription"
            className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
          >
            Pas encore de compte ? Inscris-toi
          </Link>
        )}
      </form>
    </Panel>
  );
}
