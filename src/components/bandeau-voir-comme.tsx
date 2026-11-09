import { revenirAMonCompte } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/session";
import { textes } from "@/lib/i18n/serveur";

/**
 * Bandeau de « voir comme » : l'administrateur regarde le site avec les yeux
 * d'un autre compte. Il est en haut de toutes les pages, en couleur, pour
 * qu'on n'oublie pas sous quel nom on joue — une partie lancée ici est
 * enregistrée sur ce compte-là.
 */
export async function BandeauVoirComme({ user }: { user: SessionUser }) {
  const t = (await textes()).site.voirComme;
  // La phrase du dictionnaire porte un repère à la place du pseudo : il est
  // posé ici, en gras, sans jamais être relu comme du texte à mettre en forme.
  const [avant, apres = ""] = t.vuComme.split("{compte}");

  return (
    <div className="border-b border-amber-700/60 bg-amber-950/60 text-amber-100">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2 text-sm">
        <p>
          {avant}
          <strong>{user.pseudo}</strong>
          {apres}
          <span className="text-amber-200/70">{t.precision(user.vuPar?.pseudo ?? "")}</span>
        </p>
        <form action={revenirAMonCompte} className="ml-auto">
          <button
            type="submit"
            className="rounded border border-amber-500/60 px-2.5 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-900/60"
          >
            {t.revenir}
          </button>
        </form>
      </div>
    </div>
  );
}
