"use client";

/**
 * Habillage d'écran : l'image d'une console dessinée autour du jeu.
 *
 * Les coordonnées de l'écran sont des fractions de l'image, mesurées par le
 * scan. Le lecteur s'en sert pour poser le canvas exactement dans le trou.
 */
export type Habillage = {
  id: string;
  nom: string;
  url: string;
  largeur: number;
  hauteur: number;
  ecran: { x: number; y: number; largeur: number; hauteur: number };
};

/**
 * Choix de l'habillage, en vignettes : un nom de fichier ne dit rien de la
 * couleur d'une console, une miniature si.
 */
export function ChoixHabillage({
  habillages,
  choisi,
  surChoix,
}: {
  habillages: Habillage[];
  choisi: string | null;
  surChoix: (id: string | null) => void;
}) {
  if (habillages.length === 0) return null;

  const vignette = (actif: boolean) =>
    `flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border text-xs transition-colors ${
      actif
        ? "border-accent-500 ring-2 ring-accent-500/60"
        : "border-ink-700 hover:border-ink-400"
    }`;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink-50">Habillage</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => surChoix(null)}
          aria-pressed={choisi === null}
          className={`${vignette(choisi === null)} bg-black text-ink-400`}
        >
          Aucun
        </button>
        {habillages.map((habillage) => (
          <button
            key={habillage.id}
            type="button"
            onClick={() => surChoix(habillage.id)}
            aria-pressed={choisi === habillage.id}
            aria-label={habillage.nom}
            title={habillage.nom}
            className={`${vignette(choisi === habillage.id)} bg-black`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={habillage.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
