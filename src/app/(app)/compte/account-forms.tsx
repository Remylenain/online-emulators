"use client";

import { useActionState } from "react";
import { changePassword, updateProfile, uploadAvatar } from "@/lib/account/actions";
import type { FormState } from "@/lib/auth/actions";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

const initial: FormState = {};

export function ProfileForm({ pseudo, email }: { pseudo: string; email: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, initial);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-ink-50">Profil</h2>

        {state.message && <Alert tone={state.done ? "success" : "error"}>{state.message}</Alert>}

        <Field label="Pseudo" htmlFor="pseudo" error={state.errors?.pseudo}>
          <Input id="pseudo" name="pseudo" defaultValue={pseudo} required />
        </Field>

        <Field
          label="Adresse e-mail (facultative)"
          htmlFor="email"
          error={state.errors?.email}
          hint="Sert à la réinitialisation du mot de passe. Sans adresse, c'est l'administrateur qui le change."
        >
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} />
        </Field>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Panel>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);

  return (
    <Panel>
      <form action={action} className="flex flex-col gap-5">
        <h2 className="text-base font-semibold text-ink-50">Mot de passe</h2>

        {state.message && <Alert tone={state.done ? "success" : "error"}>{state.message}</Alert>}

        <Field
          label="Mot de passe actuel"
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
          label="Nouveau mot de passe"
          htmlFor="password"
          error={state.errors?.password}
          hint="Au moins 10 caractères."
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

        <p className="text-xs text-ink-400">
          Changer le mot de passe ferme toutes les sessions, y compris celle-ci.
        </p>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Modification…" : "Changer le mot de passe"}
        </Button>
      </form>
    </Panel>
  );
}

export function AvatarForm({ hasAvatar }: { hasAvatar: boolean }) {
  const [state, action, pending] = useActionState(uploadAvatar, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.message && <Alert tone={state.done ? "success" : "error"}>{state.message}</Alert>}

      <Field
        label={hasAvatar ? "Remplacer l'avatar" : "Choisir un avatar"}
        htmlFor="avatar"
        error={state.errors?.avatar}
        hint="JPEG, PNG ou WebP, 5 Mo maximum. L'image est recadrée en carré."
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
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
