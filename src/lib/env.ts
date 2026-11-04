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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuration invalide (voir .env.example) :\n${details}`);
}

export const env = parsed.data;

/** Le captcha est contourné tant qu'aucune clé Turnstile n'est fournie. */
export const captchaEnabled = env.TURNSTILE_SECRET_KEY.length > 0;

/** Sans SMTP configuré, les e-mails sont écrits dans la console. */
export const mailEnabled = env.SMTP_HOST.length > 0;
