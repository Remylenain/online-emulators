"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword, type FormState } from "@/lib/auth/actions";
import { useT } from "@/components/langue";
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
  const textes = useT();
  const champs = textes.connexion.champs;
  const t = textes.connexion.reinitialisation;
  const [state, action, pending] = useActionState(resetPassword, initial);

  if (state.done) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">{invitation ? t.bienvenue.fait : t.fait}</h1>
          <Alert tone="success">{invitation ? t.bienvenue.enregistre : state.message}</Alert>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-500"
          >
            {textes.commun.seConnecter}
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">{invitation ? t.bienvenue.titre : t.titre}</h1>
        {invitation && <p className="text-sm text-ink-400">{t.bienvenue.explication}</p>}
        <input type="hidden" name="token" value={token} />

        {state.message && <Alert>{state.message}</Alert>}

        <Field
          label={invitation ? champs.motDePasse : t.titre}
          htmlFor="password"
          error={state.errors?.password}
          hint={champs.aideMotDePasse}
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

        <Field label={champs.confirmation} htmlFor="passwordConfirm" error={state.errors?.passwordConfirm}>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? t.enCours : invitation ? t.bienvenue.enregistrer : t.changer}
        </Button>
      </form>
    </Panel>
  );
}
