// Configuración de Firebase para conectar la maqueta, el panel y Mi Río entre varios dispositivos.
// 1. Crea el proyecto en https://console.firebase.google.com y una Realtime Database.
// 2. Copia aquí el objeto firebaseConfig de tu app web (Configuración del proyecto → Tus apps).
// Si FIREBASE_CONFIG queda en null, las páginas solo se comunican dentro de la misma computadora.
export const FIREBASE_CONFIG = null;

// Nombre de la "sala" de la demo. Todos los dispositivos con la misma sala ven lo mismo.
// Se puede cambiar desde la URL con ?sala=otra
export const SALA = 'demo';
