import type { LibellesValidation } from "../../validation";

/**
 * Les messages des schémas de validation : ce qu'un formulaire écrit sous un
 * champ mal rempli (`schemasDeValidation`, dans `src/lib/validation.ts`).
 *
 * Le français est écrit **deux fois** : ici, et dans `LIBELLES_VALIDATION`,
 * la valeur par défaut des schémas. Ce module-là ne peut rien importer — des
 * scripts le chargent par Node seul — et celui-ci ne doit pas le charger non
 * plus, sinon toute la bibliothèque de validation suivrait les dictionnaires
 * jusque dans le navigateur. Seul son type passe : un message ajouté ou
 * retiré d'un côté est une erreur de compilation de l'autre. Les deux textes
 * se corrigent ensemble.
 */
export const validation: LibellesValidation = {
  pseudoTropCourt: "Le pseudo doit faire au moins 3 caractères.",
  pseudoTropLong: "Le pseudo ne peut pas dépasser 24 caractères.",
  pseudoCaracteres: "Le pseudo accepte lettres, chiffres, espaces, tirets et soulignés.",

  emailInvalide: "Cette adresse e-mail n'est pas valide.",
  emailTropLong: "Cette adresse e-mail est trop longue.",

  motDePasseTropCourt: "Le mot de passe doit faire au moins 10 caractères.",
  motDePasseTropLong: "Le mot de passe ne peut pas dépasser 200 caractères.",
  /** La seconde saisie ne répète pas la première. */
  confirmationDifferente: "Les deux mots de passe ne correspondent pas.",

  /** Les champs laissés vides : à la connexion, puis au changement de mot de passe. */
  identifiantRequis: "Renseigne ton pseudo ou ton adresse e-mail.",
  motDePasseRequis: "Renseigne ton mot de passe.",
  motDePasseActuelRequis: "Renseigne ton mot de passe actuel.",
};
