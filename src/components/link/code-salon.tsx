/**
 * Affiche un texte du dictionnaire qui cite un code de salon.
 *
 * Même convention que `Accentue` (`src/components/langue.tsx`) — le passage
 * entre astérisques, « le salon *ABC123* » — mais la mise en valeur est celle
 * d'un code : une chasse fixe, pour qu'on le recopie sans en confondre les
 * caractères. La place du code dans la phrase reste ainsi l'affaire du
 * dictionnaire, et son habit celle de l'écran.
 */
export function AvecCode({
  texte,
  balise: Balise = "span",
  classes = "font-mono",
}: {
  texte: string;
  /** `strong` là où le code est ce qu'il faut retenir du message. */
  balise?: "span" | "strong";
  classes?: string;
}) {
  const morceaux = texte.split("*");
  return (
    <>
      {morceaux.map((morceau, rang) =>
        rang % 2 === 1 ? (
          <Balise key={rang} className={classes}>
            {morceau}
          </Balise>
        ) : (
          <span key={rang}>{morceau}</span>
        ),
      )}
    </>
  );
}
