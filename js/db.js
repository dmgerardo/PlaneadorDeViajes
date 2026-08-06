// Helpers de acceso a Firebase Realtime Database.
// Cada vista debe escuchar solo el nodo que necesita, nunca el viaje completo.

function refViaje(tripId) {
  return db.ref(`viajes/${tripId}`);
}

function refNodo(tripId, ...segmentos) {
  return db.ref(`viajes/${tripId}/${segmentos.join("/")}`);
}

// Suscribe un listener y devuelve una función para cancelarlo (usar en cleanup de vista).
function escuchar(ref, callback) {
  const manejador = ref.on("value", snap => callback(snap.val() || {}));
  return () => ref.off("value", manejador);
}

async function agregar(ref, datos) {
  const nuevaRef = ref.push();
  await nuevaRef.set(datos);
  mostrarToast("Agregado ✓");
  return nuevaRef.key;
}

async function actualizar(ref, datos) {
  await ref.update(datos);
  mostrarToast("Guardado ✓");
}

async function eliminar(ref) {
  await ref.remove();
  mostrarToast("Eliminado");
}

// Agrupa actualizaciones a varios nodos en una sola escritura atómica.
async function actualizarMultiple(mapaRutaValor) {
  await db.ref().update(mapaRutaValor);
  mostrarToast("Guardado ✓");
}

// Coalesce de renders: agrupa múltiples "value" seguidos (p.ej. al cargar datos
// iniciales de varios nodos) en un solo repintado por frame.
function programarRender(callback) {
  let pendiente = false;
  return function solicitarRender(...args) {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      callback(...args);
    });
  };
}
