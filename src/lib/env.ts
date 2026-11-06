import { z } from "zod";

/**
 * Configuration validée au démarrage.
 *
 * Toute valeur propre à une installation (domaine, chemins, secrets, SMTP)
 * passe par ici. Rien de tout cela n'est écrit en dur ailleurs dans le code :
 * c'est ce qui permettra de publier le dépôt sans rien révéler de l'instance.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_PATH: z.string().min(1),

  PUBLIC_URL: z
    .url()
    .transform((value) => value.replace(/\/$/, "")),

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),

  LIBRARY_DIR: z.string().min(1),
  DATA_DIR: z.string().min(1),

  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  MAIL_FROM: z.string().default(""),

  TURNSTILE_SITE_KEY: z.string().default(""),
  TURNSTILE_SECRET_KEY: z.string().default(""),

  // Activité Discord (facultative). Rien de tout cela ne va dans le dépôt :
  // les conditions développeur de Discord rangent l'identifiant d'application
  // avec les secrets, et interdisent de les publier dans un projet ouvert.
  DISCORD_CLIENT_ID: z.string().default(""),
  DISCORD_CLIENT_SECRET: z.string().default(""),
  /** Identifiant du jeu servi par l'Activité (colonne `games.id`). */
  DISCORD_JEU: z.string().default(""),
  /**
   * Verrou facultatif : l'identifiant du seul serveur Discord où l'Activité
   * accepte d'être jouée. Demande aussi `DISCORD_BOT_TOKEN`, sans lequel
   * Discord ne dit pas où une Activité tourne.
   */
  DISCORD_SERVEUR: z.string().regex(/^\d{17,20}$|^$/, "DISCORD_SERVEUR est un identifiant de serveur Discord").default(""),
  DISCORD_BOT_TOKEN: z.string().default(""),
  /** « 1 » : ouvre `/discord` hors de Discord, pour l'essayer. Jamais en production. */
  DISCORD_ESSAI_LOCAL: z.string().default(""),
});

const parsed = schema
  .refine((valeurs) => !valeurs.DISCORD_SERVEUR || valeurs.DISCORD_BOT_TOKEN.length > 0, {
    path: ["DISCORD_BOT_TOKEN"],
    // Mieux vaut refuser de démarrer que démarrer avec un verrou qui ne
    // peut rien vérifier.
    message: "DISCORD_SERVEUR est réglé : DISCORD_BOT_TOKEN est alors obligatoire",
  })
  .safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuration invalide (voir .env.example) :\n${details}`);
}

export const env = parsed.data;

/** Le captcha est contourné tant qu'aucune clé Turnstile n'est fournie. */
export const captchaEnabled = env.TURNSTILE_SECRET_KEY.length > 0;

/**
 * Essai hors de Discord : un compte de test, sans passer par l'OAuth. Refusé
 * en production quoi que dise l'environnement — ce serait une porte ouverte
 * sur le jeu sans compte. Il faut tout de même une Activité configurée pour
 * l'hôte demandé (voir `src/lib/discord/applications.ts`).
 */
export const discordEssaiLocal = env.NODE_ENV !== "production" && env.DISCORD_ESSAI_LOCAL === "1";

/** Sans SMTP configuré, les e-mails sont écrits dans la console. */
export const mailEnabled = env.SMTP_HOST.length > 0;
