# Continuidad para la próxima sesión de Claude Code

Pega esto (o simplemente "lee PROXIMA_SESION.md") como primer mensaje en la nueva sesión.
Este archivo es desechable: bórralo cuando ya no lo necesites, no forma parte de la app.

## Qué es este proyecto

Planeador de viajes familiar/colaborativo — vanilla JS/HTML/CSS (sin build ni framework),
Firebase Realtime Database + Auth anónima, hosteado en GitHub Pages.

- Repo: https://github.com/dmgerardo/PlaneadorDeViajes
- Sitio en vivo: https://dmgerardo.github.io/PlaneadorDeViajes/
- Proyecto de Firebase: `planeadordeviajes` (credenciales ya están en `js/firebase-config.js`,
  reglas ya publicadas en la consola de Firebase)
- Versión actual: **v17** (tag `release-v17`, commit `c94088b`)

## Léelo primero

- **[AGENTS.md](AGENTS.md)** — arquitectura, modelo de datos completo, convenciones e
  invariantes del proyecto. Es la referencia técnica principal, ya está actualizada a v17.
  No repitas nada de ahí en esta sesión nueva, solo léelo.
- **[historial.html](historial.html)** — changelog completo v1→v17 en español, visible
  dentro de la app. Ahí está el detalle de cada feature/fix ya hecho.
- **[README.md](README.md)** — instrucciones de puesta en marcha para el usuario final.

## Convenciones ya establecidas en esta sesión (no las vuelvas a preguntar)

- **Cada commit lleva su tag `release-vNN`** (NN = el número que `bump-version.py` sube
  automáticamente en el pre-commit hook). Se taguea y se hace push del tag junto con `main`.
- **Verificación antes de cada push**: como no hay framework de testing, se arma un mock
  mínimo de Firebase en un HTML temporal dentro del scratchpad (`test-*.html` en la raíz del
  repo, se borra después de usarlo), se monta la vista real ahí y se revisan los datos/DOM
  resultantes. No se sube nada sin probarlo así primero.
- **Commit + push se hacen directamente**, sin pedir confirmación en cada turno — el usuario
  ya autorizó este flujo repetidamente. Si el cambio es grande/arriesgado (p.ej. tocar
  `database.rules.json` o borrar datos), sí vale la pena confirmar antes.
- **Formularios en modal, nunca `prompt()`** — usa `abrirModal()` de `render-utils.js`.
- **Todas las horas se calculan en la hora LOCAL de la ciudad correspondiente**, nunca en
  la zona de origen del viaje salvo que esa ciudad sea justo la de origen (bug ya corregido
  dos veces por confundir esto — ver v14 y v17 en el historial).

## Qué NO se implementó (decisión consciente, no pendiente)

De la propuesta visual generada en Claude Design solo se adoptó el sistema de diseño
"Organic" (paleta/tipografía/formas). **No** se implementaron:
- Sección de **Presupuesto/gastos** (requeriría un nodo `gastos` nuevo).
- Sección de **Documentos** (requeriría Firebase Storage, no usado hoy).
- La reestructuración a tabs inferiores estilo app móvil de la maqueta.

Si el usuario los pide, son trabajo nuevo — no builds a medias que retomar.

## Estado de las solicitudes del usuario

No hay tareas pendientes ni a medias a la fecha de este resumen (2026-08-06). Todo lo
pedido hasta v17 está implementado, probado y en producción. Empieza la sesión nueva
esperando la siguiente solicitud del usuario, no continuando algo interrumpido.
