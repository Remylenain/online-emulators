import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userGames, users } from "@/db/schema";
import type { Visiteur } from "@/lib/acces";
import { newId } from "@/lib/auth/session";
import { lireJeton } from "./jeton";
import type { ProfilDiscord } from "./oauth";

/**
 * Le compte du site derrière un utilisateur Discord.
 *
 * Au premier lancement de l'Activité, le compte est créé : **restreint**, avec
 * pour seul jeu attribué celui de l'Activité. Toutes les règles de
 * `src/lib/acces.ts` s'appliquent alors telles quelles — ce compte ne voit
 * rien d'autre du catalogue, ni par l'Activité ni autrement.
 *
 * Il n'a pas de mot de passe : l'empreinte enregistrée n'en est pas une, et
 * aucune saisie ne peut lui correspondre. On n'y entre que par Discord.
 */
const SANS_MOT_DE_PASSE = "!discord";

/** Un pseudo que le site accepte (voir `pseudoSchema`), tiré du nom Discord. */
function pseudoPropre(nom: string): string {
  const propre = nom
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .slice(0, 20)
    .replace(/[^\p{L}\p{N}]+$/u, "");
  return propre.length >= 3 ? propre : "Joueur";
}

function pseudoLibre(souhaite: string): string {
  for (let n = 1; n < 1000; n++) {
    const candidat = n === 1 ? souhaite : `${souhaite} ${n}`;
    const pris = db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.pseudo}) = ${candidat.toLowerCase()}`)
      .get();
    if (!pris) return candidat;
  }
  return `${souhaite} ${newId().slice(0, 8)}`;
}

/**
 * Trouve le compte rattaché à cet utilisateur Discord, ou le crée, et lui
 * attribue le jeu de l'Activité. Rend `null` si le compte a été désactivé.
 */
export function compteDiscord(profil: ProfilDiscord, gameId: string): { id: string; pseudo: string } | null {
  let compte = db
    .select({ id: users.id, pseudo: users.pseudo, isActive: users.isActive })
    .from(users)
    .where(eq(users.discordId, profil.id))
    .get();

  if (!compte) {
    const cree = { id: newId(), pseudo: pseudoLibre(pseudoPropre(profil.pseudo)), isActive: true };
    db.insert(users)
      .values({
        id: cree.id,
        pseudo: cree.pseudo,
        passwordHash: SANS_MOT_DE_PASSE,
        accessMode: "restreint",
        discordId: profil.id,
      })
      .run();
    compte = cree;
  }
  if (!compte.isActive) return null;

  // Sans effet sur un compte « normal » déjà rattaché : il voit le jeu de
  // toute façon s'il est publié, et l'attribution le lui garde sinon.
  db.insert(userGames).values({ userId: compte.id, gameId }).onConflictDoNothing().run();

  return { id: compte.id, pseudo: compte.pseudo };
}

/**
 * Qui est derrière une requête de l'Activité : le jeton de l'en-tête
 * `Authorization` — ou, pour une lecture seulement, dans l'adresse
 * (`?jeton=`), parce qu'une balise `<img>` ne porte pas d'en-tête —, puis le
 * compte en base. Un compte désactivé entre-temps est refusé, même avec un
 * jeton encore valable.
 */
export function compteDepuisRequete(request: Request): Visiteur | null {
  const entete = request.headers.get("authorization") ?? "";
  let brut: string | null = null;
  if (entete.startsWith("Bearer ")) brut = entete.slice(7).trim();
  else if (request.method === "GET") brut = new URL(request.url).searchParams.get("jeton");
  if (!brut) return null;
  const userId = lireJeton(brut);
  if (!userId) return null;

  const compte = db
    .select({ id: users.id, accessMode: users.accessMode })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .get();
  return compte ?? null;
}
