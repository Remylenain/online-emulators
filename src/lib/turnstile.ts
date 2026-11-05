import { configCaptcha } from "./parametres";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Vérifie un jeton Turnstile auprès de Cloudflare.
 *
 * Tant qu'aucune clé secrète n'est configurée, la vérification est contournée :
 * cela permet de développer en local sans compte Cloudflare. En production,
 * l'absence de clé est signalée au démarrage par la page de réinitialisation.
 */
export async function verifyCaptcha(token: string | null, ip?: string | null): Promise<boolean> {
  const { secretKey } = configCaptcha();
  if (!secretKey) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Un captcha qui met trop longtemps ne doit pas bloquer la requête.
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    // Cloudflare injoignable : on refuse, plutôt que d'ouvrir la porte.
    return false;
  }
}
