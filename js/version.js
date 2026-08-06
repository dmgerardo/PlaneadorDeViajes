// Pinta el badge de versión y registra el service worker. APP_VERSION viene
// de js/app-version.js (cargado antes que este archivo en cada HTML).

document.querySelectorAll(".version-badge").forEach(el => {
  el.textContent = `v${APP_VERSION}`;
  el.title = "Versión de la app — ver historial de cambios";
});

// Registra el service worker (cachea el "app shell" — HTML/CSS/JS — para que
// la app abra sin conexión). Se registra aquí porque version.js es el único
// script que cargan las tres páginas (incluida historial.html, que no carga
// Firebase). "?v=" fuerza a que el navegador revise si hay una versión nueva
// del service worker cada vez que sube APP_VERSION, en vez de esperar a su
// chequeo periódico normal.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`).catch(() => {
      // Sin service worker la app sigue funcionando normal, solo sin caché offline.
    });
  });
}
