import type { Dictionnaire } from "../dictionnaires";

export const emails: Dictionnaire["emails"] = {
  reinitialisation: {
    objet: "Reset your password",
    corps: (pseudo: string, url: string) =>
      `Hi ${pseudo},\n\n` +
      `A password reset was requested for your account.\n` +
      `This link is valid for one hour and works only once:\n\n` +
      `${url}\n\n` +
      `If you didn't request this, ignore this message: your password stays the same.\n`,
  },

  invitation: {
    objet: "Your access to the game library",
    /** « their », au singulier : on ne sait rien de la personne qui invite. */
    corps: (pseudo: string, url: string, invitePar: string) =>
      `Hi ${pseudo},\n\n` +
      `${invitePar} has created an account for you on their game library.\n` +
      `Choose your password here — the link is valid for one week:\n\n` +
      `${url}\n\n` +
      `If this message landed in your spam folder, remember to mark it\n` +
      `as not spam: otherwise the site's next messages would end up there too.\n`,
  },

  confirmation: {
    objet: "Confirm your sign-up",
    corps: (pseudo: string, url: string) =>
      `Hi ${pseudo},\n\n` +
      `Someone — most likely you — asked for an account with this address.\n` +
      `To create it, open this link and confirm. It is valid for one hour:\n\n` +
      `${url}\n\n` +
      `If it wasn't you, ignore this message: no account will be created.\n`,
  },
};
