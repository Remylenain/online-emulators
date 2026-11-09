import nodemailer, { type Transporter } from "nodemailer";
import { dictionnaire } from "./i18n/dictionnaires";
import { LANGUE_DE_REFERENCE, type Langue } from "./i18n/langues";
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

/*
 * Les e-mails qui suivent sont écrits dans le dictionnaire `emails`. Chacun
 * reçoit sa langue en dernier paramètre : celle de la requête qui le
 * déclenche, quand l'appelant la connaît ; le français sinon, comme avant.
 */

export async function sendPasswordReset(
  to: string,
  pseudo: string,
  url: string,
  langue: Langue = LANGUE_DE_REFERENCE,
): Promise<void> {
  const t = dictionnaire(langue).emails.reinitialisation;
  await sendMail({ to, subject: t.objet, text: t.corps(pseudo, url) });
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
  langue: Langue = LANGUE_DE_REFERENCE,
): Promise<void> {
  const t = dictionnaire(langue).emails.invitation;
  await sendMail({ to, subject: t.objet, text: t.corps(pseudo, url, invitePar) });
}

/** Inscription ouverte : le compte n'existe qu'une fois ce lien confirmé. */
export async function sendRegistrationConfirmation(
  to: string,
  pseudo: string,
  url: string,
  langue: Langue = LANGUE_DE_REFERENCE,
): Promise<void> {
  const t = dictionnaire(langue).emails.confirmation;
  await sendMail({ to, subject: t.objet, text: t.corps(pseudo, url) });
}
