// Configuración de tu proyecto Firebase.
// Ve a la consola de Firebase → Configuración del proyecto → tus apps → SDK setup and configuration.
// Estas credenciales NO son secretas (son públicas por diseño de Firebase);
// la seguridad real vive en database.rules.json, no aquí.
// Cada persona que use esta app debe crear su propio proyecto Firebase gratuito
// y pegar aquí sus propios valores (ver README.md).

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
