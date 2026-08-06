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

const HORA_PX = 44;
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
  const noche = "rgba(32,30,29,0.22)";
  const dia = "rgba(32,30,29,0)";
  const lineas = `repeating-linear-gradient(to bottom, var(--color-borde) 0, var(--color-borde) 1px, transparent 1px, transparent var(--hora-px, 44px))`;
  const sombra = `linear-gradient(to bottom,
    ${noche} 0%, ${noche} ${pct(franja.amanecer)},
    ${dia} ${pct(franja.amanecer)}, ${dia} ${pct(franja.atardecer)},
    ${noche} ${pct(franja.atardecer)}, ${noche} 100%)`;
  return `${lineas}, ${sombra}`;
}

// Determina, para cada día, la ciudad en la que se está. Prioriza la
// asignación explícita del timeline (ciudadPorDia); si un día no tiene
// ciudad asignada ahí, recurre a la heurística previa basada en traslados
// (para no romper viajes que aún no usan el timeline).
function calcularCiudadPorDia(dias, ciudadPorDiaManual, ciudades, traslados, zonaOrigen) {
  const ordenados = Object.values(traslados).slice().sort((a, b) => a.inicioUTC.localeCompare(b.inicioUTC));
  const listaCiudades = Object.values(ciudades);
  const buscarTZ = nombre => {
    const c = listaCiudades.find(c => c.nombre.toLowerCase() === (nombre || "").toLowerCase());
    return c ? c.zonaHoraria : zonaOrigen;
  };

  let ciudadActual = null;
  let tzActual = zonaOrigen;
  const heuristico = {};
  let idxTraslado = 0;

  dias.forEach(dia => {
    let cambioHoy = null;
    while (idxTraslado < ordenados.length && ordenados[idxTraslado].inicioUTC.slice(0, 10) === dia) {
      const t = ordenados[idxTraslado];
      cambioHoy = { origen: t.origen, destino: t.destino };
      ciudadActual = t.destino;
      tzActual = buscarTZ(t.destino);
      idxTraslado++;
    }
    heuristico[dia] = { etiqueta: cambioHoy ? `${cambioHoy.origen} → ${cambioHoy.destino}` : (ciudadActual || "—"), zonaHoraria: tzActual, ciudadId: null };
  });

  const resultado = {};
  dias.forEach(dia => {
    const ciudadId = ciudadPorDiaManual[dia];
    if (ciudadId && ciudades[ciudadId]) {
      resultado[dia] = { etiqueta: ciudades[ciudadId].nombre, zonaHoraria: ciudades[ciudadId].zonaHoraria, ciudadId };
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
      <div class="cal-scroll">
        <div class="cal-grid" id="cal-grid"></div>
      </div>
      <div class="tarjeta" style="margin-top:12px;">
        <h3 style="margin-bottom:4px;">Lugares sin agendar</h3>
        <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 6px;">
          Toca un lugar y luego toca la hora del día donde quieras colocarlo.
        </p>
        <div class="cal-pendientes" id="cal-pendientes"></div>
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

  const estado = { info: {}, ciudades: {}, lugares: {}, itinerario: {}, traslados: {}, hospedajes: {}, ciudadPorDiaManual: {} };
  let lugarSeleccionado = null;
  let scrollInicialHecho = false;
  let diaAgendaActual = null;

  function colorParaCiudad(ciudadId) {
    const ids = Object.keys(estado.ciudades);
    const idx = ids.indexOf(ciudadId);
    if (idx === -1) return colorCss("--color-primario");
    return colorCss(COLORES_CIUDAD[idx % COLORES_CIUDAD.length]);
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

  function render() {
    const grid = document.getElementById("cal-grid");
    const pendientesEl = document.getElementById("cal-pendientes");
    if (!grid || !pendientesEl) return;

    asegurarDiaAgendaPorDefecto();

    const dias = modoAgenda ? (diaAgendaActual ? [diaAgendaActual] : []) : listaDeDias(estado.info.fechaInicio, estado.info.fechaFin);
    const ciudadPorDia = calcularCiudadPorDia(dias, estado.ciudadPorDiaManual, estado.ciudades, estado.traslados, estado.info.zonaOrigen || "America/Mexico_City");

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
    const colHoras = document.createElement("div");
    colHoras.className = "cal-col-horas";
    colHoras.innerHTML = (modoAgenda ? "" : `<div class="cal-header">Hora<br>local</div>`) +
      Array.from({ length: 24 }, (_, h) => `<div class="cal-hora-fila">${String(h).padStart(2, "0")}:00</div>`).join("");
    grid.appendChild(colHoras);

    dias.forEach(dia => {
      const infoDia = ciudadPorDia[dia] || { etiqueta: "—", zonaHoraria: estado.info.zonaOrigen };
      const col = document.createElement("div");
      col.className = modoAgenda ? "cal-dia cal-dia-agenda" : "cal-dia";
      col.innerHTML = `
        ${modoAgenda ? "" : `
        <div class="cal-dia-header">
          <span class="fecha">${esc(new Date(`${dia}T00:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", timeZone: "UTC" }))}</span>
          <span class="ciudad">${esc(infoDia.etiqueta)}</span>
        </div>`}
        <div class="cal-area" style="height:${24 * HORA_PX}px;" data-dia="${esc(dia)}" data-tz="${esc(infoDia.zonaHoraria)}"></div>
      `;
      const area = col.querySelector(".cal-area");
      const ciudadDelDia = infoDia.ciudadId ? estado.ciudades[infoDia.ciudadId] : null;
      area.style.backgroundImage = fondoConNoche(calcularFranjaNoche(dia, ciudadDelDia, infoDia.zonaHoraria));

      area.addEventListener("click", async e => {
        if (e.target !== area) return;
        if (!lugarSeleccionado) return;
        const lugar = estado.lugares[lugarSeleccionado];
        if (!lugar) return;
        if (infoDia.ciudadId && infoDia.ciudadId !== lugar.ciudadId) {
          const nombreCiudadLugar = estado.ciudades[lugar.ciudadId] ? estado.ciudades[lugar.ciudadId].nombre : "otra ciudad";
          alert(`Este día está asignado a "${infoDia.etiqueta}", pero "${lugar.nombre}" es de ${nombreCiudadLugar}. Asigna primero ese día a la ciudad correcta en la pestaña Ciudades.`);
          return;
        }
        const rect = area.getBoundingClientRect();
        const horaClick = Math.max(0, Math.min(23, Math.floor((e.clientY - rect.top) / HORA_PX)));
        if (hayTraslape(dia, null, horaClick, horaClick + 1, infoDia.zonaHoraria)) {
          alert("Ya hay algo agendado en ese horario. Elige otra hora.");
          return;
        }
        const inicioISO = localAUTC(dia, `${String(horaClick).padStart(2, "0")}:00`, infoDia.zonaHoraria);
        const finISO = new Date(new Date(inicioISO).getTime() + 3600000).toISOString();
        await agregar(refItinerario, {
          tipo: "lugar", refId: lugarSeleccionado, ciudadId: lugar.ciudadId,
          inicioUTC: inicioISO, finUTC: finISO, fijado: false
        });
        lugarSeleccionado = null;
        renderPendientes();
      });

      // Bloques de itinerario (lugares) para este día, según su hora local.
      Object.entries(estado.itinerario)
        .filter(([, b]) => fechaISO(b.inicioUTC, infoDia.zonaHoraria) === dia)
        .forEach(([id, b]) => pintarBloqueLugar(area, id, b, infoDia.zonaHoraria, ciudadPorDia));

      // Traslados fijos que caen ese día (según hora de origen); usan su duración real
      // (fin de trayecto) si ya se capturó, o 1h como referencia si es un traslado viejo.
      Object.entries(estado.traslados)
        .filter(([, t]) => t.inicioUTC.slice(0, 10) === dia)
        .forEach(([id, t]) => {
          const fin = t.finUTC || new Date(new Date(t.inicioUTC).getTime() + 3600000).toISOString();
          const duracion = t.finUTC ? ` (${formatoDuracion(new Date(t.finUTC) - new Date(t.inicioUTC))})` : "";
          pintarBloqueFijo(area, `✈️ ${t.tipo}: ${t.origen} → ${t.destino}${duracion}`, t.inicioUTC, fin, infoDia.zonaHoraria, "--color-traslado");
        });

      // Hospedajes: un bloque el día de check-in y otro el día de check-out.
      Object.entries(estado.hospedajes)
        .filter(([, h]) => h.checkinUTC && h.checkinUTC.slice(0, 10) === dia)
        .forEach(([id, h]) => {
          const noches = h.noches ? ` (${h.noches} noche${h.noches > 1 ? "s" : ""})` : "";
          pintarBloqueFijo(area, `🏨 Check-in: ${h.nombre}${noches}`, h.checkinUTC, new Date(new Date(h.checkinUTC).getTime() + 3600000).toISOString(), infoDia.zonaHoraria, "--color-hospedaje");
        });
      Object.entries(estado.hospedajes)
        .filter(([, h]) => h.checkoutUTC && h.checkoutUTC.slice(0, 10) === dia)
        .forEach(([id, h]) => pintarBloqueFijo(area, `🏨 Check-out: ${h.nombre}`, h.checkoutUTC, new Date(new Date(h.checkoutUTC).getTime() + 3600000).toISOString(), infoDia.zonaHoraria, "--color-hospedaje"));

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
        if (columnaHoy && scrollEl) scrollEl.scrollLeft = Math.max(0, columnaHoy.offsetLeft - 56);
        scrollInicialHecho = true;
      }
    }
  }

  function pintarBloqueFijo(area, titulo, inicioUTC, finUTC, zonaHoraria, colorVar) {
    const inicio = horaLocalDecimal(inicioUTC, zonaHoraria);
    let fin = horaLocalDecimal(finUTC, zonaHoraria);
    // Traslado nocturno o de varios días: recorta el bloque al final del día visible
    // en vez de "envolverlo" incorrectamente al inicio del mismo día.
    if (fin <= inicio) fin = 24;
    const div = document.createElement("div");
    div.className = "cal-bloque fijado";
    div.style.top = `${inicio * HORA_PX}px`;
    div.style.height = `${Math.max(fin - inicio, 0.5) * HORA_PX}px`;
    div.style.background = colorCss(colorVar);
    const zonaOrigen = estado.info.zonaOrigen || "America/Mexico_City";
    const horaOrigenTxt = zonaOrigen !== zonaHoraria
      ? `<div style="font-size:9.5px;opacity:0.85;">${formatoHora(inicioUTC, zonaHoraria)} local · ${formatoHora(inicioUTC, zonaOrigen)} origen</div>`
      : "";
    div.innerHTML = `<div class="titulo">🔒 ${esc(titulo)}</div>${horaOrigenTxt}`;
    area.appendChild(div);
  }

  function pintarBloqueLugar(area, id, bloque, zonaHoraria, ciudadPorDia) {
    const lugar = estado.lugares[bloque.refId];
    if (!lugar) return;
    const inicio = horaLocalDecimal(bloque.inicioUTC, zonaHoraria);
    const fin = horaLocalDecimal(bloque.finUTC, zonaHoraria);
    const div = document.createElement("div");
    div.className = `cal-bloque cat-${lugar.categoria}${bloque.fijado ? " fijado" : ""}`;
    div.style.top = `${inicio * HORA_PX}px`;
    div.style.height = `${Math.max(fin - inicio, 0.5) * HORA_PX}px`;
    div.style.background = colorParaCiudad(lugar.ciudadId);
    const zonaOrigen = estado.info.zonaOrigen || "America/Mexico_City";
    const horaOrigenTxt = zonaOrigen !== zonaHoraria
      ? `<div style="font-size:9.5px;opacity:0.85;">${formatoHora(bloque.inicioUTC, zonaOrigen)}–${formatoHora(bloque.finUTC, zonaOrigen)} origen</div>`
      : "";
    div.innerHTML = `
      <span class="accion-fijar" data-accion="fijar" title="Fijar/soltar">${bloque.fijado ? "🔒" : "📌"}</span>
      <span class="accion-quitar" data-accion="quitar" title="Quitar del calendario">✕</span>
      <div class="titulo">${lugar.aireLibre ? "❄️ " : ""}${esc(lugar.nombre)}</div>
      <div style="font-size:10px;opacity:0.9;">${formatoHora(bloque.inicioUTC, zonaHoraria)}–${formatoHora(bloque.finUTC, zonaHoraria)} local</div>
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
        const puedeMover = !infoCandidato || !infoCandidato.ciudadId || infoCandidato.ciudadId === lugar.ciudadId;
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
      // Un tap sin arrastre real no debe mover ni reescribir nada.
      if (!seMovio) return;
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

  function renderPendientes() {
    const el = document.getElementById("cal-pendientes");
    if (!el) return;
    limpiar(el);
    const idsAgendados = new Set(Object.values(estado.itinerario).map(b => b.refId));
    const ciudadesConDia = new Set(Object.values(estado.ciudadPorDiaManual).filter(Boolean));
    const todosPendientes = Object.entries(estado.lugares).filter(([id]) => !idsAgendados.has(id));
    // Si ya se empezó a usar el timeline, solo ofrecemos lugares cuya ciudad
    // tenga al menos un día asignado — así no se agenda algo donde no toca.
    const listos = todosPendientes.filter(([, l]) => ciudadesConDia.size === 0 || ciudadesConDia.has(l.ciudadId));
    const esperando = todosPendientes.length - listos.length;

    if (listos.length === 0) {
      el.innerHTML = todosPendientes.length === 0
        ? '<p style="font-size:12px;color:var(--color-texto-suave)">Todos los lugares están agendados.</p>'
        : '<p style="font-size:12px;color:var(--color-texto-suave)">Asigna ciudades a los días en la pestaña Ciudades para poder agendar tus lugares.</p>';
      return;
    }
    listos.forEach(([id, l]) => {
      const chip = document.createElement("div");
      chip.className = "cal-chip-pendiente" + (lugarSeleccionado === id ? " seleccionado" : "");
      chip.textContent = `${l.aireLibre ? "❄️ " : ""}${l.nombre}`;
      chip.addEventListener("click", () => {
        lugarSeleccionado = lugarSeleccionado === id ? null : id;
        renderPendientes();
      });
      el.appendChild(chip);
    });
    if (esperando > 0) {
      const nota = document.createElement("p");
      nota.style.cssText = "font-size:11px;color:var(--color-texto-suave);width:100%;margin:4px 0 0;";
      nota.textContent = `${esperando} más esperando a que asignes su ciudad en la pestaña Ciudades.`;
      el.appendChild(nota);
    }
  }

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

  return () => {
    cancelarInfo(); cancelarCiudades(); cancelarLugares();
    cancelarItinerario(); cancelarTraslados(); cancelarHospedajes(); cancelarCiudadPorDia();
  };
}

// Fusiona Agenda (un día) y Calendario (cuadrícula completa) en una sola
// pestaña con un switch — son la misma vista, solo cambia modoAgenda.
const MODO_AGENDA_KEY = "planeador_modo_agenda";

async function montarVistaAgendaCalendario(contenedor, tripId, sesion) {
  let modo = localStorage.getItem(MODO_AGENDA_KEY) === "cuadricula" ? "cuadricula" : "agenda";
  let limpiarInterno = null;

  contenedor.innerHTML = `
    <div class="segmentado" id="ac-switch">
      <button type="button" data-modo="agenda">Día</button>
      <button type="button" data-modo="cuadricula">Cuadrícula</button>
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
