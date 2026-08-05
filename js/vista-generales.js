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
        Comparte la clave de invitación de este viaje para que otros se unan desde "Unirme con clave".
      </p>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");
  const refTraslados = refNodo(tripId, "traslados");
  const refHospedajes = refNodo(tripId, "hospedajes");
  const refParticipantes = refNodo(tripId, "participantes");

  let ciudadesCache = {};

  const renderInfo = programarRender(info => {
    const el = document.getElementById("g-info");
    if (!el) return;
    el.innerHTML = `
      <h2>${esc(info.nombre || "Viaje")}</h2>
      <label>Fecha inicio</label>
      <input id="g-fecha-inicio" type="date" value="${esc(info.fechaInicio || "")}">
      <label>Fecha fin</label>
      <input id="g-fecha-fin" type="date" value="${esc(info.fechaFin || "")}">
      <label>Zona horaria de origen</label>
      <input id="g-zona-origen" type="text" value="${esc(info.zonaOrigen || "America/Mexico_City")}" placeholder="America/Mexico_City">
      <label>Clave de invitación</label>
      <input type="text" value="${esc(info.claveInvitacion || "")}" readonly>
    `;
    document.getElementById("g-fecha-inicio").addEventListener("change", e => refInfo.update({ fechaInicio: e.target.value }));
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

  document.getElementById("g-btn-ciudad").addEventListener("click", async () => {
    const nombre = prompt("Nombre de la ciudad:");
    if (!nombre || !nombre.trim()) return;
    const zonaHoraria = prompt("Zona horaria IANA (ej. America/New_York):", "America/New_York");
    if (!zonaHoraria) return;
    await agregar(refCiudades, { nombre: nombre.trim(), zonaHoraria, orden: Object.keys(ciudadesCache).length });
  });

  document.getElementById("g-btn-traslado").addEventListener("click", async () => {
    const tipo = prompt("Tipo (vuelo/tren/bus/auto):", "vuelo");
    if (!tipo) return;
    const origen = prompt("Origen:") || "";
    const destino = prompt("Destino:") || "";
    const fecha = prompt("Fecha de salida (AAAA-MM-DD):");
    const hora = prompt("Hora de salida local origen (HH:MM, 24h):", "09:00");
    if (!fecha || !hora) return;
    const confirmacion = prompt("Clave/número de confirmación:") || "";
    const inicioUTC = new Date(`${fecha}T${hora}:00Z`).toISOString();
    await agregar(refTraslados, { tipo, origen, destino, inicioUTC, confirmacion });
  });

  document.getElementById("g-btn-hospedaje").addEventListener("click", async () => {
    const nombre = prompt("Nombre del hospedaje:");
    if (!nombre) return;
    const fecha = prompt("Fecha de check-in (AAAA-MM-DD):");
    if (!fecha) return;
    const claveReservacion = prompt("Clave/número de reservación:") || "";
    const checkinUTC = new Date(`${fecha}T15:00:00Z`).toISOString();
    await agregar(refHospedajes, { nombre, checkinUTC, claveReservacion });
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
