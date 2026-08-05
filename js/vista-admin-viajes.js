// Lógica de index.html: login + selector/administración de viajes.

const pantallaLogin = document.getElementById("pantalla-login");
const pantallaViajes = document.getElementById("pantalla-viajes");

function generarClaveInvitacion() {
  return idCorto().toUpperCase();
}

async function mostrarPantallaViajes(sesion) {
  pantallaLogin.classList.add("oculto");
  pantallaViajes.classList.remove("oculto");
  document.getElementById("saludo").textContent = `Hola, ${sesion.nombre}`;

  const listaEl = document.getElementById("lista-viajes");
  const snapUsuario = await db.ref(`usuarios/${sesion.userId}`).get();
  const usuario = snapUsuario.val() || {};
  const idsViajes = Object.keys(usuario.viajesInvitado || {});

  if (idsViajes.length === 0) {
    limpiar(listaEl);
    const p = document.createElement("p");
    p.style.color = "var(--color-texto-suave)";
    p.textContent = "Sin viajes todavía.";
    listaEl.appendChild(p);
    return;
  }

  limpiar(listaEl);
  for (const tripId of idsViajes) {
    const snap = await db.ref(`viajes/${tripId}/info`).get();
    const info = snap.val();
    if (!info) continue;
    const fila = document.createElement("div");
    fila.className = "lista-item";
    fila.innerHTML = `
      <div>
        <strong>${esc(info.nombre)}</strong><br>
        <span style="font-size:12px;color:var(--color-texto-suave)">${esc(info.fechaInicio || "")} — ${esc(info.fechaFin || "")}</span>
      </div>
      <button class="secundario" data-trip="${esc(tripId)}">Abrir</button>
    `;
    fila.querySelector("button").addEventListener("click", () => {
      window.location.href = `viaje.html?trip=${encodeURIComponent(tripId)}`;
    });
    listaEl.appendChild(fila);
  }
}

const claveUnirseURL = new URLSearchParams(window.location.search).get("unirse");
if (claveUnirseURL) document.getElementById("aviso-invitacion").classList.remove("oculto");

// Une a la sesión al viaje con esa clave y navega directo a él (usado por la liga de invitación).
async function unirseYAbrir(sesion, clave) {
  const tripId = await unirseAViaje(sesion, clave);
  if (tripId) {
    window.location.href = `viaje.html?trip=${encodeURIComponent(tripId)}`;
  } else {
    document.getElementById("error-login").textContent = "La liga de invitación ya no es válida.";
    await mostrarPantallaViajes(sesion);
  }
  return tripId;
}

// Devuelve el tripId si la clave existe, o null (sin escribir nada) si no.
async function unirseAViaje(sesion, clave) {
  const snap = await db.ref("viajes").orderByChild("info/claveInvitacion").equalTo(clave.trim().toUpperCase()).get();
  if (!snap.exists()) return null;
  const [tripId] = Object.keys(snap.val());
  await db.ref(`viajes/${tripId}/participantes/${sesion.userId}`).set({ rol: "participante", nombre: sesion.nombre });
  await db.ref(`usuarios/${sesion.userId}/viajesInvitado/${tripId}`).set(true);
  return tripId;
}

document.getElementById("btn-entrar").addEventListener("click", async () => {
  const nombre = document.getElementById("campo-nombre").value;
  const contrasena = document.getElementById("campo-contrasena").value;
  const errorEl = document.getElementById("error-login");
  errorEl.textContent = "";
  try {
    const sesion = await iniciarSesion(nombre, contrasena);
    if (claveUnirseURL) {
      await unirseYAbrir(sesion, claveUnirseURL);
      return;
    }
    await mostrarPantallaViajes(sesion);
  } catch (e) {
    errorEl.textContent = e.message;
  }
});

document.getElementById("campo-contrasena").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btn-entrar").click();
});

document.getElementById("btn-salir").addEventListener("click", cerrarSesion);

document.getElementById("btn-crear-viaje").addEventListener("click", () => {
  const sesion = obtenerSesion();
  const { modal, cerrar } = abrirModal(`
    <h3>Crear viaje</h3>
    <form id="form-crear-viaje">
      <label for="cv-nombre">Nombre del viaje</label>
      <input id="cv-nombre" type="text" placeholder="Ej. NY/WA 2026" required autofocus>
      <div class="fila-botones">
        <button type="submit">Crear</button>
        <button type="button" class="secundario" id="cv-cancelar">Cancelar</button>
      </div>
    </form>
  `);
  modal.querySelector("#cv-cancelar").addEventListener("click", cerrar);
  modal.querySelector("#form-crear-viaje").addEventListener("submit", async e => {
    e.preventDefault();
    const nombreViaje = modal.querySelector("#cv-nombre").value.trim();
    if (!nombreViaje) return;

    const claveInvitacion = generarClaveInvitacion();
    const nuevaRef = db.ref("viajes").push();
    await nuevaRef.set({
      info: {
        nombre: nombreViaje,
        fechaInicio: "",
        fechaFin: "",
        zonaOrigen: "America/Mexico_City",
        claveInvitacion
      },
      participantes: { [sesion.userId]: { rol: "admin", nombre: sesion.nombre } }
    });
    await db.ref(`usuarios/${sesion.userId}/viajesInvitado/${nuevaRef.key}`).set(true);
    // El resto (fechas, zona horaria, ciudades…) se llena en la pestaña Generales del viaje.
    window.location.href = `viaje.html?trip=${encodeURIComponent(nuevaRef.key)}`;
  });
});

document.getElementById("btn-unirse-viaje").addEventListener("click", () => {
  const sesion = obtenerSesion();
  const { modal, cerrar } = abrirModal(`
    <h3>Unirme a un viaje</h3>
    <form id="form-unirse-viaje">
      <label for="uv-clave">Clave de invitación</label>
      <input id="uv-clave" type="text" placeholder="Ej. A4102MLC" required autofocus style="text-transform:uppercase;">
      <div class="error" id="uv-error"></div>
      <div class="fila-botones">
        <button type="submit">Unirme</button>
        <button type="button" class="secundario" id="uv-cancelar">Cancelar</button>
      </div>
    </form>
  `);
  modal.querySelector("#uv-cancelar").addEventListener("click", cerrar);
  modal.querySelector("#form-unirse-viaje").addEventListener("submit", async e => {
    e.preventDefault();
    const clave = modal.querySelector("#uv-clave").value.trim();
    if (!clave) return;
    const tripId = await unirseAViaje(sesion, clave);
    if (!tripId) {
      modal.querySelector("#uv-error").textContent = "No se encontró ningún viaje con esa clave.";
      return;
    }
    cerrar();
    await mostrarPantallaViajes(sesion);
  });
});

(async function inicio() {
  const sesion = obtenerSesion();
  if (!sesion) return;
  await asegurarAuthAnonima();
  if (claveUnirseURL) {
    await unirseYAbrir(sesion, claveUnirseURL);
    return;
  }
  await mostrarPantallaViajes(sesion);
})();
