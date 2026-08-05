// Vista "Generales": fechas, ciudades, traslados/hospedajes pactados,
// invitar participantes y promover admin.

async function montarVistaGenerales(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta" id="g-info"></div>
    <div class="tarjeta">
      <h3>Ciudades</h3>
      <div id="g-ciudades"></div>
      <button id="g-btn-ciudad">+ Agregar ciudad</button>
    </div>
    <div class="tarjeta">
      <h3>Traslados</h3>
      <div id="g-traslados"></div>
      <button id="g-btn-traslado">+ Agregar traslado</button>
    </div>
    <div class="tarjeta">
      <h3>Hospedajes</h3>
      <div id="g-hospedajes"></div>
      <button id="g-btn-hospedaje">+ Agregar hospedaje</button>
    </div>
    <div class="tarjeta">
      <h3>Participantes</h3>
      <div id="g-participantes"></div>
      <p style="font-size:12px;color:var(--color-texto-suave)">
        Comparte la liga de invitación de este viaje para que otros se unan directamente.
      </p>
      <button class="secundario" id="g-btn-copiar-liga">🔗 Copiar liga de invitación</button>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");
  const refTraslados = refNodo(tripId, "traslados");
  const refHospedajes = refNodo(tripId, "hospedajes");
  const refParticipantes = refNodo(tripId, "participantes");

  let ciudadesCache = {};
  let infoCache = {};

  function sumarDias(fechaStr, dias) {
    const fecha = new Date(`${fechaStr}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

  const renderInfo = programarRender(info => {
    infoCache = info;
    const el = document.getElementById("g-info");
    if (!el) return;
    el.innerHTML = `
      <h2>${esc(info.nombre || "Viaje")}</h2>
      <label>Fecha inicio</label>
      <input id="g-fecha-inicio" type="date" value="${esc(info.fechaInicio || "")}">
      <label>Fecha fin</label>
      <input id="g-fecha-fin" type="date" value="${esc(info.fechaFin || "")}">
      <label>Zona horaria de origen</label>
      <select id="g-zona-origen">${opcionesZonaHoraria(info.zonaOrigen || "America/Mexico_City")}</select>
      <label>Clave de invitación</label>
      <input type="text" value="${esc(info.claveInvitacion || "")}" readonly>
    `;
    document.getElementById("g-fecha-inicio").addEventListener("change", e => {
      const fechaInicio = e.target.value;
      const actualizacion = { fechaInicio };
      // Si no hay fecha fin capturada, la proponemos como un día después.
      if (fechaInicio && !infoCache.fechaFin) {
        const fechaFinDefault = sumarDias(fechaInicio, 1);
        document.getElementById("g-fecha-fin").value = fechaFinDefault;
        actualizacion.fechaFin = fechaFinDefault;
      }
      refInfo.update(actualizacion);
    });
    document.getElementById("g-fecha-fin").addEventListener("change", e => refInfo.update({ fechaFin: e.target.value }));
    document.getElementById("g-zona-origen").addEventListener("change", e => refInfo.update({ zonaOrigen: e.target.value }));
  });

  const renderCiudades = programarRender(ciudades => {
    ciudadesCache = ciudades;
    const el = document.getElementById("g-ciudades");
    if (!el) return;
    limpiar(el);
    const ordenadas = Object.entries(ciudades).sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    if (ordenadas.length === 0) {
      el.innerHTML = '<p style="color:var(--color-texto-suave)">Sin ciudades todavía.</p>';
      return;
    }
    ordenadas.forEach(([id, c]) => {
      const fila = document.createElement("div");
      fila.className = "lista-item";
      fila.innerHTML = `
        <div><strong>${esc(c.nombre)}</strong><br><span style="font-size:12px;color:var(--color-texto-suave)">${esc(c.zonaHoraria)}</span></div>
        <button class="texto peligro-texto" data-id="${esc(id)}">Quitar</button>
      `;
      fila.querySelector("button").addEventListener("click", async () => {
        if (confirm(`¿Quitar ciudad "${c.nombre}"?`)) await eliminar(refCiudades.child(id));
      });
      el.appendChild(fila);
    });
  });

  const renderTraslados = programarRender(traslados => {
    const el = document.getElementById("g-traslados");
    if (!el) return;
    limpiar(el);
    const entradas = Object.entries(traslados);
    if (entradas.length === 0) {
      el.innerHTML = '<p style="color:var(--color-texto-suave)">Sin traslados todavía.</p>';
      return;
    }
    entradas.forEach(([id, t]) => {
      const fila = document.createElement("div");
      fila.className = "lista-item";
      fila.innerHTML = `
        <div>
          <strong>${esc(t.tipo)} — ${esc(t.origen)} → ${esc(t.destino)}</strong><br>
          <span style="font-size:12px;color:var(--color-texto-suave)">
            ${esc(formatoFecha(t.inicioUTC, "UTC"))} ${esc(formatoHora(t.inicioUTC, "UTC"))} UTC ·
            Confirmación: ${esc(t.confirmacion || "-")}
          </span>
        </div>
        <button class="texto" data-id="${esc(id)}">Quitar</button>
      `;
      fila.querySelector("button").addEventListener("click", async () => {
        if (confirm("¿Quitar este traslado?")) await eliminar(refTraslados.child(id));
      });
      el.appendChild(fila);
    });
  });

  const renderHospedajes = programarRender(hospedajes => {
    const el = document.getElementById("g-hospedajes");
    if (!el) return;
    limpiar(el);
    const entradas = Object.entries(hospedajes);
    if (entradas.length === 0) {
      el.innerHTML = '<p style="color:var(--color-texto-suave)">Sin hospedajes todavía.</p>';
      return;
    }
    entradas.forEach(([id, h]) => {
      const fila = document.createElement("div");
      fila.className = "lista-item";
      fila.innerHTML = `
        <div>
          <strong>${esc(h.nombre)}</strong><br>
          <span style="font-size:12px;color:var(--color-texto-suave)">
            Check-in: ${esc(formatoFecha(h.checkinUTC, "UTC"))} · Confirmación: ${esc(h.claveReservacion || "-")}
          </span>
        </div>
        <button class="texto" data-id="${esc(id)}">Quitar</button>
      `;
      fila.querySelector("button").addEventListener("click", async () => {
        if (confirm("¿Quitar este hospedaje?")) await eliminar(refHospedajes.child(id));
      });
      el.appendChild(fila);
    });
  });

  const renderParticipantes = programarRender(participantes => {
    const el = document.getElementById("g-participantes");
    if (!el) return;
    limpiar(el);
    Object.entries(participantes).forEach(([userId, p]) => {
      const fila = document.createElement("div");
      fila.className = "lista-item";
      const esAdmin = p.rol === "admin";
      fila.innerHTML = `
        <div><strong>${esc(p.nombre)}</strong> ${esAdmin ? '<span class="chip importante">admin</span>' : ""}</div>
        ${esAdmin ? "" : `<button class="texto" data-id="${esc(userId)}">Hacer admin</button>`}
      `;
      const btn = fila.querySelector("button");
      if (btn) {
        btn.addEventListener("click", async () => {
          await actualizar(refParticipantes.child(userId), { rol: "admin" });
        });
      }
      el.appendChild(fila);
    });
  });

  document.getElementById("g-btn-copiar-liga").addEventListener("click", async () => {
    const clave = infoCache.claveInvitacion;
    if (!clave) return;
    const liga = new URL(`index.html?unirse=${encodeURIComponent(clave)}`, window.location.href).toString();
    const boton = document.getElementById("g-btn-copiar-liga");
    try {
      await navigator.clipboard.writeText(liga);
      const textoOriginal = boton.textContent;
      boton.textContent = "✅ Copiada";
      setTimeout(() => { boton.textContent = textoOriginal; }, 1800);
    } catch (e) {
      const { modal, cerrar } = abrirModal(`
        <h3>Liga de invitación</h3>
        <p style="font-size:13px;color:var(--color-texto-suave)">No se pudo copiar automáticamente. Selecciona y copia el texto:</p>
        <input type="text" value="${esc(liga)}" readonly onclick="this.select()">
        <div class="fila-botones"><button type="button" id="li-cerrar">Cerrar</button></div>
      `);
      modal.querySelector("#li-cerrar").addEventListener("click", cerrar);
      modal.querySelector("input").select();
    }
  });

  document.getElementById("g-btn-ciudad").addEventListener("click", () => {
    const { modal, cerrar } = abrirModal(`
      <h3>Agregar ciudad</h3>
      <form id="form-ciudad">
        <label for="fc-nombre">Nombre</label>
        <input id="fc-nombre" type="text" placeholder="Ej. Nueva York" required autofocus>
        <label for="fc-zona">Zona horaria</label>
        <select id="fc-zona" required>${opcionesZonaHoraria(infoCache.zonaOrigen || "America/Mexico_City")}</select>
        <div class="fila-botones">
          <button type="submit">Agregar</button>
          <button type="button" class="secundario" id="fc-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#fc-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-ciudad").addEventListener("submit", async e => {
      e.preventDefault();
      const nombre = modal.querySelector("#fc-nombre").value.trim();
      const zonaHoraria = modal.querySelector("#fc-zona").value;
      if (!nombre || !zonaHoraria) return;
      await agregar(refCiudades, { nombre, zonaHoraria, orden: Object.keys(ciudadesCache).length });
      cerrar();
    });
  });

  document.getElementById("g-btn-traslado").addEventListener("click", () => {
    const { modal, cerrar } = abrirModal(`
      <h3>Agregar traslado</h3>
      <form id="form-traslado">
        <label for="ft-tipo">Tipo</label>
        <select id="ft-tipo" required>
          <option value="vuelo">Vuelo</option>
          <option value="tren">Tren</option>
          <option value="bus">Autobús</option>
          <option value="auto">Auto</option>
        </select>
        <label for="ft-origen">Origen</label>
        <input id="ft-origen" type="text" placeholder="Ej. CDMX" required autofocus>
        <label for="ft-destino">Destino</label>
        <input id="ft-destino" type="text" placeholder="Ej. Nueva York" required>
        <label for="ft-fecha">Fecha de salida</label>
        <input id="ft-fecha" type="date" required>
        <label for="ft-hora">Hora de salida (hora de origen)</label>
        <input id="ft-hora" type="time" value="09:00" required>
        <label for="ft-confirmacion">Clave/número de confirmación</label>
        <input id="ft-confirmacion" type="text" placeholder="Opcional">
        <div class="fila-botones">
          <button type="submit">Agregar</button>
          <button type="button" class="secundario" id="ft-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#ft-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-traslado").addEventListener("submit", async e => {
      e.preventDefault();
      const tipo = modal.querySelector("#ft-tipo").value;
      const origen = modal.querySelector("#ft-origen").value.trim();
      const destino = modal.querySelector("#ft-destino").value.trim();
      const fecha = modal.querySelector("#ft-fecha").value;
      const hora = modal.querySelector("#ft-hora").value;
      const confirmacion = modal.querySelector("#ft-confirmacion").value.trim();
      if (!origen || !destino || !fecha || !hora) return;
      const inicioUTC = localAUTC(fecha, hora, infoCache.zonaOrigen || "America/Mexico_City");
      await agregar(refTraslados, { tipo, origen, destino, inicioUTC, confirmacion });
      cerrar();
    });
  });

  document.getElementById("g-btn-hospedaje").addEventListener("click", () => {
    const { modal, cerrar } = abrirModal(`
      <h3>Agregar hospedaje</h3>
      <form id="form-hospedaje">
        <label for="fh-nombre">Nombre</label>
        <input id="fh-nombre" type="text" placeholder="Ej. Hotel Plaza" required autofocus>
        <label for="fh-fecha">Fecha de check-in</label>
        <input id="fh-fecha" type="date" required>
        <label for="fh-confirmacion">Clave/número de reservación</label>
        <input id="fh-confirmacion" type="text" placeholder="Opcional">
        <div class="fila-botones">
          <button type="submit">Agregar</button>
          <button type="button" class="secundario" id="fh-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#fh-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-hospedaje").addEventListener("submit", async e => {
      e.preventDefault();
      const nombre = modal.querySelector("#fh-nombre").value.trim();
      const fecha = modal.querySelector("#fh-fecha").value;
      const claveReservacion = modal.querySelector("#fh-confirmacion").value.trim();
      if (!nombre || !fecha) return;
      const checkinUTC = localAUTC(fecha, "15:00", infoCache.zonaOrigen || "America/Mexico_City");
      await agregar(refHospedajes, { nombre, checkinUTC, claveReservacion });
      cerrar();
    });
  });

  const cancelarInfo = escuchar(refInfo, renderInfo);
  const cancelarCiudades = escuchar(refCiudades, renderCiudades);
  const cancelarTraslados = escuchar(refTraslados, renderTraslados);
  const cancelarHospedajes = escuchar(refHospedajes, renderHospedajes);
  const cancelarParticipantes = escuchar(refParticipantes, renderParticipantes);

  return () => {
    cancelarInfo(); cancelarCiudades(); cancelarTraslados();
    cancelarHospedajes(); cancelarParticipantes();
  };
}
