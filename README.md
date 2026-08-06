# Planeador de Viajes

Una app web para planear viajes largos, de varias ciudades, entre varias personas.
Sirve como el lugar central donde vas guardando lugares que te interesan, sus prioridades,
los traslados y hospedajes ya confirmados, y un checklist de empaque — a lo largo de meses
de investigación, antes de viajar.

No sirve para comprar boletos ni hacer reservaciones: solo para organizar la información.

## ¿Qué puedes hacer con ella?

- Crear varios viajes e invitar a las personas que van contigo.
- Ir agregando ciudades, fechas, vuelos/trenes/autobuses y hoteles ya pactados.
- Capturar una lista de lugares (restaurantes, museos, actividades…) por ciudad, marcando
  qué tan importantes son: **deseable**, **importante** o **no negociable**.
- Acomodar esos lugares en una cuadrícula tipo calendario, viendo la hora de tu ciudad de
  origen y la hora local a la vez.
- Llevar un checklist de cosas por empacar, con una casilla por persona.

## Cómo funciona por dentro

Es una app 100% de archivos estáticos (HTML/CSS/JavaScript, sin instalación ni "build").
Los datos se guardan en tu propia base de datos de Firebase (gratuita), en tiempo real:
si dos personas la abren al mismo tiempo, ambas ven los cambios de inmediato.

## Puesta en marcha (una sola vez, la hace quien administra la app)

1. **Crea tu proyecto de Firebase** (gratis): entra a [console.firebase.google.com](https://console.firebase.google.com),
   crea un proyecto nuevo.
2. **Activa Realtime Database**: en el menú lateral, "Realtime Database" → "Crear base de datos"
   → elige modo "bloqueado" (las reglas las vamos a pegar nosotros).
3. **Activa Authentication anónima**: menú "Authentication" → pestaña "Sign-in method" →
   habilita "Anónimo".
4. **Copia tus credenciales**: "Configuración del proyecto" (el engrane) → baja hasta
   "Tus apps" → crea una app web → copia el objeto `firebaseConfig`.
5. **Pega tus credenciales** en [`js/firebase-config.js`](js/firebase-config.js), reemplazando
   los valores `TU_...`. Estas credenciales no son secretas — no protegen nada por sí solas,
   la seguridad real está en las reglas del siguiente paso.
6. **Publica las reglas de seguridad**: en "Realtime Database" → pestaña "Reglas", pega el
   contenido de [`database.rules.json`](database.rules.json) y publica. **Esto se hace a mano
   siempre que ese archivo cambie** — subir el código a GitHub no actualiza las reglas.

## Cómo se usa

1. Abre `index.html` (localmente, o publicado en Firebase Hosting).
2. Escribe tu nombre y una contraseña. Si es la primera vez, se crea tu cuenta con esa
   contraseña; si ya existías, debes escribir la misma contraseña de siempre.
3. Crea un viaje nuevo, o pide a quien lo creó que te comparta la **clave de invitación**
   para unirte con el botón "Unirme con clave".
4. Ve llenando las pestañas: Generales → Lugares → Calendario → Checklist, en ese orden
   conviene empezar.

## Sobre tus datos

- Todo se guarda en tu propio proyecto de Firebase — nadie más tiene acceso salvo que
  compartas tus credenciales o tu clave de invitación.
- Dado que es una app recreativa (no maneja información sensible ni pagos), la seguridad
  es proporcional: las contraseñas se guardan como huella digital (hash), pero no hay
  verificación de identidad fuerte. No la uses para nada más allá de coordinar un viaje
  entre personas de confianza.

## Licencia

MIT — ver [LICENSE](LICENSE).
