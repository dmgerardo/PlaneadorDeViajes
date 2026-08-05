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

  document.getElementById("l-btn-agregar").addEventListener("click", async () => {
    const idsCiudades = Object.keys(ciudadesCache);
    if (idsCiudades.length === 0) {
      alert("Primero agrega al menos una ciudad en la pestaña Generales.");
      return;
    }
    const nombre = prompt("Nombre del lugar:");
    if (!nombre || !nombre.trim()) return;

    const opcionesCiudad = idsCiudades.map((id, i) => `${i + 1}) ${ciudadesCache[id].nombre}`).join("\n");
    const seleccion = prompt(`¿En qué ciudad?\n${opcionesCiudad}`, "1");
    const ciudadId = idsCiudades[Number(seleccion) - 1];
    if (!ciudadId) { alert("Ciudad no válida."); return; }

    const categoria = prompt("Prioridad: deseable / importante / no_negociable", "deseable");
    if (!["deseable", "importante", "no_negociable"].includes(categoria)) {
      alert("Prioridad no válida.");
      return;
    }

    const liga_mapa = prompt("Liga de mapa (opcional):") || "";
    const ligaExtra = prompt("Liga de interés adicional (opcional):") || "";
    const aireLibre = confirm("¿Es una actividad al aire libre (requiere ropa de intemperie)?");
    const notas = prompt("Notas (opcional):") || "";

    await agregar(refLugares, {
      nombre: nombre.trim(),
      ciudadId,
      categoria,
      liga_mapa,
      ligas: ligaExtra ? [ligaExtra] : [],
      aireLibre,
      notas
    });
  });

  const cancelarCiudades = escuchar(refCiudades, renderCiudades);
  const cancelarLugares = escuchar(refLugares, renderLugares);

  return () => { cancelarCiudades(); cancelarLugares(); };
}
