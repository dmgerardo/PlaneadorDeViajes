// Configuración de tu proyecto Firebase.
// Ve a la consola de Firebase → Configuración del proyecto → tus apps → SDK setup and configuration.
// Estas credenciales NO son secretas (son públicas por diseño de Firebase);
// la seguridad real vive en database.rules.json, no aquí.
// Cada persona que use esta app debe crear su propio proyecto Firebase gratuito
// y pegar aquí sus propios valores (ver README.md).

const firebaseConfig = {
  apiKey: "AIzaSyAZf5OOP8hDPgbEL-l_C8oD3Mg1Nwl7N-k",
  authDomain: "planeadordeviajes.firebaseapp.com",
  databaseURL: "https://planeadordeviajes-default-rtdb.firebaseio.com",
  projectId: "planeadordeviajes",
  storageBucket: "planeadordeviajes.firebasestorage.app",
  messagingSenderId: "613286451710",
  appId: "1:613286451710:web:5a6ee125c97e70f15848af"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
