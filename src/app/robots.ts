import type { MetadataRoute } from "next";

/**
 * Le site est privé : rien ne doit être indexé.
 *
 * L'en-tête `X-Robots-Tag` posé dans `next.config.ts` fait déjà le travail sur
 * chaque réponse, y compris celles qu'un robots.txt ne couvre pas (images,
 * téléchargements). Ce fichier est la seconde barrière : un robot qui ne lirait
 * que robots.txt n'a ainsi aucune excuse, et l'absence de robots.txt sur un
 * domaine privé attire plus l'attention que sa présence.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
