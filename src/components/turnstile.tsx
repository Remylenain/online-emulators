"use client";

import { useEffect, useRef } from "react";
import { useLangue } from "@/components/langue";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Widget Cloudflare Turnstile, rendu explicitement.
 *
 * Le jeton obtenu part dans le champ `cf-turnstile-response` du formulaire, que
 * l'action serveur revérifie auprès de Cloudflare — un jeton fabriqué côté
 * navigateur ne sert donc à rien.
 *
 * Sans clé publique configurée, le composant ne rend rien : en développement,
 * la vérification serveur est elle aussi contournée.
 *
 * Le widget n'a pas de texte à nous : c'est Cloudflare qui écrit le sien,
 * dans la langue de l'interface qu'on lui indique.
 */
export function Turnstile({ siteKey }: { siteKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const langue = useLangue();

  useEffect(() => {
    if (!siteKey || !container.current) return;

    let cancelled = false;

    function render() {
      if (cancelled || !container.current || !window.turnstile) return;
      if (widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: "dark",
        language: langue,
      });
    }

    if (window.turnstile) {
      render();
    } else {
      // Une seule balise de script, même si la page est revisitée.
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_URL;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, langue]);

  if (!siteKey) return null;

  return <div ref={container} className="flex justify-center" />;
}
