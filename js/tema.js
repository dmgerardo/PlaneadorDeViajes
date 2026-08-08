// Preferencia manual de tema claro/oscuro, por encima de prefers-color-scheme
// del sistema (que sigue siendo el default mientras no se toque el botón de
// tema). Se carga en <head>, antes de pintar el body, para no parpadear con
// el tema equivocado al recargar. Ver :root[data-theme] en estilos.css y el
// botón #btn-tema en viaje.html (único lugar de la app con el alternador,
// pero la preferencia guardada aplica en todas las páginas).
const CLAVE_TEMA_MANUAL = "temaManual";

function temaGuardado() {
  const valor = localStorage.getItem(CLAVE_TEMA_MANUAL);
  return valor === "claro" || valor === "oscuro" ? valor : null;
}

// Sin preferencia manual guardada, el default es SIEMPRE claro — ya no sigue
// prefers-color-scheme del sistema (antes un celular en modo oscuro abría la
// app en oscuro sin que nadie lo hubiera pedido). El alternador de tema
// sigue disponible para quien prefiera oscuro.
function temaEfectivo() {
  return temaGuardado() || "claro";
}

function aplicarTemaGuardado() {
  // Siempre se fija data-theme explícito (nunca se quita el atributo): así
  // :root[data-theme="claro"] (ver estilos.css) le gana en especificidad al
  // @media (prefers-color-scheme: dark) del sistema operativo, y "claro" es
  // de verdad el default aunque el celular esté en modo oscuro.
  document.documentElement.setAttribute("data-theme", temaGuardado() || "claro");
}

function alternarTema() {
  const nuevo = temaEfectivo() === "oscuro" ? "claro" : "oscuro";
  localStorage.setItem(CLAVE_TEMA_MANUAL, nuevo);
  aplicarTemaGuardado();
  actualizarBotonTema();
}

// Pinta el icono/estado del botón de tema si existe en la página actual —
// llamarla después de que iconos.js ya haya cargado.
function actualizarBotonTema() {
  const btn = document.getElementById("btn-tema");
  if (!btn) return;
  const oscuro = temaEfectivo() === "oscuro";
  btn.innerHTML = icono(oscuro ? "sun" : "moon", 18);
  const etiqueta = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  btn.setAttribute("aria-label", etiqueta);
  btn.title = etiqueta;
}

aplicarTemaGuardado();
