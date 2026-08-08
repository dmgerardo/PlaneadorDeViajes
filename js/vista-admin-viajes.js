// Lógica de index.html: login + selector/administración de viajes.

const pantallaLogin = document.getElementById("pantalla-login");
const pantallaViajes = document.getElementById("pantalla-viajes");

function generarClaveInvitacion() {
  return idCorto().toUpperCase();
}

// opciones.autoRedirigirSiUnico: si la persona tiene exactamente un viaje,
// entra directo a él en vez de mostrar una pantalla de elección que no
// tiene caso con un solo viaje. Solo se activa al llegar aquí "de forma
// normal" (login recién hecho, o abrir la app con sesión ya iniciada) —
// NUNCA cuando viene de presionar "← Viajes" desde dentro de un viaje (ver
// vieneDeVolver más abajo), porque ese botón sirve justo para poder elegir
// otro viaje o crear uno nuevo, aunque solo tengas uno; auto-redirigir ahí
// dejaría el botón inservible. Tampoco se activa después de unirse a un
// viaje por clave o si falló ese intento, para no tapar el mensaje de error
// ni saltarte la lista justo cuando la persona está interactuando con ella.
async function mostrarPantallaViajes(sesion, opciones = {}) {
  const autoRedirigirSiUnico = !!opciones.autoRedirigirSiUnico;
  pantallaLogin.classList.add("oculto");
  pantallaViajes.classList.remove("oculto");
  document.getElementById("saludo").textContent = `Hola, ${sesion.nombre}`;

  const listaEl = document.getElementById("lista-viajes");
  const snapUsuario = await db.ref(`usuarios/${sesion.userId}`).get();
  const usuario = snapUsuario.val() || {};
  const idsViajes = Object.keys(usuario.viajesInvitado || {});

  if (autoRedirigirSiUnico && idsViajes.length === 1) {
    window.location.href = `viaje.html?trip=${encodeURIComponent(idsViajes[0])}`;
    return;
  }

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
    fila.className = "lista-item lista-item-clic";
    fila.innerHTML = `
      <div>
        <strong>${esc(info.nombre)}</strong><br>
        <span style="font-size:12px;color:var(--color-texto-suave)">${esc(info.fechaInicio || "")} — ${esc(info.fechaFin || "")}</span>
      </div>
      <span class="lista-item-chevron">${icono("chevron-right", 18)}</span>
    `;
    fila.addEventListener("click", () => {
      window.location.href = `viaje.html?trip=${encodeURIComponent(tripId)}`;
    });
    listaEl.appendChild(fila);
  }
}

const claveUnirseURL = new URLSearchParams(window.location.search).get("unirse");
if (claveUnirseURL) document.getElementById("aviso-invitacion").classList.remove("oculto");

// viaje.html manda este parámetro al presionar "← Viajes" — ver
// autoRedirigirSiUnico en mostrarPantallaViajes.
const vieneDeVolver = new URLSearchParams(window.location.search).get("volver") === "1";

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

// Antes de dar de alta un nombre que no existe, confirmamos con la persona
// para no crear una cuenta duplicada por un simple typo en el nombre.
function confirmarCrearCuenta(nombre) {
  return new Promise(resolve => {
    const { modal, cerrar } = abrirModal(`
      <h3>¿Crear cuenta nueva?</h3>
      <p style="font-size:13px;color:var(--color-texto-suave)">
        No encontramos ninguna cuenta con el nombre "${esc(nombre)}". Si ya tienes cuenta,
        cancela y revisa cómo escribiste tu nombre la primera vez.
      </p>
      <div class="fila-botones">
        <button type="button" id="cc-crear">Sí, crear cuenta "${esc(nombre)}"</button>
        <button type="button" class="secundario" id="cc-cancelar">Cancelar</button>
      </div>
    `);
    modal.querySelector("#cc-crear").addEventListener("click", () => { cerrar(); resolve(true); });
    modal.querySelector("#cc-cancelar").addEventListener("click", () => { cerrar(); resolve(false); });
  });
}

document.getElementById("btn-entrar").addEventListener("click", async () => {
  const nombre = document.getElementById("campo-nombre").value;
  const contrasena = document.getElementById("campo-contrasena").value;
  const errorEl = document.getElementById("error-login");
  errorEl.textContent = "";
  if (!nombre.trim() || !contrasena) {
    errorEl.textContent = "Escribe tu nombre y tu contraseña.";
    return;
  }
  try {
    await asegurarAuthAnonima();
    if (!(await existeCuenta(nombre))) {
      const confirmado = await confirmarCrearCuenta(nombre.trim());
      if (!confirmado) return;
    }
    const sesion = await iniciarSesion(nombre, contrasena);
    if (claveUnirseURL) {
      await unirseYAbrir(sesion, claveUnirseURL);
      return;
    }
    await mostrarPantallaViajes(sesion, { autoRedirigirSiUnico: !vieneDeVolver });
  } catch (e) {
    errorEl.textContent = e.message;
  }
});

document.getElementById("btn-mi-contrasena").innerHTML = iconoTexto("key", "Contraseña", 15);
document.getElementById("btn-mi-contrasena").addEventListener("click", () => {
  abrirModalCambiarContrasena(obtenerSesion());
});

document.getElementById("campo-contrasena").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btn-entrar").click();
});

document.getElementById("btn-salir").addEventListener("click", cerrarSesion);

document.getElementById("btn-unirse-viaje").innerHTML = icono("link", 18);
document.getElementById("btn-crear-viaje").innerHTML = icono("plus", 20);

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
    // El resto (fechas, zona horaria, ciudades…) se llena en las pestañas Info/Ciudades del viaje.
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
  await mostrarPantallaViajes(sesion, { autoRedirigirSiUnico: !vieneDeVolver });
})();
