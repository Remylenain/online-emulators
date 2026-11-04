import { z } from "zod";

/**
 * Règles communes aux formulaires et aux scripts en ligne de commande, pour
 * qu'un compte créé à la main respecte les mêmes contraintes qu'un compte créé
 * par le site.
 */

export const pseudoSchema = z
  .string()
  .trim()
  .min(3, "Le pseudo doit faire au moins 3 caractères.")
  .max(24, "Le pseudo ne peut pas dépasser 24 caractères.")
  .regex(
    /^[\p{L}\p{N}](?:[\p{L}\p{N}_ -]*[\p{L}\p{N}])?$/u,
    "Le pseudo accepte lettres, chiffres, espaces, tirets et soulignés.",
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Cette adresse e-mail n'est pas valide."))
  .refine((value) => value.length <= 180, "Cette adresse e-mail est trop longue.");

/**
 * Adresse facultative : un champ laissé vide donne `null`. Un compte sans
 * adresse ne peut pas recevoir de lien, l'administrateur change alors son
 * mot de passe à la main.
 */
export const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  emailSchema.nullable(),
);

/**
 * Longueur minimale plutôt qu'un jeu de caractères imposé : une phrase longue
 * résiste mieux qu'un « P@ssw0rd » et s'oublie moins.
 */
export const passwordSchema = z
  .string()
  .min(10, "Le mot de passe doit faire au moins 10 caractères.")
  .max(200, "Le mot de passe ne peut pas dépasser 200 caractères.");

export const loginSchema = z.object({
  // À la connexion, l'identifiant peut être le pseudo ou l'adresse e-mail.
  identifier: z.string().trim().min(1, "Renseigne ton pseudo ou ton adresse e-mail."),
  password: z.string().min(1, "Renseigne ton mot de passe."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["passwordConfirm"],
  });

/** Inscription par lien : la personne choisit son pseudo et son mot de passe. */
export const registerSchema = z
  .object({
    token: z.string().min(1),
    pseudo: pseudoSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["passwordConfirm"],
  });

/**
 * Inscription ouverte : adresse, pseudo, mot de passe, captcha. `siteweb` est
 * un piège à robots : un champ invisible qu'un humain ne remplit jamais.
 */
export const openRegisterSchema = z
  .object({
    email: emailSchema,
    pseudo: pseudoSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    captchaToken: z.string().optional(),
    siteweb: z.string().max(0).optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["passwordConfirm"],
  });

export const updateProfileSchema = z.object({
  pseudo: pseudoSchema,
  email: optionalEmailSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Renseigne ton mot de passe actuel."),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["passwordConfirm"],
  });

/** Transforme un titre en identifiant d'URL : « Pokémon Violette » → « pokemon-violette ». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Normalise une chaîne pour la recherche : minuscules, sans accents.
 *
 * Le scan écrit le résultat dans `games.search_text`, et la recherche compare
 * avec le même traitement. SQLite compare les octets : sans cette
 * normalisation des deux côtés, chercher « emeraude » ne trouverait jamais
 * « Émeraude ».
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Première erreur par champ, dans la forme attendue par les formulaires. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    errors[key] ??= issue.message;
  }
  return errors;
}
