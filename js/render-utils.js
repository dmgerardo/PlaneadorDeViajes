// Utilidades de render compartidas por todas las vistas.

// Anti-XSS: escapa texto dinámico antes de insertarlo como HTML.
function esc(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Genera un id corto legible para nodos nuevos cuando no se usa push() de Firebase.
function idCorto() {
  return Math.random().toString(36).slice(2, 10);
}

// Formatea una fecha/hora ISO-UTC ("2026-08-05T14:00:00.000Z") a hora local
// de una zona horaria específica, en formato corto 24h.
function formatoHora(isoUTC, zonaHoraria) {
  if (!isoUTC) return "";
  const fecha = new Date(isoUTC);
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zonaHoraria
  }).format(fecha);
}

// Formatea una duración en milisegundos como "Xh Ym" para mostrar en traslados/hospedajes.
function formatoDuracion(ms) {
  if (!ms || ms <= 0) return "";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatoFecha(isoUTC, zonaHoraria) {
  if (!isoUTC) return "";
  const fecha = new Date(isoUTC);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    weekday: "short",
    timeZone: zonaHoraria
  }).format(fecha);
}

// Convierte fecha+hora local (de una zona horaria dada) a ISO-UTC para guardar en Firebase.
// input: "2026-08-05", "14:00", zonaHoraria: "America/Mexico_City"
function localAUTC(fechaStr, horaStr, zonaHoraria) {
  // Truco: interpretamos la fecha/hora como si fuera UTC, medimos el offset real
  // de la zona destino en ese instante, y corregimos.
  const ingenuo = new Date(`${fechaStr}T${horaStr}:00Z`);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zonaHoraria,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(ingenuo);
  const obj = {};
  partes.forEach(p => { obj[p.type] = p.value; });
  const comoUTC = Date.UTC(obj.year, obj.month - 1, obj.day, obj.hour, obj.minute, obj.second);
  const offsetMs = comoUTC - ingenuo.getTime();
  return new Date(ingenuo.getTime() - offsetMs).toISOString();
}

function limpiar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// Modal genérico: reemplaza a prompt()/confirm() para captura de datos.
// contenidoHTML debe incluir su propio <form id="..."> con los campos.
// Se cierra solo al hacer click fuera, con la tecla Escape, o llamando a cerrar().
function abrirModal(contenidoHTML) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<div class="modal">${contenidoHTML}</div>`;
  document.body.appendChild(fondo);

  const cerrar = () => fondo.remove();
  fondo.addEventListener("click", e => { if (e.target === fondo) cerrar(); });
  const escuchaEscape = e => { if (e.key === "Escape") { cerrar(); document.removeEventListener("keydown", escuchaEscape); } };
  document.addEventListener("keydown", escuchaEscape);

  return { fondo, modal: fondo.querySelector(".modal"), cerrar };
}

// Lista de zonas horarias IANA soportadas por el navegador, para usarse en <select>
// en vez de que el usuario tenga que escribir el nombre exacto a mano.
const ZONAS_HORARIAS = (typeof Intl.supportedValuesOf === "function")
  ? Intl.supportedValuesOf("timeZone")
  : [
      "America/Mexico_City", "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "America/Bogota", "America/Lima", "America/Santiago",
      "America/Buenos_Aires", "America/Sao_Paulo", "Europe/Madrid", "Europe/London",
      "Europe/Paris", "Europe/Rome", "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai",
      "Australia/Sydney", "UTC"
    ];

function opcionesZonaHoraria(seleccionada) {
  return ZONAS_HORARIAS.map(z =>
    `<option value="${esc(z)}"${z === seleccionada ? " selected" : ""}>${esc(z.replace(/_/g, " "))}</option>`
  ).join("");
}
