import type { NextConfig } from "next";

/**
 * Le cœur mGBA compilé en WebAssembly utilise des threads, donc
 * SharedArrayBuffer, qui exige l'isolation cross-origin (COOP + COEP).
 *
 * Ces en-têtes sont posés uniquement sur les routes du lecteur : avec
 * `require-corp`, tout script ou iframe tierce sans en-tête CORP est bloquée,
 * ce qui casserait le captcha Turnstile sur la page de réinitialisation.
 */
const crossOriginIsolation = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const baseSecurity = [
  // Bibliothèque privée : rien ne doit être indexé, nulle part.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },

  /**
   * HSTS : le navigateur n'utilisera plus que HTTPS pour ce domaine, même si
   * quelqu'un tape l'adresse sans `https://`. Sans cet en-tête, la toute
   * première requête part en clair, et la redirection d'Apache arrive trop
   * tard pour empêcher l'interception du cookie de session.
   *
   * Un an, sans `includeSubDomains` (le site n'a pas de sous-domaine) et sans
   * `preload`, qui demande une inscription auprès des navigateurs et ne se
   * défait quasiment pas. Pour revenir en arrière, il faut servir
   * `max-age=0` pendant au moins le temps que le cache des visiteurs expire :
   * retirer l'en-tête ne suffit pas, les navigateurs l'ont mémorisé.
   *
   * Les navigateurs ignorent cet en-tête sur une connexion non chiffrée, donc
   * aucun effet en développement sur http://localhost.
   */
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurity },
      { source: "/jouer/:path*", headers: crossOriginIsolation },
      // Le cœur et son wasm doivent être servis en same-origin : le worker
      // pthread démarre depuis l'URL de mgba.js.
      { source: "/mgba/:path*", headers: crossOriginIsolation },
    ];
  },

  // Les savestates et les sauvegardes transitent en corps de requête.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
