import { z } from "zod";

/**
 * Règles communes aux formulaires et aux scripts en ligne de commande, pour
 * qu'un compte créé à la main respecte les mêmes contraintes qu'un compte créé
 * par le site.
 */

/**
 * Les messages des schémas, en français : ceux que rendent les exports de ce
 * module quand on ne leur en fournit pas d'autres.
 *
 * Ils sont écrits ici plutôt que repris du dictionnaire parce que ce module
 * **ne doit rien importer** d'autre que `zod` : `scripts/create-user.ts`,
 * `scripts/installer.ts` et `scripts/scan-library.ts` le chargent par Node
 * seul, sans le résolveur du projet, et un import sans extension — celui des
 * dictionnaires — les ferait échouer au lancement, sans que le compilateur le
 * voie. Le dictionnaire français (`src/lib/i18n/fr/validation.ts`) porte les
 * mêmes textes et prend sa forme d'ici : les deux se corrigent ensemble.
 */
export const LIBELLES_VALIDATION = {
  pseudoTropCourt: "Le pseudo doit faire au moins 3 caractères.",
  pseudoTropLong: "Le pseudo ne peut pas dépasser 24 caractères.",
  pseudoCaracteres: "Le pseudo accepte lettres, chiffres, espaces, tirets et soulignés.",
  emailInvalide: "Cette adresse e-mail n'est pas valide.",
  emailTropLong: "Cette adresse e-mail est trop longue.",
  motDePasseTropCourt: "Le mot de passe doit faire au moins 10 caractères.",
  motDePasseTropLong: "Le mot de passe ne peut pas dépasser 200 caractères.",
  confirmationDifferente: "Les deux mots de passe ne correspondent pas.",
  identifiantRequis: "Renseigne ton pseudo ou ton adresse e-mail.",
  motDePasseRequis: "Renseigne ton mot de passe.",
  motDePasseActuelRequis: "Renseigne ton mot de passe actuel.",
};
export type LibellesValidation = typeof LIBELLES_VALIDATION;

function construireSchemas(libelles: LibellesValidation) {
  const pseudoSchema = z
    .string()
    .trim()
    .min(3, libelles.pseudoTropCourt)
    .max(24, libelles.pseudoTropLong)
    .regex(/^[\p{L}\p{N}](?:[\p{L}\p{N}_ -]*[\p{L}\p{N}])?$/u, libelles.pseudoCaracteres);

  const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email(libelles.emailInvalide))
    .refine((value) => value.length <= 180, libelles.emailTropLong);

  /**
   * Adresse facultative : un champ laissé vide donne `null`. Un compte sans
   * adresse ne peut pas recevoir de lien, l'administrateur change alors son
   * mot de passe à la main.
   */
  const optionalEmailSchema = z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    emailSchema.nullable(),
  );

  /**
   * Longueur minimale plutôt qu'un jeu de caractères imposé : une phrase longue
   * résiste mieux qu'un « P@ssw0rd » et s'oublie moins.
   */
  const passwordSchema = z
    .string()
    .min(10, libelles.motDePasseTropCourt)
    .max(200, libelles.motDePasseTropLong);

  const loginSchema = z.object({
    // À la connexion, l'identifiant peut être le pseudo ou l'adresse e-mail.
    identifier: z.string().trim().min(1, libelles.identifiantRequis),
    password: z.string().min(1, libelles.motDePasseRequis),
  });

  const forgotPasswordSchema = z.object({
    email: emailSchema,
    captchaToken: z.string().optional(),
  });

  const resetPasswordSchema = z
    .object({
      token: z.string().min(1),
      password: passwordSchema,
      passwordConfirm: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: libelles.confirmationDifferente,
      path: ["passwordConfirm"],
    });

  /** Inscription par lien : la personne choisit son pseudo et son mot de passe. */
  const registerSchema = z
    .object({
      token: z.string().min(1),
      pseudo: pseudoSchema,
      password: passwordSchema,
      passwordConfirm: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: libelles.confirmationDifferente,
      path: ["passwordConfirm"],
    });

  /**
   * Inscription ouverte : adresse, pseudo, mot de passe, captcha. `siteweb` est
   * un piège à robots : un champ invisible qu'un humain ne remplit jamais.
   */
  const openRegisterSchema = z
    .object({
      email: emailSchema,
      pseudo: pseudoSchema,
      password: passwordSchema,
      passwordConfirm: z.string(),
      captchaToken: z.string().optional(),
      siteweb: z.string().max(0).optional(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: libelles.confirmationDifferente,
      path: ["passwordConfirm"],
    });

  const updateProfileSchema = z.object({
    pseudo: pseudoSchema,
    email: optionalEmailSchema,
  });

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, libelles.motDePasseActuelRequis),
      password: passwordSchema,
      passwordConfirm: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: libelles.confirmationDifferente,
      path: ["passwordConfirm"],
    });

  return {
    pseudoSchema,
    emailSchema,
    optionalEmailSchema,
    passwordSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    registerSchema,
    openRegisterSchema,
    updateProfileSchema,
    changePasswordSchema,
  };
}

export type SchemasDeValidation = ReturnType<typeof construireSchemas>;

/** Un jeu de schémas par jeu de libellés : un dictionnaire ne les reconstruit pas à chaque requête. */
const schemasConstruits = new WeakMap<LibellesValidation, SchemasDeValidation>();

/**
 * Les schémas, avec les messages fournis : `schemasDeValidation(t.validation)`
 * donne ceux de la langue de la requête, sous les mêmes noms que les exports
 * ci-dessous. Sans paramètre, ce sont les schémas en français.
 */
export function schemasDeValidation(libelles: LibellesValidation = LIBELLES_VALIDATION): SchemasDeValidation {
  let schemas = schemasConstruits.get(libelles);
  if (!schemas) {
    schemas = construireSchemas(libelles);
    schemasConstruits.set(libelles, schemas);
  }
  return schemas;
}

/**
 * Les schémas en français, tels qu'ils ont toujours été exportés : les
 * scripts en ligne de commande et les écrans qui ne sont pas traduits s'en
 * servent sans rien changer.
 */
export const {
  pseudoSchema,
  emailSchema,
  optionalEmailSchema,
  passwordSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  registerSchema,
  openRegisterSchema,
  updateProfileSchema,
  changePasswordSchema,
} = schemasDeValidation();

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
