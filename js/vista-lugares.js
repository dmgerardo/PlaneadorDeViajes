// Vista "Lugares": banco de lugares deseados, categorizados por prioridad,
// con ligas de interés y de mapa. Se centraliza aquí toda la investigación
// previa al viaje; después se arrastran a la cuadrícula (vista-calendario.js).

async function montarVistaLugares(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>Lugares deseados</h2>
      <label>Filtrar por ciudad</label>
      <select id="l-filtro-ciudad"><option value="">Todas</option></select>
    </div>
    <div id="l-lista"></div>
    <button id="l-btn-agregar" style="position:sticky;bottom:12px;width:100%;">+ Agregar lugar</button>
  `;

  const refLugares = refNodo(tripId, "lugares");
  const refCiudades = refNodo(tripId, "ciudades");

  let ciudadesCache = {};
  let lugaresCache = {};
  let filtroCiudad = "";

  const etiquetaCategoria = {
    deseable: "Deseable",
    importante: "Importante",
    no_negociable: "No negociable"
  };

  function renderLista() {
    const el = document.getElementById("l-lista");
    if (!el) return;
    limpiar(el);
    const entradas = Object.entries(lugaresCache).filter(([, l]) => !filtroCiudad || l.ciudadId === filtroCiudad);
    if (entradas.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave)">Sin lugares todavía.</p>';
      return;
    }
    entradas
      .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
      .forEach(([id, l]) => {
        const ciudad = ciudadesCache[l.ciudadId];
        const tarjeta = document.createElement("div");
        tarjeta.className = "tarjeta";
        tarjeta.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong>${esc(l.nombre)}</strong> ${l.aireLibre ? "❄️" : ""}<br>
              <span style="font-size:12px;color:var(--color-texto-suave)">${esc(ciudad ? ciudad.nombre : "Sin ciudad")}</span>
            </div>
            <span class="chip ${esc(l.categoria)}">${esc(etiquetaCategoria[l.categoria] || l.categoria)}</span>
          </div>
          ${l.notas ? `<p style="font-size:13px;">${esc(l.notas)}</p>` : ""}
          <div class="fila-botones">
            ${l.liga_mapa ? `<a href="${esc(l.liga_mapa)}" target="_blank" rel="noopener noreferrer"><button class="secundario">🗺️ Mapa</button></a>` : ""}
            ${(l.ligas || []).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><button class="secundario">🔗 Liga</button></a>`).join("")}
            <button class="texto" data-accion="borrar" data-id="${esc(id)}">Quitar</button>
          </div>
        `;
        tarjeta.querySelector('[data-accion="borrar"]').addEventListener("click", async () => {
          if (confirm(`¿Quitar "${l.nombre}" de la lista?`)) await eliminar(refLugares.child(id));
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
    renderLista();
  });

  const renderLugares = programarRender(lugares => {
    lugaresCache = lugares;
    renderLista();
  });

  document.getElementById("l-filtro-ciudad").addEventListener("change", e => {
    filtroCiudad = e.target.value;
    renderLista();
  });

  document.getElementById("l-btn-agregar").addEventListener("click", () => {
    const idsCiudades = Object.keys(ciudadesCache);
    if (idsCiudades.length === 0) {
      alert("Primero agrega al menos una ciudad en la pestaña Generales.");
      return;
    }

    const { modal, cerrar } = abrirModal(`
      <h3>Agregar lugar</h3>
      <form id="form-lugar">
        <label for="fl-nombre">Nombre</label>
        <input id="fl-nombre" type="text" placeholder="Ej. Empire State" required autofocus>
        <label for="fl-ciudad">Ciudad</label>
        <select id="fl-ciudad" required>
          ${idsCiudades.map(id => `<option value="${esc(id)}">${esc(ciudadesCache[id].nombre)}</option>`).join("")}
        </select>
        <label for="fl-categoria">Prioridad</label>
        <select id="fl-categoria" required>
          <option value="deseable">Deseable</option>
          <option value="importante">Importante</option>
          <option value="no_negociable">No negociable</option>
        </select>
        <label for="fl-mapa">Liga de mapa</label>
        <input id="fl-mapa" type="url" placeholder="https://maps.google.com/… (opcional)">
        <label for="fl-liga">Liga de interés adicional</label>
        <input id="fl-liga" type="url" placeholder="https://… (opcional)">
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input id="fl-aire-libre" type="checkbox" style="width:auto;">
          ❄️ Actividad al aire libre (requiere ropa de intemperie)
        </label>
        <label for="fl-notas">Notas</label>
        <textarea id="fl-notas" placeholder="Opcional"></textarea>
        <div class="fila-botones">
          <button type="submit">Agregar</button>
          <button type="button" class="secundario" id="fl-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#fl-cancelar").addEventListener("click", cerrar);
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

      await agregar(refLugares, {
        nombre, ciudadId, categoria, liga_mapa,
        ligas: ligaExtra ? [ligaExtra] : [],
        aireLibre, notas
      });
      cerrar();
    });
  });

  const cancelarCiudades = escuchar(refCiudades, renderCiudades);
  const cancelarLugares = escuchar(refLugares, renderLugares);

  return () => { cancelarCiudades(); cancelarLugares(); };
}
