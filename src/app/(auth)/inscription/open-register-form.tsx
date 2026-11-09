"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestRegistration, type FormState } from "@/lib/auth/actions";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";

const initial: FormState = {};

/**
 * Inscription ouverte : adresse, pseudo, mot de passe, captcha. Le compte
 * n'existe qu'une fois le mail confirmé.
 */
export function OpenRegisterForm({ siteKey }: { siteKey: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(requestRegistration, initial);

  if (state.done) {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-ink-50">{t.connexion.boiteMail}</h1>
          <Alert tone="success">{state.message}</Alert>
          <RetourConnexion />
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-ink-50">{t.connexion.inscription.titre}</h1>
        <p className="text-sm text-ink-400">{t.connexion.inscription.explicationOuverte}</p>

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

        <Field
          label={t.connexion.champs.pseudo}
          htmlFor="pseudo"
          error={state.errors?.pseudo}
          hint={t.connexion.champs.aidePseudo}
        >
          <Input id="pseudo" name="pseudo" autoComplete="username" required />
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

        {/*
          Piège à robots : invisible, et vide chez un humain. Son libellé n'est
          lu que par les robots, il n'est donc pas traduit.
        */}
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
          <label htmlFor="siteweb">Site web</label>
          <input id="siteweb" name="siteweb" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Turnstile siteKey={siteKey} />
        {state.errors?.captcha && <Alert>{state.errors.captcha}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? t.connexion.envoi : t.connexion.inscription.recevoirLeLien}
        </Button>

        <RetourConnexion />
      </form>
    </Panel>
  );
}

function RetourConnexion() {
  const t = useT();
  return (
    <Link
      href="/connexion"
      className="text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
    >
      {t.connexion.dejaUnCompte}
    </Link>
  );
}
