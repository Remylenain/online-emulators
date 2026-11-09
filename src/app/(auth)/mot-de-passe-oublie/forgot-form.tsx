"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";

const initial: FormState = {};

export function ForgotPasswordForm({
  siteKey,
  mailActif,
}: {
  siteKey: string;
  /** Sans serveur de mail, aucun lien ne peut partir : seul l'administrateur peut aider. */
  mailActif: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  const retourConnexion = (
    <Link
      href="/connexion"
      className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
    >
      {t.connexion.oubli.retour}
    </Link>
  );

  if (!mailActif) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">{t.connexion.oubli.titre}</h1>
          <p className="text-sm text-ink-300">{t.connexion.oubli.sansMail}</p>
          {retourConnexion}
        </div>
      </Panel>
    );
  }

  if (state.done) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">{t.connexion.boiteMail}</h1>
          <Alert tone="success">{state.message}</Alert>
          {retourConnexion}
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">{t.connexion.oubli.titre}</h1>
        <p className="text-sm text-ink-400">{t.connexion.oubli.explication}</p>
        <p className="text-sm text-ink-400">{t.connexion.oubli.sansAdresse}</p>

        {state.message && <Alert>{state.message}</Alert>}

        <Field label={t.connexion.champs.email} htmlFor="email" error={state.errors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            autoFocus
          />
        </Field>

        <Turnstile siteKey={siteKey} />
        {state.errors?.captcha && <Alert>{state.errors.captcha}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? t.connexion.envoi : t.connexion.oubli.envoyer}
        </Button>

        {retourConnexion}
      </form>
    </Panel>
  );
}
