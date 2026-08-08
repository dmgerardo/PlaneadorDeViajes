// Vista "Calendario": cuadrícula días x horas con doble zona horaria,
// bloques flotantes (lugares) arrastrables/redimensionables (incluso entre
// días) y fijado, traslados/hospedajes como bloques fijos, y prevención de
// traslapes. La ciudad de cada día se asigna en la pestaña "Ruta"
// (vista-ruta.js) — aquí solo se lee esa asignación.
//
// La misma función sirve para la vista "Calendario" (todos los días) y para
// "Agenda" (un solo día con navegación prev/next) — ver opciones.modoAgenda.
// montarVistaAgendaCalendario (al final del archivo) las fusiona en una sola
// pestaña con un switch Día/Cuadrícula.

// Niveles de "zoom" vertical de la cuadrícula (botones +/-, ver
// montarVistaCalendario): [0] es el actual/default (el más amplio, "más
// cerca"); subir de índice aleja la vista y achica los renglones. Solo 2-3
// niveles a propósito — no es un zoom continuo, es "normal/chico/muy chico".
// Es una preferencia global de la app (no por viaje), igual que
// MODO_AGENDA_KEY más abajo — vive en localStorage, no en Firebase.
const NIVELES_HORA_PX = [44, 32, 24];
const CLAVE_ZOOM_CALENDARIO = "planeador_zoomCalendarioNivel";
function nivelZoomGuardado() {
  const crudo = parseInt(localStorage.getItem(CLAVE_ZOOM_CALENDARIO), 10);
  return Number.isInteger(crudo) && crudo >= 0 && crudo < NIVELES_HORA_PX.length ? crudo : 0;
}
let nivelZoomCalendario = nivelZoomGuardado();
// HORA_PX es mutable (no const) a propósito: todo el archivo la referencia
// por clausura (posición/alto de bloques, snapping de arrastre, líneas de
// hora vía --hora-px en CSS) — cambiarla aquí y volver a renderizar basta
// para aplicar el zoom en todos lados sin duplicar esa lógica por vista.
let HORA_PX = NIVELES_HORA_PX[nivelZoomCalendario];
const COLORES_CIUDAD = ["--color-ciudad-1", "--color-ciudad-2", "--color-ciudad-3", "--color-ciudad-4", "--color-ciudad-5", "--color-ciudad-6"];

function colorCss(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function listaDeDias(fechaInicio, fechaFin) {
  const dias = [];
  if (!fechaInicio || !fechaFin) return dias;
  let cursor = new Date(`${fechaInicio}T00:00:00Z`);
  const fin = new Date(`${fechaFin}T00:00:00Z`);
  while (cursor <= fin) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return dias;
}

function sumarDiasStr(fechaStr, delta) {
  const fecha = new Date(`${fechaStr}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + delta);
  return fecha.toISOString().slice(0, 10);
}

// --- Amanecer/atardecer real (ecuación del amanecer) ---
// Aproximación estándar (precisión de unos minutos), suficiente para sombrear
// la cuadrícula — no para navegación. Referencia: "Sunrise equation" (NOAA).
function gradARad(g) { return (g * Math.PI) / 180; }
function radAGrad(r) { return (r * 180) / Math.PI; }

// Devuelve { amanecerUTC, atardecerUTC } (Date) para esa fecha+lat/lng, o null
// si el sol no sale o no se pone ese día (latitudes polares en verano/invierno).
function calcularSolUTC(fechaStr, lat, lng) {
  // El día Juliano de referencia se toma al mediodía UTC (convención de la
  // ecuación del amanecer) — usar medianoche aquí desfasa amanecer/atardecer
  // 12 horas (quedan invertidos entre sí).
  const jd0 = new Date(`${fechaStr}T12:00:00Z`).getTime() / 86400000 + 2440587.5;
  const n = jd0 - 2451545.0 + 0.0008;
  const Jstar = n - lng / 360;
  const M = ((357.5291 + 0.98560028 * Jstar) % 360 + 360) % 360;
  const Mrad = gradARad(M);
  const C = 1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
  const lambda = ((M + 102.9372 + C + 180) % 360 + 360) % 360;
  const lambdaRad = gradARad(lambda);
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);
  const sinDelta = Math.sin(lambdaRad) * Math.sin(gradARad(23.44));
  const delta = Math.asin(sinDelta);
  const latRad = gradARad(lat);
  const cosOmega = (Math.sin(gradARad(-0.83)) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta));
  if (cosOmega > 1 || cosOmega < -1) return null;
  const omega0 = radAGrad(Math.acos(cosOmega));
  const jdAJs = jd => new Date((jd - 2440587.5) * 86400000);
  return {
    amanecerUTC: jdAJs(Jtransit - omega0 / 360),
    atardecerUTC: jdAJs(Jtransit + omega0 / 360)
  };
}

// Franja horaria de "noche" (hora local decimal, 0-24) para sombrear un día.
// Con coordenadas de la ciudad usa amanecer/atardecer real de esa fecha; si no
// hay coordenadas, cae a un rango fijo de referencia (20:00–06:00).
function calcularFranjaNoche(fechaStr, ciudad, zonaHoraria) {
  if (ciudad && ciudad.lat != null && ciudad.lng != null) {
    const sol = calcularSolUTC(fechaStr, ciudad.lat, ciudad.lng);
    if (sol) {
      const zona = zonaHoraria || "UTC";
      const partesHora = (isoUTC) => {
        const fecha = new Date(isoUTC);
        const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(fecha);
        const obj = {}; partes.forEach(p => obj[p.type] = p.value);
        return Number(obj.hour) + Number(obj.minute) / 60;
      };
      return { amanecer: partesHora(sol.amanecerUTC), atardecer: partesHora(sol.atardecerUTC) };
    }
  }
  return { amanecer: 6, atardecer: 20 };
}

// Fondo CSS del área del día: líneas de hora + franja oscura en horario nocturno.
function fondoConNoche(franja) {
  const pct = h => `${((Math.max(0, Math.min(24, h)) / 24) * 100).toFixed(3)}%`;
  // --color-noche-cal cambia entre temas (ver estilos.css): en modo oscuro el
  // fondo de la cuadrícula ya es oscuro de por sí, así que un tinte del mismo
  // tono que en modo claro casi no se nota — se usa un tinte negro más fuerte.
  const noche = colorCss("--color-noche-cal");
  const dia = "rgba(0,0,0,0)";
  const lineas = `repeating-linear-gradient(to bottom, var(--color-borde) 0, var(--color-borde) 1px, transparent 1px, transparent var(--hora-px, 44px))`;
  const sombra = `linear-gradient(to bottom,
    ${noche} 0%, ${noche} ${pct(franja.amanecer)},
    ${dia} ${pct(franja.amanecer)}, ${dia} ${pct(franja.atardecer)},
    ${noche} ${pct(franja.atardecer)}, ${noche} 100%)`;
  return `${lineas}, ${sombra}`;
}

// Determina, para cada día, la(s) ciudad(es) en la(s) que se está. Un día
// con un traslado capturado (Logística) que lo toque (el de salida, en hora
// del origen, o el de llegada, en hora del destino) se trata SIEMPRE como
// día partido entre dos ciudades — misma prioridad y mismo criterio que
// vista-ruta.js (trasladoDelDia), para que Calendario/Agenda muestren
// exactamente lo mismo que Ruta. Solo si el día no tiene traslado se usa la
// asignación explícita del timeline (ciudadPorDia); si tampoco la tiene,
// recurre a la heurística previa (seguir la ciudad de destino del último
// traslado visto), para no romper viajes que aún no usan el timeline.
// Cada entrada trae `ciudadIds`: todas las ciudades válidas para agendar un
// lugar ese día (una sola normalmente; dos en un día partido) — [] significa
// "sin restricción" (día sin ciudad conocida todavía).
function calcularCiudadPorDia(dias, ciudadPorDiaManual, ciudades, traslados, zonaOrigen) {
  const idPorNombre = nombre => {
    const entrada = Object.entries(ciudades).find(([, c]) => c.nombre.toLowerCase() === (nombre || "").toLowerCase());
    return entrada ? entrada[0] : null;
  };
  const buscarTZ = nombre => {
    const id = idPorNombre(nombre);
    return id ? ciudades[id].zonaHoraria : zonaOrigen;
  };

  // Traslado (si lo hay) que toca cada día — igual que trasladoDelDia en
  // vista-ruta.js, pero precalculado para los `dias` de esta vista.
  const trasladoPorDia = {};
  Object.values(traslados).forEach(t => {
    if (!t.inicioUTC) return;
    const fin = t.finUTC || t.inicioUTC;
    const diaSalida = fechaISO(t.inicioUTC, buscarTZ(t.origen));
    const diaLlegada = fechaISO(fin, buscarTZ(t.destino));
    if (!trasladoPorDia[diaSalida]) trasladoPorDia[diaSalida] = t;
    if (!trasladoPorDia[diaLlegada]) trasladoPorDia[diaLlegada] = t;
  });

  // Heurística previa (sin Ruta ni traslados capturados): sigue la ciudad de
  // destino del último traslado visto, en orden cronológico — último
  // recurso si el día no tiene ni traslado ni asignación manual.
  const ordenados = Object.values(traslados).slice().sort((a, b) => a.inicioUTC.localeCompare(b.inicioUTC));
  let ciudadActual = null, tzActual = zonaOrigen, idxTraslado = 0;
  const heuristico = {};
  dias.forEach(dia => {
    while (idxTraslado < ordenados.length && ordenados[idxTraslado].inicioUTC.slice(0, 10) === dia) {
      const t = ordenados[idxTraslado];
      ciudadActual = t.destino;
      tzActual = buscarTZ(t.destino);
      idxTraslado++;
    }
    const id = idPorNombre(ciudadActual);
    heuristico[dia] = { etiqueta: ciudadActual || "—", zonaHoraria: tzActual, ciudadId: id, ciudadIds: id ? [id] : [] };
  });

  const resultado = {};
  dias.forEach(dia => {
    const traslado = trasladoPorDia[dia];
    if (traslado) {
      const origenId = idPorNombre(traslado.origen);
      const destinoId = idPorNombre(traslado.destino);
      resultado[dia] = {
        etiqueta: `${traslado.origen} → ${traslado.destino}`,
        zonaHoraria: buscarTZ(traslado.destino),
        ciudadId: destinoId || origenId || null,
        ciudadIds: [origenId, destinoId].filter(Boolean)
      };
      return;
    }
    const ciudadId = ciudadPorDiaManual[dia];
    if (ciudadId && ciudades[ciudadId]) {
      resultado[dia] = { etiqueta: ciudades[ciudadId].nombre, zonaHoraria: ciudades[ciudadId].zonaHoraria, ciudadId, ciudadIds: [ciudadId] };
    } else {
      resultado[dia] = heuristico[dia];
    }
  });
  return resultado;
}

async function montarVistaCalendario(contenedor, tripId, sesion, opciones = {}) {
  const modoAgenda = !!opciones.modoAgenda;
  document.documentElement.style.setProperty("--hora-px", `${HORA_PX}px`);

  contenedor.innerHTML = `
    <div class="cal-wrap">
      ${modoAgenda ? `
        <div class="cal-agenda-nav">
          <button class="secundario" id="ag-prev">← Anterior</button>
          <div id="ag-fecha-actual" class="cal-agenda-fecha"></div>
          <button class="secundario" id="ag-next">Siguiente →</button>
        </div>
      ` : ""}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <label for="cal-zona-vista" style="margin:0;font-size:12px;">Selecciona huso horario a mostrar:</label>
        <select id="cal-zona-vista" style="flex:1;"></select>
        <button type="button" class="texto" id="cal-zoom-menos" aria-label="Renglones más chicos" title="Renglones más chicos" style="flex:0 0 auto;padding:6px;">${icono("minus", 16)}</button>
        <button type="button" class="texto" id="cal-zoom-mas" aria-label="Renglones más grandes" title="Renglones más grandes" style="flex:0 0 auto;padding:6px;">${icono("plus", 16)}</button>
      </div>
      <div class="cal-body">
        <div class="cal-col-horas" id="cal-col-horas"></div>
        <div class="cal-scroll scroll-fade-x">
          <div class="cal-grid" id="cal-grid"></div>
        </div>
      </div>
      <div class="tarjeta" style="margin-top:12px;">
        <h3 style="margin-bottom:4px;">Lugares sin agendar</h3>
        <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 6px;">
          Toca un lugar y luego toca la hora del día donde quieras colocarlo.
        </p>
        <div class="fila-botones" id="cal-pendientes-filtros" style="margin:0 0 8px;"></div>
        <div class="cal-pendientes scroll-fade-x" id="cal-pendientes"></div>
      </div>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");
  const refLugares = refNodo(tripId, "lugares");
  const refItinerario = refNodo(tripId, "itinerario");
  const refTraslados = refNodo(tripId, "traslados");
  const refHospedajes = refNodo(tripId, "hospedajes");
  const refCiudadPorDia = refNodo(tripId, "ciudadPorDia");
  const refMonedas = refNodo(tripId, "monedas");

  const estado = { info: {}, ciudades: {}, lugares: {}, itinerario: {}, traslados: {}, hospedajes: {}, ciudadPorDiaManual: {}, monedas: {} };
  let lugarSeleccionado = null;
  let scrollInicialHecho = false;
  let diaAgendaActual = null;
  // Zona horaria fija en la que se dibuja TODO (sombreado de noche, posición
  // de bloques, clic para agendar, arrastre/redimensión), elegida a mano por
  // la persona usuaria — null significa "hora local de la ciudad de cada
  // día" (default). Cada columna sigue siendo un día real en la ciudad que
  // le corresponde (eso no cambia — a qué columna pertenece un traslado,
  // hospedaje o lugar se sigue decidiendo con la zona REAL de esa ciudad,
  // igual que antes de v43); lo único que cambia con este selector es en
  // qué reloj se expresa la posición vertical DENTRO de esa columna. Es
  // clave que el eje de posición y el eje de guardado (arrastre/clic) usen
  // siempre la MISMA zona (ver zonaPosicion más abajo) — si se dibujara con
  // una zona y se decodificara el pixel con otra, arrastrar un bloque lo
  // guardaría en una hora distinta a la que se ve, el mismo tipo de bug de
  // v41/v42 pero en el eje de arrastre en vez del de "a qué día pertenece".
  const claveZonaVista = `planeador_zonaVistaNoche::${tripId}`;
  let zonaVistaNoche = localStorage.getItem(claveZonaVista) || null;
  // Ciudad(es) del día que se está viendo en Agenda — normalmente una sola,
  // dos en un día partido (traslado capturado ese día, ver
  // calcularCiudadPorDia). Se recalcula en cada render() y renderPendientes()
  // la usa para no mezclar lugares de otras ciudades del viaje en la lista
  // de "sin agendar" de ese día.
  let ciudadesDelDiaAgenda = [];
  // Unión de todas las ciudades con al menos un día asignado en el viaje
  // (manual o por un traslado capturado ese día) — se recalcula en cada
  // render() y renderPendientes() la usa en modo Calendario (no Agenda) para
  // decidir qué lugares pendientes ya se pueden agendar en algún día visible.
  let ciudadesConDiaCalendario = new Set();

  // Orden de prioridad para "Lugares sin agendar": no negociables primero
  // (lo que sí o sí hay que agendar), luego importantes, luego deseables.
  // ETIQUETA_CATEGORIA_LUGAR viene de vista-lugares.js (mismo scope global
  // de script, ya cargado para cuando esto se ejecuta en runtime).
  const ORDEN_CATEGORIA_LUGAR = ["no_negociable", "importante", "deseable"];
  // Filtro toggle por categoría en esa misma lista — todas activas por
  // default (se ve exactamente lo mismo que antes hasta que la persona
  // usuaria decide ocultar alguna). Vive en memoria (no se guarda entre
  // sesiones), igual que lugarSeleccionado.
  const filtroCategoriasPendientes = new Set(ORDEN_CATEGORIA_LUGAR);

  function colorParaCiudad(ciudadId) {
    const ids = Object.keys(estado.ciudades);
    const idx = ids.indexOf(ciudadId);
    if (idx === -1) return colorCss("--color-primario");
    return colorCss(COLORES_CIUDAD[idx % COLORES_CIUDAD.length]);
  }

  // Zona horaria real de una ciudad por nombre (la de origen del viaje, o
  // alguna de "ciudades") — mismo helper que vista-logistica.js/vista-ruta.js.
  // Se usa para saber en qué día(s) cae un traslado/hospedaje según SU PROPIA
  // ciudad, nunca según la zona de la columna donde se esté dibujando (ver
  // nota en el filtro de traslados de abajo — usar la zona de la columna ahí
  // causaba que un traslado sin relación con esa ciudad "se colara" en el día
  // equivocado, solo por la aritmética de husos horarios muy separados).
  function zonaDeNombreCiudad(nombre) {
    if (!nombre) return estado.info.zonaOrigen || "America/Mexico_City";
    if (nombre === estado.info.ciudadOrigen) return estado.info.zonaOrigen || "America/Mexico_City";
    const ciudad = Object.values(estado.ciudades).find(c => c.nombre === nombre);
    return ciudad ? ciudad.zonaHoraria : (estado.info.zonaOrigen || "America/Mexico_City");
  }

  function horaLocalDecimal(isoUTC, zonaHoraria) {
    const fecha = new Date(isoUTC);
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(fecha);
    const obj = {}; partes.forEach(p => obj[p.type] = p.value);
    return Number(obj.hour) + Number(obj.minute) / 60;
  }

  // ¿Se traslapa [inicioDecimal, finDecimal) con algún otro bloque de itinerario
  // ese mismo día (en la zona horaria local del día)?
  function hayTraslape(dia, idExcluir, inicioDecimal, finDecimal, zonaHoraria) {
    return Object.entries(estado.itinerario).some(([id, b]) => {
      if (id === idExcluir) return false;
      if (fechaISO(b.inicioUTC, zonaHoraria) !== dia) return false;
      const bInicio = horaLocalDecimal(b.inicioUTC, zonaHoraria);
      let bFin = horaLocalDecimal(b.finUTC, zonaHoraria);
      if (bFin <= bInicio) bFin = 24;
      return inicioDecimal < bFin && finDecimal > bInicio;
    });
  }

  function asegurarDiaAgendaPorDefecto() {
    if (!modoAgenda || diaAgendaActual || !estado.info.fechaInicio || !estado.info.fechaFin) return;
    const hoy = fechaISO(new Date().toISOString(), estado.info.zonaOrigen || "America/Mexico_City");
    if (hoy < estado.info.fechaInicio) diaAgendaActual = estado.info.fechaInicio;
    else if (hoy > estado.info.fechaFin) diaAgendaActual = estado.info.fechaFin;
    else diaAgendaActual = hoy;
  }

  // Opciones del selector "Sombreado de noche en la hora de": la zona de
  // origen del viaje + cada ciudad ya capturada, agrupadas por zonaHoraria
  // (si dos ciudades comparten zona, basta una opción). Se reconstruye en
  // cada render porque la lista de ciudades puede cambiar.
  function renderZonaVistaSelector() {
    const select = document.getElementById("cal-zona-vista");
    if (!select) return;
    const vistas = new Map(); // zonaHoraria -> etiqueta
    if (estado.info.ciudadOrigen && estado.info.zonaOrigen) {
      vistas.set(estado.info.zonaOrigen, `${estado.info.ciudadOrigen} (origen)`);
    }
    Object.values(estado.ciudades).forEach(c => {
      if (!vistas.has(c.zonaHoraria)) vistas.set(c.zonaHoraria, c.nombre);
    });
    select.innerHTML = `<option value="">Hora local de cada día</option>` +
      Array.from(vistas.entries()).map(([zona, etiqueta]) => `<option value="${esc(zona)}">${esc(etiqueta)}</option>`).join("");
    // Si la zona guardada ya no corresponde a ninguna ciudad del viaje (se
    // borró esa ciudad), se cae de vuelta a "hora local de cada día".
    if (zonaVistaNoche && !vistas.has(zonaVistaNoche)) {
      zonaVistaNoche = null;
      localStorage.removeItem(claveZonaVista);
    }
    select.value = zonaVistaNoche || "";
  }

  function render() {
    const grid = document.getElementById("cal-grid");
    const colHorasEl = document.getElementById("cal-col-horas");
    const pendientesEl = document.getElementById("cal-pendientes");
    if (!grid || !colHorasEl || !pendientesEl) return;

    renderZonaVistaSelector();
    asegurarDiaAgendaPorDefecto();

    const dias = modoAgenda ? (diaAgendaActual ? [diaAgendaActual] : []) : listaDeDias(estado.info.fechaInicio, estado.info.fechaFin);
    const ciudadPorDia = calcularCiudadPorDia(dias, estado.ciudadPorDiaManual, estado.ciudades, estado.traslados, estado.info.zonaOrigen || "America/Mexico_City");
    ciudadesDelDiaAgenda = (modoAgenda && diaAgendaActual && ciudadPorDia[diaAgendaActual]) ? ciudadPorDia[diaAgendaActual].ciudadIds : [];
    ciudadesConDiaCalendario = new Set(Object.values(ciudadPorDia).flatMap(info => info.ciudadIds || []));

    if (modoAgenda) {
      const encabezado = document.getElementById("ag-fecha-actual");
      if (encabezado && diaAgendaActual) {
        const infoDia = ciudadPorDia[diaAgendaActual] || { etiqueta: "—" };
        const fechaLarga = new Date(`${diaAgendaActual}T00:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
        encabezado.innerHTML = `${esc(fechaLarga)}<br><span style="font-size:12px;color:var(--color-texto-suave);font-family:var(--font-body);">${esc(infoDia.etiqueta)}</span>`;
      }
      // No dejar navegar fuera del rango de fechas del viaje.
      const btnPrev = document.getElementById("ag-prev");
      const btnNext = document.getElementById("ag-next");
      if (btnPrev) btnPrev.disabled = !diaAgendaActual || !estado.info.fechaInicio || diaAgendaActual <= estado.info.fechaInicio;
      if (btnNext) btnNext.disabled = !diaAgendaActual || !estado.info.fechaFin || diaAgendaActual >= estado.info.fechaFin;
    }

    limpiar(grid);

    // El eje de horas siempre es la hora LOCAL del día (cada columna puede tener
    // una ciudad/zona distinta) — el horario de origen se muestra por bloque.
    // En Agenda no hay encabezado de día dentro de la cuadrícula (ese dato ya
    // está en la barra de arriba), así que tampoco se reserva ese espacio aquí
    // — si no, las filas de hora quedan corridas respecto a los bloques.
    // Vive FUERA de #cal-grid (que es lo único que hace scroll horizontal en
    // .cal-scroll) para que quede fija de verdad al deslizar los días — antes
    // dependía de position:sticky dentro de la fila flex con scroll, y a veces
    // dejaba de pegarse a la mitad del recorrido.
    colHorasEl.innerHTML = (modoAgenda ? "" : `<div class="cal-header">Hora<br>local</div>`) +
      Array.from({ length: 24 }, (_, h) => `<div class="cal-hora-fila">${String(h).padStart(2, "0")}:00</div>`).join("");

    dias.forEach(dia => {
      const infoDia = ciudadPorDia[dia] || { etiqueta: "—", zonaHoraria: estado.info.zonaOrigen };
      // Zona en la que se dibuja/decodifica TODO dentro de esta columna: la
      // posición de los bloques, el sombreado de noche, el clic para agendar
      // y el arrastre/redimensión (ver habilitarArrastre/habilitarRedimension
      // más abajo, que reciben esta misma zona). El amanecer/atardecer real
      // sigue siendo el de la ciudad del día (ciudadDelDia, por sus
      // coordenadas) — zonaPosicion solo cambia en qué reloj se expresa.
      const zonaPosicion = zonaVistaNoche || infoDia.zonaHoraria;
      const col = document.createElement("div");
      col.className = modoAgenda ? "cal-dia cal-dia-agenda" : "cal-dia";
      col.innerHTML = `
        ${modoAgenda ? "" : `
        <div class="cal-dia-header">
          <span class="fecha">${esc(new Date(`${dia}T00:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", timeZone: "UTC" }))}</span>
          <span class="ciudad">${esc(infoDia.etiqueta)}</span>
        </div>`}
        <div class="cal-area" style="height:${24 * HORA_PX}px;" data-dia="${esc(dia)}" data-tz="${esc(zonaPosicion)}"></div>
      `;
      const area = col.querySelector(".cal-area");
      const ciudadDelDia = infoDia.ciudadId ? estado.ciudades[infoDia.ciudadId] : null;
      area.style.backgroundImage = fondoConNoche(calcularFranjaNoche(dia, ciudadDelDia, zonaPosicion));

      area.addEventListener("click", async e => {
        if (e.target !== area) return;
        if (!lugarSeleccionado) return;
        const lugar = estado.lugares[lugarSeleccionado];
        if (!lugar) return;
        if (infoDia.ciudadIds && infoDia.ciudadIds.length && !infoDia.ciudadIds.includes(lugar.ciudadId)) {
          const nombreCiudadLugar = estado.ciudades[lugar.ciudadId] ? estado.ciudades[lugar.ciudadId].nombre : "otra ciudad";
          alert(`Este día está asignado a "${infoDia.etiqueta}", pero "${lugar.nombre}" es de ${nombreCiudadLugar}. Asigna primero ese día a la ciudad correcta en la pestaña Ciudades.`);
          return;
        }
        const rect = area.getBoundingClientRect();
        const horaClick = Math.max(0, Math.min(23, Math.floor((e.clientY - rect.top) / HORA_PX)));
        if (hayTraslape(dia, null, horaClick, horaClick + 1, zonaPosicion)) {
          alert("Ya hay algo agendado en ese horario. Elige otra hora.");
          return;
        }
        const inicioISO = localAUTC(dia, `${String(horaClick).padStart(2, "0")}:00`, zonaPosicion);
        const finISO = new Date(new Date(inicioISO).getTime() + 3600000).toISOString();
        await agregar(refItinerario, {
          tipo: "lugar", refId: lugarSeleccionado, ciudadId: lugar.ciudadId,
          inicioUTC: inicioISO, finUTC: finISO, fijado: false
        });
        lugarSeleccionado = null;
        renderPendientes();
      });

      // A qué columna pertenece cada bloque (lugares/traslados/hospedajes) se
      // decide SIEMPRE con la misma zona que gobierna la posición dentro de
      // esa columna (zonaPosicion) — nunca una mezcla de zonas distintas
      // entre bloques de una misma columna. Es clave que TODOS los bloques
      // de una columna compartan un único eje pixel↔hora: si uno se
      // posicionara con una zona y otro con otra (p.ej. cada uno cayendo a
      // un "fallback" distinto), dos traslados que en la realidad NO se
      // traslapan podrían dibujarse encimados, porque sus ejes de hora ya
      // no serían comparables entre sí (bug real visto en producción v44).
      // Sin zona de vista, zonaPosicion === la zona real de la ciudad del
      // día — igual que siempre, sin cambios. Con zona de vista activa, es
      // una única zona global (no "la zona de la columna ajena de turno"),
      // así que no reintroduce el bug de traslados/hospedajes cruzando a un
      // día equivocado que forzó a bucketear siempre por la zona propia de
      // cada entidad (ver comentario histórico más abajo) — acá es una sola
      // zona consistente para todo el calendario. Efecto secundario
      // aceptado: con un desfase muy grande entre la zona de vista y la real
      // (p.ej. ver Tokio en hora de México), un bloque puede caer fuera del
      // rango de días visible del viaje y no dibujarse en ninguna columna —
      // se prefiere eso a una posición engañosa o inconsistente con sus
      // vecinos.
      Object.entries(estado.itinerario)
        .filter(([, b]) => fechaISO(b.inicioUTC, zonaPosicion) === dia)
        .forEach(([id, b]) => pintarBloqueLugar(area, id, b, zonaPosicion, dia, ciudadPorDia));

      // Traslados que tocan este día: el día de salida o el de llegada,
      // medidos en zonaPosicion (ver comentario arriba). Sin zona de vista
      // esto es zonaDeNombreCiudad(origen/destino) — la zona propia de cada
      // tramo — que es la que corrigió el bug histórico: usar la zona de LA
      // COLUMNA (que podía ser la de una ciudad ajena al traslado) para
      // decidir a qué día pertenece hacía que un traslado sin relación con
      // esa ciudad "se colara" en el día equivocado solo porque, al
      // convertir su inicio/fin a una zona horaria muy distinta y ajena
      // (p.ej. Tokio, +9h), la aritmética cruzaba por casualidad la
      // medianoche de esa zona ajena. Con zona de vista activa no es el
      // mismo riesgo: es una sola zona global, no la de una columna ajena
      // variable. Un traslado largo (vuelo internacional de +10h) sí puede
      // tocar dos días DE VERDAD (el de salida y el de llegada) — se dibuja
      // un segmento recortado en cada uno (ver pintarBloqueFijo). Usa su
      // duración real (fin de trayecto) si ya se capturó, o 1h como
      // referencia si es un traslado viejo.
      Object.entries(estado.traslados)
        .filter(([, t]) => {
          const fin = t.finUTC || new Date(new Date(t.inicioUTC).getTime() + 3600000).toISOString();
          const diaSalida = fechaISO(t.inicioUTC, zonaVistaNoche || zonaDeNombreCiudad(t.origen));
          const diaLlegada = fechaISO(fin, zonaVistaNoche || zonaDeNombreCiudad(t.destino));
          return dia === diaSalida || dia === diaLlegada;
        })
        .forEach(([id, t]) => {
          const fin = t.finUTC || new Date(new Date(t.inicioUTC).getTime() + 3600000).toISOString();
          const duracion = t.finUTC ? ` (${formatoDuracion(new Date(t.finUTC) - new Date(t.inicioUTC))})` : "";
          const viaEscalas = (t.escalas || []).map(e => ` → ${e}`).join("");
          pintarBloqueFijo(area, "plane", `${t.tipo}: ${t.origen}${viaEscalas} → ${t.destino}${duracion}`, t.inicioUTC, fin, zonaPosicion, "--color-traslado", dia);
        });

      // Hospedajes: un bloque el día de check-in y otro el día de check-out,
      // con el mismo criterio de zona que traslados arriba.
      Object.entries(estado.hospedajes)
        .filter(([, h]) => h.checkinUTC && fechaISO(h.checkinUTC, zonaVistaNoche || zonaDeNombreCiudad(h.ciudad)) === dia)
        .forEach(([id, h]) => {
          const noches = h.noches ? ` (${h.noches} noche${h.noches > 1 ? "s" : ""})` : "";
          pintarBloqueFijo(area, "hotel", `Check-in: ${h.nombre}${noches}`, h.checkinUTC, new Date(new Date(h.checkinUTC).getTime() + 3600000).toISOString(), zonaPosicion, "--color-hospedaje", dia);
        });
      Object.entries(estado.hospedajes)
        .filter(([, h]) => h.checkoutUTC && fechaISO(h.checkoutUTC, zonaVistaNoche || zonaDeNombreCiudad(h.ciudad)) === dia)
        .forEach(([id, h]) => pintarBloqueFijo(area, "hotel", `Check-out: ${h.nombre}`, h.checkoutUTC, new Date(new Date(h.checkoutUTC).getTime() + 3600000).toISOString(), zonaPosicion, "--color-hospedaje", dia));

      grid.appendChild(col);
    });

    renderPendientes();

    // Auto-scroll a la columna de hoy, solo una vez por montaje de la vista.
    if (!scrollInicialHecho && !modoAgenda) {
      const hoyStr = fechaISO(new Date().toISOString(), estado.info.zonaOrigen || "America/Mexico_City");
      if (dias.includes(hoyStr)) {
        const areaHoy = grid.querySelector(`.cal-area[data-dia="${hoyStr}"]`);
        const columnaHoy = areaHoy ? areaHoy.closest(".cal-dia") : null;
        const scrollEl = contenedor.querySelector(".cal-scroll");
        if (columnaHoy && scrollEl) scrollEl.scrollLeft = Math.max(0, columnaHoy.offsetLeft);
        scrollInicialHecho = true;
      }
    }
  }

  // Calcula la posición vertical (hora decimal 0-24) de un bloque dentro de
  // la columna `dia`, usando siempre zonaHoraria (zonaPosicion) — la MISMA
  // zona para todos los bloques de una columna, sin excepciones por bloque.
  // Es clave que sea así: si cada bloque decidiera su propia zona de
  // posición (p.ej. cayendo a un "fallback" distinto cuando no toca `dia`),
  // dos bloques que en la realidad no se traslapan podrían dibujarse
  // encimados, porque sus ejes de hora dejarían de ser comparables entre sí
  // (bug real visto en producción v44 — dos traslados quedaron encimados en
  // Agenda al ver el calendario en hora de Tokio). Si el bloque queda
  // COMPLETAMENTE fuera de `dia` en esta zona (posible con una zona de
  // vista muy alejada de la real), se recorta a un bloque de 24h — menos
  // preciso que desaparecer o encimarse con un vecino en un eje distinto,
  // pero consistente con el resto de la columna.
  function calcularPosicionBloque(inicioUTC, finUTC, zonaHoraria, dia) {
    const diaInicio = fechaISO(inicioUTC, zonaHoraria);
    const diaFin = fechaISO(finUTC, zonaHoraria);
    const inicio = diaInicio === dia ? horaLocalDecimal(inicioUTC, zonaHoraria) : 0;
    let fin = diaFin === dia ? horaLocalDecimal(finUTC, zonaHoraria) : 24;
    if (fin <= inicio) fin = 24;
    return { inicio, fin, diaInicio };
  }

  // dia: fecha local (AAAA-MM-DD, en zonaHoraria) de la columna donde se está
  // pintando este bloque — ver calcularPosicionBloque.
  function pintarBloqueFijo(area, iconoTipo, texto, inicioUTC, finUTC, zonaHoraria, colorVar, dia) {
    const { inicio, fin, diaInicio } = calcularPosicionBloque(inicioUTC, finUTC, zonaHoraria, dia);
    const div = document.createElement("div");
    div.className = "cal-bloque fijado";
    div.style.top = `${inicio * HORA_PX}px`;
    div.style.height = `${Math.max(fin - inicio, 0.5) * HORA_PX}px`;
    div.style.background = colorCss(colorVar);
    const zonaOrigen = estado.info.zonaOrigen || "America/Mexico_City";
    const etiquetaZona = zonaVistaNoche ? "vista" : "local";
    // La hora de origen solo tiene sentido en el día real de salida — en los
    // días siguientes (si el traslado sigue en curso) confundiría más que ayudar.
    const horaOrigenTxt = (zonaOrigen !== zonaHoraria && diaInicio === dia)
      ? `<div style="font-size:9.5px;opacity:0.85;">${formatoHora(inicioUTC, zonaHoraria)} ${etiquetaZona} · ${formatoHora(inicioUTC, zonaOrigen)} origen</div>`
      : "";
    div.innerHTML = `<div class="titulo">${icono("lock", 12)}${icono(iconoTipo, 12)} ${esc(texto)}</div>${horaOrigenTxt}`;
    area.appendChild(div);
  }

  // Modal con la info del lugar (nombre, categoría, ciudad, horario
  // agendado, notas, costo, ligas de mapa/sitio web) — se abre al tocar el
  // bloque en Calendario/Agenda sin arrastrarlo, para no tener que ir hasta
  // la pestaña Lugares a consultarlo. Un botón "Editar" cambia el MISMO
  // modal a un formulario (sin cerrar/reabrir); al guardar (o cancelar)
  // vuelve a mostrar esta vista de solo lectura, ya actualizada.
  // ETIQUETA_CATEGORIA_LUGAR viene de vista-lugares.js (mismo scope global
  // de script, ya cargado).
  function mostrarInfoLugar(lugarInicial, bloque, zonaHoraria) {
    const { modal, cerrar } = abrirModal("");

    function renderVista(lugar) {
      const zonaOrigen = estado.info.zonaOrigen || "America/Mexico_City";
      const etiquetaZona = zonaVistaNoche ? "vista" : "local";
      const ciudad = estado.ciudades[lugar.ciudadId];
      const ligaWeb = (lugar.ligas || [])[0];
      const horaOrigenTxt = zonaOrigen !== zonaHoraria
        ? `<p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 8px;">${formatoHora(bloque.inicioUTC, zonaOrigen)}–${formatoHora(bloque.finUTC, zonaOrigen)} hora de origen</p>`
        : "";
      modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <h3 style="margin:0;">${lugar.aireLibre ? icono("snowflake", 15) + " " : ""}${esc(lugar.nombre)}</h3>
          <span class="chip ${esc(lugar.categoria)}">${esc(ETIQUETA_CATEGORIA_LUGAR[lugar.categoria] || lugar.categoria)}</span>
        </div>
        <p style="font-size:13px;color:var(--color-texto-suave);margin:4px 0 8px;">
          ${esc(ciudad ? ciudad.nombre : "")} · ${formatoHora(bloque.inicioUTC, zonaHoraria)}–${formatoHora(bloque.finUTC, zonaHoraria)} ${etiquetaZona}
        </p>
        ${horaOrigenTxt}
        ${lugar.costo != null ? `<p style="font-size:13px;">${esc(formatoCosto(lugar.costo, lugar.costoTipo, lugar.moneda))}</p>` : ""}
        ${lugar.notas ? `<p style="font-size:13px;white-space:pre-wrap;">${esc(lugar.notas)}</p>` : ""}
        ${(lugar.liga_mapa || ligaWeb) ? `
        <div class="fila-botones">
          ${lugar.liga_mapa ? `<a href="${esc(lugar.liga_mapa)}" target="_blank" rel="noopener noreferrer"><button type="button" class="secundario">${iconoTexto("map", "Mapa", 14)}</button></a>` : ""}
          ${ligaWeb ? `<a href="${esc(ligaWeb)}" target="_blank" rel="noopener noreferrer"><button type="button" class="secundario">${iconoTexto("link", "Sitio web", 14)}</button></a>` : ""}
        </div>` : ""}
        <div class="fila-botones">
          <button type="button" id="il-editar">Editar</button>
          <button type="button" class="secundario" id="il-cerrar">Cerrar</button>
        </div>
      `;
      modal.querySelector("#il-editar").addEventListener("click", () => renderEdicion(lugar));
      modal.querySelector("#il-cerrar").addEventListener("click", cerrar);
    }

    function renderEdicion(lugar) {
      const idsCiudades = Object.keys(estado.ciudades);
      modal.innerHTML = `
        <h3>Editar lugar</h3>
        <form id="il-form">
          <label for="il-nombre">Nombre</label>
          <input id="il-nombre" type="text" required autofocus value="${esc(lugar.nombre)}">
          <label for="il-ciudad">Ciudad</label>
          <select id="il-ciudad" required>
            ${idsCiudades.map(id => `<option value="${esc(id)}" ${lugar.ciudadId === id ? "selected" : ""}>${esc(estado.ciudades[id].nombre)}</option>`).join("")}
          </select>
          <label for="il-categoria">Prioridad</label>
          <select id="il-categoria" required>
            <option value="deseable" ${lugar.categoria === "deseable" ? "selected" : ""}>Deseable</option>
            <option value="importante" ${lugar.categoria === "importante" ? "selected" : ""}>Importante</option>
            <option value="no_negociable" ${lugar.categoria === "no_negociable" ? "selected" : ""}>No negociable</option>
          </select>
          <label for="il-mapa">Liga de mapa</label>
          <input id="il-mapa" type="url" placeholder="https://maps.google.com/… (opcional)" value="${esc(lugar.liga_mapa || "")}">
          <label for="il-liga">Liga de interés adicional</label>
          <input id="il-liga" type="url" placeholder="https://… (opcional)" value="${esc((lugar.ligas || [])[0] || "")}">
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
            <input id="il-aire-libre" type="checkbox" ${lugar.aireLibre ? "checked" : ""}>
            ${icono("snowflake", 15)} Actividad al aire libre (requiere ropa de intemperie)
          </label>
          <label for="il-notas">Notas</label>
          <textarea id="il-notas" placeholder="Opcional">${esc(lugar.notas || "")}</textarea>
          ${camposCosto("il", lugar, "porPersona", monedasActivasDe(estado.monedas))}
          <div class="fila-botones">
            <button type="submit">Guardar cambios</button>
            <button type="button" class="secundario" id="il-cancelar-edicion">Cancelar</button>
          </div>
        </form>
      `;
      modal.querySelector("#il-cancelar-edicion").addEventListener("click", () => renderVista(lugar));
      modal.querySelector("#il-form").addEventListener("submit", async e => {
        e.preventDefault();
        const nombre = modal.querySelector("#il-nombre").value.trim();
        const ciudadId = modal.querySelector("#il-ciudad").value;
        if (!nombre || !ciudadId) return;
        const categoria = modal.querySelector("#il-categoria").value;
        const liga_mapa = modal.querySelector("#il-mapa").value.trim();
        const ligaExtra = modal.querySelector("#il-liga").value.trim();
        const aireLibre = modal.querySelector("#il-aire-libre").checked;
        const notas = modal.querySelector("#il-notas").value.trim();
        const { costo, costoTipo, moneda } = leerCamposCosto(modal, "il");
        const datos = { nombre, ciudadId, categoria, liga_mapa, ligas: ligaExtra ? [ligaExtra] : [], aireLibre, notas, costo, costoTipo, moneda };
        await actualizar(refLugares.child(bloque.refId), datos);
        // Vuelve a la vista de solo lectura ya con los datos nuevos, sin
        // esperar a que el listener de Firebase confirme el viaje redondo.
        renderVista({ ...lugar, ...datos });
      });
    }

    renderVista(lugarInicial);
  }

  // zonaHoraria: zona de posición de esta columna (zonaPosicion — la MISMA
  // para todos los bloques de la columna, ver calcularPosicionBloque). dia:
  // día de la columna.
  function pintarBloqueLugar(area, id, bloque, zonaHoraria, dia, ciudadPorDia) {
    const lugar = estado.lugares[bloque.refId];
    if (!lugar) return;
    const { inicio, fin } = calcularPosicionBloque(bloque.inicioUTC, bloque.finUTC, zonaHoraria, dia);
    const div = document.createElement("div");
    div.className = `cal-bloque cat-${lugar.categoria}${bloque.fijado ? " fijado" : ""}`;
    div.style.top = `${inicio * HORA_PX}px`;
    div.style.height = `${Math.max(fin - inicio, 0.5) * HORA_PX}px`;
    div.style.background = colorParaCiudad(lugar.ciudadId);
    const zonaOrigen = estado.info.zonaOrigen || "America/Mexico_City";
    const etiquetaZona = zonaVistaNoche ? "vista" : "local";
    const horaOrigenTxt = zonaOrigen !== zonaHoraria
      ? `<div style="font-size:9.5px;opacity:0.85;">${formatoHora(bloque.inicioUTC, zonaOrigen)}–${formatoHora(bloque.finUTC, zonaOrigen)} origen</div>`
      : "";
    // Liga directa a Mapa/sitio web del lugar (capturadas en la pestaña
    // Lugares) — abren en otra pestaña sin pasar por esa sección. Van en
    // línea justo después del título, con margen, para que se noten como
    // acciones propias del lugar y no se confundan con fijar/quitar
    // (esquinas del bloque). data-accion las excluye del arrastre igual
    // que fijar/quitar (ver habilitarArrastre, que ignora cualquier
    // "[data-accion]" al iniciar).
    const ligaWeb = (lugar.ligas || [])[0];
    const accionMapa = lugar.liga_mapa
      ? `<a class="accion-liga" data-accion="mapa" href="${esc(lugar.liga_mapa)}" target="_blank" rel="noopener noreferrer" title="Ver en el mapa" onclick="event.stopPropagation()">${icono("map", 13)}</a>`
      : "";
    const accionWeb = ligaWeb
      ? `<a class="accion-liga" data-accion="web" href="${esc(ligaWeb)}" target="_blank" rel="noopener noreferrer" title="Sitio web" onclick="event.stopPropagation()">${icono("link", 13)}</a>`
      : "";
    // Insignia de prioridad: "‼" no negociable, "!" importante — nada para
    // deseable, que es la prioridad base y no necesita destacarse.
    const INSIGNIA_PRIORIDAD = { no_negociable: "‼", importante: "!" };
    const badgePrioridad = INSIGNIA_PRIORIDAD[lugar.categoria]
      ? `<span class="badge-prioridad" title="${esc(ETIQUETA_CATEGORIA_LUGAR[lugar.categoria] || lugar.categoria)}">${INSIGNIA_PRIORIDAD[lugar.categoria]}</span>`
      : "";
    const badgeAireLibre = lugar.aireLibre
      ? `<span class="badge-aire" title="Actividad al aire libre (requiere ropa de intemperie)">${icono("snowflake", 12)}</span>`
      : "";
    // Todas las insignias puramente informativas (prioridad, aire libre) van
    // juntas en la esquina inferior izquierda — pointer-events:none en el
    // contenedor (ver estilos.css), no compiten con el tap-para-info ni con
    // el arrastre.
    const badgesInferior = (badgePrioridad || badgeAireLibre)
      ? `<div class="badges-inferior">${badgePrioridad}${badgeAireLibre}</div>`
      : "";
    div.innerHTML = `
      <span class="accion-fijar" data-accion="fijar" title="Fijar/soltar">${bloque.fijado ? icono("lock", 13) : icono("pin", 13)}</span>
      <span class="accion-quitar" data-accion="quitar" title="Quitar del calendario">${icono("x", 13)}</span>
      ${badgesInferior}
      <div class="titulo">${esc(lugar.nombre)}${accionMapa}${accionWeb}</div>
      <div style="font-size:10px;opacity:0.9;">${formatoHora(bloque.inicioUTC, zonaHoraria)}–${formatoHora(bloque.finUTC, zonaHoraria)} ${etiquetaZona}</div>
      ${horaOrigenTxt}
      ${bloque.fijado ? "" : '<div class="resize"></div>'}
    `;

    div.querySelector('[data-accion="fijar"]').addEventListener("click", ev => {
      ev.stopPropagation();
      actualizar(refItinerario.child(id), { fijado: !bloque.fijado });
    });
    div.querySelector('[data-accion="quitar"]').addEventListener("click", ev => {
      ev.stopPropagation();
      eliminar(refItinerario.child(id));
    });

    if (!bloque.fijado) {
      habilitarArrastre(div, area, id, bloque, zonaHoraria, ciudadPorDia);
      habilitarRedimension(div.querySelector(".resize"), area, id, bloque, zonaHoraria);
    } else {
      // Fijado: sin arrastre/redimensión (ver arriba), así que un tap normal
      // no tiene ningún otro manejador que lo intercepte — basta un "click".
      div.addEventListener("click", e => {
        if (e.target.closest("[data-accion]")) return;
        mostrarInfoLugar(lugar, bloque, zonaHoraria);
      });
    }

    area.appendChild(div);
  }

  // Arrastre vertical (cambia hora) y, si el puntero cruza a la columna de
  // otro día cuya ciudad coincide con la del lugar, también cambia de día.
  function habilitarArrastre(div, areaInicial, id, bloque, zonaHorariaInicial, ciudadPorDia) {
    let arrastrando = false, offsetY = 0, nuevoTop = 0, topInicial = 0, seMovio = false;
    let areaActual = areaInicial;
    let zonaActual = zonaHorariaInicial;

    div.addEventListener("pointerdown", e => {
      if (e.target.closest(".resize") || e.target.closest("[data-accion]")) return;
      arrastrando = true;
      seMovio = false;
      areaActual = areaInicial;
      zonaActual = zonaHorariaInicial;
      offsetY = e.clientY - div.getBoundingClientRect().top;
      // Un simple tap (sin pointermove) debe dejar el bloque donde estaba,
      // no mandarlo a las 00:00 — por eso arrancamos desde su posición actual.
      topInicial = parseFloat(div.style.top) || 0;
      nuevoTop = topInicial;
      div.setPointerCapture(e.pointerId);
      div.style.zIndex = "10";
    });
    div.addEventListener("pointermove", e => {
      if (!arrastrando) return;
      const lugar = estado.lugares[bloque.refId];
      div.style.visibility = "hidden";
      const elDebajo = document.elementFromPoint(e.clientX, e.clientY);
      div.style.visibility = "";
      const nuevaArea = elDebajo ? elDebajo.closest(".cal-area") : null;
      if (nuevaArea && nuevaArea !== areaActual && lugar) {
        const diaCandidato = nuevaArea.dataset.dia;
        const infoCandidato = ciudadPorDia[diaCandidato];
        const puedeMover = !infoCandidato || !infoCandidato.ciudadIds || !infoCandidato.ciudadIds.length || infoCandidato.ciudadIds.includes(lugar.ciudadId);
        if (puedeMover) {
          areaActual = nuevaArea;
          zonaActual = nuevaArea.dataset.tz;
          areaActual.appendChild(div);
        }
      }
      const rectArea = areaActual.getBoundingClientRect();
      nuevoTop = Math.max(0, Math.min(23.5 * HORA_PX, e.clientY - rectArea.top - offsetY));
      nuevoTop = Math.round(nuevoTop / (HORA_PX / 4)) * (HORA_PX / 4); // snap a 15 min
      if (Math.abs(nuevoTop - topInicial) > 0.5 || areaActual !== areaInicial) seMovio = true;
      div.style.top = `${nuevoTop}px`;
    });
    div.addEventListener("pointerup", async () => {
      if (!arrastrando) return;
      arrastrando = false;
      div.style.zIndex = "";
      // Un tap sin arrastre real no debe mover ni reescribir nada — en vez
      // de eso, muestra la info del lugar (zonaActual sigue siendo la zona
      // en la que se dibujó, al no haberse movido de columna).
      if (!seMovio) {
        const lugar = estado.lugares[bloque.refId];
        if (lugar) mostrarInfoLugar(lugar, bloque, zonaActual);
        return;
      }
      const dia = areaActual.dataset.dia;
      const nuevaHoraDecimal = nuevoTop / HORA_PX;
      const duracionHoras = (new Date(bloque.finUTC) - new Date(bloque.inicioUTC)) / 3600000;
      if (hayTraslape(dia, id, nuevaHoraDecimal, nuevaHoraDecimal + duracionHoras, zonaActual)) {
        alert("Ya hay algo agendado en ese horario. Se regresó a su posición anterior.");
        solicitarRender();
        return;
      }
      const hh = Math.floor(nuevaHoraDecimal);
      const mm = Math.round((nuevaHoraDecimal - hh) * 60);
      const nuevoInicio = localAUTC(dia, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, zonaActual);
      const nuevoFin = new Date(new Date(nuevoInicio).getTime() + duracionHoras * 3600000).toISOString();
      await actualizar(refItinerario.child(id), { inicioUTC: nuevoInicio, finUTC: nuevoFin });
    });
  }

  function habilitarRedimension(handle, area, id, bloque, zonaHoraria) {
    if (!handle) return;
    let redimensionando = false;
    handle.addEventListener("pointerdown", e => {
      redimensionando = true;
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", e => {
      if (!redimensionando) return;
      const div = handle.parentElement;
      const rectArea = area.getBoundingClientRect();
      let nuevaAltura = e.clientY - rectArea.top - parseFloat(div.style.top);
      nuevaAltura = Math.max(HORA_PX / 4, Math.round(nuevaAltura / (HORA_PX / 4)) * (HORA_PX / 4));
      div.style.height = `${nuevaAltura}px`;
    });
    handle.addEventListener("pointerup", async () => {
      if (!redimensionando) return;
      redimensionando = false;
      const div = handle.parentElement;
      const duracionHoras = parseFloat(div.style.height) / HORA_PX;
      const inicioDecimal = parseFloat(div.style.top) / HORA_PX;
      if (hayTraslape(area.dataset.dia, id, inicioDecimal, inicioDecimal + duracionHoras, zonaHoraria)) {
        alert("Ese tamaño se traslaparía con otro elemento. Se regresó a su duración anterior.");
        solicitarRender();
        return;
      }
      const nuevoFin = new Date(new Date(bloque.inicioUTC).getTime() + duracionHoras * 3600000).toISOString();
      await actualizar(refItinerario.child(id), { finUTC: nuevoFin });
    });
  }

  // Chips toggle (No negociable/Importante/Deseable) para filtrar qué
  // categorías se muestran en "Lugares sin agendar" — no dependen de qué
  // día/ciudad está activo, así que se pintan una sola vez y solo vuelven a
  // pintarse ellas mismas al togglear (renderPendientes() sigue actualizando
  // la lista de abajo).
  function renderFiltrosPendientes() {
    const el = document.getElementById("cal-pendientes-filtros");
    if (!el) return;
    limpiar(el);
    ORDEN_CATEGORIA_LUGAR.forEach(cat => {
      const activo = filtroCategoriasPendientes.has(cat);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip ${cat}${activo ? "" : " chip-inactivo"}`;
      chip.textContent = ETIQUETA_CATEGORIA_LUGAR[cat] || cat;
      chip.title = activo ? "Ocultar de esta lista" : "Mostrar en esta lista";
      chip.addEventListener("click", () => {
        if (activo) filtroCategoriasPendientes.delete(cat);
        else filtroCategoriasPendientes.add(cat);
        renderFiltrosPendientes();
        renderPendientes();
      });
      el.appendChild(chip);
    });
  }

  function renderPendientes() {
    const el = document.getElementById("cal-pendientes");
    if (!el) return;
    renderFiltrosPendientes();
    limpiar(el);
    const idsAgendados = new Set(Object.values(estado.itinerario).map(b => b.refId));
    const sinAgendarSinFiltro = Object.entries(estado.lugares).filter(([id]) => !idsAgendados.has(id));
    const todosPendientes = sinAgendarSinFiltro
      .filter(([, l]) => filtroCategoriasPendientes.has(l.categoria))
      // No negociables primero, luego importantes, luego deseables — dentro
      // de cada categoría, alfabético (para que el orden no salte de un
      // render a otro sin motivo).
      .sort((a, b) => {
        const porCategoria = ORDEN_CATEGORIA_LUGAR.indexOf(a[1].categoria) - ORDEN_CATEGORIA_LUGAR.indexOf(b[1].categoria);
        return porCategoria !== 0 ? porCategoria : a[1].nombre.localeCompare(b[1].nombre);
      });

    let listos, mensajeVacio, ctaRuta = false;
    if (modoAgenda) {
      // En Agenda solo tiene sentido ofrecer lugares de la(s) ciudad(es) de
      // ESTE día (dos en un día partido) — mostrar los de otras ciudades del
      // viaje solo confunde.
      listos = ciudadesDelDiaAgenda.length ? todosPendientes.filter(([, l]) => ciudadesDelDiaAgenda.includes(l.ciudadId)) : [];
      if (ciudadesDelDiaAgenda.length) {
        mensajeVacio = "Sin lugares pendientes de esta ciudad.";
      } else {
        mensajeVacio = "Asigna la ciudad de este día en la pestaña Ruta para ver lugares pendientes.";
        ctaRuta = true;
      }
    } else {
      // En Calendario (todos los días) sí tiene sentido ofrecer lugares de
      // cualquier ciudad que ya tenga al menos un día asignado (incluye
      // ambas ciudades de un día partido).
      listos = todosPendientes.filter(([, l]) => ciudadesConDiaCalendario.size === 0 || ciudadesConDiaCalendario.has(l.ciudadId));
      mensajeVacio = "Asigna ciudades a los días en la pestaña Ruta para poder agendar tus lugares.";
      ctaRuta = true;
    }

    if (listos.length === 0) {
      if (sinAgendarSinFiltro.length === 0) {
        el.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Todos los lugares están agendados.</p>';
        return;
      }
      if (todosPendientes.length === 0) {
        // Hay lugares pendientes, pero ninguno de la categoría que se dejó
        // activa en los filtros de arriba — no es lo mismo que "ya no hay
        // nada pendiente", así que amerita su propio mensaje.
        el.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Sin lugares pendientes con los filtros de categoría activos.</p>';
        return;
      }
      // Estado vacío por falta de asignación en Ruta: botón directo a esa
      // pestaña, no solo el texto explicando qué falta.
      el.innerHTML = `
        <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 8px;">${esc(mensajeVacio)}</p>
        ${ctaRuta ? `<button class="secundario" id="cal-btn-ir-ruta">Ir a Ruta</button>` : ""}
      `;
      const btnIrRuta = document.getElementById("cal-btn-ir-ruta");
      if (btnIrRuta) btnIrRuta.addEventListener("click", () => cambiarVista("ruta"));
      return;
    }
    listos.forEach(([id, l]) => {
      const chip = document.createElement("div");
      chip.className = "cal-chip-pendiente" + (lugarSeleccionado === id ? " seleccionado" : "");
      chip.innerHTML = `${l.aireLibre ? icono("snowflake", 12) + " " : ""}${esc(l.nombre)}`;
      chip.addEventListener("click", () => {
        lugarSeleccionado = lugarSeleccionado === id ? null : id;
        renderPendientes();
      });
      el.appendChild(chip);
    });
    const esperando = todosPendientes.length - listos.length;
    if (esperando > 0) {
      const nota = document.createElement("p");
      nota.style.cssText = "font-size:11px;color:var(--color-texto-suave);width:100%;margin:4px 0 0;";
      nota.textContent = modoAgenda
        ? `${esperando} más en otras ciudades del viaje.`
        : `${esperando} más esperando a que asignes su ciudad en la pestaña Ruta.`;
      el.appendChild(nota);
    }
  }

  document.getElementById("cal-zona-vista").addEventListener("change", e => {
    zonaVistaNoche = e.target.value || null;
    if (zonaVistaNoche) localStorage.setItem(claveZonaVista, zonaVistaNoche);
    else localStorage.removeItem(claveZonaVista);
    solicitarRender();
  });

  // Zoom vertical de la cuadrícula: preferencia global (no por viaje, ver
  // NIVELES_HORA_PX), así que Agenda y Calendario (y cualquier otro viaje
  // que se abra después) comparten el mismo nivel. Los botones se
  // deshabilitan en los extremos en vez de dar la vuelta — son 2-3 niveles
  // fijos, no un zoom continuo.
  function actualizarBotonesZoom() {
    const btnMas = document.getElementById("cal-zoom-mas");
    const btnMenos = document.getElementById("cal-zoom-menos");
    if (btnMas) btnMas.disabled = nivelZoomCalendario === 0;
    if (btnMenos) btnMenos.disabled = nivelZoomCalendario === NIVELES_HORA_PX.length - 1;
  }
  function aplicarZoomCalendario() {
    HORA_PX = NIVELES_HORA_PX[nivelZoomCalendario];
    localStorage.setItem(CLAVE_ZOOM_CALENDARIO, String(nivelZoomCalendario));
    document.documentElement.style.setProperty("--hora-px", `${HORA_PX}px`);
    actualizarBotonesZoom();
    solicitarRender();
  }
  document.getElementById("cal-zoom-mas").addEventListener("click", () => {
    if (nivelZoomCalendario === 0) return;
    nivelZoomCalendario--;
    aplicarZoomCalendario();
  });
  document.getElementById("cal-zoom-menos").addEventListener("click", () => {
    if (nivelZoomCalendario === NIVELES_HORA_PX.length - 1) return;
    nivelZoomCalendario++;
    aplicarZoomCalendario();
  });
  actualizarBotonesZoom();

  if (modoAgenda) {
    document.getElementById("ag-prev").addEventListener("click", () => {
      if (!diaAgendaActual) return;
      const anterior = sumarDiasStr(diaAgendaActual, -1);
      if (estado.info.fechaInicio && anterior < estado.info.fechaInicio) return;
      diaAgendaActual = anterior;
      solicitarRender();
    });
    document.getElementById("ag-next").addEventListener("click", () => {
      if (!diaAgendaActual) return;
      const siguiente = sumarDiasStr(diaAgendaActual, 1);
      if (estado.info.fechaFin && siguiente > estado.info.fechaFin) return;
      diaAgendaActual = siguiente;
      solicitarRender();
    });
    // Deja pegado el encabezado (día, ciudad y flechas) justo debajo de las
    // pestañas al hacer scroll hacia abajo.
    const navViajeEl = document.getElementById("nav-viaje");
    const navEl = contenedor.querySelector(".cal-agenda-nav");
    if (navViajeEl && navEl) navEl.style.top = `${navViajeEl.getBoundingClientRect().height}px`;
    // Deslizar a la izquierda/derecha sobre el área del día para navegar.
    const scrollEl = contenedor.querySelector(".cal-scroll");
    let inicioX = null, inicioY = null;
    scrollEl.addEventListener("pointerdown", e => {
      if (e.target.closest(".cal-bloque")) { inicioX = null; return; }
      inicioX = e.clientX; inicioY = e.clientY;
    });
    scrollEl.addEventListener("pointerup", e => {
      if (inicioX === null) return;
      const dx = e.clientX - inicioX;
      const dy = e.clientY - inicioY;
      inicioX = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        document.getElementById(dx < 0 ? "ag-next" : "ag-prev").click();
      }
    });
  }

  const solicitarRender = programarRender(render);
  const cancelarInfo = escuchar(refInfo, v => { estado.info = v; solicitarRender(); });
  const cancelarCiudades = escuchar(refCiudades, v => { estado.ciudades = v; solicitarRender(); });
  const cancelarLugares = escuchar(refLugares, v => { estado.lugares = v; solicitarRender(); });
  const cancelarItinerario = escuchar(refItinerario, v => { estado.itinerario = v; solicitarRender(); });
  const cancelarTraslados = escuchar(refTraslados, v => { estado.traslados = v; solicitarRender(); });
  const cancelarHospedajes = escuchar(refHospedajes, v => { estado.hospedajes = v; solicitarRender(); });
  const cancelarCiudadPorDia = escuchar(refCiudadPorDia, v => { estado.ciudadPorDiaManual = v; solicitarRender(); });
  // Sin solicitarRender(): las monedas solo hacen falta para el selector del
  // formulario de edición de lugar (ver abrirEdicionLugar), que se abre
  // bajo demanda — no vale la pena repintar toda la cuadrícula cuando cambian.
  const cancelarMonedas = escuchar(refMonedas, v => { estado.monedas = v; });

  return () => {
    cancelarInfo(); cancelarCiudades(); cancelarLugares();
    cancelarItinerario(); cancelarTraslados(); cancelarHospedajes(); cancelarCiudadPorDia(); cancelarMonedas();
  };
}

// Fusiona Agenda (un día) y Calendario (cuadrícula completa) en una sola
// pestaña con un switch — son la misma vista, solo cambia modoAgenda.
const MODO_AGENDA_KEY = "planeador_modo_agenda";

async function montarVistaAgendaCalendario(contenedor, tripId, sesion) {
  let modo = localStorage.getItem(MODO_AGENDA_KEY) === "cuadricula" ? "cuadricula" : "agenda";
  let limpiarInterno = null;

  contenedor.innerHTML = `
    <h2 style="margin-bottom:8px;">Agenda</h2>
    <div class="segmentado" id="ac-switch">
      <button type="button" data-modo="agenda">Día</button>
      <button type="button" data-modo="cuadricula">Calendario</button>
    </div>
    <div id="ac-contenido"></div>
  `;
  const contenidoInterno = contenedor.querySelector("#ac-contenido");
  const botones = contenedor.querySelectorAll("#ac-switch button");

  async function montarModo() {
    botones.forEach(b => b.classList.toggle("activo", b.dataset.modo === modo));
    if (limpiarInterno) { limpiarInterno(); limpiarInterno = null; }
    limpiar(contenidoInterno);
    limpiarInterno = await montarVistaCalendario(contenidoInterno, tripId, sesion, { modoAgenda: modo === "agenda" });
  }

  botones.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.modo === modo) return;
      modo = btn.dataset.modo;
      localStorage.setItem(MODO_AGENDA_KEY, modo);
      montarModo();
    });
  });

  await montarModo();

  return () => { if (limpiarInterno) limpiarInterno(); };
}
