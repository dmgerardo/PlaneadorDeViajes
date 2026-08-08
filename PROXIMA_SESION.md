# Continuidad para la próxima sesión de Claude Code

Pega esto (o simplemente "lee PROXIMA_SESION.md") como primer mensaje en la nueva sesión.
Este archivo es desechable: bórralo cuando ya no lo necesites, no forma parte de la app.

## Qué es este proyecto

Planeador de viajes familiar/colaborativo — vanilla JS/HTML/CSS (sin build ni framework),
Firebase Realtime Database + Auth anónima, con modo oscuro/claro (con alternador manual),
modo offline de lectura, y catálogo de ciudades/monedas por país.

- Repo: https://github.com/dmgerardo/PlaneadorDeViajes
- Sitio en vivo: **https://planeadordeviajes.web.app** (Firebase Hosting — ya NO es
  GitHub Pages, se migró en v18). Deploy automático en cada push a `main` vía GitHub
  Actions (`.github/workflows/firebase-hosting-merge.yml`). El CDN de Firebase Hosting
  puede tardar hasta 1h en reflejar un deploy nuevo en todos sus nodos de borde — si el
  sitio muestra una versión vieja justo después de mergear, es eso, no un deploy fallido
  (verifica con `fetch(url, {cache:"no-store"})` con un query de cache-busting si hace
  falta confirmar que el origin ya sirve lo nuevo).
- Proyecto de Firebase: `planeadordeviajes` (credenciales ya están en `js/firebase-config.js`,
  reglas ya publicadas en la consola de Firebase). El secreto
  `FIREBASE_SERVICE_ACCOUNT_PLANEADORDEVIAJES` que usa el workflow vive en
  GitHub → Settings → Secrets, no en el repo.
- Nombre de la app: **Planeador de Viajes Familiar** (se renombró en v33).
- Versión actual: **v43** (tag `release-v43`), ya mergeada a `main` y desplegada.

## Léelo primero

- **[AGENTS.md](AGENTS.md)** — arquitectura, modelo de datos completo, convenciones e
  invariantes del proyecto. Es la referencia técnica principal, actualizada hasta v42
  (nodo `monedas`, campos de costo). No repitas nada de ahí en esta sesión nueva, solo
  léelo. Si haces cambios de modelo de datos nuevos, actualízalo también.
- **[historial.html](historial.html)** — changelog completo v1→v43 en español, visible
  dentro de la app. Ahí está el detalle de cada feature/fix ya hecho, versión por versión.
- **[README.md](README.md)** — instrucciones de puesta en marcha para el usuario final.

## Flujo de trabajo ya establecido (no lo vuelvas a preguntar)

- **Cada commit que toca `.css`/`.js` lleva su tag `release-vNN`** (NN = el número que
  `bump-version.py` sube automáticamente en el pre-commit hook, editando
  `js/app-version.js`). Se taguea y se hace push del tag junto con la rama. Si un commit
  **no** toca `.css`/`.js` (solo `.html`/`.md`), el hook no bumpea nada — no le pongas un
  tag `release-vNN` nuevo a ese commit, no corresponde a una versión real.
- **Cada feature/fix termina en su propio PR**, mergeado a `main` tras preguntarle al
  usuario "¿mergeo y despliego?" (por defecto ha contestado que sí todas las veces, pero
  sigue preguntando — no asumas el sí). No se hace squash de varios cambios en un commit
  gigante: un commit (con su tag) por feature/fix, un PR por feature/fix.
- **Verificación antes de cada push**: se arma un mock mínimo en un HTML temporal
  (`test-*.html` en la raíz del repo, **se borra después de usarlo** — nunca debe quedar
  un `test-*.html` sin borrar en un commit) que carga los JS reales de la app (a veces con
  un `programarRender`/`localStorage` mockeado si esa parte no viene de `db.js`) y revisa
  el DOM/datos resultantes con `javascript_tool`/`get_page_text` del navegador de
  Claude Code. El tool `computer{action:"screenshot"}` **no funciona en este entorno**
  (headless, "Browser pane is not displayed") — no lo intentes, usa
  `getComputedStyle`/`get_page_text`/lectura de `document.styleSheets` en su lugar.
- **Con el service worker ya en producción**, el navegador de pruebas puede quedarse
  sirviendo una versión vieja en caché entre sesiones — si algo no refleja tus cambios
  recién hechos, corre primero `navigator.serviceWorker.getRegistrations()...unregister()`
  + `caches.keys()...delete()` antes de suponer que hay un bug real.
- **Formularios en modal, nunca `prompt()`** — usa `abrirModal()` de `render-utils.js`.
  Para confirmaciones destructivas normales, `confirm()` nativo sigue siendo aceptable;
  para acciones muy destructivas (borrar un viaje entero) se pide escribir una palabra de
  confirmación en un modal, no basta un `confirm()` — ver "Eliminar viaje" en
  `vista-info.js`.
- **Todas las horas se calculan en la hora LOCAL de la ciudad correspondiente**, nunca en
  la zona de origen del viaje ni en la de una columna/zona ajena sin relación — bug
  cometido y corregido MÁS DE UNA VEZ esta sesión (ver "Lección de la sesión" abajo).
- **Filas de lista sin botón "Editar" aparte**: tocar la fila completa
  (`lista-item-clic`) abre el formulario de edición; "Eliminar" vive dentro de ese
  formulario, no en la fila — ver AGENTS.md para el patrón exacto. Para agregar, un botón
  circular con ícono "+" (`btn-agregar-circular`) junto al título de la sección, no un
  botón "+ Agregar" de ancho completo al final de la lista.
- **Nunca emoji como icono funcional** — usa `icono()`/`iconoTexto()` de `js/iconos.js`
  (SVG de Lucide embebido, sin CDN). `input[type="date"]` necesita su ícono de calendario
  dibujado a mano (`background-image` con SVG propio en `estilos.css`) — el
  `::-webkit-calendar-picker-indicator` nativo NO es confiable entre navegadores con
  `appearance:none` (se ve roto en Chrome de escritorio y desaparece en iOS Safari).

## Lección de la sesión (para no repetir el error)

Esta sesión tuvo una racha de bugs de zona horaria en `vista-calendario.js` al arreglar
que los traslados que cruzan medianoche no se veían (v41). El primer intento de fix (v41)
comparaba la hora de un traslado contra **la zona horaria de la columna que se estaba
dibujando** para decidir si "tocaba" ese día — eso causó que un traslado sin relación con
una ciudad lejana (ej. México→LA) apareciera igual en la columna de esa ciudad (ej. Tokio),
solo porque la aritmética de zonas muy separadas cruzaba la medianoche por casualidad. El
fix correcto (v42) fue usar siempre **la zona propia del traslado/hospedaje** (origen y
destino, vía `zonaDeNombreCiudad()`) para decidir en qué día(s) aparece, y solo usar la
zona de la columna para la posición/recorte visual dentro de esos días ya correctos.

**Regla general**: cuando compares/conviertas una hora para decidir algo (en qué día cae,
si se traslapa con otra cosa, etc.), usa la zona horaria **de la entidad dueña de esa
hora** (la ciudad del traslado/hospedaje/lugar), nunca la zona de "donde se está pintando"
o de un contexto ajeno — son cosas distintas y mezclarlas produce bugs sutiles que solo se
notan con ciudades muy separadas en huso horario (México↔Tokio, no México↔Chicago).

## Tarea pendiente abierta (repórtala como continuación, no como nueva)

**El selector "Sombreado de noche en la hora de" (v43, Calendario/Agenda) solo cambia el
sombreado de noche — no mueve la posición de los bloques (traslados/hospedajes/lugares) en
la cuadrícula.** El usuario lo reportó como confuso justo después de que se implementó: si
eliges ver todo "en hora de México", el fondo oscuro/claro se recalcula en esa zona pero
los bloques se quedan dibujados en la hora local de la ciudad de cada día, así que la
posición del bloque y el sombreado de fondo dejan de corresponder visualmente.

Esto fue una decisión consciente al implementarlo (ver PR #12 y el commit de v43): mover
también los bloques implica tocar `pintarBloqueLugar`/`pintarBloqueFijo` y, más riesgoso,
la lógica de arrastre/redimensión (`habilitarArrastre`/`habilitarRedimension`) y el clic
para agendar un lugar — todos esos leen la posición en píxeles del bloque y la reinterpretan
como una hora real para escribir en Firebase. Si el bloque se dibuja usando la zona de
vista pero se arrastra/decodifica usando la zona real de la columna (o viceversa), un
arrastre podría guardar el lugar en una hora distinta a la que el usuario vio y soltó —
justo el tipo de bug de zonas que costó dos rondas arreglar en v41/v42. Dado ese
antecedente, se prefirió no arriesgarlo sin más tiempo de diseño/prueba.

**Antes de tocarlo**, decide con el usuario el alcance real que quiere:
- Opción A (más simple y segura): que los bloques FIJOS (traslados/hospedajes, sin
  arrastre — ya tienen `class="fijado"` y no llaman a `habilitarArrastre`) sí se
  reposicionen con la zona de vista, y los lugares (que sí se arrastran) se queden como
  están hasta resolver el punto de abajo. Reduce el alcance del riesgo a la mitad.
- Opción B (completa): todo el contenido del día se reposiciona con la zona de vista, y el
  arrastre/redimensión/clic-para-agendar tienen que reconciliar "posición visual (zona de
  vista)" vs "hora real a guardar (zona de la ciudad)" — requiere convertir la posición en
  píxeles primero a hora-en-zona-de-vista y de ahí a UTC correctamente, en vez de asumir
  que la zona de la columna y la de vista son la misma.

Recomendación: probablemente conviene Opción A primero (bajo riesgo, ya resuelve la
inconsistencia visual para lo que más se nota — traslados largos), y dejar lugares para
después si el usuario lo sigue pidiendo.

## Qué NO se implementó (decisión consciente, no pendiente)

- Sección de **Documentos** (requeriría Firebase Storage, no usado hoy).
- **Tab bar fija inferior en móvil** — se propuso explícitamente en una spec de rediseño
  y el usuario decidió mantener la navegación de dos niveles (switch + tabs) en su lugar.
  No es un olvido, es una decisión ya tomada.
- **Conversión entre monedas dentro del reporte de costos**: si un tipo de cambio no está
  capturado para una moneda, esa moneda queda fuera del "total consolidado en MXN" — no se
  inventa una tasa. Es intencional (ver `calcularReporteCostos` en `vista-info.js`).

Si el usuario los pide, son trabajo nuevo — no builds a medias que retomar.

## Resumen de lo hecho en la sesión anterior (v31→v43)

En orden cronológico, cada uno ya en producción:

1. **v31** — Alternador de modo claro/oscuro manual en la barra superior (antes solo
   seguía `prefers-color-scheme`).
2. **v32** — Botón "+" circular junto al título en vez de "+ Agregar" de ancho completo
   (Ciudades, Traslados, Hospedajes, Lugares).
3. **v33** — El admin puede renombrar/eliminar un viaje desde Info (con confirmación
   reforzada). La app se renombró a "Planeador de Viajes Familiar".
4. **v34** — Pestaña Ruta: un día con un traslado capturado se pinta partido en dos
   colores (origen/destino).
5. **v35–v36** — Campos de costo (opcional, total/por persona, moneda) en
   Traslados/Hospedajes/Lugares + reporte "Costos del viaje" en Info, con consolidado en
   MXN según tipo de cambio.
6. **v37** — La tarjeta de monedas se rediseñó al patrón de Ciudades (agregar/quitar con
   botón "+", no una lista fija de checkboxes) — corrigió además un bug donde los
   controles quedaban en solo-lectura para el admin.
7. **v38** — El catálogo de monedas disponibles se deriva de los países del catálogo de
   ciudades (84 monedas, antes solo 5). Eliminar un viaje ahora pide escribir la palabra
   "Borrar" en vez del nombre del viaje (estilo AWS).
8. **v39–v40** — Ícono de calendario en `input[type="date"]`: el primer intento (v39,
   restilizar el ícono nativo) no se veía en iOS Safari; v40 lo reemplazó por un ícono
   propio dibujado como `background-image`, independiente del navegador. Además, los
   campos de fecha de Traslados/Hospedajes ya no arrancan vacíos (precargan la fecha de
   inicio del viaje, evitando que el selector nativo abriera en "hoy").
9. **v41–v42** — Traslados que cruzan medianoche: v41 hizo que aparecieran también en el
   día de llegada (antes desaparecían después de medianoche); v42 corrigió un efecto
   secundario de ese fix (traslados "fantasma" apareciendo en ciudades sin relación,
   ver "Lección de la sesión" arriba).
10. **v43** — Selector "Sombreado de noche en la hora de" en Calendario/Agenda — ver
    "Tarea pendiente abierta" arriba, quedó con una limitación conocida.

## Estado de las solicitudes del usuario

La única tarea abierta es la de "Tarea pendiente abierta" arriba (bloques que no se
reposicionan con el selector de zona de vista). Todo lo demás pedido hasta ahora está
implementado, probado y en producción (v43). Empieza la sesión nueva confirmando con el
usuario el alcance que quiere para esa tarea (Opción A vs B arriba) antes de programar.
