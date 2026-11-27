// Configuración de Firebase para conectar la maqueta, el panel y Mi Río entre varios dispositivos.
// Si FIREBASE_CONFIG queda en null, las páginas solo se comunican dentro de la misma computadora.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDmpIaoc1z8-CfNaI5uNSWQUNVvct19pEQ',
  authDomain: 'mercury-62244.firebaseapp.com',
  databaseURL: 'https://mercury-62244-default-rtdb.firebaseio.com',
  projectId: 'mercury-62244',
  storageBucket: 'mercury-62244.firebasestorage.app',
  messagingSenderId: '544514499252',
  appId: '1:544514499252:web:0ff70f0c1c4df5a3bbade1'
};

// Nombre de la "sala" de la demo. Todos los dispositivos con la misma sala ven lo mismo.
// Se puede cambiar desde la URL con ?sala=otra
export const SALA = 'demo';
