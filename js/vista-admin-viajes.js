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

document.getElementById("btn-entrar").addEventListener("click", async () => {
  const nombre = document.getElementById("campo-nombre").value;
  const contrasena = document.getElementById("campo-contrasena").value;
  const errorEl = document.getElementById("error-login");
  errorEl.textContent = "";
  try {
    const sesion = await iniciarSesion(nombre, contrasena);
    await mostrarPantallaViajes(sesion);
  } catch (e) {
    errorEl.textContent = e.message;
  }
});

document.getElementById("campo-contrasena").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btn-entrar").click();
});

document.getElementById("btn-salir").addEventListener("click", cerrarSesion);

document.getElementById("btn-crear-viaje").addEventListener("click", async () => {
  const sesion = obtenerSesion();
  const nombreViaje = prompt("Nombre del viaje:");
  if (!nombreViaje || !nombreViaje.trim()) return;
  const fechaInicio = prompt("Fecha de inicio (AAAA-MM-DD):", "");
  const fechaFin = prompt("Fecha de fin (AAAA-MM-DD):", "");
  const zonaOrigen = prompt("Zona horaria de origen (ej. America/Mexico_City):", "America/Mexico_City");

  const claveInvitacion = generarClaveInvitacion();
  const nuevaRef = db.ref("viajes").push();
  await nuevaRef.set({
    info: {
      nombre: nombreViaje.trim(),
      fechaInicio: fechaInicio || "",
      fechaFin: fechaFin || "",
      zonaOrigen: zonaOrigen || "America/Mexico_City",
      claveInvitacion
    },
    participantes: { [sesion.userId]: { rol: "admin", nombre: sesion.nombre } }
  });
  await db.ref(`usuarios/${sesion.userId}/viajesInvitado/${nuevaRef.key}`).set(true);
  alert(`Viaje creado. Clave de invitación: ${claveInvitacion}`);
  await mostrarPantallaViajes(sesion);
});

document.getElementById("btn-unirse-viaje").addEventListener("click", async () => {
  const sesion = obtenerSesion();
  const clave = prompt("Clave de invitación del viaje:");
  if (!clave || !clave.trim()) return;

  const snap = await db.ref("viajes").orderByChild("info/claveInvitacion").equalTo(clave.trim().toUpperCase()).get();
  if (!snap.exists()) {
    alert("No se encontró ningún viaje con esa clave.");
    return;
  }
  const [tripId] = Object.keys(snap.val());
  await db.ref(`viajes/${tripId}/participantes/${sesion.userId}`).set({ rol: "participante", nombre: sesion.nombre });
  await db.ref(`usuarios/${sesion.userId}/viajesInvitado/${tripId}`).set(true);
  await mostrarPantallaViajes(sesion);
});

(async function inicio() {
  const sesion = obtenerSesion();
  if (sesion) {
    await asegurarAuthAnonima();
    await mostrarPantallaViajes(sesion);
  }
})();
