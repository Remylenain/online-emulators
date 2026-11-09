"use client";

import { useActionState } from "react";
import { changePassword, updateProfile, uploadAvatar } from "@/lib/account/actions";
import type { FormState } from "@/lib/auth/actions";
import { useT } from "@/components/langue";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

export function ProfileForm({ pseudo, email }: { pseudo: string; email: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  const t = useT();

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-ink-50">{t.compte.profil.titre}</h2>

        {state.message && <Alert tone={state.done ? "success" : "error"}>{state.message}</Alert>}

        <Field label={t.compte.profil.pseudo} htmlFor="pseudo" error={state.errors?.pseudo}>
          <Input id="pseudo" name="pseudo" defaultValue={pseudo} required />
        </Field>

        <Field
          label={t.compte.profil.email}
          htmlFor="email"
          error={state.errors?.email}
          hint={t.compte.profil.aideEmail}
        >
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} />
        </Field>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t.compte.profil.enregistrement : t.compte.profil.enregistrer}
        </Button>
      </form>
    </Panel>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const t = useT();

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-ink-50">{t.compte.motDePasse.titre}</h2>

        {state.message && <Alert tone={state.done ? "success" : "error"}>{state.message}</Alert>}

        <Field
          label={t.compte.motDePasse.actuel}
          htmlFor="currentPassword"
          error={state.errors?.currentPassword}
        >
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Field
          label={t.compte.motDePasse.nouveau}
          htmlFor="password"
          error={state.errors?.password}
          hint={t.compte.motDePasse.aideNouveau}
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>

        <Field
          label={t.compte.motDePasse.confirmation}
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

        <p className="text-xs text-ink-400">{t.compte.motDePasse.avertissement}</p>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t.compte.motDePasse.modification : t.compte.motDePasse.changer}
        </Button>
      </form>
    </Panel>
  );
}

export function AvatarForm({ hasAvatar }: { hasAvatar: boolean }) {
  const [state, action, pending] = useActionState(uploadAvatar, initial);
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.message && <Alert tone={state.done ? "success" : "error"}>{state.message}</Alert>}

      <Field
        label={hasAvatar ? t.compte.avatar.remplacer : t.compte.avatar.choisir}
        htmlFor="avatar"
        error={state.errors?.avatar}
        hint={t.compte.avatar.aide}
      >
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="w-full cursor-pointer rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-ink-200 file:mr-3 file:rounded-md file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-ink-200"
        />
      </Field>

      <Button type="submit" disabled={pending} variant="ghost" className="self-start">
        {pending ? t.compte.avatar.envoi : t.compte.avatar.envoyer}
      </Button>
    </form>
  );
}
