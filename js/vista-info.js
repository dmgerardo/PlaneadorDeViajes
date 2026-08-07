// Vista "Info": datos generales del viaje (fechas, ciudad de origen, zona
// horaria, clave de invitación) y participantes (incluye promover a admin
// y gestión de contraseña). Se captura sobre todo una vez, al planear.

async function montarVistaInfo(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta" id="in-info"></div>
    <div class="tarjeta">
      <h3>Participantes</h3>
      <div class="fila-botones" style="margin-top:0;">
        <button class="secundario" id="in-btn-mi-contrasena">🔑 Cambiar mi contraseña</button>
      </div>
      <div id="in-participantes"></div>
      <p style="font-size:12px;color:var(--color-texto-suave)">
        Comparte la liga de invitación de este viaje para que otros se unan directamente.
      </p>
      <button class="secundario" id="in-btn-copiar-liga">🔗 Copiar liga de invitación</button>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refParticipantes = refNodo(tripId, "participantes");

  let infoCache = {};
  let participantesCache = {};

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
      <h2>${esc(info.nombre || "Viaje")}</h2>
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
    `;
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

  const cancelarInfo = escuchar(refInfo, renderInfo);
  const cancelarParticipantes = escuchar(refParticipantes, renderParticipantes);

  return () => { cancelarInfo(); cancelarParticipantes(); };
}
