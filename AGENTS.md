# AGENTS.md — Guía técnica para agentes de IA

Contexto operativo completo del repo. Léelo antes de tocar código.

## Arquitectura

- Sin build ni framework: HTML + CSS + JS vanilla (ES6+), cargado directo por `<script>`.
- **Iconos**: `js/iconos.js` — SVG de Lucide (stroke-width 2.75) embebidos inline como
  strings, sin CDN (para que sigan disponibles offline). `icono(nombre, tamano)` devuelve
  el `<svg>`; `iconoTexto(nombre, texto, tamano)` es el atajo para "icono + etiqueta" (usa
  `esc()` internamente, así que `texto` no debe venir ya escapado). Agregar un icono nuevo
  = copiar su `<path>` de `unpkg.com/lucide-static@latest/icons/<nombre>.svg` al mapa
  `ICONOS_LUCIDE`. Nunca emoji como icono funcional (botones/chips/bloques) — el ✈️ del
  `<h1>` de `index.html` es la única excepción, es decorativo.
- Backend: Firebase Realtime Database (SDK `compat` por CDN) + Authentication anónima.
  No hay servidor propio ni Cloud Functions.
- Hosting: **Firebase Hosting**, deploy automático en cada push a `main` vía GitHub Actions
  (`.github/workflows/firebase-hosting-merge.yml`, acción `FirebaseExtended/action-hosting-deploy`).
  Config del sitio en `firebase.json`/`.firebaserc` (mismo proyecto Firebase que la base de
  datos: `planeadordeviajes`). El secreto `FIREBASE_SERVICE_ACCOUNT_PLANEADORDEVIAJES` vive
  en GitHub → Settings → Secrets, no en el repo. Se migró desde GitHub Pages en v18 (mismo
  proveedor que ya usábamos para Auth/DB, y no depende del pipeline de Pages).
- Cada pantalla (`index.html`, `viaje.html`) carga los mismos scripts base
  (`firebase-config.js`, `render-utils.js`, `db.js`, `auth.js`) y luego los scripts de vista
  que necesita.
- `viaje.html` es un shell con **dos niveles de navegación**: un switcher de grupo
  ("En el viaje" / "Planeación", `#grupo-switch`) y, debajo, los tabs del grupo activo
  (`#tabs-viaje`), ambos dentro de `#nav-viaje` (sticky). El mapa `grupos` en el script
  inline de `viaje.html` define qué vistas van en cada grupo, y expone `cambiarVista(id)`
  como función global — cualquier `vista-*.js` puede llamarla para navegar directo a otra
  pestaña (ej. el checklist de progreso en `vista-info.js`, o el botón "Ir a Ruta" del
  estado vacío de "Lugares sin agendar" en `vista-calendario.js`). Cada vista (`js/vista-*.js`)
  expone una función `montarVistaX(contenedor, tripId, sesion)` que:
  1. Pinta su HTML en `contenedor`.
  2. Se suscribe a los nodos de Firebase que necesita con `escuchar()` (de `db.js`).
  3. Devuelve una función de limpieza que cancela esos listeners — `viaje.html` la llama
     al cambiar de tab. **Nunca dejes un listener de Firebase sin su función de limpieza.**
- Tabs de **"En el viaje"** (uso diario, durante el viaje): Agenda (fusiona Agenda y
  Calendario, ver abajo) y Checklist. Tabs de **"Planeación"** (captura mayormente antes
  de salir): Info, Ciudades, Ruta, Logística, Lugares.
- `vista-calendario.js` define `montarVistaCalendario(contenedor, tripId, sesion,
  { modoAgenda })` (cuadrícula completa o un solo día) y, al final del archivo,
  `montarVistaAgendaCalendario(contenedor, tripId, sesion)` — el wrapper que fusiona ambas
  en una sola pestaña con un switch "Día/Calendario" (`.segmentado`), y es lo que se monta
  en el tab "Agenda". También define globals (`HORA_PX`, `COLORES_CIUDAD`, `colorCss`,
  `listaDeDias`) que `vista-ruta.js` reutiliza — por eso `vista-calendario.js` debe
  cargarse antes que `vista-ruta.js` en `viaje.html`.
- **No confundir `vista-ciudades.js` con `vista-ruta.js`**: `vista-ciudades.js` (tab
  "Ciudades") es el catálogo de ciudades del viaje (nombre/zona horaria/coordenadas);
  `vista-ruta.js` (tab "Ruta") asigna cuál de esas ciudades corresponde a cada día
  (`ciudadPorDia`) — antes ambas cosas coexistían bajo el nombre "Ciudades" y era
  ambiguo, se separaron a propósito en la reestructura de v18.
- **`js/catalogo-ciudades.js`**: catálogo estático (~310 ciudades, ~65 países más
  visitados) para autocompletar el campo "Nombre" al agregar una ciudad
  (`vista-ciudades.js`) — `buscarEnCatalogoCiudades(texto)` filtra por nombre/país sin
  acentos. Es solo un atajo: al elegir una sugerencia se rellenan zona horaria y
  coordenadas, pero siguen siendo campos editables normales, y el usuario puede
  seguir escribiendo cualquier ciudad que no esté en el catálogo sin fricción extra.
  No lo confundas con `ZONAS_HORARIAS` (`render-utils.js`), que es la lista de husos
  horarios de `Intl`, no de ciudades.
- `vista-logistica.js` (tab "Logística") fusiona lo que antes eran las secciones
  "Traslados" y "Hospedajes" de la vieja pestaña "Generales" (ya no existe como tal —
  ver `vista-info.js`, `vista-ciudades.js`, `vista-ruta.js`, `vista-logistica.js`).

## Modelo de datos (Firebase Realtime Database)

```
usuarios/{userId}: { nombre, passwordHash, viajesInvitado: { tripId: true } }
identidades/{claveNombre}: userId

viajes/{tripId}:
  info: { nombre, fechaInicio, fechaFin, zonaOrigen, ciudadOrigen, claveInvitacion }
  // ciudadOrigen: nombre libre de la ciudad donde empieza/termina el viaje (no es un
  // id de "ciudades" — es solo texto). Aparece como opción "(origen)" al elegir
  // origen/destino de un traslado, junto con los nombres de "ciudades".
  ciudades/{cityId}: { nombre, zonaHoraria, orden, lat, lng }
  // lat/lng son opcionales (null si no se capturaron) — se usan solo para calcular
  // amanecer/atardecer real y sombrear la noche en Calendario/Agenda
  // (vista-calendario.js: calcularSolUTC/calcularFranjaNoche). Sin coordenadas, esa
  // vista usa un rango fijo de referencia 20:00–06:00.
  lugares/{lugarId}: { nombre, ciudadId, categoria, liga_mapa, ligas: [...], aireLibre, notas,
                        costo, costoTipo, moneda }
  itinerario/{bloqueId}: { tipo: "lugar", refId, ciudadId, inicioUTC, finUTC, fijado }
  ciudadPorDia/{fecha}: ciudadId  // asignación explícita del timeline; fecha = "AAAA-MM-DD"
  traslados/{trasladoId}: { tipo, origen, destino, inicioUTC, finUTC, zonaDestino, confirmacion,
                             escalas, costo, costoTipo, moneda }
  // escalas: string[] opcional, nombres de ciudad en orden (mismo universo que
  // origen/destino — ver opcionesCiudadesTraslado()). Es solo informativo: no
  // tiene horas propias, el traslado sigue siendo un único bloque de
  // inicioUTC a finUTC en Calendario/Agenda.
  hospedajes/{hospedajeId}: { nombre, ciudad, checkinUTC, checkoutUTC, noches, claveReservacion,
                               costo, costoTipo, moneda }
  // origen/destino/ciudad son nombres (texto) elegidos de la lista combinada
  // info.ciudadOrigen + nombres de "ciudades" — ver opcionesCiudadesTraslado() en
  // vista-generales.js. inicioUTC/checkinUTC SIEMPRE se calculan con
  // zonaDeNombreCiudad(nombre), es decir la hora LOCAL de esa ciudad concreta —
  // nunca con info.zonaOrigen a menos que esa ciudad sea justo la de origen. No
  // reintroduzcas "zona = infoCache.zonaOrigen" como default para estas horas.
  // costo/costoTipo/moneda (traslados, hospedajes, lugares): costo es opcional
  // (null si no se ha capturado — así el reporte no lo cuenta como $0).
  // costoTipo es "total" (cubre a todos los viajeros) o "porPersona"; moneda es
  // uno de MONEDAS_SOPORTADAS ("MXN","USD","EUR","JPY","CAD" — render-utils.js).
  // Compartido entre los tres formularios vía camposCosto()/leerCamposCosto()
  // (render-utils.js) — no dupliques esos campos a mano en una vista nueva.
  monedas/{codigoISO}: { tipoCambioMXN }
  // Monedas que el admin agregó a este viaje (vista-info.js, tarjeta
  // "Monedas del viaje") — mismo patrón que la pestaña Ciudades: se
  // agregan/editan/quitan una por una (botón "+" + clic en la fila para
  // editar), NO es una lista fija con checkboxes de activar/desactivar. MXN
  // es la moneda base: siempre disponible, nunca vive en este nodo, no
  // tiene tipoCambioMXN propio (es implícitamente 1). Un viaje que nunca
  // tocó esa tarjeta solo ofrece MXN — ver monedasActivasDe() en
  // render-utils.js. El reporte de costos (pestaña Info, vista-info.js:
  // calcularReporteCostos) agrupa por moneda (multiplicando los
  // "porPersona" por el número de participantes) y además
  // arma un total consolidado en MXN usando tipoCambioMXN — las monedas sin
  // tasa capturada quedan fuera de ese consolidado, no se inventa un valor.
  checklist/{itemId}: { nombre, porPersona: { userId: bool }, orden, categoria }
  // categoria: "empaque" (antes de viajar) | "viaje" (durante el viaje) — sin categoria
  // se trata como "empaque" (ítems de antes de que existiera el campo). El orden es
  // independiente por categoría (ambas se ordenan/filtran por separado en la UI).
  participantes/{userId}: { rol: "admin" | "participante", nombre }
```

**Identidad estable ≠ uid anónimo de Firebase.** El uid anónimo solo existe para que
`auth != null` se cumpla en las reglas. La identidad real de la persona (con la que se
filtran sus viajes, se marca el checklist, etc.) es `sesion.userId`, resuelta en el login
vía `identidades/{claveNombre} → userId` (`js/auth.js`). No mezclar ambos conceptos.

**Contraseña**: `usuarios/{userId}/passwordHash` se puede cambiar de dos formas —
`cambiarContrasenaPropia(userId, actual, nueva)` (verifica la actual) desde el botón
"Contraseña"/"Cambiar mi contraseña" (index.html y tab Info), o
`restablecerContrasena(userId, nueva)` (sin verificar, solo lo ofrece la UI a un admin
del viaje sobre otro participante, en la tab Info) — no existe recuperación por email
porque no hay backend propio ni dirección de correo capturada. La pantalla de login
(`index.html`) tiene un texto fijo bajo "Entrar" que apunta a esto ("Pide a un admin del
viaje que te la restablezca") — es solo texto informativo, no dispara ningún flujo por sí
mismo (no hay forma de saber quién es admin de qué viaje sin haber iniciado sesión).

## Invariantes y convenciones

- **Captura de datos siempre vía formulario en modal, nunca `prompt()`.** Usa
  `abrirModal(html)` (`render-utils.js`): recibe el HTML de un `<form>`, lo inserta en
  `.modal-fondo > .modal`, y devuelve `{ modal, cerrar }`. El propio `<form>` maneja su
  `submit` (con `e.preventDefault()`) y llama a `cerrar()` al terminar. Selects en vez de
  texto libre cuando el valor debe ser válido (p.ej. zona horaria: `opcionesZonaHoraria()`
  usa `Intl.supportedValuesOf("timeZone")`). `confirm()` nativo sigue siendo aceptable solo
  para confirmar una acción destructiva (borrar), no para capturar datos.
- **Agregar y editar comparten el mismo formulario.** El patrón es
  `abrirFormularioX(idExistente)`: si `idExistente` es `null` crea (título/botón "Agregar",
  `agregar()`); si trae un id, precarga los `value=` desde el cache local y usa
  `actualizar()` en vez de `agregar()`. No dupliques el HTML del formulario entre el botón
  "+ Agregar" y la fila de la lista — ambos deben llamar a la misma función.
- **Filas/tarjetas de lista sin botón "Editar" aparte**: la fila completa lleva la clase
  `lista-item-clic` (o `tarjeta lista-item-clic`) y un solo listener de `click` que abre
  `abrirFormularioX(id)` directamente — un botón "Editar" al lado sería redundante con
  poder tocar la fila. El botón "Eliminar" (`class="peligro"`) vive **dentro** de ese
  formulario, al final de `.fila-botones`, solo cuando `existente` — no en la fila de la
  lista. Si la fila tiene otros elementos clicables que no deben abrir edición (ligas
  externas en Lugares, por ejemplo), el listener debe hacer `if (e.target.closest("a"))
  return;` antes de abrir el formulario. Ver `vista-ciudades.js`, `vista-logistica.js`,
  `vista-lugares.js`.
- **`input[type="checkbox"|"radio"]` no debe llevar el estilo de pill genérico.** El
  selector `input, select, textarea` en `estilos.css` es solo para campos de texto; los
  checkboxes tienen su propia regla (18px, `appearance: auto`) — si un checkbox se ve como
  una barra en blanco sin marca, es porque volvió a caer bajo esa regla genérica.
- **Todo texto dinámico al DOM pasa por `esc()`** (`js/render-utils.js`) antes de insertarse
  vía `innerHTML`. Sin excepciones — es la única defensa anti-XSS del proyecto.
- **Fechas/horas se guardan siempre en UTC** (ISO 8601, sufijo `Z`) en Firebase. La
  conversión a hora local se hace solo al pintar, con `Intl.DateTimeFormat` /
  `formatoHora()` / `formatoFecha()` (`render-utils.js`). Para ir de "fecha+hora local" a
  UTC al guardar, usa `localAUTC()` — no construyas el ISO a mano sumando/restando horas,
  los offsets de DST varían por zona y fecha.
- **Modo offline de solo lectura**: `escuchar()` (`db.js`) guarda en `localStorage` la
  última copia de cada nodo que llegó de Firebase (clave = `ref.toString()`, la URL
  completa del nodo) y, al montar una vista, pinta esa copia de inmediato si existe —
  así no hay que esperar a Firebase para ver algo. Cuando Firebase sí entrega datos
  frescos, se repinta y se actualiza la copia. **No** cachea escrituras offline (sigue
  siendo solo lectura); `actualizarBannerConexion()` (`render-utils.js`) solo avisa que
  no hay señal, no bloquea los formularios. Además, `sw.js` (service worker, registrado
  desde `js/version.js`) cachea el "app shell" (HTML/CSS/JS/manifest + SDK de Firebase)
  para que la app abra sin conexión — sin esto, el navegador ni siquiera podría cargar
  `viaje.html` sin red aunque los datos ya estén en `localStorage`.
- **`js/app-version.js` es la única fuente de `APP_VERSION`** (separado de
  `js/version.js`, que sí usa `document`/`window`) porque `sw.js` también necesita ese
  valor vía `importScripts()`, y un service worker no tiene acceso al DOM.
  `scripts/bump-version.py` edita `js/app-version.js`, no `js/version.js`.
- **Toda escritura a Firebase pasa por `agregar()`/`actualizar()`/`eliminar()`/
  `actualizarMultiple()` de `db.js`**, nunca `ref.set()`/`ref.update()` directo desde una
  vista — esos helpers disparan `mostrarToast()` (`render-utils.js`) para dar confirmación
  visual de "Guardado ✓"/"Agregado ✓"/"Eliminado". Escribir directo con `ref.update()`
  (como se hacía antes en la vieja `vista-generales.js`) deja al usuario sin esa
  confirmación.
- **Un render por frame**: usa `programarRender()` (`db.js`) para envolver el callback de
  cualquier vista que escuche varios nodos — evita repintar N veces si Firebase entrega
  varios `value` seguidos.
- **No descargues el viaje completo si no hace falta**: cada vista escucha solo sus propios
  nodos (`refNodo(tripId, "lugares")`, etc.), nunca `refViaje(tripId)` completo, salvo que
  genuinamente necesite todo el árbol.
- **Español en toda la UI**, nombres de variables/funciones y comentarios.
- **Sin sobre-ingeniería**: no agregues frameworks, bundlers, ni abstracciones nuevas sin
  que el usuario lo pida explícitamente.
- **Versión de la app**: `js/version.js` define `APP_VERSION` y pinta cualquier elemento
  `.version-badge` (hay uno en cada página: `index.html`, `viaje.html`, `historial.html`).
  `scripts/bump-version.py` mantiene `APP_VERSION` sincronizado con el contador `?v=N` de
  cache-busting — nunca lo edites a mano, ni agregues una segunda fuente de verdad para la
  versión. **Cada commit debe llevar su tag `release-vNN`** (NN = el `APP_VERSION` resultante
  de ese commit) antes o inmediatamente después de crearlo, y hacer push del tag junto con la
  rama — es el punto de retorno documentado en el prompt base del proyecto.

## Seguridad — límites conocidos (documentar, no "arreglar" sin discutirlo)

Este proyecto usa **contraseñas verificadas del lado del cliente** (hash SHA-256 comparado
en el navegador) sobre una identidad de texto (nombre) en vez de autenticación real de
Firebase. Esto es una decisión consciente para mantener la app 100% estática sin backend
propio. Consecuencias:

- `database.rules.json` solo puede exigir `auth != null` (cualquier usuario anónimo
  autenticado), no "solo el dueño de este userId" ni "solo participantes de este viaje" —
  Firebase no tiene forma de verificar server-side que el uid anónimo corresponde a ese
  `userId` sin Cloud Functions o tokens personalizados (fuera de alcance).
- Cualquiera con acceso a las credenciales públicas de Firebase (no secretas por diseño)
  y capaz de generar un uid anónimo podría, en teoría, leer/escribir cualquier viaje.
  Es aceptable para uso recreativo entre personas de confianza; **no uses esta app para
  datos sensibles.**
- Si en el futuro se requiere seguridad real por viaje, la solución es migrar a Cloud
  Functions + Custom Auth Tokens (cambio arquitectónico grande, discutirlo con el usuario
  antes de implementarlo).

## Errores a evitar

- No mezcles el uid anónimo de Firebase (`firebase.auth().currentUser.uid`) con
  `sesion.userId` — son conceptos distintos, ver arriba.
- No olvides publicar `database.rules.json` a mano en la consola de Firebase cuando
  cambie — el repo no lo hace automáticamente.
- No agregues cantidades al checklist — es intencionalmente solo un checkbox
  hecho/no-hecho por persona (decisión confirmada con el usuario).
- El color de los bloques en la cuadrícula es **por ciudad**; la prioridad
  (deseable/importante/no_negociable) se indica con borde, no con color — no los mezcles.
- 🔒 en la cuadrícula = bloque con horario ya fijado (reservación real o fijado a mano);
  ❄️ = actividad al aire libre que requiere ropa de intemperie. No reasignes su significado.

## Ver también

- [CLAUDE.md](CLAUDE.md) — apuntador breve a este archivo.
- [README.md](README.md) — puesta en marcha para usuarios finales.
- [docs/diagrama-flujo.svg](docs/diagrama-flujo.svg) — diagrama de pantallas y flujo de datos.
