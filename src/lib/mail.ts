import nodemailer, { type Transporter } from "nodemailer";
import { configMail, type ConfigMail } from "./parametres";

/**
 * Le transport est gardé tant que la configuration ne change pas : elle peut
 * maintenant être modifiée depuis l'administration, sans redémarrage.
 */
let transporter: { signature: string; transport: Transporter } | null = null;

function getTransporter(config: ConfigMail): Transporter {
  const signature = JSON.stringify([config.host, config.port, config.user, config.password]);
  if (transporter?.signature !== signature) {
    transporter = {
      signature,
      transport: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: config.user ? { user: config.user, pass: config.password } : undefined,
      }),
    };
  }
  return transporter.transport;
}

/**
 * Sans SMTP configuré, le message est écrit dans la console du serveur plutôt
 * que perdu : en développement, cela donne le lien de réinitialisation sans
 * monter un relais.
 */
export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const config = configMail();
  if (!config.host) {
    console.info(
      `[mail] SMTP non configuré, message non envoyé :\n` +
        `  à      : ${message.to}\n` +
        `  objet  : ${message.subject}\n` +
        `${message.text}`,
    );
    return;
  }

  await getTransporter(config).sendMail({
    from: config.from || config.user,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

export async function sendPasswordReset(to: string, pseudo: string, url: string): Promise<void> {
  await sendMail({
    to,
    subject: "Réinitialisation de ton mot de passe",
    text:
      `Salut ${pseudo},\n\n` +
      `Une réinitialisation de mot de passe a été demandée pour ton compte.\n` +
      `Ce lien est valable une heure et ne fonctionne qu'une fois :\n\n` +
      `${url}\n\n` +
      `Si tu n'as rien demandé, ignore ce message : ton mot de passe reste inchangé.\n`,
  });
}

/**
 * Invitation : le lien permet au destinataire de choisir son mot de passe.
 *
 * Le mot de passe provisoire n'est **pas** envoyé par mail. Il reste affiché à
 * l'administrateur, qui le transmet de vive voix si c'est plus simple — un mot
 * de passe envoyé par mail reste dans une boîte, et on ne sait jamais qui la
 * lira ni combien de temps.
 */
export async function sendInvitation(
  to: string,
  pseudo: string,
  url: string,
  invitePar: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Ton accès à la bibliothèque de jeux",
    text:
      `Salut ${pseudo},\n\n` +
      `${invitePar} t'a créé un compte sur sa bibliothèque de jeux.\n` +
      `Choisis ton mot de passe ici — le lien est valable une semaine :\n\n` +
      `${url}\n\n` +
      `Si ce message est arrivé dans tes indésirables, pense à le marquer\n` +
      `comme légitime : les prochains messages du site suivraient le même chemin.\n`,
  });
}

/** Inscription ouverte : le compte n'existe qu'une fois ce lien confirmé. */
export async function sendRegistrationConfirmation(
  to: string,
  pseudo: string,
  url: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Confirme ton inscription",
    text:
      `Salut ${pseudo},\n\n` +
      `Quelqu'un — toi, sans doute — a demandé un compte avec cette adresse.\n` +
      `Pour le créer, ouvre ce lien et confirme. Il est valable une heure :\n\n` +
      `${url}\n\n` +
      `Si ce n'est pas toi, ignore ce message : aucun compte ne sera créé.\n`,
  });
}
