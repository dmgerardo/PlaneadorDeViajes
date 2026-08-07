# Continuidad para la próxima sesión de Claude Code

Pega esto (o simplemente "lee PROXIMA_SESION.md") como primer mensaje en la nueva sesión.
Este archivo es desechable: bórralo cuando ya no lo necesites, no forma parte de la app.

## Qué es este proyecto

Planeador de viajes familiar/colaborativo — vanilla JS/HTML/CSS (sin build ni framework),
Firebase Realtime Database + Auth anónima, con modo oscuro y modo offline de lectura.

- Repo: https://github.com/dmgerardo/PlaneadorDeViajes
- Sitio en vivo: **https://planeadordeviajes.web.app** (Firebase Hosting — ya NO es
  GitHub Pages, se migró en v18 porque Pages tuvo un outage largo el 2026-08-06).
  Deploy automático en cada push a `main` vía GitHub Actions
  (`.github/workflows/firebase-hosting-merge.yml`).
- Proyecto de Firebase: `planeadordeviajes` (credenciales ya están en `js/firebase-config.js`,
  reglas ya publicadas en la consola de Firebase). El secreto
  `FIREBASE_SERVICE_ACCOUNT_PLANEADORDEVIAJES` que usa el workflow vive en
  GitHub → Settings → Secrets, no en el repo.
- Versión actual: **v30** (tag `release-v30`, commit `e2afdbf`)

## Léelo primero

- **[AGENTS.md](AGENTS.md)** — arquitectura, modelo de datos completo, convenciones e
  invariantes del proyecto. Es la referencia técnica principal, ya está actualizada a v30.
  No repitas nada de ahí en esta sesión nueva, solo léelo.
- **[historial.html](historial.html)** — changelog completo v1→v30 en español, visible
  dentro de la app. Ahí está el detalle de cada feature/fix ya hecho.
- **[README.md](README.md)** — instrucciones de puesta en marcha para el usuario final.

## Qué cambió a fondo desde v17 (por si venías de una sesión vieja)

- **Navegación reestructurada**: switcher "En el viaje" / "Planeación" en el primer
  renglón (junto al botón "← Viajes"), tabs del grupo activo debajo. La vieja pestaña
  "Generales" ya no existe — se partió en **Info**, **Ciudades** (catálogo) y
  **Logística** (traslados+hospedajes fusionados). La vieja pestaña "Ciudades"
  (asignación día→ciudad) se renombró a **Ruta**. Agenda y Calendario son la misma
  pestaña con un switch interno Día/Calendario.
- **Modo oscuro** (sigue `prefers-color-scheme`) y **modo offline de lectura**
  (`sw.js` + caché en `localStorage` vía `escuchar()` en `db.js`) — ver sección de abajo,
  esto complica un poco las pruebas locales.
- **Catálogo de ciudades** (`js/catalogo-ciudades.js`, ~310 ciudades) con autocompletar
  al agregar una ciudad o capturar la ciudad de origen.
- **Iconos Lucide** (`js/iconos.js`) en vez de emoji para todo lo funcional.
- Hosting movido de GitHub Pages a Firebase Hosting (ver arriba).

## Convenciones ya establecidas (no las vuelvas a preguntar)

- **Cada commit que toca `.css`/`.js` lleva su tag `release-vNN`** (NN = el número que
  `bump-version.py` sube automáticamente en el pre-commit hook, editando
  `js/app-version.js`). Se taguea y se hace push del tag junto con `main`. Si un commit
  **no** toca `.css`/`.js` (solo `.html`/`.md`), el hook no bumpea nada — no le pongas un
  tag `release-vNN` nuevo a ese commit, no corresponde a una versión real.
- **Verificación antes de cada push**: se arma un mock mínimo de Firebase en un HTML
  temporal (`test-*.html` en la raíz del repo, se borra después de usarlo), se monta la
  vista real ahí y se revisan los datos/DOM resultantes. No se sube nada sin probarlo así
  primero. **Con el service worker ya en producción**, el navegador de pruebas puede
  quedarse sirviendo una versión vieja en caché entre sesiones de prueba — si algo no
  refleja tus cambios recién hechos, corre primero
  `navigator.serviceWorker.getRegistrations()...unregister()` + `caches.keys()...delete()`
  antes de suponer que hay un bug real.
- **Commit + push se hacen directamente**, sin pedir confirmación en cada turno — el
  usuario ya autorizó este flujo repetidamente. Si el cambio es grande/arriesgado (p.ej.
  tocar `database.rules.json` o borrar datos), sí vale la pena confirmar antes.
- **Formularios en modal, nunca `prompt()`** — usa `abrirModal()` de `render-utils.js`.
- **Todas las horas se calculan en la hora LOCAL de la ciudad correspondiente**, nunca en
  la zona de origen del viaje salvo que esa ciudad sea justo la de origen (bug ya
  corregido más de una vez por confundir esto — ver historial).
- **Filas de lista sin botón "Editar" aparte**: tocar la fila completa
  (`lista-item-clic`) abre el formulario de edición; "Eliminar" vive dentro de ese
  formulario, no en la fila — ver AGENTS.md para el patrón exacto.
- **Nunca emoji como icono funcional** — usa `icono()`/`iconoTexto()` de
  `js/iconos.js` (SVG de Lucide embebido, sin CDN).
- **GitHub Pages/Actions puede tener outages** (pasó una vez varias horas el 2026-08-06):
  si un deploy se queda atorado en "queued"/"in_progress" mucho tiempo, revisa
  `https://www.githubstatus.com/api/v2/summary.json` antes de suponer que el repo está
  roto — puede ser un problema del lado de GitHub, no tuyo.

## Qué NO se implementó (decisión consciente, no pendiente)

- Sección de **Presupuesto/gastos** (requeriría un nodo `gastos` nuevo).
- Sección de **Documentos** (requeriría Firebase Storage, no usado hoy).
- **Tab bar fija inferior en móvil** — se propuso explícitamente en una spec de rediseño
  y el usuario decidió mantener la navegación de dos niveles (switch + tabs) en su lugar.
  No es un olvido, es una decisión ya tomada.

Si el usuario los pide, son trabajo nuevo — no builds a medias que retomar.

## Estado de las solicitudes del usuario

No hay tareas pendientes ni a medias a la fecha de este resumen (2026-08-06). Todo lo
pedido hasta v30 está implementado, probado y en producción. Empieza la sesión nueva
esperando la siguiente solicitud del usuario, no continuando algo interrumpido.
