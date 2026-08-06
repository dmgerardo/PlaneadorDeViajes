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
  const req = event.request;
  const url = req.url;
  // Nunca interceptar Firebase (base de datos/auth en tiempo real) — solo el
  // app shell estático pasa por este service worker.
  if (req.method !== "GET" || url.includes("firebaseio.com") || url.includes("googleapis.com/identitytoolkit")) {
    return;
  }

  // Documentos HTML (navegación entre index.html/viaje.html/historial.html):
  // red primero. Si solo usáramos caché, dos pestañas que registraron su
  // service worker en momentos distintos (una antes de un deploy, otra
  // después) podían quedar mostrando versiones distintas hasta cerrar y
  // reabrir la app. Con red primero, si hay señal siempre se ve lo último;
  // el caché solo entra como respaldo si no hay conexión.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.open(CACHE_NOMBRE).then(cache => cache.match(req)))
    );
    return;
  }

  // CSS/JS/imágenes: caché primero (más rápido, y ya son inmutables por
  // versión — el ?v=N cambia si el contenido cambió). IMPORTANTE: se busca
  // en la caché de ESTA versión (CACHE_NOMBRE), no con caches.match() a
  // secas — ese buscaba en TODAS las cachés existentes (incluida una
  // versión vieja todavía no borrada) y podía devolver una copia vieja.
  event.respondWith(
    caches.open(CACHE_NOMBRE).then(cache =>
      cache.match(req).then(respuestaCache => respuestaCache || fetch(req))
    )
  );
});
