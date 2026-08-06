// Vista "Ciudades": catálogo de ciudades del viaje (nombre, zona horaria,
// coordenadas opcionales). No confundir con la pestaña "Ruta"
// (vista-ruta.js), que asigna cuál de estas ciudades corresponde a cada
// día del viaje — esta vista solo mantiene la lista.

async function montarVistaCiudades(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>Ciudades</h2>
      <div id="ci-lista"></div>
      <button id="ci-btn-agregar">+ Agregar ciudad</button>
    </div>
  `;

  const refInfo = refNodo(tripId, "info");
  const refCiudades = refNodo(tripId, "ciudades");

  let infoCache = {};
  let ciudadesCache = {};

  // Zona horaria de la última ciudad agregada (o la de origen si no hay ninguna) —
  // se usa como default al agregar la siguiente ciudad, para no tener que
  // buscarla de nuevo en la lista de 400+ zonas cada vez.
  function zonaHorariaSugerida() {
    const ciudades = Object.values(ciudadesCache);
    if (ciudades.length === 0) return infoCache.zonaOrigen || "America/Mexico_City";
    const ultima = ciudades.sort((a, b) => (b.orden || 0) - (a.orden || 0))[0];
    return ultima.zonaHoraria;
  }

  const renderLista = programarRender(() => {
    const el = document.getElementById("ci-lista");
    if (!el) return;
    limpiar(el);
    const ordenadas = Object.entries(ciudadesCache).sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    if (ordenadas.length === 0) {
      el.innerHTML = '<p style="color:var(--color-texto-suave)">Sin ciudades todavía.</p>';
      return;
    }
    ordenadas.forEach(([id, c]) => {
      const fila = document.createElement("div");
      fila.className = "lista-item lista-item-clic";
      fila.innerHTML = `
        <div><strong>${esc(c.nombre)}</strong><br><span style="font-size:12px;color:var(--color-texto-suave)">${esc(c.zonaHoraria)}</span></div>
        <span class="lista-item-chevron">›</span>
      `;
      fila.addEventListener("click", () => abrirFormularioCiudad(id));
      el.appendChild(fila);
    });
  });

  function abrirFormularioCiudad(idExistente) {
    const existente = idExistente ? ciudadesCache[idExistente] : null;
    const { modal, cerrar } = abrirModal(`
      <h3>${existente ? "Editar ciudad" : "Agregar ciudad"}</h3>
      <form id="form-ciudad">
        <label for="fc-nombre">Nombre</label>
        <div class="autocompletar-envoltura">
          <input id="fc-nombre" type="text" placeholder="Ej. Nueva York" autocomplete="off" required autofocus value="${esc(existente ? existente.nombre : "")}">
          <div class="autocompletar-lista oculto" id="fc-sugerencias"></div>
        </div>
        <p style="font-size:11px;color:var(--color-texto-suave);margin:4px 0 0;">Escribe para buscar en el catálogo (rellena zona horaria y coordenadas solo), o captúrala manual abajo.</p>
        <label for="fc-zona">Zona horaria</label>
        <select id="fc-zona" required>${opcionesZonaHoraria(existente ? existente.zonaHoraria : zonaHorariaSugerida())}</select>
        <label for="fc-lat">Coordenadas (opcional — para sombrear la noche real en el calendario)</label>
        <div style="display:flex;gap:8px;">
          <input id="fc-lat" type="number" step="any" min="-90" max="90" placeholder="Latitud" value="${esc(existente && existente.lat != null ? existente.lat : "")}">
          <input id="fc-lng" type="number" step="any" min="-180" max="180" placeholder="Longitud" value="${esc(existente && existente.lng != null ? existente.lng : "")}">
        </div>
        <p style="font-size:11px;color:var(--color-texto-suave);margin:4px 0 0;">Búscalas en Google Maps: clic derecho sobre el mapa → el primer número es la latitud, el segundo la longitud.</p>
        <div class="fila-botones">
          <button type="submit">${existente ? "Guardar cambios" : "Agregar"}</button>
          <button type="button" class="secundario" id="fc-cancelar">Cancelar</button>
          ${existente ? `<button type="button" class="peligro" id="fc-eliminar">Eliminar</button>` : ""}
        </div>
      </form>
    `);
    modal.querySelector("#fc-cancelar").addEventListener("click", cerrar);

    // Autocompletar contra el catálogo (js/catalogo-ciudades.js): al elegir
    // una sugerencia se rellenan zona horaria y coordenadas solas, pero
    // siguen siendo campos normales — el catálogo es solo un atajo, nunca
    // la única forma de capturar una ciudad.
    const campoNombre = modal.querySelector("#fc-nombre");
    const listaSugerencias = modal.querySelector("#fc-sugerencias");
    function ocultarSugerencias() {
      listaSugerencias.classList.add("oculto");
      listaSugerencias.innerHTML = "";
    }
    campoNombre.addEventListener("input", () => {
      const resultados = buscarEnCatalogoCiudades(campoNombre.value);
      if (resultados.length === 0) { ocultarSugerencias(); return; }
      listaSugerencias.innerHTML = resultados.map((c, i) =>
        `<div class="autocompletar-item" data-idx="${i}">${esc(c.nombre)} <span style="color:var(--color-texto-suave)">— ${esc(c.pais)}</span></div>`
      ).join("");
      listaSugerencias.classList.remove("oculto");
      listaSugerencias.querySelectorAll(".autocompletar-item").forEach((el, i) => {
        el.addEventListener("mousedown", e => {
          // mousedown (no click) para que dispare antes del blur del input.
          e.preventDefault();
          const c = resultados[i];
          campoNombre.value = c.nombre;
          modal.querySelector("#fc-zona").value = c.zonaHoraria;
          modal.querySelector("#fc-lat").value = c.lat;
          modal.querySelector("#fc-lng").value = c.lng;
          ocultarSugerencias();
        });
      });
    });
    campoNombre.addEventListener("blur", () => setTimeout(ocultarSugerencias, 150));

    if (existente) {
      modal.querySelector("#fc-eliminar").addEventListener("click", async () => {
        if (confirm(`¿Quitar ciudad "${existente.nombre}"?`)) {
          await eliminar(refCiudades.child(idExistente));
          cerrar();
        }
      });
    }
    modal.querySelector("#form-ciudad").addEventListener("submit", async e => {
      e.preventDefault();
      const nombre = modal.querySelector("#fc-nombre").value.trim();
      const zonaHoraria = modal.querySelector("#fc-zona").value;
      const latTxt = modal.querySelector("#fc-lat").value.trim();
      const lngTxt = modal.querySelector("#fc-lng").value.trim();
      if (!nombre || !zonaHoraria) return;
      const datos = { nombre, zonaHoraria };
      // null (no undefined) para poder borrar coordenadas ya capturadas al editar.
      datos.lat = latTxt ? Number(latTxt) : null;
      datos.lng = lngTxt ? Number(lngTxt) : null;
      if (existente) {
        await actualizar(refCiudades.child(idExistente), datos);
      } else {
        datos.orden = Object.keys(ciudadesCache).length;
        await agregar(refCiudades, datos);
      }
      cerrar();
    });
  }
  document.getElementById("ci-btn-agregar").addEventListener("click", () => abrirFormularioCiudad(null));

  const cancelarInfo = escuchar(refInfo, v => { infoCache = v; });
  const cancelarCiudades = escuchar(refCiudades, v => { ciudadesCache = v; renderLista(); });

  return () => { cancelarInfo(); cancelarCiudades(); };
}
