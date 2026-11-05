"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";

const initial: FormState = {};

const retourConnexion = (
  <Link
    href="/connexion"
    className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
  >
    Retour à la connexion
  </Link>
);

export function ForgotPasswordForm({
  siteKey,
  mailActif,
}: {
  siteKey: string;
  /** Sans serveur de mail, aucun lien ne peut partir : seul l'administrateur peut aider. */
  mailActif: boolean;
}) {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (!mailActif) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">Mot de passe oublié</h1>
          <p className="text-sm text-ink-300">
            Demande à l&apos;administrateur du site : il te donnera un nouveau mot de passe, que tu pourras
            ensuite changer depuis ton compte.
          </p>
          {retourConnexion}
        </div>
      </Panel>
    );
  }

  if (state.done) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">Vérifie ta boîte mail</h1>
          <Alert tone="success">{state.message}</Alert>
          {retourConnexion}
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">Mot de passe oublié</h1>
        <p className="text-sm text-ink-400">
          Indique l&apos;adresse e-mail de ton compte : un lien de réinitialisation
          valable une heure y sera envoyé.
        </p>
        <p className="text-sm text-ink-400">
          Pas d&apos;adresse e-mail sur ton compte ? Demande à l&apos;administrateur de te donner un
          nouveau mot de passe.
        </p>

        {state.message && <Alert>{state.message}</Alert>}

        <Field label="Adresse e-mail" htmlFor="email" error={state.errors?.email}>
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
          {pending ? "Envoi…" : "Envoyer le lien"}
        </Button>

        {retourConnexion}
      </form>
    </Panel>
  );
}
