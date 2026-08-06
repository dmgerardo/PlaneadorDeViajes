// Vista "Checklist": lista de empaque compartida por el viaje.
// Cada persona tiene su propio checkbox de hecho/no hecho por ítem.
// Los ítems se pueden reordenar arrastrando desde la manija ⠿⠿.

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
      <div class="fila-botones">
        <button class="secundario" id="chk-btn-varios">+ Agregar varios</button>
        <button class="secundario" id="chk-btn-importar">📋 Importar de otro viaje</button>
      </div>
    </div>
  `;

  const refChecklist = refNodo(tripId, "checklist");
  const refParticipantes = refNodo(tripId, "participantes");

  let participantesCache = { [sesion.userId]: { nombre: sesion.nombre } };
  let itemsCache = {};

  function habilitarArrastreFila(tr, id, tabla) {
    const handle = tr.querySelector(".chk-handle");
    let arrastrando = false;

    handle.addEventListener("pointerdown", e => {
      arrastrando = true;
      handle.setPointerCapture(e.pointerId);
      tr.style.opacity = "0.5";
    });
    handle.addEventListener("pointermove", e => {
      if (!arrastrando) return;
      const filas = Array.from(tabla.querySelectorAll("tr[data-id]")).filter(f => f !== tr);
      const y = e.clientY;
      let destino = null;
      for (const fila of filas) {
        const rect = fila.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) { destino = fila; break; }
      }
      if (destino) tabla.insertBefore(tr, destino);
      else tabla.appendChild(tr);
    });
    handle.addEventListener("pointerup", async () => {
      if (!arrastrando) return;
      arrastrando = false;
      tr.style.opacity = "";
      const filasFinal = Array.from(tabla.querySelectorAll("tr[data-id]"));
      const mapaCompleto = {};
      filasFinal.forEach((fila, index) => {
        mapaCompleto[`viajes/${tripId}/checklist/${fila.dataset.id}/orden`] = index;
      });
      await actualizarMultiple(mapaCompleto);
    });
  }

  function render() {
    const tabla = document.getElementById("chk-tabla");
    if (!tabla) return;
    limpiar(tabla);
    const personas = Object.entries(participantesCache);

    const filaEncabezado = document.createElement("tr");
    filaEncabezado.innerHTML = `
      <th style="width:28px;"></th>
      <th style="text-align:left;padding:6px;">Ítem</th>
      ${personas.map(([, p]) => `<th style="padding:6px;font-size:12px;">${esc(p.nombre)}</th>`).join("")}
      <th></th>
    `;
    tabla.appendChild(filaEncabezado);

    const items = Object.entries(itemsCache).sort((a, b) => (a[1].orden ?? 9999) - (b[1].orden ?? 9999));
    if (items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="${personas.length + 3}" style="padding:12px;color:var(--color-texto-suave);text-align:center;">Sin ítems todavía.</td>`;
      tabla.appendChild(tr);
      return;
    }

    items.forEach(([id, item]) => {
      const tr = document.createElement("tr");
      tr.dataset.id = id;
      tr.style.borderTop = "1px solid var(--color-borde)";
      tr.innerHTML = `
        <td class="chk-handle" style="padding:6px;text-align:center;cursor:grab;color:var(--color-texto-suave);touch-action:none;user-select:none;">⠿⠿</td>
        <td style="padding:6px;">${esc(item.nombre)}</td>
        ${personas.map(([userId]) => `
          <td style="text-align:center;padding:6px;">
            <input type="checkbox" data-item="${esc(id)}" data-persona="${esc(userId)}" ${item.porPersona && item.porPersona[userId] ? "checked" : ""}>
          </td>`).join("")}
        <td style="text-align:center;"><button class="texto" data-borrar="${esc(id)}">✕</button></td>
      `;
      tabla.appendChild(tr);

      tr.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener("change", () => {
          actualizar(refChecklist.child(chk.dataset.item).child("porPersona"), { [chk.dataset.persona]: chk.checked });
        });
      });
      tr.querySelector("[data-borrar]").addEventListener("click", () => {
        if (confirm("¿Quitar este ítem del checklist?")) eliminar(refChecklist.child(id));
      });

      habilitarArrastreFila(tr, id, tabla);
    });
  }

  async function agregarItem(nombre, ordenBase) {
    await agregar(refChecklist, { nombre, porPersona: {}, orden: ordenBase });
  }

  document.getElementById("chk-btn-agregar").addEventListener("click", async () => {
    const campo = document.getElementById("chk-nuevo-item");
    const nombre = campo.value.trim();
    if (!nombre) return;
    await agregarItem(nombre, Object.keys(itemsCache).length);
    campo.value = "";
  });
  document.getElementById("chk-nuevo-item").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("chk-btn-agregar").click();
  });

  document.getElementById("chk-btn-varios").addEventListener("click", () => {
    const { modal, cerrar } = abrirModal(`
      <h3>Agregar varios ítems</h3>
      <form id="form-varios">
        <label for="chk-varios-texto">Ítems separados por comas</label>
        <textarea id="chk-varios-texto" placeholder="Ej. Pasaportes, Cargadores, Botas térmicas" autofocus></textarea>
        <div class="fila-botones">
          <button type="submit">Agregar</button>
          <button type="button" class="secundario" id="cv-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#cv-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-varios").addEventListener("submit", async e => {
      e.preventDefault();
      const texto = modal.querySelector("#chk-varios-texto").value;
      const nombres = texto.split(",").map(s => s.trim()).filter(Boolean);
      if (nombres.length === 0) return;
      let siguienteOrden = Object.keys(itemsCache).length;
      for (const nombre of nombres) {
        await agregarItem(nombre, siguienteOrden++);
      }
      cerrar();
    });
  });

  document.getElementById("chk-btn-importar").addEventListener("click", async () => {
    const snapUsuario = await db.ref(`usuarios/${sesion.userId}`).get();
    const usuario = snapUsuario.val() || {};
    const idsViajes = Object.keys(usuario.viajesInvitado || {}).filter(id => id !== tripId);
    if (idsViajes.length === 0) {
      alert("No tienes otros viajes de dónde importar el checklist.");
      return;
    }
    const viajesConNombre = await Promise.all(idsViajes.map(async id => {
      const snap = await db.ref(`viajes/${id}/info`).get();
      const info = snap.val();
      return { id, nombre: (info && info.nombre) || "(sin nombre)" };
    }));

    const { modal, cerrar } = abrirModal(`
      <h3>Importar checklist de otro viaje</h3>
      <form id="form-importar-chk">
        <label for="ic-viaje">Viaje</label>
        <select id="ic-viaje" required>
          ${viajesConNombre.map(v => `<option value="${esc(v.id)}">${esc(v.nombre)}</option>`).join("")}
        </select>
        <p style="font-size:12px;color:var(--color-texto-suave)">Se copian los nombres de los ítems; el estado de hecho/no hecho empieza en blanco.</p>
        <div class="fila-botones">
          <button type="submit">Importar</button>
          <button type="button" class="secundario" id="ic-cancelar">Cancelar</button>
        </div>
      </form>
    `);
    modal.querySelector("#ic-cancelar").addEventListener("click", cerrar);
    modal.querySelector("#form-importar-chk").addEventListener("submit", async e => {
      e.preventDefault();
      const otroTripId = modal.querySelector("#ic-viaje").value;
      const snap = await db.ref(`viajes/${otroTripId}/checklist`).get();
      const itemsOtro = Object.values(snap.val() || {});
      let siguienteOrden = Object.keys(itemsCache).length;
      for (const item of itemsOtro) {
        await agregarItem(item.nombre, siguienteOrden++);
      }
      cerrar();
    });
  });

  const solicitarRender = programarRender(render);
  const cancelarParticipantes = escuchar(refParticipantes, v => {
    participantesCache = Object.keys(v).length ? v : participantesCache;
    solicitarRender();
  });
  const cancelarChecklist = escuchar(refChecklist, v => { itemsCache = v; solicitarRender(); });

  return () => { cancelarParticipantes(); cancelarChecklist(); };
}
