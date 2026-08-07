// Vista "Lugares": banco de lugares deseados, categorizados por prioridad,
// con ligas de interés y de mapa. Se centraliza aquí toda la investigación
// previa al viaje; después se arrastran a la cuadrícula (vista-calendario.js).

const ETIQUETA_CATEGORIA_LUGAR = {
  deseable: "Deseable",
  importante: "Importante",
  no_negociable: "No negociable"
};

async function montarVistaLugares(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <div class="encabezado-seccion">
        <h2>Lugares deseados</h2>
        <button type="button" class="btn-agregar-circular" id="l-btn-agregar" aria-label="Agregar lugar" title="Agregar lugar">${icono("plus", 20)}</button>
      </div>
      <div id="l-resumen" style="font-size:12.5px;color:var(--color-texto-suave);margin-bottom:8px;"></div>
      <label>Filtrar por ciudad</label>
      <select id="l-filtro-ciudad"><option value="">Todas</option></select>
      <label>Filtrar por prioridad</label>
      <select id="l-filtro-categoria">
        <option value="">Todas</option>
        <option value="deseable">Deseable</option>
        <option value="importante">Importante</option>
        <option value="no_negociable">No negociable</option>
      </select>
    </div>
    <div id="l-lista"></div>
  `;

  const refLugares = refNodo(tripId, "lugares");
  const refCiudades = refNodo(tripId, "ciudades");

  let ciudadesCache = {};
  let lugaresCache = {};
  let filtroCiudad = "";
  let filtroCategoria = "";

  function renderResumen() {
    const el = document.getElementById("l-resumen");
    if (!el) return;
    const total = Object.keys(lugaresCache).length;
    if (total === 0) { el.textContent = ""; return; }
    const porCiudad = {};
    Object.values(lugaresCache).forEach(l => {
      const nombre = ciudadesCache[l.ciudadId] ? ciudadesCache[l.ciudadId].nombre : "Sin ciudad";
      porCiudad[nombre] = (porCiudad[nombre] || 0) + 1;
    });
    const detalle = Object.entries(porCiudad).map(([nombre, n]) => `${n} en ${nombre}`).join(" · ");
    el.textContent = `${total} lugar${total === 1 ? "" : "es"} en total — ${detalle}`;
  }

  function renderLista() {
    const el = document.getElementById("l-lista");
    if (!el) return;
    limpiar(el);
    const entradas = Object.entries(lugaresCache).filter(([, l]) =>
      (!filtroCiudad || l.ciudadId === filtroCiudad) &&
      (!filtroCategoria || l.categoria === filtroCategoria)
    );
    if (entradas.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave)">Sin lugares todavía.</p>';
      return;
    }
    entradas
      .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
      .forEach(([id, l]) => {
        const ciudad = ciudadesCache[l.ciudadId];
        const tarjeta = document.createElement("div");
        tarjeta.className = "tarjeta lista-item-clic";
        tarjeta.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong>${esc(l.nombre)}</strong> ${l.aireLibre ? icono("snowflake", 13) : ""}<br>
              <span style="font-size:12px;color:var(--color-texto-suave)">${esc(ciudad ? ciudad.nombre : "Sin ciudad")}</span>
            </div>
            <span class="chip ${esc(l.categoria)}">${esc(ETIQUETA_CATEGORIA_LUGAR[l.categoria] || l.categoria)}</span>
          </div>
          ${l.notas ? `<p style="font-size:13px;">${esc(l.notas)}</p>` : ""}
          ${(l.liga_mapa || (l.ligas || []).length) ? `
          <div class="fila-botones">
            ${l.liga_mapa ? `<a href="${esc(l.liga_mapa)}" target="_blank" rel="noopener noreferrer"><button class="secundario">${iconoTexto("map", "Mapa", 14)}</button></a>` : ""}
            ${(l.ligas || []).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><button class="secundario">${iconoTexto("link", "Liga", 14)}</button></a>`).join("")}
          </div>` : ""}
        `;
        // Las ligas de Mapa/Interés abren en otra pestaña y no deben disparar
        // el modo de edición — solo el resto de la tarjeta lo abre.
        tarjeta.addEventListener("click", e => {
          if (e.target.closest("a")) return;
          abrirFormularioLugar(id);
        });
        el.appendChild(tarjeta);
      });
  }

  const renderCiudades = programarRender(ciudades => {
    ciudadesCache = ciudades;
    const select = document.getElementById("l-filtro-ciudad");
    if (!select) return;
    const valorPrevio = select.value;
    select.innerHTML = '<option value="">Todas</option>' +
      Object.entries(ciudades).map(([id, c]) => `<option value="${esc(id)}">${esc(c.nombre)}</option>`).join("");
    select.value = valorPrevio;
    renderResumen();
    renderLista();
  });

  const renderLugares = programarRender(lugares => {
    lugaresCache = lugares;
    renderResumen();
    renderLista();
  });

  document.getElementById("l-filtro-ciudad").addEventListener("change", e => {
    filtroCiudad = e.target.value;
    renderLista();
  });
  document.getElementById("l-filtro-categoria").addEventListener("change", e => {
    filtroCategoria = e.target.value;
    renderLista();
  });

  function abrirFormularioLugar(idExistente) {
    const existente = idExistente ? lugaresCache[idExistente] : null;
    const idsCiudades = Object.keys(ciudadesCache);
    if (idsCiudades.length === 0) {
      alert("Primero agrega al menos una ciudad en la pestaña Ciudades.");
      return;
    }

    const { modal, cerrar } = abrirModal(`
      <h3>${existente ? "Editar lugar" : "Agregar lugar"}</h3>
      <form id="form-lugar">
        <label for="fl-nombre">Nombre</label>
        <input id="fl-nombre" type="text" placeholder="Ej. Empire State" required autofocus value="${esc(existente ? existente.nombre : "")}">
        <label for="fl-ciudad">Ciudad</label>
        <select id="fl-ciudad" required>
          ${idsCiudades.map(id => `<option value="${esc(id)}" ${existente && existente.ciudadId === id ? "selected" : ""}>${esc(ciudadesCache[id].nombre)}</option>`).join("")}
        </select>
        <label for="fl-categoria">Prioridad</label>
        <select id="fl-categoria" required>
          <option value="deseable" ${existente && existente.categoria === "deseable" ? "selected" : ""}>Deseable</option>
          <option value="importante" ${existente && existente.categoria === "importante" ? "selected" : ""}>Importante</option>
          <option value="no_negociable" ${existente && existente.categoria === "no_negociable" ? "selected" : ""}>No negociable</option>
        </select>
        <label for="fl-mapa">Liga de mapa</label>
        <input id="fl-mapa" type="url" placeholder="https://maps.google.com/… (opcional)" value="${esc(existente ? (existente.liga_mapa || "") : "")}">
        <label for="fl-liga">Liga de interés adicional</label>
        <input id="fl-liga" type="url" placeholder="https://… (opcional)" value="${esc(existente && existente.ligas ? (existente.ligas[0] || "") : "")}">
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input id="fl-aire-libre" type="checkbox" ${existente && existente.aireLibre ? "checked" : ""}>
          ${icono("snowflake", 15)} Actividad al aire libre (requiere ropa de intemperie)
        </label>
        <label for="fl-notas">Notas</label>
        <textarea id="fl-notas" placeholder="Opcional">${esc(existente ? (existente.notas || "") : "")}</textarea>
        <div class="fila-botones">
          <button type="submit">${existente ? "Guardar cambios" : "Agregar"}</button>
          <button type="button" class="secundario" id="fl-cancelar">Cancelar</button>
          ${existente ? `<button type="button" class="peligro" id="fl-eliminar">Eliminar</button>` : ""}
        </div>
      </form>
    `);
    modal.querySelector("#fl-cancelar").addEventListener("click", cerrar);
    if (existente) {
      modal.querySelector("#fl-eliminar").addEventListener("click", async () => {
        if (confirm(`¿Quitar "${existente.nombre}" de la lista?`)) {
          await eliminar(refLugares.child(idExistente));
          cerrar();
        }
      });
    }
    modal.querySelector("#form-lugar").addEventListener("submit", async e => {
      e.preventDefault();
      const nombre = modal.querySelector("#fl-nombre").value.trim();
      const ciudadId = modal.querySelector("#fl-ciudad").value;
      const categoria = modal.querySelector("#fl-categoria").value;
      const liga_mapa = modal.querySelector("#fl-mapa").value.trim();
      const ligaExtra = modal.querySelector("#fl-liga").value.trim();
      const aireLibre = modal.querySelector("#fl-aire-libre").checked;
      const notas = modal.querySelector("#fl-notas").value.trim();
      if (!nombre || !ciudadId) return;

      const datos = {
        nombre, ciudadId, categoria, liga_mapa,
        ligas: ligaExtra ? [ligaExtra] : [],
        aireLibre, notas
      };
      if (existente) await actualizar(refLugares.child(idExistente), datos);
      else await agregar(refLugares, datos);
      cerrar();
    });
  }
  document.getElementById("l-btn-agregar").addEventListener("click", () => abrirFormularioLugar(null));

  const cancelarCiudades = escuchar(refCiudades, renderCiudades);
  const cancelarLugares = escuchar(refLugares, renderLugares);

  return () => { cancelarCiudades(); cancelarLugares(); };
}
