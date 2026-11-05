import { redirect } from "next/navigation";

/**
 * L'administration n'a pas d'accueil propre : elle s'ouvre sur les comptes,
 * la page la plus souvent demandée. Le lien « Administration » du menu peut
 * ainsi rester tel quel, et les favoris déjà posés continuent de marcher.
 */
export default function AdminPage() {
  redirect("/admin/tableau");
}
