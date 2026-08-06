// Helpers de acceso a Firebase Realtime Database.
// Cada vista debe escuchar solo el nodo que necesita, nunca el viaje completo.

function refViaje(tripId) {
  return db.ref(`viajes/${tripId}`);
}

function refNodo(tripId, ...segmentos) {
  return db.ref(`viajes/${tripId}/${segmentos.join("/")}`);
}

// Caché de solo lectura para modo offline: guarda en localStorage la última
// copia conocida de cada nodo, por su URL completa (ref.toString() ya
// incluye la ruta). Si al montar una vista no hay señal, no hay nada que
// esperar de Firebase — se pinta de inmediato con esta copia. En cuanto
// Firebase sí entrega datos frescos, se vuelve a pintar y se actualiza el
// caché. No cachea escrituras offline: sigue siendo solo lectura.
function claveCache(ref) {
  return `planeador_cache::${ref.toString()}`;
}
function leerCache(ref) {
  try {
    const crudo = localStorage.getItem(claveCache(ref));
    return crudo === null ? undefined : JSON.parse(crudo);
  } catch (e) { return undefined; }
}
function guardarCache(ref, valor) {
  try { localStorage.setItem(claveCache(ref), JSON.stringify(valor)); }
  catch (e) { /* localStorage lleno o bloqueado: no es crítico, se ignora */ }
}

// Suscribe un listener y devuelve una función para cancelarlo (usar en cleanup de vista).
function escuchar(ref, callback) {
  const cacheado = leerCache(ref);
  if (cacheado !== undefined) callback(cacheado);
  const manejador = ref.on("value", snap => {
    const valor = snap.val() || {};
    guardarCache(ref, valor);
    callback(valor);
  });
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
