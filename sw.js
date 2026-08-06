// Service worker: cachea el "app shell" (HTML/CSS/JS/manifest) para que la
// app abra sin conexión — modo offline de SOLO LECTURA. Los datos del viaje
// (Firebase) no se manejan aquí; ese caché vive en localStorage y lo maneja
// escuchar() en js/db.js. Este archivo solo resuelve "¿el navegador puede
// siquiera abrir la página sin señal?".
// app-version.js NO usa `document`/`window` (a diferencia de version.js), así
// que es seguro importarlo aquí.
importScripts("js/app-version.js");
const CACHE_NOMBRE = `planeador-shell-v${APP_VERSION}`;

const ARCHIVOS_APP_SHELL = [
  "index.html",
  "viaje.html",
  "historial.html",
  "manifest.json",
  `css/estilos.css?v=${APP_VERSION}`,
  `js/app-version.js?v=${APP_VERSION}`,
  `js/version.js?v=${APP_VERSION}`,
  `js/firebase-config.js?v=${APP_VERSION}`,
  `js/render-utils.js?v=${APP_VERSION}`,
  `js/db.js?v=${APP_VERSION}`,
  `js/auth.js?v=${APP_VERSION}`,
  `js/vista-admin-viajes.js?v=${APP_VERSION}`,
  `js/vista-info.js?v=${APP_VERSION}`,
  `js/vista-ciudades.js?v=${APP_VERSION}`,
  `js/vista-calendario.js?v=${APP_VERSION}`,
  `js/vista-ruta.js?v=${APP_VERSION}`,
  `js/vista-logistica.js?v=${APP_VERSION}`,
  `js/vista-lugares.js?v=${APP_VERSION}`,
  `js/vista-checklist.js?v=${APP_VERSION}`,
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "icons/favicon-48.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NOMBRE)
      .then(cache => cache.addAll(ARCHIVOS_APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n !== CACHE_NOMBRE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = event.request.url;
  // Nunca interceptar Firebase (base de datos/auth en tiempo real) — solo el
  // app shell estático pasa por este service worker.
  if (event.request.method !== "GET" || url.includes("firebaseio.com") || url.includes("googleapis.com/identitytoolkit")) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(respuestaCache => respuestaCache || fetch(event.request))
  );
});
