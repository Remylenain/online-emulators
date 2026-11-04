import type { MetadataRoute } from "next";
import { descriptionDuSite, nomApplication } from "@/lib/parametres";

/**
 * Manifeste d'application web : c'est lui qui permet d'ajouter le site à
 * l'écran d'accueil d'un téléphone et de le lancer en plein écran, sans
 * barre d'adresse — le lecteur occupe alors tout l'écran, comme une console.
 *
 * Servi sans session (voir `proxy.ts`) : le navigateur le demande sans
 * cookie, et une redirection vers la connexion l'empêcherait d'installer.
 */
// Le nom vient des réglages : le manifeste doit être produit à la demande,
// pas figé à la construction du site.
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  // Le même nom dans les deux champs : c'est ce que l'administrateur a
  // choisi de voir sous l'icône, le téléphone l'abrège lui-même s'il le faut.
  const nom = nomApplication();
  return {
    name: nom,
    short_name: nom,
    description: descriptionDuSite(),
    lang: "fr",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#13161f",
    theme_color: "#13161f",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
