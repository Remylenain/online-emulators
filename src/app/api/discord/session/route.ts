import { NextResponse } from "next/server";
import { compteDiscord } from "@/lib/discord/compte";
import { adressesCoeur } from "@/lib/discord/coeur";
import { jeuConfigure } from "@/lib/discord/jeu";
import { signerJeton } from "@/lib/discord/jeton";
import { echangerCode, profilDiscord, type ProfilDiscord } from "@/lib/discord/oauth";
import { discordActive, discordEssaiLocal } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Ouvre une session de l'Activité Discord.
 *
 * La page envoie le `code` que le client Discord lui a remis. Il est échangé
 * ici contre un jeton d'accès, puis Discord nous dit qui est l'utilisateur.
 * En retour, la page reçoit de quoi jouer : son jeton pour les routes
 * `/api/discord`, la fiche du jeu, et l'adresse du cœur.
 *
 * Le jeton d'accès Discord repart vers la page, qui en a besoin pour terminer
 * la poignée de main du SDK (`authenticate`). Il n'est ni conservé ni
 * journalisé ici.
 */
export async function POST(request: Request) {
  if (!discordActive && !discordEssaiLocal) return new NextResponse("Introuvable", { status: 404 });

  // Chaque ouverture coûte deux appels à l'API de Discord : on borne.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  const debit = rateLimit(`discord-session:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!debit.allowed) {
    return NextResponse.json(
      { erreur: "Trop de tentatives. Réessaie dans un instant." },
      { status: 429, headers: { "Retry-After": String(debit.retryAfter) } },
    );
  }

  let corps: { code?: unknown; essai?: unknown; nom?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const jeu = await jeuConfigure();
  if (!jeu) {
    return NextResponse.json({ erreur: "Le jeu de cette Activité est introuvable." }, { status: 503 });
  }

  let profil: ProfilDiscord;
  let jetonAcces: string | null = null;

  if (corps.essai === true) {
    if (!discordEssaiLocal) return NextResponse.json({ erreur: "Essai local désactivé." }, { status: 403 });
    // Un nom facultatif, pour essayer à plusieurs sans partager la partie.
    const nom = typeof corps.nom === "string" && /^[a-z0-9]{1,16}$/.test(corps.nom) ? corps.nom : "";
    profil = { id: nom ? `essai-local-${nom}` : "essai-local", pseudo: nom ? `Essai ${nom}` : "Essai local" };
  } else {
    if (!discordActive) return new NextResponse("Introuvable", { status: 404 });
    if (typeof corps.code !== "string" || corps.code.length === 0 || corps.code.length > 200) {
      return NextResponse.json({ erreur: "Code d'autorisation manquant." }, { status: 400 });
    }
    jetonAcces = await echangerCode(corps.code);
    const connu = jetonAcces ? await profilDiscord(jetonAcces) : null;
    if (!jetonAcces || !connu) {
      return NextResponse.json({ erreur: "Discord n'a pas reconnu cette connexion." }, { status: 401 });
    }
    profil = connu;
  }

  const compte = compteDiscord(profil, jeu.id);
  if (!compte) return NextResponse.json({ erreur: "Ce compte est désactivé." }, { status: 403 });

  return NextResponse.json(
    {
      jeton: signerJeton(compte.id),
      jetonDiscord: jetonAcces,
      pseudo: compte.pseudo,
      jeu: { titre: jeu.titre, console: jeu.console, taille: jeu.taille, empreinte: jeu.empreinte },
      coeur: adressesCoeur(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
