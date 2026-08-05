// Vista "Calendario": cuadrícula días x horas con doble zona horaria,
// bloques flotantes (lugares) arrastrables/redimensionables y fijado,
// más traslados/hospedajes ya pactados como bloques fijos.

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

// Determina, para cada día, la ciudad en la que se está (y si ese día hay
// traslado, la ciudad destino), a partir de los traslados ya capturados.
function calcularCiudadPorDia(dias, traslados, ciudades, zonaOrigen) {
  const ordenados = Object.values(traslados).slice().sort((a, b) => a.inicioUTC.localeCompare(b.inicioUTC));
  const listaCiudades = Object.values(ciudades);
  const buscarTZ = nombre => {
    const c = listaCiudades.find(c => c.nombre.toLowerCase() === (nombre || "").toLowerCase());
    return c ? c.zonaHoraria : zonaOrigen;
  };

  let ciudadActual = null;
  let tzActual = zonaOrigen;
  const resultado = {};
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
    resultado[dia] = { etiqueta: cambioHoy ? `${cambioHoy.origen} → ${cambioHoy.destino}` : (ciudadActual || "—"), zonaHoraria: tzActual };
  });
  return resultado;
}

async function montarVistaCalendario(contenedor, tripId, sesion) {
  document.documentElement.style.setProperty("--hora-px", `${HORA_PX}px`);

  contenedor.innerHTML = `
    <div class="cal-wrap">
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

  const estado = { info: {}, ciudades: {}, lugares: {}, itinerario: {}, traslados: {}, hospedajes: {} };
  let lugarSeleccionado = null;

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

  function fechaLocal(isoUTC, zonaHoraria) {
    const fecha = new Date(isoUTC);
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(fecha);
    const obj = {}; partes.forEach(p => obj[p.type] = p.value);
    return `${obj.year}-${obj.month}-${obj.day}`;
  }

  function render() {
    const grid = document.getElementById("cal-grid");
    const pendientesEl = document.getElementById("cal-pendientes");
    if (!grid || !pendientesEl) return;

    const dias = listaDeDias(estado.info.fechaInicio, estado.info.fechaFin);
    const ciudadPorDia = calcularCiudadPorDia(dias, estado.traslados, estado.ciudades, estado.info.zonaOrigen || "America/Mexico_City");

    limpiar(grid);

    // Columna de horas (zona de origen)
    const colHoras = document.createElement("div");
    colHoras.className = "cal-col-horas";
    colHoras.innerHTML = `<div class="cal-header">Hora<br>${esc((estado.info.zonaOrigen || "").split("/").pop() || "")}</div>` +
      Array.from({ length: 24 }, (_, h) => `<div class="cal-hora-fila">${String(h).padStart(2, "0")}:00</div>`).join("");
    grid.appendChild(colHoras);

    dias.forEach(dia => {
      const infoDia = ciudadPorDia[dia] || { etiqueta: "—", zonaHoraria: estado.info.zonaOrigen };
      const col = document.createElement("div");
      col.className = "cal-dia";
      col.innerHTML = `
        <div class="cal-dia-header">
          <span class="fecha">${esc(new Date(`${dia}T00:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", timeZone: "UTC" }))}</span>
          <span class="ciudad">${esc(infoDia.etiqueta)}</span>
        </div>
        <div class="cal-area" style="height:${24 * HORA_PX}px;" data-dia="${esc(dia)}" data-tz="${esc(infoDia.zonaHoraria)}"></div>
      `;
      const area = col.querySelector(".cal-area");

      area.addEventListener("click", async e => {
        if (e.target !== area) return;
        if (!lugarSeleccionado) return;
        const rect = area.getBoundingClientRect();
        const horaClick = Math.max(0, Math.min(23, Math.floor((e.clientY - rect.top) / HORA_PX)));
        const lugar = estado.lugares[lugarSeleccionado];
        if (!lugar) return;
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
        .filter(([, b]) => fechaLocal(b.inicioUTC, infoDia.zonaHoraria) === dia)
        .forEach(([id, b]) => pintarBloqueLugar(area, id, b, infoDia.zonaHoraria));

      // Traslados fijos que caen ese día (según hora de origen, mostrados como referencia).
      Object.entries(estado.traslados)
        .filter(([, t]) => t.inicioUTC.slice(0, 10) === dia)
        .forEach(([id, t]) => pintarBloqueFijo(area, `✈️ ${t.tipo}: ${t.origen} → ${t.destino}`, t.inicioUTC, new Date(new Date(t.inicioUTC).getTime() + 3600000).toISOString(), infoDia.zonaHoraria, "--color-traslado"));

      // Hospedajes cuyo check-in cae ese día.
      Object.entries(estado.hospedajes)
        .filter(([, h]) => h.checkinUTC && h.checkinUTC.slice(0, 10) === dia)
        .forEach(([id, h]) => pintarBloqueFijo(area, `🏨 Check-in: ${h.nombre}`, h.checkinUTC, new Date(new Date(h.checkinUTC).getTime() + 3600000).toISOString(), infoDia.zonaHoraria, "--color-hospedaje"));

      grid.appendChild(col);
    });

    renderPendientes();
  }

  function pintarBloqueFijo(area, titulo, inicioUTC, finUTC, zonaHoraria, colorVar) {
    const inicio = horaLocalDecimal(inicioUTC, zonaHoraria);
    const fin = horaLocalDecimal(finUTC, zonaHoraria);
    const div = document.createElement("div");
    div.className = "cal-bloque fijado";
    div.style.top = `${inicio * HORA_PX}px`;
    div.style.height = `${Math.max(fin - inicio, 0.5) * HORA_PX}px`;
    div.style.background = colorCss(colorVar);
    div.innerHTML = `<div class="titulo">🔒 ${esc(titulo)}</div>`;
    area.appendChild(div);
  }

  function pintarBloqueLugar(area, id, bloque, zonaHoraria) {
    const lugar = estado.lugares[bloque.refId];
    if (!lugar) return;
    const inicio = horaLocalDecimal(bloque.inicioUTC, zonaHoraria);
    const fin = horaLocalDecimal(bloque.finUTC, zonaHoraria);
    const div = document.createElement("div");
    div.className = `cal-bloque cat-${lugar.categoria}${bloque.fijado ? " fijado" : ""}`;
    div.style.top = `${inicio * HORA_PX}px`;
    div.style.height = `${Math.max(fin - inicio, 0.5) * HORA_PX}px`;
    div.style.background = colorParaCiudad(lugar.ciudadId);
    div.innerHTML = `
      <div class="acciones">
        <span data-accion="fijar" title="Fijar/soltar">${bloque.fijado ? "🔒" : "📌"}</span>
        <span data-accion="quitar" title="Quitar del calendario">✕</span>
      </div>
      <div class="titulo">${lugar.aireLibre ? "❄️ " : ""}${esc(lugar.nombre)}</div>
      <div style="font-size:10px;opacity:0.9;">${formatoHora(bloque.inicioUTC, zonaHoraria)}–${formatoHora(bloque.finUTC, zonaHoraria)}</div>
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
      habilitarArrastre(div, area, id, bloque, zonaHoraria);
      habilitarRedimension(div.querySelector(".resize"), area, id, bloque, zonaHoraria);
    }

    area.appendChild(div);
  }

  function habilitarArrastre(div, area, id, bloque, zonaHoraria) {
    let arrastrando = false, offsetY = 0, nuevoTop = 0;
    div.addEventListener("pointerdown", e => {
      if (e.target.closest(".resize") || e.target.closest("[data-accion]")) return;
      arrastrando = true;
      offsetY = e.clientY - div.getBoundingClientRect().top;
      div.setPointerCapture(e.pointerId);
    });
    div.addEventListener("pointermove", e => {
      if (!arrastrando) return;
      const rectArea = area.getBoundingClientRect();
      nuevoTop = Math.max(0, Math.min(23.5 * HORA_PX, e.clientY - rectArea.top - offsetY));
      nuevoTop = Math.round(nuevoTop / (HORA_PX / 4)) * (HORA_PX / 4); // snap a 15 min
      div.style.top = `${nuevoTop}px`;
    });
    div.addEventListener("pointerup", async e => {
      if (!arrastrando) return;
      arrastrando = false;
      const nuevaHoraDecimal = nuevoTop / HORA_PX;
      const duracionHoras = (new Date(bloque.finUTC) - new Date(bloque.inicioUTC)) / 3600000;
      const dia = area.dataset.dia;
      const hh = Math.floor(nuevaHoraDecimal);
      const mm = Math.round((nuevaHoraDecimal - hh) * 60);
      const nuevoInicio = localAUTC(dia, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, zonaHoraria);
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
    handle.addEventListener("pointerup", async e => {
      if (!redimensionando) return;
      redimensionando = false;
      const div = handle.parentElement;
      const duracionHoras = parseFloat(div.style.height) / HORA_PX;
      const nuevoFin = new Date(new Date(bloque.inicioUTC).getTime() + duracionHoras * 3600000).toISOString();
      await actualizar(refItinerario.child(id), { finUTC: nuevoFin });
    });
  }

  function renderPendientes() {
    const el = document.getElementById("cal-pendientes");
    if (!el) return;
    limpiar(el);
    const idsAgendados = new Set(Object.values(estado.itinerario).map(b => b.refId));
    const pendientes = Object.entries(estado.lugares).filter(([id]) => !idsAgendados.has(id));
    if (pendientes.length === 0) {
      el.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Todos los lugares están agendados.</p>';
      return;
    }
    pendientes.forEach(([id, l]) => {
      const chip = document.createElement("div");
      chip.className = "cal-chip-pendiente" + (lugarSeleccionado === id ? " seleccionado" : "");
      chip.textContent = `${l.aireLibre ? "❄️ " : ""}${l.nombre}`;
      chip.addEventListener("click", () => {
        lugarSeleccionado = lugarSeleccionado === id ? null : id;
        renderPendientes();
      });
      el.appendChild(chip);
    });
  }

  const solicitarRender = programarRender(render);
  const cancelarInfo = escuchar(refInfo, v => { estado.info = v; solicitarRender(); });
  const cancelarCiudades = escuchar(refCiudades, v => { estado.ciudades = v; solicitarRender(); });
  const cancelarLugares = escuchar(refLugares, v => { estado.lugares = v; solicitarRender(); });
  const cancelarItinerario = escuchar(refItinerario, v => { estado.itinerario = v; solicitarRender(); });
  const cancelarTraslados = escuchar(refTraslados, v => { estado.traslados = v; solicitarRender(); });
  const cancelarHospedajes = escuchar(refHospedajes, v => { estado.hospedajes = v; solicitarRender(); });

  return () => {
    cancelarInfo(); cancelarCiudades(); cancelarLugares();
    cancelarItinerario(); cancelarTraslados(); cancelarHospedajes();
  };
}
