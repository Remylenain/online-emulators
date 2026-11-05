import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guard";
import { EssaiPs1 } from "./essai-ps1";

export const metadata: Metadata = { title: "Essai PS1" };

/**
 * Banc d'essai de l'émulation PlayStation, réservé à l'administration.
 *
 * Rien ici ne touche au catalogue ni au serveur : l'image du disque est
 * choisie sur l'appareil et reste dans le navigateur. La page sert à juger,
 * sur chaque appareil, si le cœur tient la cadence avant d'aller plus loin.
 */
export default async function Ps1Page() {
  await requireAdmin();
  return <EssaiPs1 />;
}
