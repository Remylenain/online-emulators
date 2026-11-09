import { textes } from "@/lib/i18n/serveur";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";
import { boutonsDeLaVitrine } from "@/lib/vitrine";

/**
 * L'accueil de la vitrine : un bouton par jeu ouvert aux invités, et rien
 * d'autre. C'est ce que montre la racine du site à un visiteur sans compte
 * (`src/proxy.ts`) ; un compte connecté y trouve son catalogue, comme avant.
 */
export default async function AccueilVitrine() {
  const boutons = await boutonsDeLaVitrine();
  const t = await textes();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 py-10 text-center sm:py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">{nomDuSite()}</h1>
        <p className="text-ink-400">{descriptionDuSite()}</p>
      </div>

      <div className="flex w-full flex-col items-stretch justify-center gap-4 sm:flex-row">
        {boutons.map((bouton) => (
          <a
            key={`${bouton.consoleSlug}/${bouton.slug}`}
            href={`/partie/${bouton.consoleSlug}/${bouton.slug}`}
            title={bouton.titre}
            className="rounded-panel border border-accent-600 bg-accent-600/15 px-8 py-5 text-lg font-semibold text-accent-400 transition-colors hover:bg-accent-600/25 sm:min-w-56"
          >
            {bouton.libelle}
          </a>
        ))}
      </div>

      <p className="max-w-md text-sm text-ink-400">
        {t.vitrine.sansCompte}
      </p>
    </div>
  );
}
