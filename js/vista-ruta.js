// Vista "Ruta": asigna la ciudad en la que se está cada día del viaje,
// mediante un timeline — toca una ciudad y luego toca cada día para irla
// asignando (o "Quitar" para ir borrando). No es arrastre: con mouse,
// arrastrar pintaba de más las celdas "en el camino" del puntero sin
// querer — un clic por día es más predecible. Esta asignación explícita
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
        Toca una ciudad y luego toca cada día para asignarla (o "Quitar" para ir borrando).
        El Calendario y la Agenda usan esta asignación para saber en qué ciudad estás cada día.
        Los días con un traslado capturado (pestaña Logística) se muestran partidos entre
        origen y destino.
      </p>
      <div class="ruta-layout">
        <div class="ruta-ciudades" id="cal-ciudades-chips"></div>
        <div class="ciudad-timeline" id="ciudad-timeline"></div>
      </div>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");
  const refCiudadPorDia = refNodo(tripId, "ciudadPorDia");
  const refTraslados = refNodo(tripId, "traslados");

  const estado = { info: {}, ciudades: {}, ciudadPorDiaManual: {}, traslados: {} };
  let ciudadSeleccionada = null;

  function colorParaCiudad(ciudadId) {
    const ids = Object.keys(estado.ciudades);
    const idx = ids.indexOf(ciudadId);
    if (idx === -1) return colorCss("--color-primario");
    return colorCss(COLORES_CIUDAD[idx % COLORES_CIUDAD.length]);
  }

  // Nombre de ciudad (origen/destino de un traslado, texto libre) → su
  // ciudadId en el catálogo, para poder pintarlo con su color asignado. Si
  // no hay match (p.ej. es la ciudad de origen del viaje, que no vive en
  // /ciudades), se pinta con un color neutro más abajo.
  function ciudadIdPorNombre(nombre) {
    const encontrada = Object.entries(estado.ciudades).find(([, c]) => c.nombre.toLowerCase() === (nombre || "").toLowerCase());
    return encontrada ? encontrada[0] : null;
  }

  function zonaDeNombre(nombre) {
    const id = ciudadIdPorNombre(nombre);
    return id ? estado.ciudades[id].zonaHoraria : (estado.info.zonaOrigen || "America/Mexico_City");
  }

  // El traslado (si lo hay) que toca ese día — el día en que sale (hora
  // local del origen) O el día en que llega (hora local del destino). Un
  // vuelo largo (p.ej. 11h+ cruzando varios husos horarios) puede salir un
  // día y llegar al siguiente: antes solo se detectaba el día de salida, y
  // el de llegada se veía como un día "normal" sin nada que indicara que
  // el viaje seguía en curso. Es lo que hace que el día quede "partido"
  // entre dos ciudades en vez de ser una sola.
  function trasladoDelDia(dia) {
    return Object.values(estado.traslados).find(t => {
      if (!t.inicioUTC) return false;
      const fin = t.finUTC || t.inicioUTC;
      const diaSalida = fechaISO(t.inicioUTC, zonaDeNombre(t.origen));
      const diaLlegada = fechaISO(fin, zonaDeNombre(t.destino));
      return dia === diaSalida || dia === diaLlegada;
    }) || null;
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
      const fechaCorta = new Date(`${dia}T00:00:00Z`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");
      const traslado = trasladoDelDia(dia);
      if (traslado) {
        // Día partido entre dos ciudades: mitad y mitad con el color de
        // cada una (gris si es la ciudad de origen del viaje u otra que no
        // está en el catálogo de /ciudades), más el ícono de avión.
        const origenId = ciudadIdPorNombre(traslado.origen);
        const destinoId = ciudadIdPorNombre(traslado.destino);
        const colorOrigen = origenId ? colorParaCiudad(origenId) : colorCss("--color-texto-suave");
        const colorDestino = destinoId ? colorParaCiudad(destinoId) : colorCss("--color-texto-suave");
        const zonaOrigen = zonaDeNombre(traslado.origen);
        const zonaDestino = zonaDeNombre(traslado.destino);
        const finTraslado = traslado.finUTC || traslado.inicioUTC;
        // El día de salida y el de llegada pueden ser distintos (traslado
        // que cruza medianoche) — el tooltip muestra la hora que aplica a
        // ESTE día en particular, no siempre la de salida.
        const esDiaLlegada = dia === fechaISO(finTraslado, zonaDestino) && dia !== fechaISO(traslado.inicioUTC, zonaOrigen);
        celda.style.background = `linear-gradient(to right, ${colorOrigen} 0 50%, ${colorDestino} 50% 100%)`;
        celda.style.color = "#fff2eb";
        celda.title = esDiaLlegada
          ? `Llega ${formatoHora(finTraslado, zonaDestino)}: ${traslado.origen} → ${traslado.destino}`
          : `Sale ${formatoHora(traslado.inicioUTC, zonaOrigen)}: ${traslado.origen} → ${traslado.destino}`;
        celda.innerHTML = `
          <span class="ct-fecha">${fechaCorta}</span>
          <span class="ct-ciudad">${icono("plane", 14, "icono-texto")}${esc(traslado.origen)} → ${esc(traslado.destino)}</span>
        `;
      } else if (ciudadId && estado.ciudades[ciudadId]) {
        celda.style.background = colorParaCiudad(ciudadId);
        celda.style.color = "#fff2eb";
        celda.innerHTML = `<span class="ct-fecha">${fechaCorta}</span><span class="ct-ciudad">${esc(estado.ciudades[ciudadId].nombre)}</span>`;
      } else {
        celda.innerHTML = `<span class="ct-fecha">${fechaCorta}</span>`;
      }
      celda.addEventListener("click", () => asignarDia(dia));
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
    chipBorrar.innerHTML = iconoTexto("eraser", "Quitar", 14);
    chipBorrar.addEventListener("click", () => {
      ciudadSeleccionada = borrarActivo ? null : "__borrar__";
      render();
    });
    chipsEl.appendChild(chipBorrar);
  }

  // Un clic por día: primero se elige una ciudad (o "Quitar") arriba, y
  // cada clic siguiente en un día la asigna (o la borra) — sin arrastre,
  // para que un mouse no pinte de más las celdas de en medio sin querer.
  async function asignarDia(dia) {
    if (!ciudadSeleccionada) return;
    const valor = ciudadSeleccionada === "__borrar__" ? null : ciudadSeleccionada;
    estado.ciudadPorDiaManual = { ...estado.ciudadPorDiaManual, [dia]: valor };
    render();
    await actualizar(refCiudadPorDia, { [dia]: valor });
  }

  const solicitarRender = programarRender(render);
  const cancelarInfo = escuchar(refInfo, v => { estado.info = v; solicitarRender(); });
  const cancelarCiudades = escuchar(refCiudades, v => { estado.ciudades = v; solicitarRender(); });
  const cancelarCiudadPorDia = escuchar(refCiudadPorDia, v => { estado.ciudadPorDiaManual = v; solicitarRender(); });
  const cancelarTraslados = escuchar(refTraslados, v => { estado.traslados = v; solicitarRender(); });

  return () => { cancelarInfo(); cancelarCiudades(); cancelarCiudadPorDia(); cancelarTraslados(); };
}
