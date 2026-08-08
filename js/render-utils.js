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

// Fecha en formato AAAA-MM-DD (para prellenar <input type="date">), en una zona dada.
function fechaISO(isoUTC, zonaHoraria) {
  if (!isoUTC) return "";
  const fecha = new Date(isoUTC);
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(fecha);
  const obj = {}; partes.forEach(p => obj[p.type] = p.value);
  return `${obj.year}-${obj.month}-${obj.day}`;
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

// Confirmación visual breve de "esto ya se guardó" — se llama desde db.js
// después de cada escritura exitosa a Firebase. Reutiliza un solo elemento
// y reinicia su temporizador en cada llamada, para no apilar mensajes si
// hay varias escrituras seguidas (p.ej. arrastrar un bloque del calendario).
let temporizadorToast = null;
function mostrarToast(mensaje) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = mensaje;
  el.classList.add("mostrar");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => el.classList.remove("mostrar"), 1600);
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

// Modal de "cambiar mi contraseña" — compartido entre index.html
// (vista-admin-viajes.js) y viaje.html (vista-info.js). Requiere auth.js
// (cambiarContrasenaPropia) ya cargado.
function abrirModalCambiarContrasena(sesion) {
  const { modal, cerrar } = abrirModal(`
    <h3>Cambiar mi contraseña</h3>
    <form id="form-mi-contrasena">
      <label for="mc-actual">Contraseña actual</label>
      <input id="mc-actual" type="password" required autofocus autocomplete="current-password">
      <label for="mc-nueva">Contraseña nueva</label>
      <input id="mc-nueva" type="password" required autocomplete="new-password">
      <div class="error" id="mc-error"></div>
      <div class="fila-botones">
        <button type="submit">Guardar</button>
        <button type="button" class="secundario" id="mc-cancelar">Cancelar</button>
      </div>
    </form>
  `);
  modal.querySelector("#mc-cancelar").addEventListener("click", cerrar);
  modal.querySelector("#form-mi-contrasena").addEventListener("submit", async e => {
    e.preventDefault();
    const actual = modal.querySelector("#mc-actual").value;
    const nueva = modal.querySelector("#mc-nueva").value;
    if (!actual || !nueva) return;
    try {
      await cambiarContrasenaPropia(sesion.userId, actual, nueva);
      cerrar();
    } catch (err) {
      modal.querySelector("#mc-error").textContent = err.message;
    }
  });
}

// Aviso de "sin conexión": banner fijo arriba de la pantalla cuando el
// navegador detecta que no hay red. No bloquea los formularios (si se
// intenta guardar algo sin señal, Firebase reintenta solo al reconectar) —
// solo avisa para que quede claro que lo que se ve es la última copia
// guardada (ver escuchar() en db.js), no algo desactualizado por error.
function actualizarBannerConexion() {
  let banner = document.getElementById("banner-sin-conexion");
  if (!navigator.onLine) {
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "banner-sin-conexion";
      banner.textContent = "📶 Sin conexión — viendo la última versión guardada";
      document.body.prepend(banner);
      document.body.style.paddingTop = `${banner.offsetHeight}px`;
    }
  } else if (banner) {
    banner.remove();
    document.body.style.paddingTop = "";
  }
}
window.addEventListener("online", actualizarBannerConexion);
window.addEventListener("offline", actualizarBannerConexion);
document.addEventListener("DOMContentLoaded", actualizarBannerConexion);

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

// Monedas que la app sabe manejar (deliberadamente pocas — un select con
// ~180 códigos ISO 4217 era ruido para un viaje típico). MXN es siempre la
// moneda base del reporte consolidado (viajes/{tripId}/monedas, ver abajo).
const MONEDAS_SOPORTADAS = ["MXN", "USD", "EUR", "JPY", "CAD"];
const NOMBRE_MONEDA = {
  MXN: "Peso mexicano",
  USD: "Dólar estadounidense",
  EUR: "Euro",
  JPY: "Yen japonés",
  CAD: "Dólar canadiense"
};

// Monedas disponibles para capturar un costo en este viaje: MXN (siempre,
// es la base) + las que el admin agregó explícitamente a viajes/{tripId}/
// monedas (ver la tarjeta "Monedas del viaje" en vista-info.js — funciona
// como la de Ciudades: se agregan/quitan una por una, no es un catálogo
// fijo). Un viaje que nunca tocó esa tarjeta solo ofrece MXN.
function monedasActivasDe(monedasCache) {
  return MONEDAS_SOPORTADAS.filter(m => m === "MXN" || Boolean(monedasCache && monedasCache[m]));
}

// activas: subconjunto de MONEDAS_SOPORTADAS a ofrecer (ver monedasActivasDe).
// Si el valor ya guardado quedó desactivado después, se conserva como opción
// extra al editar — no se pierde el dato ni obliga a cambiarlo a fuerzas.
function opcionesMoneda(seleccionada, activas) {
  const valor = seleccionada || "MXN";
  const base = (activas && activas.length ? activas : MONEDAS_SOPORTADAS).slice();
  const lista = base.includes(valor) ? base : [valor, ...base];
  return lista.map(m =>
    `<option value="${esc(m)}"${m === valor ? " selected" : ""}>${esc(m)}${NOMBRE_MONEDA[m] ? ` — ${esc(NOMBRE_MONEDA[m])}` : ""}</option>`
  ).join("");
}

// Campos de costo compartidos por los formularios de Traslados, Hospedajes
// y Lugares (costo opcional, si cubre a todo el grupo o es por persona, y en
// qué moneda) — evita triplicar el mismo bloque en cada vista. idPrefix
// evita colisión de ids entre los tres formularios (ej. "ft", "fh", "fl").
// defaultTipoNuevo es el valor sugerido solo para una captura nueva (p.ej.
// "porPersona" tiene más sentido para un lugar/actividad que para un vuelo).
// monedasActivas viene de monedasActivasDe() — las que el admin dejó
// prendidas para este viaje (ver pestaña Info).
function camposCosto(idPrefix, existente, defaultTipoNuevo, monedasActivas) {
  const costo = existente && existente.costo != null ? existente.costo : "";
  const costoTipo = (existente && existente.costoTipo) || defaultTipoNuevo || "total";
  const moneda = (existente && existente.moneda) || "MXN";
  return `
    <label for="${idPrefix}-costo">Costo (opcional)</label>
    <input id="${idPrefix}-costo" type="number" min="0" step="0.01" placeholder="0.00" value="${esc(costo)}">
    <label for="${idPrefix}-costo-tipo">¿Es el total o por persona?</label>
    <select id="${idPrefix}-costo-tipo">
      <option value="total"${costoTipo === "total" ? " selected" : ""}>Total (cubre a todos los viajeros)</option>
      <option value="porPersona"${costoTipo === "porPersona" ? " selected" : ""}>Por persona</option>
    </select>
    <label for="${idPrefix}-moneda">Moneda</label>
    <select id="${idPrefix}-moneda">${opcionesMoneda(moneda, monedasActivas)}</select>
  `;
}

// Lee los tres campos pintados por camposCosto(). costo queda en null si se
// deja en blanco — así el reporte de costos (pestaña Info) sabe que ese
// ítem todavía no tiene costo capturado, en vez de contarlo como $0.
function leerCamposCosto(modal, idPrefix) {
  const crudo = modal.querySelector(`#${idPrefix}-costo`).value;
  const numero = Number(crudo);
  const costo = crudo === "" || !Number.isFinite(numero) ? null : numero;
  const costoTipo = modal.querySelector(`#${idPrefix}-costo-tipo`).value;
  const moneda = modal.querySelector(`#${idPrefix}-moneda`).value;
  return { costo, costoTipo, moneda };
}

// Formatea un costo con su símbolo/código de moneda (Intl.NumberFormat) y,
// si es "por persona", agrega la etiqueta — usado en las filas de
// Traslados/Hospedajes/Lugares y en el reporte de costos de Info. Si la
// moneda no es un código ISO 4217 válido (dato viejo o escrito a mano en
// otra parte), cae a un texto plano en vez de lanzar una excepción.
function formatoCosto(costo, costoTipo, moneda) {
  if (costo === null || costo === undefined || costo === "") return "";
  let monto;
  try {
    monto = new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN", maximumFractionDigits: 2 }).format(costo);
  } catch (e) {
    monto = `${costo} ${moneda || ""}`.trim();
  }
  return costoTipo === "porPersona" ? `${monto}/persona` : monto;
}
