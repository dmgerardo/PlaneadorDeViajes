// Vista "Ruta": asigna la ciudad en la que se está cada día del viaje,
// mediante un timeline — toca una ciudad y arrastra sobre los días para
// pintarla (o "🧹 Vaciar" para quitarla). Esta asignación explícita
// (ciudadPorDia) es la que usan las vistas Agenda/Calendario para saber
// en qué ciudad estás cada día, y para no dejarte agendar un lugar en el
// día equivocado. Reutiliza HORA_PX/COLORES_CIUDAD/colorCss/listaDeDias,
// definidos en vista-calendario.js (debe cargarse antes que este archivo).
// No confundir con la pestaña "Ciudades" (vista-ciudades.js), que es el
// catálogo de ciudades del viaje (nombre/zona horaria/coordenadas) — esta
// vista solo asigna, día por día, cuál de esas ciudades toca.

async function montarVistaRuta(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>Ruta por día</h2>
      <p style="font-size:12px;color:var(--color-texto-suave);margin:0 0 8px;">
        Toca una ciudad y arrastra sobre los días para asignarla (o "🧹 Vaciar" para quitarla).
        El Calendario y la Agenda usan esta asignación para saber en qué ciudad estás cada día.
      </p>
      <div class="ciudad-timeline" id="ciudad-timeline"></div>
      <div class="cal-pendientes" id="cal-ciudades-chips"></div>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");
  const refCiudadPorDia = refNodo(tripId, "ciudadPorDia");

  const estado = { info: {}, ciudades: {}, ciudadPorDiaManual: {} };
  let ciudadSeleccionada = null;
  let pintando = false;
  let cambiosPintura = {};

  function colorParaCiudad(ciudadId) {
    const ids = Object.keys(estado.ciudades);
    const idx = ids.indexOf(ciudadId);
    if (idx === -1) return colorCss("--color-primario");
    return colorCss(COLORES_CIUDAD[idx % COLORES_CIUDAD.length]);
  }

  function render() {
    const wrap = document.getElementById("ciudad-timeline");
    const chipsEl = document.getElementById("cal-ciudades-chips");
    if (!wrap || !chipsEl) return;

    const dias = listaDeDias(estado.info.fechaInicio, estado.info.fechaFin);
    limpiar(wrap);
    if (dias.length === 0) {
      wrap.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Primero captura las fechas del viaje en la pestaña Info.</p>';
    }
    dias.forEach(dia => {
      const ciudadId = estado.ciudadPorDiaManual[dia];
      const celda = document.createElement("div");
      celda.className = "ct-dia";
      celda.dataset.dia = dia;
      const fechaCorta = new Date(`${dia}T00:00:00Z`).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
      if (ciudadId && estado.ciudades[ciudadId]) {
        celda.style.background = colorParaCiudad(ciudadId);
        celda.style.color = "#fff2eb";
        celda.innerHTML = `<span class="ct-fecha">${fechaCorta}</span><span class="ct-ciudad">${esc(estado.ciudades[ciudadId].nombre)}</span>`;
      } else {
        celda.innerHTML = `<span class="ct-fecha">${fechaCorta}</span>`;
      }
      celda.addEventListener("pointerdown", () => iniciarPintura(dia));
      celda.addEventListener("pointerenter", () => continuarPintura(dia));
      wrap.appendChild(celda);
    });

    limpiar(chipsEl);
    if (Object.keys(estado.ciudades).length === 0) {
      chipsEl.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Primero agrega ciudades en la pestaña Ciudades.</p>';
      return;
    }
    Object.entries(estado.ciudades).forEach(([id, c]) => {
      const chip = document.createElement("div");
      const activo = ciudadSeleccionada === id;
      chip.className = "cal-chip-pendiente" + (activo ? " seleccionado" : "");
      if (activo) chip.style.background = colorParaCiudad(id);
      chip.style.borderColor = colorParaCiudad(id);
      chip.textContent = c.nombre;
      chip.addEventListener("click", () => {
        ciudadSeleccionada = ciudadSeleccionada === id ? null : id;
        render();
      });
      chipsEl.appendChild(chip);
    });
    const chipBorrar = document.createElement("div");
    const borrarActivo = ciudadSeleccionada === "__borrar__";
    chipBorrar.className = "cal-chip-pendiente" + (borrarActivo ? " seleccionado" : "");
    chipBorrar.textContent = "🧹 Vaciar";
    chipBorrar.addEventListener("click", () => {
      ciudadSeleccionada = borrarActivo ? null : "__borrar__";
      render();
    });
    chipsEl.appendChild(chipBorrar);
  }

  function iniciarPintura(dia) {
    if (!ciudadSeleccionada) return;
    pintando = true;
    cambiosPintura = {};
    aplicarPintura(dia);
  }
  function continuarPintura(dia) {
    if (!pintando) return;
    aplicarPintura(dia);
  }
  function aplicarPintura(dia) {
    const valor = ciudadSeleccionada === "__borrar__" ? null : ciudadSeleccionada;
    cambiosPintura[dia] = valor;
    estado.ciudadPorDiaManual = { ...estado.ciudadPorDiaManual, [dia]: valor };
    render();
  }
  async function finalizarPintura() {
    if (!pintando) return;
    pintando = false;
    const mapa = {};
    Object.entries(cambiosPintura).forEach(([dia, valor]) => {
      mapa[`viajes/${tripId}/ciudadPorDia/${dia}`] = valor;
    });
    cambiosPintura = {};
    if (Object.keys(mapa).length) await actualizarMultiple(mapa);
  }
  document.addEventListener("pointerup", finalizarPintura);

  const solicitarRender = programarRender(render);
  const cancelarInfo = escuchar(refInfo, v => { estado.info = v; solicitarRender(); });
  const cancelarCiudades = escuchar(refCiudades, v => { estado.ciudades = v; solicitarRender(); });
  const cancelarCiudadPorDia = escuchar(refCiudadPorDia, v => { estado.ciudadPorDiaManual = v; solicitarRender(); });

  return () => {
    document.removeEventListener("pointerup", finalizarPintura);
    cancelarInfo(); cancelarCiudades(); cancelarCiudadPorDia();
  };
}
