"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type FormState } from "@/lib/auth/actions";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

export function LoginForm({ inscriptionOuverte }: { inscriptionOuverte: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(login, initial);
  // Page demandée avant la redirection vers la connexion, posée par le middleware.
  const next = useSearchParams().get("suite") ?? "";

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">{t.connexion.entree.titre}</h1>
        {next && <input type="hidden" name="suite" value={next} />}

        {state.message && <Alert>{state.message}</Alert>}

        <Field label={t.connexion.entree.identifiant} htmlFor="identifier" error={state.errors?.identifier}>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            required
            autoFocus
          />
        </Field>

        <Field label={t.connexion.champs.motDePasse} htmlFor="password" error={state.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? t.connexion.entree.enCours : t.commun.seConnecter}
        </Button>

        <Link
          href="/mot-de-passe-oublie"
          className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
        >
          {t.connexion.entree.motDePasseOublie}
        </Link>
        {inscriptionOuverte && (
          <Link
            href="/inscription"
            className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
          >
            {t.connexion.entree.pasDeCompte}
          </Link>
        )}
      </form>
    </Panel>
  );
}
