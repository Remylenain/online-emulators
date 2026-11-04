import Link from "next/link";
import type { ReactNode } from "react";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-ink-50">
          {nomDuSite()}
        </Link>
        <p className="max-w-sm text-sm text-ink-400">{descriptionDuSite()}</p>
      </header>

      <main className="w-full max-w-sm">{children}</main>

      <footer className="text-xs text-ink-700">Accès réservé aux comptes du site.</footer>
    </div>
  );
}
