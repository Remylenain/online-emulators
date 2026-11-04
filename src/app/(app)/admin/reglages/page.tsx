import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guard";
import { etatCapacite } from "@/lib/link/capacite";
import { descriptionDuSite, nomDuSite } from "@/lib/parametres";
import { Reglages } from "./reglages";

export const metadata: Metadata = { title: "Réglages" };
// La capacité du câble link dépend des salons ouverts à l'instant.
export const dynamic = "force-dynamic";

/**
 * Ce qui se règle sans toucher au serveur : le nom du site, sa phrase
 * d'accueil, et la part du processeur laissée au câble link.
 */
export default async function ReglagesPage() {
  await requireAdmin();
  return <Reglages nom={nomDuSite()} description={descriptionDuSite()} capacite={etatCapacite()} />;
}
