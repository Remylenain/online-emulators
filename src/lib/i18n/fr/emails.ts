/**
 * Les e-mails que le site envoie (`src/lib/mail.ts`) : leur objet et leur
 * corps, en texte seul. Les retours à la ligne font partie du texte — un
 * client mail les affiche tels quels.
 *
 * Chacun part dans la langue de la requête qui le déclenche : celle de la
 * personne qui demande un lien, donc le plus souvent celle de son
 * destinataire.
 */
export const emails = {
  /** Le lien demandé depuis « Mot de passe oublié ». */
  reinitialisation: {
    objet: "Réinitialisation de ton mot de passe",
    corps: (pseudo: string, url: string) =>
      `Salut ${pseudo},\n\n` +
      `Une réinitialisation de mot de passe a été demandée pour ton compte.\n` +
      `Ce lien est valable une heure et ne fonctionne qu'une fois :\n\n` +
      `${url}\n\n` +
      `Si tu n'as rien demandé, ignore ce message : ton mot de passe reste inchangé.\n`,
  },

  /**
   * L'invitation envoyée par l'administrateur, nommé dans le message
   * (`invitePar`) : le lien fait choisir son mot de passe au destinataire.
   */
  invitation: {
    objet: "Ton accès à la bibliothèque de jeux",
    corps: (pseudo: string, url: string, invitePar: string) =>
      `Salut ${pseudo},\n\n` +
      `${invitePar} t'a créé un compte sur sa bibliothèque de jeux.\n` +
      `Choisis ton mot de passe ici — le lien est valable une semaine :\n\n` +
      `${url}\n\n` +
      `Si ce message est arrivé dans tes indésirables, pense à le marquer\n` +
      `comme légitime : les prochains messages du site suivraient le même chemin.\n`,
  },

  /** Inscription ouverte : le compte n'existe qu'une fois ce lien confirmé. */
  confirmation: {
    objet: "Confirme ton inscription",
    corps: (pseudo: string, url: string) =>
      `Salut ${pseudo},\n\n` +
      `Quelqu'un — toi, sans doute — a demandé un compte avec cette adresse.\n` +
      `Pour le créer, ouvre ce lien et confirme. Il est valable une heure :\n\n` +
      `${url}\n\n` +
      `Si ce n'est pas toi, ignore ce message : aucun compte ne sera créé.\n`,
  },
};
