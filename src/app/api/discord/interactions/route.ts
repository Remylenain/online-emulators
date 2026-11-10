import { NextResponse } from "next/server";
import { clesPubliques } from "@/lib/discord/applications";
import { applicationVisee, reponse, signatureValide } from "@/lib/discord/interactions";

/**
 * L'adresse où Discord envoie ses interactions (« Interactions Endpoint
 * URL ») : c'est par elle qu'une commande tapée dans un salon lance
 * l'Activité (voir `src/lib/discord/interactions.ts`).
 *
 * Discord signe chaque requête avec la clé de l'application. Une signature
 * qui ne se vérifie pas vaut un 401, sans rien dire de plus : Discord en
 * envoie exprès de fausses pour s'assurer que l'adresse les refuse, à
 * l'enregistrement de l'adresse puis de temps en temps.
 *
 * Rien n'est lu du corps que l'application visée et le type d'interaction,
 * et rien n'en est gardé ni journalisé.
 */

/** Une interaction fait quelques kilooctets : au-delà, ce n'en est pas une. */
const TAILLE_MAX = 64 * 1024;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > TAILLE_MAX) {
    return new NextResponse("Trop long", { status: 413 });
  }
  const corps = await request.text();
  if (corps.length > TAILLE_MAX) return new NextResponse("Trop long", { status: 413 });

  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const horodatage = request.headers.get("x-signature-timestamp") ?? "";
  const signee = clesPubliques(applicationVisee(corps)).some((cle) =>
    signatureValide(cle, signature, horodatage, corps),
  );
  if (!signee) return new NextResponse("Signature refusée", { status: 401 });

  const reponseAEnvoyer = reponse(corps);
  if (!reponseAEnvoyer) return new NextResponse("Interaction inattendue", { status: 400 });
  return NextResponse.json(reponseAEnvoyer);
}
