// Número de versión de la app, sincronizado con el contador ?v= por
// scripts/bump-version.py. Cada valor coincide con el tag release-vNN del
// commit que lo generó. Separado de js/version.js (que sí usa `document`)
// porque sw.js también necesita este valor vía importScripts(), y un
// service worker no tiene acceso a `document`/`window`.
const APP_VERSION = "18";
