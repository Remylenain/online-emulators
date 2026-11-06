import { useEffect } from "react";

/**
 * Plein écran automatique sur téléphone : au premier appui sur l'écran, la
 * page demande le plein écran, et les barres du système disparaissent — la
 * barre d'adresse dans un navigateur, la barre d'état d'Android dans
 * l'application installée.
 *
 * Le navigateur n'accorde le plein écran qu'en réponse à un geste : on ne
 * peut pas le demander au chargement, d'où ce premier appui. `pointerup` et
 * non `pointerdown` : pour un doigt, seul le relâchement compte comme un
 * geste aux yeux du navigateur.
 *
 * Une seule fois par ouverture du lecteur. Si le joueur ressort du plein
 * écran — par le menu ou par le geste du système — on ne l'y remet pas de
 * force : il l'a voulu. Le bouton du menu reste là pour y revenir.
 *
 * Sans effet sur iPhone, où Safari ne donne le plein écran qu'aux vidéos :
 * là, c'est l'installation sur l'écran d'accueil qui en tient lieu.
 */
export function usePleinEcranAuto(actif: boolean): void {
  useEffect(() => {
    if (!actif || !document.fullscreenEnabled) return;

    function entrer() {
      window.removeEventListener("pointerup", entrer, true);
      if (document.fullscreenElement) return;
      // Un refus (réglage du navigateur, geste jugé trop ancien) n'est pas
      // une erreur à montrer : le jeu continue simplement avec ses barres.
      void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
    window.addEventListener("pointerup", entrer, true);

    return () => {
      window.removeEventListener("pointerup", entrer, true);
      // En quittant le lecteur, le reste du site retrouve ses barres.
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [actif]);
}
