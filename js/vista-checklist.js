// Vista "Checklist": lista de empaque compartida por el viaje.
// Cada persona tiene su propio checkbox de hecho/no hecho por ítem.

async function montarVistaChecklist(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>Checklist</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;" id="chk-tabla"></table>
      </div>
      <div class="fila-botones">
        <input id="chk-nuevo-item" type="text" placeholder="Nuevo ítem…" style="flex:1;">
        <button id="chk-btn-agregar">Agregar</button>
      </div>
    </div>
  `;

  const refChecklist = refNodo(tripId, "checklist");
  const refParticipantes = refNodo(tripId, "participantes");

  let participantesCache = { [sesion.userId]: { nombre: sesion.nombre } };
  let itemsCache = {};

  function render() {
    const tabla = document.getElementById("chk-tabla");
    if (!tabla) return;
    const personas = Object.entries(participantesCache);

    let html = `<tr><th style="text-align:left;padding:6px;">Ítem</th>${personas.map(([, p]) => `<th style="padding:6px;font-size:12px;">${esc(p.nombre)}</th>`).join("")}<th></th></tr>`;

    const items = Object.entries(itemsCache).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
    if (items.length === 0) {
      html += `<tr><td colspan="${personas.length + 2}" style="padding:12px;color:var(--color-texto-suave);text-align:center;">Sin ítems todavía.</td></tr>`;
    } else {
      items.forEach(([id, item]) => {
        html += `<tr style="border-top:1px solid var(--color-borde);">
          <td style="padding:6px;">${esc(item.nombre)}</td>
          ${personas.map(([userId]) => `
            <td style="text-align:center;padding:6px;">
              <input type="checkbox" data-item="${esc(id)}" data-persona="${esc(userId)}" ${item.porPersona && item.porPersona[userId] ? "checked" : ""}>
            </td>`).join("")}
          <td style="text-align:center;"><button class="texto" data-borrar="${esc(id)}">✕</button></td>
        </tr>`;
      });
    }
    tabla.innerHTML = html;

    tabla.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener("change", () => {
        actualizar(refChecklist.child(chk.dataset.item).child("porPersona"), { [chk.dataset.persona]: chk.checked });
      });
    });
    tabla.querySelectorAll("[data-borrar]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (confirm("¿Quitar este ítem del checklist?")) eliminar(refChecklist.child(btn.dataset.borrar));
      });
    });
  }

  document.getElementById("chk-btn-agregar").addEventListener("click", async () => {
    const campo = document.getElementById("chk-nuevo-item");
    const nombre = campo.value.trim();
    if (!nombre) return;
    await agregar(refChecklist, { nombre, porPersona: {} });
    campo.value = "";
  });
  document.getElementById("chk-nuevo-item").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("chk-btn-agregar").click();
  });

  const solicitarRender = programarRender(render);
  const cancelarParticipantes = escuchar(refParticipantes, v => {
    participantesCache = Object.keys(v).length ? v : participantesCache;
    solicitarRender();
  });
  const cancelarChecklist = escuchar(refChecklist, v => { itemsCache = v; solicitarRender(); });

  return () => { cancelarParticipantes(); cancelarChecklist(); };
}
