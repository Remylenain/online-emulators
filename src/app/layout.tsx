import type { Metadata, Viewport } from "next";
import { FournisseurLangue } from "@/components/langue";
import { langueDeLaRequete } from "@/lib/i18n/serveur";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";
import "./globals.css";

/**
 * Le nom du site vient des réglages : chaque page ne donne que son propre
 * titre, et le gabarit y accole le nom choisi par l'administrateur.
 */
export function generateMetadata(): Metadata {
  const nom = nomDuSite();
  return {
    title: { default: nom, template: `%s — ${nom}` },
    description: descriptionDuSite(),
    robots: { index: false, follow: false },
    manifest: "/manifest.webmanifest",
    icons: { apple: "/apple-touch-icon.png" },
    // Sur iPhone, l'ajout à l'écran d'accueil lance le site en plein écran.
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: nom },
  };
}

export const viewport: Viewport = {
  // Le lecteur occupe tout l'écran sur mobile : pas de zoom accidentel
  // en tapotant les boutons tactiles.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#13161f",
};

/**
 * La langue se décide ici, une fois par requête, et descend par le
 * fournisseur : `lang` pour le navigateur et les lecteurs d'écran, les textes
 * pour les composants. Les écrans qui ne lisent pas encore les dictionnaires
 * restent en français, quelle que soit cette langue (voir `docs/langues.md`).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const langue = await langueDeLaRequete();
  return (
    <html lang={langue}>
      <body className="min-h-dvh font-sans antialiased">
        <FournisseurLangue langue={langue}>{children}</FournisseurLangue>
      </body>
    </html>
  );
}
