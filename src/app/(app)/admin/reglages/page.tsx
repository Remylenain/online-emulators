import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guard";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";
import { Reglages } from "./reglages";

export const metadata: Metadata = { title: "Réglages" };

/** Ce qui se règle sans toucher au serveur : le nom du site et sa phrase d'accueil. */
export default async function ReglagesPage() {
  await requireAdmin();
  return <Reglages nom={nomDuSite()} description={descriptionDuSite()} />;
}
