/* BUUB — enregistrement du service worker (PWA sur toute la plateforme).
 * Léger et autonome : à inclure sur chaque page qui ne charge pas offline.js
 * (lequel enregistre déjà le SW pour la caisse et le tableau de bord). */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();
