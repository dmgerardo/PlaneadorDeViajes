// Vista "Checklist": lista de empaque compartida por el viaje, más una
// segunda lista de pendientes propios del viaje (comprar Suica, reservar un
// restaurante, etc.) — mismo modelo de datos, con un campo "categoria" que
// las separa, y un switch arriba para alternar entre las dos.
// Cada persona tiene su propio checkbox de hecho/no hecho por ítem.
// Los ítems se pueden reordenar arrastrando desde la manija ⠿⠿ (el orden es
// independiente entre categorías).

const CATEGORIA_CHECKLIST_DEFAULT = "empaque";

async function montarVistaChecklist(contenedor, tripId, sesion) {
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>Checklist</h2>
      <div class="segmentado" id="chk-switch">
        <button type="button" data-cat="empaque">Antes de viajar</button>
        <button type="button" data-cat="viaje">Durante el viaje</button>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;" id="chk-tabla"></table>
      </div>
      <div class="fila-botones">
        <input id="chk-nuevo-item" type="text" placeholder="Nuevo ítem…" style="flex:1;">
        <button id="chk-btn-agregar">Agregar</button>
      </div>
      <div class="fila-botones">
        <button class="secundario" id="chk-btn-varios">+ Agregar varios</button>
        <button class="secundario" id="chk-btn-importar">${iconoTexto("clipboard-list", "Importar de otro viaje", 15)}</button>
      </div>
    </div>
  `;

  const refChecklist = refNodo(tripId, "checklist");
  const refParticipantes = refNodo(tripId, "participantes");

  let participantesCache = { [sesion.userId]: { nombre: sesion.nombre } };
  let itemsCache = {};
  let categoriaActual = CATEGORIA_CHECKLIST_DEFAULT;

  function categoriaDe(item) {
    return item.categoria || CATEGORIA_CHECKLIST_DEFAULT;
  }

  contenedor.querySelectorAll("#chk-switch button").forEach(btn => {
    btn.classList.toggle("activo", btn.dataset.cat === categoriaActual);
    btn.addEventListener("click", () => {
      if (btn.dataset.cat === categoriaActual) return;
      categoriaActual = btn.dataset.cat;
      contenedor.querySelectorAll("#chk-switch button").forEach(b => b.classList.toggle("activo", b.dataset.cat === categoriaActual));
      solicitarRender();
    });
  });

  function habilitarArrastreFila(tr, id, tabla) {
    const handle = tr.querySelector(".chk-handle");
    let arrastrando = false;

    // preventDefault() en pointerdown es lo que de verdad evita que el
    // navegador arranque su propio gesto (selección de texto al arrastrar
    // con mouse, o el menú/lupa de selección al mantener presionado en
    // móvil — eso era lo que hacía "se deshabilite" el renglón: el gesto
    // nativo tomaba el control antes de que nuestro drag empezara). El
    // pointer capture ya redirige los eventos siguientes al handle pase lo
    // que pase debajo del dedo/cursor, pero sin este preventDefault() el
    // navegador igual dispara su selección nativa desde el mousedown/
    // touchstart original. tabla.classList "arrastrando-fila" (ver
    // estilos.css) refuerza con user-select:none mientras dura el arrastre.
    handle.addEventListener("pointerdown", e => {
      e.preventDefault();
      arrastrando = true;
      handle.setPointerCapture(e.pointerId);
      tr.style.opacity = "0.5";
      tabla.classList.add("arrastrando-fila");
    });
    handle.addEventListener("pointermove", e => {
      if (!arrastrando) return;
      e.preventDefault();
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
    async function terminarArrastre() {
      if (!arrastrando) return;
      arrastrando = false;
      tr.style.opacity = "";
      tabla.classList.remove("arrastrando-fila");
      const filasFinal = Array.from(tabla.querySelectorAll("tr[data-id]"));
      const mapaCompleto = {};
      filasFinal.forEach((fila, index) => {
        mapaCompleto[`viajes/${tripId}/checklist/${fila.dataset.id}/orden`] = index;
      });
      await actualizarMultiple(mapaCompleto);
    }
    handle.addEventListener("pointerup", terminarArrastre);
    // Si el sistema interrumpe el gesto (p.ej. una notificación, o el
    // navegador decide que es un gesto de otro tipo a medio camino), sin
    // esto el renglón se quedaba a medias (opacidad 0.5, tabla bloqueada)
    // sin ningún pointerup que lo resolviera.
    handle.addEventListener("pointercancel", () => {
      arrastrando = false;
      tr.style.opacity = "";
      tabla.classList.remove("arrastrando-fila");
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

    const items = Object.entries(itemsCache)
      .filter(([, item]) => categoriaDe(item) === categoriaActual)
      .sort((a, b) => (a[1].orden ?? 9999) - (b[1].orden ?? 9999));
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
        <td class="chk-handle" style="padding:6px;text-align:center;color:var(--color-texto-suave);">⠿⠿</td>
        <td style="padding:6px;">${esc(item.nombre)}</td>
        ${personas.map(([userId]) => `
          <td style="text-align:center;padding:6px;">
            <input type="checkbox" data-item="${esc(id)}" data-persona="${esc(userId)}" ${item.porPersona && item.porPersona[userId] ? "checked" : ""}>
          </td>`).join("")}
        <td style="text-align:center;"><button class="texto" data-borrar="${esc(id)}">${icono("x", 15)}</button></td>
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

  function itemsEnCategoriaActual() {
    return Object.values(itemsCache).filter(item => categoriaDe(item) === categoriaActual).length;
  }

  async function agregarItem(nombre, ordenBase, categoria) {
    await agregar(refChecklist, { nombre, porPersona: {}, orden: ordenBase, categoria });
  }

  document.getElementById("chk-btn-agregar").addEventListener("click", async () => {
    const campo = document.getElementById("chk-nuevo-item");
    const nombre = campo.value.trim();
    if (!nombre) return;
    await agregarItem(nombre, itemsEnCategoriaActual(), categoriaActual);
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
      let siguienteOrden = itemsEnCategoriaActual();
      for (const nombre of nombres) {
        await agregarItem(nombre, siguienteOrden++, categoriaActual);
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
      let siguienteOrden = itemsEnCategoriaActual();
      for (const item of itemsOtro) {
        await agregarItem(item.nombre, siguienteOrden++, categoriaActual);
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
