/**
 * La page du compte : l'avatar, le profil et le mot de passe, avec ce que
 * leurs formulaires répondent une fois envoyés.
 *
 * Les refus qui tiennent à la forme d'un champ — pseudo trop court, adresse
 * invalide, mots de passe différents — viennent des schémas de validation
 * (`validation`), pas d'ici.
 */
export const compte = {
  /** Le titre de la page et de son onglet. */
  titre: "Mon compte",

  avatar: {
    titre: "Avatar",
    retirer: "Retirer",
    /** Le libellé du champ : « remplacer » quand le compte a déjà une image. */
    choisir: "Choisir un avatar",
    remplacer: "Remplacer l'avatar",
    aide: "JPEG, PNG ou WebP, 5 Mo maximum. L'image est recadrée en carré.",
    envoyer: "Envoyer",
    envoi: "Envoi…",
    misAJour: "Avatar mis à jour.",
    erreurs: {
      manquante: "Choisis une image.",
      tropLourde: "L'image ne doit pas dépasser 5 Mo.",
      illisible: "Ce fichier n'est pas une image lisible.",
    },
  },

  profil: {
    titre: "Profil",
    pseudo: "Pseudo",
    email: "Adresse e-mail (facultative)",
    aideEmail:
      "Sert à la réinitialisation du mot de passe. Sans adresse, c'est l'administrateur qui le change.",
    enregistrer: "Enregistrer",
    enregistrement: "Enregistrement…",
    misAJour: "Profil mis à jour.",
    erreurs: {
      pseudoPris: "Ce pseudo est déjà pris.",
      emailPris: "Cette adresse est déjà utilisée par un autre compte.",
    },
  },

  motDePasse: {
    titre: "Mot de passe",
    actuel: "Mot de passe actuel",
    nouveau: "Nouveau mot de passe",
    aideNouveau: "Au moins 10 caractères.",
    confirmation: "Confirmation",
    /** Sous le formulaire : ce que le changement entraîne, avant de l'envoyer. */
    avertissement: "Changer le mot de passe ferme toutes les sessions, y compris celle-ci.",
    changer: "Changer le mot de passe",
    modification: "Modification…",
    modifie: "Mot de passe modifié. Toutes les sessions ont été fermées : reconnecte-toi.",
    erreurs: {
      actuelIncorrect: "Mot de passe actuel incorrect.",
    },
  },
};
