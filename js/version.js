// Número de versión de la app, sincronizado con el contador ?v= por
// scripts/bump-version.py. Cada valor coincide con el tag release-vNN
// del commit que lo generó.
const APP_VERSION = "16";

document.querySelectorAll(".version-badge").forEach(el => {
  el.textContent = `v${APP_VERSION}`;
  el.title = "Versión de la app — ver historial de cambios";
});
