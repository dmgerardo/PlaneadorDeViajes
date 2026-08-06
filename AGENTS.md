# AGENTS.md — Guía técnica para agentes de IA

Contexto operativo completo del repo. Léelo antes de tocar código.

## Arquitectura

- Sin build ni framework: HTML + CSS + JS vanilla (ES6+), cargado directo por `<script>`.
- Backend: Firebase Realtime Database (SDK `compat` por CDN) + Authentication anónima.
  No hay servidor propio ni Cloud Functions.
- Hosting: archivos estáticos (GitHub Pages u otro hosting estático).
- Cada pantalla (`index.html`, `viaje.html`) carga los mismos scripts base
  (`firebase-config.js`, `render-utils.js`, `db.js`, `auth.js`) y luego los scripts de vista
  que necesita.
- `viaje.html` es un shell con tabs; cada vista (`js/vista-*.js`) expone una función
  `montarVistaX(contenedor, tripId, sesion)` que:
  1. Pinta su HTML en `contenedor`.
  2. Se suscribe a los nodos de Firebase que necesita con `escuchar()` (de `db.js`).
  3. Devuelve una función de limpieza que cancela esos listeners — `viaje.html` la llama
     al cambiar de tab. **Nunca dejes un listener de Firebase sin su función de limpieza.**
- `vista-calendario.js` sirve tanto la pestaña "Calendario" como "Agenda" (un solo día) vía
  `montarVistaCalendario(contenedor, tripId, sesion, { modoAgenda })`. Define globals
  (`HORA_PX`, `COLORES_CIUDAD`, `colorCss`, `listaDeDias`) que `vista-ciudades.js` reutiliza —
  por eso `vista-calendario.js` debe cargarse antes que `vista-ciudades.js` en `viaje.html`.

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
  lugares/{lugarId}: { nombre, ciudadId, categoria, liga_mapa, ligas: [...], aireLibre, notas }
  itinerario/{bloqueId}: { tipo: "lugar", refId, ciudadId, inicioUTC, finUTC, fijado }
  ciudadPorDia/{fecha}: ciudadId  // asignación explícita del timeline; fecha = "AAAA-MM-DD"
  traslados/{trasladoId}: { tipo, origen, destino, inicioUTC, finUTC, zonaDestino, confirmacion }
  hospedajes/{hospedajeId}: { nombre, ciudad, checkinUTC, checkoutUTC, noches, claveReservacion }
  // origen/destino/ciudad son nombres (texto) elegidos de la lista combinada
  // info.ciudadOrigen + nombres de "ciudades" — ver opcionesCiudadesTraslado() en
  // vista-generales.js. inicioUTC/checkinUTC SIEMPRE se calculan con
  // zonaDeNombreCiudad(nombre), es decir la hora LOCAL de esa ciudad concreta —
  // nunca con info.zonaOrigen a menos que esa ciudad sea justo la de origen. No
  // reintroduzcas "zona = infoCache.zonaOrigen" como default para estas horas.
  checklist/{itemId}: { nombre, porPersona: { userId: bool }, orden }
  participantes/{userId}: { rol: "admin" | "participante", nombre }
```

**Identidad estable ≠ uid anónimo de Firebase.** El uid anónimo solo existe para que
`auth != null` se cumpla en las reglas. La identidad real de la persona (con la que se
filtran sus viajes, se marca el checklist, etc.) es `sesion.userId`, resuelta en el login
vía `identidades/{claveNombre} → userId` (`js/auth.js`). No mezclar ambos conceptos.

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
  "+ Agregar" y el botón "Editar" de cada fila — ambos deben llamar a la misma función.
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
