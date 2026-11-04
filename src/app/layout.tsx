import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
