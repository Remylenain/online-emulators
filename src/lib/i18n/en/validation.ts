import type { Dictionnaire } from "../dictionnaires";

export const validation: Dictionnaire["validation"] = {
  pseudoTropCourt: "The username must be at least 3 characters long.",
  pseudoTropLong: "The username cannot be longer than 24 characters.",
  pseudoCaracteres: "The username can contain letters, digits, spaces, hyphens and underscores.",

  emailInvalide: "This email address is not valid.",
  emailTropLong: "This email address is too long.",

  motDePasseTropCourt: "The password must be at least 10 characters long.",
  motDePasseTropLong: "The password cannot be longer than 200 characters.",
  confirmationDifferente: "The two passwords do not match.",

  identifiantRequis: "Enter your username or your email address.",
  motDePasseRequis: "Enter your password.",
  motDePasseActuelRequis: "Enter your current password.",
};
