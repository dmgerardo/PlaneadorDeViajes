// Autenticación por nombre + contraseña, con identidad estable entre dispositivos.
// El uid anónimo de Firebase solo sirve para cumplir "auth != null" en las reglas;
// la identidad real del usuario vive en identidades/{claveNombre} → userId.

const SESION_KEY = "planeador_sesion";

function normalizarClave(nombre) {
  return nombre.trim().toLowerCase().replace(/\s+/g, "_");
}

async function hashTexto(texto) {
  const datos = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function obtenerSesion() {
  const crudo = localStorage.getItem(SESION_KEY);
  return crudo ? JSON.parse(crudo) : null;
}

function guardarSesion(sesion) {
  localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
}

function cerrarSesion() {
  localStorage.removeItem(SESION_KEY);
  window.location.href = "index.html";
}

// Asegura que haya un usuario anónimo de Firebase activo (requerido por las reglas).
function asegurarAuthAnonima() {
  return new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged(user => {
      if (user) { resolve(user); return; }
      firebase.auth().signInAnonymously().catch(reject);
    });
  });
}

// Intenta iniciar sesión; si el nombre no existe, lo crea (alta implícita).
// Devuelve { userId, nombre } o lanza Error con mensaje para mostrar al usuario.
async function iniciarSesion(nombre, contrasena) {
  if (!nombre.trim() || !contrasena) {
    throw new Error("Escribe tu nombre y tu contraseña.");
  }
  await asegurarAuthAnonima();

  const clave = normalizarClave(nombre);
  const passwordHash = await hashTexto(contrasena);

  const snapIdentidad = await db.ref(`identidades/${clave}`).get();

  if (!snapIdentidad.exists()) {
    // Usuario nuevo.
    const userId = await agregar(db.ref("usuarios"), { nombre: nombre.trim(), passwordHash });
    await db.ref(`identidades/${clave}`).set(userId);
    const sesion = { userId, nombre: nombre.trim() };
    guardarSesion(sesion);
    return sesion;
  }

  const userId = snapIdentidad.val();
  const snapUsuario = await db.ref(`usuarios/${userId}`).get();
  const usuario = snapUsuario.val();

  if (!usuario || usuario.passwordHash !== passwordHash) {
    throw new Error("Contraseña incorrecta.");
  }

  const sesion = { userId, nombre: usuario.nombre };
  guardarSesion(sesion);
  return sesion;
}

// Para páginas que requieren sesión: redirige a login si no hay sesión guardada.
async function requerirSesion() {
  const sesion = obtenerSesion();
  if (!sesion) {
    window.location.href = "index.html";
    return null;
  }
  await asegurarAuthAnonima();
  return sesion;
}

// ¿Ya existe una cuenta con este nombre? Se usa antes de iniciar sesión para
// avisar si se está a punto de crear una cuenta nueva por error (typo en el
// nombre), en vez de dar de alta en silencio.
async function existeCuenta(nombre) {
  const clave = normalizarClave(nombre);
  const snap = await db.ref(`identidades/${clave}`).get();
  return snap.exists();
}

// Cambiar la propia contraseña, verificando primero la actual.
async function cambiarContrasenaPropia(userId, actual, nueva) {
  const snap = await db.ref(`usuarios/${userId}`).get();
  const usuario = snap.val();
  const hashActual = await hashTexto(actual);
  if (!usuario || usuario.passwordHash !== hashActual) {
    throw new Error("Tu contraseña actual no es correcta.");
  }
  await actualizar(db.ref(`usuarios/${userId}`), { passwordHash: await hashTexto(nueva) });
}

// Restablecer la contraseña de otro participante (solo lo ofrece la UI a un
// admin del viaje) — no requiere conocer la contraseña anterior, porque es
// justo el caso de "la olvidé por completo y no hay email para recuperarla".
async function restablecerContrasena(userId, nueva) {
  await actualizar(db.ref(`usuarios/${userId}`), { passwordHash: await hashTexto(nueva) });
}
