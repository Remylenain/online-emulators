import type { Metadata } from "next";
import { Avatar } from "@/components/avatar";
import { Button, Panel } from "@/components/ui";
import { removeAvatar } from "@/lib/account/actions";
import { requireUser } from "@/lib/auth/guard";
import { AvatarForm, PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-50">Mon compte</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-ink-50">Avatar</h2>
            <div className="flex items-center gap-4">
              <Avatar user={user} size={72} />
              {user.avatarPath && (
                <form action={removeAvatar}>
                  <Button type="submit" variant="ghost">
                    Retirer
                  </Button>
                </form>
              )}
            </div>
            <AvatarForm hasAvatar={Boolean(user.avatarPath)} />
          </div>
        </Panel>

        <ProfileForm pseudo={user.pseudo} email={user.email} />

        <div className="lg:col-span-2 lg:max-w-xl">
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
