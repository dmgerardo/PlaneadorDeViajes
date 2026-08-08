// Vista "Info": datos generales del viaje (fechas, ciudad de origen, zona
// horaria, clave de invitación) y participantes (incluye promover a admin
// y gestión de contraseña). Se captura sobre todo una vez, al planear.

async function montarVistaInfo(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta" id="in-progreso"></div>
    <div class="tarjeta" id="in-info"></div>
    <div class="tarjeta" id="in-monedas"></div>
    <div class="tarjeta" id="in-costos"></div>
    <div class="tarjeta">
      <h3>Participantes</h3>
      <div class="fila-botones" style="margin-top:0;">
        <button class="secundario" id="in-btn-mi-contrasena">${iconoTexto("key", "Cambiar mi contraseña", 15)}</button>
      </div>
      <div id="in-participantes"></div>
      <p style="font-size:12px;color:var(--color-texto-suave)">
        Comparte la liga de invitación de este viaje para que otros se unan directamente.
      </p>
      <button class="secundario" id="in-btn-copiar-liga">${iconoTexto("link", "Copiar liga de invitación", 15)}</button>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refParticipantes = refNodo(tripId, "participantes");
  const refCiudades = refNodo(tripId, "ciudades");
  const refCiudadPorDia = refNodo(tripId, "ciudadPorDia");
  const refLugares = refNodo(tripId, "lugares");
  const refTraslados = refNodo(tripId, "traslados");
  const refHospedajes = refNodo(tripId, "hospedajes");
  const refMonedas = refNodo(tripId, "monedas");

  let infoCache = {};
  let participantesCache = {};
  let monedasCache = {};
  let esAdminActual = false;
  const progreso = { ciudades: {}, ciudadPorDia: {}, lugares: {} };
  const costos = { traslados: {}, hospedajes: {}, lugares: {} };

  // Tarjeta "Monedas del viaje": el admin activa/desactiva cuáles de las
  // MONEDAS_SOPORTADAS se ofrecen al capturar un costo, y fija un tipo de
  // cambio a MXN por moneda para el total consolidado de abajo. Cada
  // checkbox/input guarda solo. Visible para todos (todos capturan costos y
  // necesitan saber qué moneda usar), pero solo editable si es admin.
  const renderMonedas = programarRender(() => {
    const el = document.getElementById("in-monedas");
    if (!el) return;
    el.innerHTML = `
      <h3>Monedas del viaje</h3>
      <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 8px;">
        Estas son las monedas disponibles al capturar un costo. Fija un tipo de cambio a MXN
        en cada una para ver el total consolidado.
      </p>
      <div id="in-monedas-lista"></div>
    `;
    const lista = document.getElementById("in-monedas-lista");
    MONEDAS_SOPORTADAS.forEach(codigo => {
      const entrada = monedasCache[codigo] || {};
      const esBase = codigo === "MXN";
      const activa = monedaEstaActiva(monedasCache, codigo);
      const fila = document.createElement("div");
      fila.className = "lista-item";
      fila.style.alignItems = "center";
      fila.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;flex:1;">
          <input type="checkbox" data-moneda-activa="${esc(codigo)}" ${activa ? "checked" : ""} ${esBase || !esAdminActual ? "disabled" : ""}>
          ${esc(codigo)} <span style="color:var(--color-texto-suave);font-size:12px;">— ${esc(NOMBRE_MONEDA[codigo])}</span>
        </label>
        ${esBase
          ? `<span style="font-size:12px;color:var(--color-texto-suave)">Moneda base</span>`
          : `<input type="number" min="0" step="0.0001" data-tipo-cambio="${esc(codigo)}" placeholder="1 ${esc(codigo)} = ? MXN"
               value="${entrada.tipoCambioMXN != null ? esc(entrada.tipoCambioMXN) : ""}" style="width:150px;" ${esAdminActual ? "" : "disabled"}>`}
      `;
      if (esAdminActual && !esBase) {
        fila.querySelector("[data-moneda-activa]").addEventListener("change", e => {
          actualizar(refMonedas.child(codigo), { activa: e.target.checked });
        });
        fila.querySelector("[data-tipo-cambio]").addEventListener("change", e => {
          const valor = e.target.value === "" ? null : Number(e.target.value);
          actualizar(refMonedas.child(codigo), { tipoCambioMXN: Number.isFinite(valor) ? valor : null });
        });
      }
      lista.appendChild(fila);
    });
  });

  // Suma, por moneda, lo capturado en Traslados/Hospedajes/Lugares — un
  // costo "por persona" se multiplica por el número de participantes para
  // poder sumarlo junto con los que ya son el total del grupo. Además arma
  // un total consolidado en MXN usando el tipo de cambio fijo de cada
  // moneda (viajes/{tripId}/monedas) — las monedas sin tipo de cambio
  // capturado quedan fuera de ese consolidado (se listan aparte) en vez de
  // sumarse como si valieran lo mismo que un peso.
  function calcularReporteCostos() {
    const numParticipantes = Math.max(Object.keys(participantesCache).length, 1);
    const categorias = [
      { clave: "traslados", items: costos.traslados },
      { clave: "hospedajes", items: costos.hospedajes },
      { clave: "lugares", items: costos.lugares }
    ];
    const porMoneda = {};
    categorias.forEach(({ clave, items }) => {
      Object.values(items).forEach(item => {
        if (item.costo === null || item.costo === undefined) return;
        const moneda = item.moneda || "MXN";
        const montoTotal = item.costoTipo === "porPersona" ? item.costo * numParticipantes : item.costo;
        if (!porMoneda[moneda]) porMoneda[moneda] = { traslados: 0, hospedajes: 0, lugares: 0, total: 0 };
        porMoneda[moneda][clave] += montoTotal;
        porMoneda[moneda].total += montoTotal;
      });
    });
    let totalConsolidadoMXN = 0;
    const monedasSinTipoCambio = [];
    Object.entries(porMoneda).forEach(([moneda, c]) => {
      if (moneda === "MXN") { totalConsolidadoMXN += c.total; return; }
      const tasa = monedasCache[moneda] && monedasCache[moneda].tipoCambioMXN;
      if (tasa) totalConsolidadoMXN += c.total * tasa;
      else monedasSinTipoCambio.push(moneda);
    });
    return { porMoneda, numParticipantes, totalConsolidadoMXN, monedasSinTipoCambio };
  }

  const renderCostos = programarRender(() => {
    const el = document.getElementById("in-costos");
    if (!el) return;
    const { porMoneda, numParticipantes, totalConsolidadoMXN, monedasSinTipoCambio } = calcularReporteCostos();
    const monedas = Object.keys(porMoneda).sort();
    if (monedas.length === 0) {
      el.innerHTML = `
        <h3>Costos del viaje</h3>
        <p style="font-size:12px;color:var(--color-texto-suave)">
          Aún no has capturado costos. Agrégalos al editar un traslado, hospedaje o lugar.
        </p>
      `;
      return;
    }
    // El consolidado no aporta nada si todo ya está en MXN (sería el mismo
    // número dos veces) — en cualquier otro caso (una o más monedas ajenas
    // con tipo de cambio capturado) sí vale mostrarlo.
    const soloMXN = monedas.length === 1 && monedas[0] === "MXN";
    const mostrarConsolidado = totalConsolidadoMXN > 0 && !soloMXN;
    el.innerHTML = `
      <h3>Costos del viaje</h3>
      ${mostrarConsolidado ? `
        <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--color-borde);">
          <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:var(--font-heading);font-size:17px;">
            <span>Total consolidado</span>
            <strong>${esc(formatoCosto(totalConsolidadoMXN, "total", "MXN"))}</strong>
          </div>
          ${numParticipantes > 1 ? `<div style="font-size:12px;color:var(--color-texto-suave)">≈ ${esc(formatoCosto(totalConsolidadoMXN / numParticipantes, "total", "MXN"))}/persona entre ${numParticipantes}</div>` : ""}
          ${monedasSinTipoCambio.length > 0 ? `<div style="font-size:12px;color:var(--color-texto-suave)">Sin tipo de cambio capturado, no incluidas: ${monedasSinTipoCambio.map(esc).join(", ")} (ver "Monedas del viaje")</div>` : ""}
        </div>
      ` : ""}
      ${monedas.map(moneda => {
        const c = porMoneda[moneda];
        const partes = [];
        if (c.traslados) partes.push(`Traslados: ${esc(formatoCosto(c.traslados, "total", moneda))}`);
        if (c.hospedajes) partes.push(`Hospedajes: ${esc(formatoCosto(c.hospedajes, "total", moneda))}`);
        if (c.lugares) partes.push(`Lugares: ${esc(formatoCosto(c.lugares, "total", moneda))}`);
        const porPersona = numParticipantes > 1
          ? `<div style="font-size:12px;color:var(--color-texto-suave)">≈ ${esc(formatoCosto(c.total / numParticipantes, "total", moneda))}/persona entre ${numParticipantes}</div>`
          : "";
        return `
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:var(--font-heading);">
              <span>${esc(moneda)}</span>
              <strong>${esc(formatoCosto(c.total, "total", moneda))}</strong>
            </div>
            <div style="font-size:12px;color:var(--color-texto-suave)">${partes.join(" · ")}</div>
            ${porPersona}
          </div>
        `;
      }).join("")}
    `;
  });

  // Checklist de prerrequisitos "Ciudades → Ruta → Lugares" — cada uno
  // habilita mejor al siguiente (Ruta necesita ciudades capturadas; el
  // Calendario necesita días asignados en Ruta para poder agendar lugares).
  const renderProgreso = programarRender(() => {
    const el = document.getElementById("in-progreso");
    if (!el) return;
    const pasos = [
      { hecho: Object.keys(progreso.ciudades).length > 0, texto: "Ciudades agregadas", vista: "ciudades" },
      { hecho: Object.values(progreso.ciudadPorDia).some(Boolean), texto: "Días asignados en Ruta", vista: "ruta" },
      { hecho: Object.keys(progreso.lugares).length > 0, texto: "Lugares agregados", vista: "lugares" }
    ];
    el.innerHTML = `
      <h3>Progreso de planeación</h3>
      ${pasos.map(p => `
        <div class="progreso-item">
          ${p.hecho ? icono("check", 16, "progreso-check") : `<span class="progreso-circulo"></span>`}
          <span class="${p.hecho ? "progreso-texto-hecho" : ""}">${esc(p.texto)}</span>
          ${!p.hecho ? `<button class="texto" data-vista="${p.vista}">Ir →</button>` : ""}
        </div>
      `).join("")}
    `;
    el.querySelectorAll("button[data-vista]").forEach(btn => {
      btn.addEventListener("click", () => cambiarVista(btn.dataset.vista));
    });
  });

  function sumarDias(fechaStr, dias) {
    const fecha = new Date(`${fechaStr}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

  const renderInfo = programarRender(info => {
    infoCache = info;
    const el = document.getElementById("in-info");
    if (!el) return;
    el.innerHTML = `
      <div class="encabezado-seccion">
        <h2>${esc(info.nombre || "Viaje")}</h2>
        ${esAdminActual ? `<button type="button" class="texto" id="in-btn-renombrar">Renombrar</button>` : ""}
      </div>
      <label>Fecha inicio</label>
      <input id="in-fecha-inicio" type="date" value="${esc(info.fechaInicio || "")}">
      <label>Fecha fin</label>
      <input id="in-fecha-fin" type="date" value="${esc(info.fechaFin || "")}" min="${esc(info.fechaInicio || "")}">
      <label>Ciudad de origen</label>
      <div class="autocompletar-envoltura">
        <input id="in-ciudad-origen" type="text" placeholder="Ej. CDMX" autocomplete="off" value="${esc(info.ciudadOrigen || "")}">
        <div class="autocompletar-lista oculto" id="in-sugerencias-origen"></div>
      </div>
      <label>Zona horaria de origen</label>
      <select id="in-zona-origen">${opcionesZonaHoraria(info.zonaOrigen || "America/Mexico_City")}</select>
      <label>Clave de invitación</label>
      <input type="text" value="${esc(info.claveInvitacion || "")}" readonly>
      ${esAdminActual ? `
      <div class="fila-botones">
        <button type="button" class="peligro" id="in-btn-eliminar-viaje">Eliminar viaje</button>
      </div>` : ""}
    `;
    if (esAdminActual) {
      document.getElementById("in-btn-renombrar").addEventListener("click", () => abrirModalRenombrarViaje(info.nombre || ""));
      document.getElementById("in-btn-eliminar-viaje").addEventListener("click", () => abrirModalEliminarViaje(info.nombre || "este viaje"));
    }
    document.getElementById("in-fecha-inicio").addEventListener("change", e => {
      const fechaInicio = e.target.value;
      const actualizacion = { fechaInicio };
      document.getElementById("in-fecha-fin").min = fechaInicio;
      // Si no hay fecha fin capturada, la proponemos como un día después.
      if (fechaInicio && !infoCache.fechaFin) {
        const fechaFinDefault = sumarDias(fechaInicio, 1);
        document.getElementById("in-fecha-fin").value = fechaFinDefault;
        actualizacion.fechaFin = fechaFinDefault;
      }
      actualizar(refInfo, actualizacion);
    });
    document.getElementById("in-fecha-fin").addEventListener("change", e => actualizar(refInfo, { fechaFin: e.target.value }));
    document.getElementById("in-ciudad-origen").addEventListener("change", e => actualizar(refInfo, { ciudadOrigen: e.target.value.trim() }));
    document.getElementById("in-zona-origen").addEventListener("change", e => actualizar(refInfo, { zonaOrigen: e.target.value }));

    // Mismo autocompletar del catálogo (js/catalogo-ciudades.js) que en el
    // formulario de la pestaña Ciudades: elegir una sugerencia rellena sola
    // la zona horaria de origen — sigue siendo un campo de texto normal si
    // la ciudad no está en el catálogo.
    const campoOrigen = document.getElementById("in-ciudad-origen");
    const sugerenciasOrigen = document.getElementById("in-sugerencias-origen");
    function ocultarSugerenciasOrigen() {
      sugerenciasOrigen.classList.add("oculto");
      sugerenciasOrigen.innerHTML = "";
    }
    campoOrigen.addEventListener("input", () => {
      const resultados = buscarEnCatalogoCiudades(campoOrigen.value);
      if (resultados.length === 0) { ocultarSugerenciasOrigen(); return; }
      sugerenciasOrigen.innerHTML = resultados.map((c, i) =>
        `<div class="autocompletar-item" data-idx="${i}">${esc(c.nombre)} <span style="color:var(--color-texto-suave)">— ${esc(c.pais)}</span></div>`
      ).join("");
      sugerenciasOrigen.classList.remove("oculto");
      sugerenciasOrigen.querySelectorAll(".autocompletar-item").forEach((elItem, i) => {
        elItem.addEventListener("mousedown", e => {
          e.preventDefault();
          const c = resultados[i];
          campoOrigen.value = c.nombre;
          document.getElementById("in-zona-origen").value = c.zonaHoraria;
          ocultarSugerenciasOrigen();
          actualizar(refInfo, { ciudadOrigen: c.nombre, zonaOrigen: c.zonaHoraria });
        });
      });
    });
    campoOrigen.addEventListener("blur", () => setTimeout(ocultarSugerenciasOrigen, 150));
  });

  const renderParticipantes = programarRender(participantes => {
    participantesCache = participantes;
    const el = document.getElementById("in-participantes");
    if (!el) return;
    limpiar(el);
    const yoSoyAdmin = participantes[sesion.userId] && participantes[sesion.userId].rol === "admin";
    if (yoSoyAdmin !== esAdminActual) {
      esAdminActual = yoSoyAdmin;
      renderInfo(infoCache); // refresca los botones de admin (Renombrar/Eliminar) del encabezado
      renderMonedas(); // habilita/deshabilita los controles de activar/tipo de cambio
    }
    renderCostos(); // el número de participantes cambia el total "por persona"
    Object.entries(participantes).forEach(([userId, p]) => {
      const fila = document.createElement("div");
      fila.className = "lista-item";
      const esAdmin = p.rol === "admin";
      const esYo = userId === sesion.userId;
      fila.innerHTML = `
        <div><strong>${esc(p.nombre)}</strong> ${esAdmin ? '<span class="chip importante">admin</span>' : ""}</div>
        <div class="fila-botones" style="margin:0;">
          ${!esAdmin ? `<button class="texto" data-accion="hacer-admin">Hacer admin</button>` : ""}
          ${yoSoyAdmin && !esYo ? `<button class="texto" data-accion="restablecer">Restablecer contraseña</button>` : ""}
        </div>
      `;
      const btnAdmin = fila.querySelector('[data-accion="hacer-admin"]');
      if (btnAdmin) {
        btnAdmin.addEventListener("click", async () => {
          await actualizar(refParticipantes.child(userId), { rol: "admin" });
        });
      }
      const btnRestablecer = fila.querySelector('[data-accion="restablecer"]');
      if (btnRestablecer) {
        btnRestablecer.addEventListener("click", () => abrirModalRestablecer(userId, p.nombre));
      }
      el.appendChild(fila);
    });
  });

  function abrirModalRestablecer(userId, nombre) {
    const { modal, cerrar } = abrirModal(`
      <h3>Restablecer contraseña de ${esc(nombre)}</h3>
      <p style="font-size:13px;color:var(--color-texto-suave)">
        Como admin del viaje puedes ponerle una contraseña nueva. Avísale para que no se quede fuera.
      </p>
      <form id="form-restablecer">
        <label for="rc-nueva">Contraseña nueva</label>
        <input id="rc-nueva" type="password" required autofocus autocomplete="new-password">
        <div class="error" id="rc-error"></div>
        <div class="fila-botones">
          <button type="submit">Guardar</button>
          <button type="button" class="secundario" id="rc-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#rc-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-restablecer").addEventListener("submit", async e => {
      e.preventDefault();
      const nueva = modal.querySelector("#rc-nueva").value;
      if (!nueva) return;
      try {
        await restablecerContrasena(userId, nueva);
        cerrar();
      } catch (err) {
        modal.querySelector("#rc-error").textContent = err.message;
      }
    });
  }

  function abrirModalRenombrarViaje(nombreActual) {
    const { modal, cerrar } = abrirModal(`
      <h3>Renombrar viaje</h3>
      <form id="form-renombrar-viaje">
        <label for="rv-nombre">Nombre del viaje</label>
        <input id="rv-nombre" type="text" required autofocus value="${esc(nombreActual)}">
        <div class="fila-botones">
          <button type="submit">Guardar</button>
          <button type="button" class="secundario" id="rv-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#rv-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-renombrar-viaje").addEventListener("submit", async e => {
      e.preventDefault();
      const nuevoNombre = modal.querySelector("#rv-nombre").value.trim();
      if (!nuevoNombre) return;
      await actualizar(refInfo, { nombre: nuevoNombre });
      cerrar();
    });
  }

  // Borra el viaje completo (todo su árbol en /viajes/{tripId}) y limpia la
  // referencia en /usuarios/{userId}/viajesInvitado de cada participante —
  // si no, a esas personas les quedaría un id de viaje "fantasma" en su
  // lista al que ya no pueden entrar.
  async function eliminarViajeCompleto() {
    const actualizaciones = { [`viajes/${tripId}`]: null };
    Object.keys(participantesCache || {}).forEach(userId => {
      actualizaciones[`usuarios/${userId}/viajesInvitado/${tripId}`] = null;
    });
    await db.ref().update(actualizaciones);
    mostrarToast("Eliminado");
  }

  // Requiere escribir el nombre exacto del viaje — a diferencia de un
  // confirm() simple, esto es intencionalmente más estricto porque borra
  // TODO el viaje (no solo una fila) y afecta a todos los participantes,
  // no solo a quien lo borra.
  function abrirModalEliminarViaje(nombreViaje) {
    const { modal, cerrar } = abrirModal(`
      <h3>Eliminar viaje</h3>
      <p style="font-size:13px;color:var(--color-texto-suave)">
        Esto borra <strong>${esc(nombreViaje)}</strong> por completo: ciudades, ruta, lugares,
        traslados, hospedajes y checklist. El viaje desaparece para todos los participantes.
        No se puede deshacer.
      </p>
      <form id="form-eliminar-viaje">
        <label for="ev-confirmar">Escribe "${esc(nombreViaje)}" para confirmar</label>
        <input id="ev-confirmar" type="text" autocomplete="off" required autofocus>
        <div class="error" id="ev-error"></div>
        <div class="fila-botones">
          <button type="submit" class="peligro">Eliminar viaje</button>
          <button type="button" class="secundario" id="ev-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#ev-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-eliminar-viaje").addEventListener("submit", async e => {
      e.preventDefault();
      const escrito = modal.querySelector("#ev-confirmar").value.trim();
      if (escrito !== nombreViaje) {
        modal.querySelector("#ev-error").textContent = "El nombre no coincide.";
        return;
      }
      await eliminarViajeCompleto();
      cerrar();
      window.location.href = "index.html";
    });
  }

  document.getElementById("in-btn-mi-contrasena").addEventListener("click", () => {
    abrirModalCambiarContrasena(sesion);
  });

  document.getElementById("in-btn-copiar-liga").addEventListener("click", async () => {
    const clave = infoCache.claveInvitacion;
    if (!clave) return;
    const liga = new URL(`index.html?unirse=${encodeURIComponent(clave)}`, window.location.href).toString();
    const boton = document.getElementById("in-btn-copiar-liga");
    try {
      await navigator.clipboard.writeText(liga);
      const htmlOriginal = boton.innerHTML;
      boton.innerHTML = iconoTexto("check", "Copiada", 15);
      setTimeout(() => { boton.innerHTML = htmlOriginal; }, 1800);
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

  const cancelarInfo = escuchar(refInfo, renderInfo);
  const cancelarParticipantes = escuchar(refParticipantes, renderParticipantes);
  const cancelarCiudadesProgreso = escuchar(refCiudades, v => { progreso.ciudades = v; renderProgreso(); });
  const cancelarCiudadPorDiaProgreso = escuchar(refCiudadPorDia, v => { progreso.ciudadPorDia = v; renderProgreso(); });
  const cancelarLugaresProgreso = escuchar(refLugares, v => { progreso.lugares = v; costos.lugares = v; renderProgreso(); renderCostos(); });
  const cancelarTrasladosCostos = escuchar(refTraslados, v => { costos.traslados = v; renderCostos(); });
  const cancelarHospedajesCostos = escuchar(refHospedajes, v => { costos.hospedajes = v; renderCostos(); });
  const cancelarMonedas = escuchar(refMonedas, v => { monedasCache = v; renderMonedas(); renderCostos(); });

  return () => {
    cancelarInfo(); cancelarParticipantes();
    cancelarCiudadesProgreso(); cancelarCiudadPorDiaProgreso(); cancelarLugaresProgreso();
    cancelarTrasladosCostos(); cancelarHospedajesCostos(); cancelarMonedas();
  };
}
