import type { ReactNode } from "react";
import Link from "next/link";
import { textes } from "@/lib/i18n/serveur";
import { titreComplet, type JeuResume } from "@/lib/jeu-resume";

/** Une ligne de liste : vignette, titre, et ce que la section veut montrer à droite. */
export async function LigneJeu({ jeu, children }: { jeu: JeuResume; children: ReactNode }) {
  const t = await textes();
  return (
    <div className="flex items-center gap-4 bg-ink-900/40 px-4 py-3">
      <Link href={`/jeux/${jeu.consoleSlug}/${jeu.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
        {jeu.coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/cover/${jeu.id}`}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded border border-ink-800 bg-ink-950/60 object-contain"
          />
        ) : (
          <span className="size-12 shrink-0 rounded border border-ink-800 bg-ink-950/60" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink-50 hover:underline">
            {titreComplet(jeu, t.mesJeux.titrePartie)}
          </span>
          <span className="block text-xs uppercase text-ink-700">{jeu.consoleSlug}</span>
        </span>
      </Link>
      {children}
    </div>
  );
}

