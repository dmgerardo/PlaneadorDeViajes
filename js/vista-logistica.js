// Vista "Logística": traslados (vuelos/trenes/bus/auto) y hospedajes
// pactados para el viaje. Las horas de cada uno se muestran siempre en la
// hora LOCAL de la ciudad correspondiente (nunca en UTC ni en la zona de
// origen del viaje, salvo que esa ciudad sea justo la de origen).

async function montarVistaLogistica(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3>Traslados</h3>
      <div id="lg-traslados"></div>
      <button id="lg-btn-traslado">+ Agregar traslado</button>
    </div>
    <div class="tarjeta">
      <h3>Hospedajes</h3>
      <div id="lg-hospedajes"></div>
      <button id="lg-btn-hospedaje">+ Agregar hospedaje</button>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");
  const refTraslados = refNodo(tripId, "traslados");
  const refHospedajes = refNodo(tripId, "hospedajes");

  let infoCache = {};
  let ciudadesCache = {};
  let trasladosCache = {};
  let hospedajesCache = {};

  // Atributos min/max para <input type="date"> — mantiene la captura dentro del
  // rango de fechas del viaje si ya está definido.
  function limitesFecha() {
    const min = infoCache.fechaInicio ? ` min="${esc(infoCache.fechaInicio)}"` : "";
    const max = infoCache.fechaFin ? ` max="${esc(infoCache.fechaFin)}"` : "";
    return min + max;
  }

  // Ciudades disponibles para elegir como origen/destino de un traslado o
  // ciudad de un hospedaje: la ciudad de origen del viaje + todas las
  // capturadas. Si el valor actual (al editar) ya no está en ninguna de las
  // dos, se conserva como opción extra para no perder el dato.
  function nombresCiudadesTraslado(valorActual) {
    const nombres = [];
    if (infoCache.ciudadOrigen) nombres.push(infoCache.ciudadOrigen);
    Object.values(ciudadesCache).forEach(c => { if (!nombres.includes(c.nombre)) nombres.push(c.nombre); });
    if (valorActual && !nombres.includes(valorActual)) nombres.push(valorActual);
    return nombres;
  }
  function opcionesCiudadesTraslado(valorActual) {
    const nombres = nombresCiudadesTraslado(valorActual);
    if (nombres.length === 0) return '<option value="">Agrega la ciudad de origen o alguna ciudad primero</option>';
    return nombres.map(n =>
      `<option value="${esc(n)}"${n === valorActual ? " selected" : ""}>${esc(n)}${n === infoCache.ciudadOrigen ? " (origen)" : ""}</option>`
    ).join("");
  }

  // Zona horaria real de una ciudad por nombre (la de origen del viaje, o
  // alguna de "ciudades"). Check-in/check-out y horas de traslados SIEMPRE se
  // calculan y se MUESTRAN en la hora LOCAL de la ciudad correspondiente,
  // nunca en la de origen del viaje salvo que justo esa sea la ciudad en
  // cuestión, y nunca en UTC crudo.
  function zonaDeNombreCiudad(nombre) {
    if (!nombre) return infoCache.zonaOrigen || "America/Mexico_City";
    if (nombre === infoCache.ciudadOrigen) return infoCache.zonaOrigen || "America/Mexico_City";
    const ciudad = Object.values(ciudadesCache).find(c => c.nombre === nombre);
    return ciudad ? ciudad.zonaHoraria : (infoCache.zonaOrigen || "America/Mexico_City");
  }

  const renderTraslados = programarRender(() => {
    const el = document.getElementById("lg-traslados");
    if (!el) return;
    limpiar(el);
    const entradas = Object.entries(trasladosCache);
    if (entradas.length === 0) {
      el.innerHTML = '<p style="color:var(--color-texto-suave)">Sin traslados todavía.</p>';
      return;
    }
    entradas.forEach(([id, t]) => {
      const zonaSalida = zonaDeNombreCiudad(t.origen);
      const duracion = t.finUTC ? formatoDuracion(new Date(t.finUTC) - new Date(t.inicioUTC)) : "";
      const fila = document.createElement("div");
      fila.className = "lista-item";
      fila.innerHTML = `
        <div>
          <strong>${esc(t.tipo)} — ${esc(t.origen)} → ${esc(t.destino)}</strong><br>
          <span style="font-size:12px;color:var(--color-texto-suave)">
            ${esc(formatoFecha(t.inicioUTC, zonaSalida))} ${esc(formatoHora(t.inicioUTC, zonaSalida))} hora de ${esc(t.origen)}
            ${duracion ? ` · Duración: ${esc(duracion)}` : ""} ·
            Confirmación: ${esc(t.confirmacion || "-")}
          </span>
        </div>
        <div class="fila-botones" style="margin:0;">
          <button class="texto" data-accion="editar">Editar</button>
          <button class="texto" data-accion="quitar">Quitar</button>
        </div>
      `;
      fila.querySelector('[data-accion="editar"]').addEventListener("click", () => abrirFormularioTraslado(id));
      fila.querySelector('[data-accion="quitar"]').addEventListener("click", async () => {
        if (confirm("¿Quitar este traslado?")) await eliminar(refTraslados.child(id));
      });
      el.appendChild(fila);
    });
  });

  const renderHospedajes = programarRender(() => {
    const el = document.getElementById("lg-hospedajes");
    if (!el) return;
    limpiar(el);
    const entradas = Object.entries(hospedajesCache);
    if (entradas.length === 0) {
      el.innerHTML = '<p style="color:var(--color-texto-suave)">Sin hospedajes todavía.</p>';
      return;
    }
    entradas.forEach(([id, h]) => {
      const zona = zonaDeNombreCiudad(h.ciudad);
      const fila = document.createElement("div");
      fila.className = "lista-item";
      fila.innerHTML = `
        <div>
          <strong>${esc(h.nombre)}</strong>${h.ciudad ? ` <span style="font-weight:400;">— ${esc(h.ciudad)}</span>` : ""}<br>
          <span style="font-size:12px;color:var(--color-texto-suave)">
            Check-in: ${esc(formatoFecha(h.checkinUTC, zona))}
            ${h.checkoutUTC ? ` · Check-out: ${esc(formatoFecha(h.checkoutUTC, zona))}` : ""}
            ${h.noches ? ` · ${h.noches} noche${h.noches > 1 ? "s" : ""}` : ""} ·
            Confirmación: ${esc(h.claveReservacion || "-")}
          </span>
        </div>
        <div class="fila-botones" style="margin:0;">
          <button class="texto" data-accion="editar">Editar</button>
          <button class="texto" data-accion="quitar">Quitar</button>
        </div>
      `;
      fila.querySelector('[data-accion="editar"]').addEventListener("click", () => abrirFormularioHospedaje(id));
      fila.querySelector('[data-accion="quitar"]').addEventListener("click", async () => {
        if (confirm("¿Quitar este hospedaje?")) await eliminar(refHospedajes.child(id));
      });
      el.appendChild(fila);
    });
  });

  // --- Traslado: agregar o editar ---
  function abrirFormularioTraslado(idExistente) {
    const existente = idExistente ? trasladosCache[idExistente] : null;
    const zonaOrigenDefault = existente ? zonaDeNombreCiudad(existente.origen) : zonaDeNombreCiudad(infoCache.ciudadOrigen || "");
    const zonaDestinoDefault = existente ? zonaDeNombreCiudad(existente.destino) : "";
    const valInicioFecha = existente ? fechaISO(existente.inicioUTC, zonaOrigenDefault) : "";
    const valInicioHora = existente ? formatoHora(existente.inicioUTC, zonaOrigenDefault) : "09:00";
    const valFinFecha = existente && existente.finUTC ? fechaISO(existente.finUTC, zonaDestinoDefault || zonaOrigenDefault) : "";
    const valFinHora = existente && existente.finUTC ? formatoHora(existente.finUTC, zonaDestinoDefault || zonaOrigenDefault) : "12:00";

    const { modal, cerrar } = abrirModal(`
      <h3>${existente ? "Editar traslado" : "Agregar traslado"}</h3>
      <form id="form-traslado">
        <label for="ft-tipo">Tipo</label>
        <select id="ft-tipo" required>
          <option value="vuelo">Vuelo</option>
          <option value="tren">Tren</option>
          <option value="bus">Autobús</option>
          <option value="auto">Auto</option>
        </select>
        <label for="ft-origen">Origen</label>
        <select id="ft-origen" required autofocus>${opcionesCiudadesTraslado(existente ? existente.origen : infoCache.ciudadOrigen || "")}</select>
        <label for="ft-destino">Destino</label>
        <select id="ft-destino" required>${opcionesCiudadesTraslado(existente ? existente.destino : "")}</select>
        <label for="ft-fecha">Fecha de salida</label>
        <input id="ft-fecha" type="date" required value="${esc(valInicioFecha)}"${limitesFecha()}>
        <label for="ft-hora">Hora de salida (hora local del origen)</label>
        <input id="ft-hora" type="time" value="${esc(valInicioHora)}" required>
        <label for="ft-fecha-llegada">Fecha de llegada</label>
        <input id="ft-fecha-llegada" type="date" required value="${esc(valFinFecha)}"${limitesFecha()}>
        <label for="ft-hora-llegada">Hora de llegada (hora local del destino)</label>
        <input id="ft-hora-llegada" type="time" value="${esc(valFinHora)}" required>
        <label for="ft-confirmacion">Clave/número de confirmación</label>
        <input id="ft-confirmacion" type="text" placeholder="Opcional" value="${esc(existente ? (existente.confirmacion || "") : "")}">
        <div class="fila-botones">
          <button type="submit">${existente ? "Guardar cambios" : "Agregar"}</button>
          <button type="button" class="secundario" id="ft-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    if (existente) modal.querySelector("#ft-tipo").value = existente.tipo;
    modal.querySelector("#ft-cancelar").addEventListener("click", cerrar);
    // La fecha de llegada por default es la misma que la de salida; el usuario la
    // cambia solo si el traslado cruza la medianoche.
    modal.querySelector("#ft-fecha").addEventListener("change", e => {
      const fechaLlegada = modal.querySelector("#ft-fecha-llegada");
      if (!fechaLlegada.value) fechaLlegada.value = e.target.value;
    });
    modal.querySelector("#form-traslado").addEventListener("submit", async e => {
      e.preventDefault();
      const tipo = modal.querySelector("#ft-tipo").value;
      const origen = modal.querySelector("#ft-origen").value.trim();
      const destino = modal.querySelector("#ft-destino").value.trim();
      const fecha = modal.querySelector("#ft-fecha").value;
      const hora = modal.querySelector("#ft-hora").value;
      const fechaLlegada = modal.querySelector("#ft-fecha-llegada").value || fecha;
      const horaLlegada = modal.querySelector("#ft-hora-llegada").value;
      const confirmacion = modal.querySelector("#ft-confirmacion").value.trim();
      if (!origen || !destino || !fecha || !hora || !horaLlegada) return;
      // Cada hora se interpreta en la zona LOCAL de su propia ciudad (origen/destino),
      // no en la zona de origen del viaje — para traslados internos (p.ej. entre dos
      // ciudades visitadas) eso daría una hora incorrecta.
      const zonaSalida = zonaDeNombreCiudad(origen);
      const zonaLlegada = zonaDeNombreCiudad(destino);
      const inicioUTC = localAUTC(fecha, hora, zonaSalida);
      const finUTC = localAUTC(fechaLlegada, horaLlegada, zonaLlegada);
      const datos = { tipo, origen, destino, inicioUTC, finUTC, zonaDestino: zonaLlegada, confirmacion };
      if (existente) await actualizar(refTraslados.child(idExistente), datos);
      else await agregar(refTraslados, datos);
      cerrar();
    });
  }
  document.getElementById("lg-btn-traslado").addEventListener("click", () => {
    if (nombresCiudadesTraslado(null).length === 0) {
      alert("Primero captura la ciudad de origen (pestaña Info) o agrega al menos una ciudad.");
      return;
    }
    abrirFormularioTraslado(null);
  });

  // --- Hospedaje: agregar o editar ---
  function abrirFormularioHospedaje(idExistente) {
    const existente = idExistente ? hospedajesCache[idExistente] : null;
    const { modal, cerrar } = abrirModal(`
      <h3>${existente ? "Editar hospedaje" : "Agregar hospedaje"}</h3>
      <form id="form-hospedaje">
        <label for="fh-nombre">Nombre</label>
        <input id="fh-nombre" type="text" placeholder="Ej. Hotel Plaza" required autofocus value="${esc(existente ? existente.nombre : "")}">
        <label for="fh-ciudad">Ciudad</label>
        <select id="fh-ciudad" required>${opcionesCiudadesTraslado(existente ? existente.ciudad : infoCache.ciudadOrigen || "")}</select>
        <label for="fh-fecha">Fecha de check-in</label>
        <input id="fh-fecha" type="date" required value="${esc(existente ? fechaISO(existente.checkinUTC, zonaDeNombreCiudad(existente.ciudad)) : "")}"${limitesFecha()}>
        <label for="fh-noches">Número de noches</label>
        <input id="fh-noches" type="number" min="1" step="1" value="${esc(existente ? (existente.noches || 1) : 1)}" required>
        <label for="fh-confirmacion">Clave/número de reservación</label>
        <input id="fh-confirmacion" type="text" placeholder="Opcional" value="${esc(existente ? (existente.claveReservacion || "") : "")}">
        <div class="fila-botones">
          <button type="submit">${existente ? "Guardar cambios" : "Agregar"}</button>
          <button type="button" class="secundario" id="fh-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#fh-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-hospedaje").addEventListener("submit", async e => {
      e.preventDefault();
      const nombre = modal.querySelector("#fh-nombre").value.trim();
      const ciudad = modal.querySelector("#fh-ciudad").value.trim();
      const fecha = modal.querySelector("#fh-fecha").value;
      const noches = Number(modal.querySelector("#fh-noches").value) || 1;
      const claveReservacion = modal.querySelector("#fh-confirmacion").value.trim();
      if (!nombre || !ciudad || !fecha) return;
      // Check-in/check-out en la hora LOCAL de la ciudad del hospedaje, no en
      // la zona de origen del viaje.
      const zona = zonaDeNombreCiudad(ciudad);
      const checkinUTC = localAUTC(fecha, "15:00", zona);
      const checkoutUTC = localAUTC(sumarDias(fecha, noches), "11:00", zona);
      const datos = { nombre, ciudad, checkinUTC, checkoutUTC, noches, claveReservacion };
      if (existente) await actualizar(refHospedajes.child(idExistente), datos);
      else await agregar(refHospedajes, datos);
      cerrar();
    });
  }
  document.getElementById("lg-btn-hospedaje").addEventListener("click", () => {
    if (nombresCiudadesTraslado(null).length === 0) {
      alert("Primero captura la ciudad de origen (pestaña Info) o agrega al menos una ciudad.");
      return;
    }
    abrirFormularioHospedaje(null);
  });

  function sumarDias(fechaStr, dias) {
    const fecha = new Date(`${fechaStr}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

  const cancelarInfo = escuchar(refInfo, v => { infoCache = v; renderTraslados(); renderHospedajes(); });
  const cancelarCiudades = escuchar(refCiudades, v => { ciudadesCache = v; renderTraslados(); renderHospedajes(); });
  const cancelarTraslados = escuchar(refTraslados, v => { trasladosCache = v; renderTraslados(); });
  const cancelarHospedajes = escuchar(refHospedajes, v => { hospedajesCache = v; renderHospedajes(); });

  return () => { cancelarInfo(); cancelarCiudades(); cancelarTraslados(); cancelarHospedajes(); };
}
