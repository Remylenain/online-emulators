import type { Dictionnaire } from "../dictionnaires";

export const compte: Dictionnaire["compte"] = {
  titre: "My account",

  avatar: {
    titre: "Avatar",
    retirer: "Remove",
    choisir: "Choose an avatar",
    remplacer: "Replace the avatar",
    /** « MB » : l'unité que les navigateurs et les systèmes affichent pour un fichier. */
    aide: "JPEG, PNG or WebP, 5 MB at most. The image is cropped to a square.",
    envoyer: "Upload",
    envoi: "Uploading…",
    misAJour: "Avatar updated.",
    erreurs: {
      manquante: "Choose an image.",
      tropLourde: "The image must not exceed 5 MB.",
      illisible: "This file is not a readable image.",
    },
  },

  profil: {
    titre: "Profile",
    pseudo: "Username",
    email: "Email address (optional)",
    aideEmail: "Used to reset your password. Without an address, the administrator changes it for you.",
    enregistrer: "Save",
    enregistrement: "Saving…",
    misAJour: "Profile updated.",
    erreurs: {
      pseudoPris: "This username is already taken.",
      emailPris: "This address is already used by another account.",
    },
  },

  motDePasse: {
    titre: "Password",
    actuel: "Current password",
    nouveau: "New password",
    aideNouveau: "At least 10 characters.",
    confirmation: "Confirm password",
    avertissement: "Changing your password signs you out everywhere, including here.",
    changer: "Change password",
    modification: "Changing…",
    modifie: "Password changed. You have been signed out everywhere: sign in again.",
    erreurs: {
      actuelIncorrect: "Current password is incorrect.",
    },
  },
};
