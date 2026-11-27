// Módulo compartido entre la maqueta 3D (index.html) y el panel de control (panel/).
// Todos los datos que genera son SIMULADOS para la demostración.

export const NODO_MAQUETA = 'AM-02';

export const METALES = [
  { id: 'Hg', nombre: 'Mercurio', lod: 0.1, dec: 2, precaucion: 2, alerta: 6, guia: 6, fuente: 'OMS 6 µg/L · EPA 2 µg/L', electrodo: 'oro' },
  { id: 'As', nombre: 'Arsénico', lod: 0.4, dec: 1, precaucion: 5, alerta: 10, guia: 10, fuente: 'OMS 10 µg/L', electrodo: 'oro' },
  { id: 'Pb', nombre: 'Plomo', lod: 0.4, dec: 1, precaucion: 5, alerta: 10, guia: 10, fuente: 'OMS 10 µg/L', electrodo: 'oro' },
  { id: 'Cd', nombre: 'Cadmio', lod: 0.1, dec: 2, precaucion: 1.5, alerta: 3, guia: 3, fuente: 'OMS 3 µg/L', electrodo: 'bismuto' },
  { id: 'Cu', nombre: 'Cobre', lod: 0.4, dec: 0, precaucion: 1000, alerta: 2000, guia: 2000, fuente: 'OMS 2000 µg/L', electrodo: 'oro' },
  { id: 'Zn', nombre: 'Zinc', lod: 1, dec: 0, precaucion: 1500, alerta: 3000, guia: null, fuente: 'Sin valor guía de salud (OMS: sabor > 3000 µg/L)', electrodo: 'bismuto' }
];

export const PARAMETROS_AGUA = [
  { id: 'turbidez', nombre: 'Turbidez', unidad: 'NTU', dec: 0 },
  { id: 'ph', nombre: 'pH', unidad: '', dec: 1 },
  { id: 'conductividad', nombre: 'Conductividad', unidad: 'µS/cm', dec: 0 },
  { id: 'temperatura', nombre: 'Temperatura', unidad: '°C', dec: 1 }
];

export const NODOS = [
  { id: 'AM-01', lugar: 'Boca Colorado', rio: 'Río Madre de Dios', tramo: 'Río arriba, zona minera', x: 150, y: 150, base: 1.25, rssi: -104 },
  { id: 'AM-02', lugar: 'Laberinto', rio: 'Río Madre de Dios', tramo: 'Zona minera · nodo de la maqueta 3D', x: 380, y: 215, base: 1.0, rssi: -97 },
  { id: 'AM-03', lugar: 'Puerto Maldonado', rio: 'Río Madre de Dios', tramo: 'Cerca de la captación de agua', x: 610, y: 175, base: 0.55, rssi: -88 },
  { id: 'AM-04', lugar: 'Huepetuhe', rio: 'Quebrada Huepetuhe', tramo: 'Afluente con dragas', x: 120, y: 330, base: 1.45, rssi: -109 }
];

export const FASES_CICLO = [
  { id: 'admision', nombre: 'Admisión', real: '3 s', demo: 3.0, texto: 'La compuerta se abre y entra una pequeña muestra de agua a la cámara' },
  { id: 'reactivo', nombre: 'Reactivo', real: '10 s', demo: 2.6, texto: 'La microbomba dosifica ~1 mL de buffer ácido desde el cartucho' },
  { id: 'deposito', nombre: 'Depósito', real: '≈ 6 min', demo: 5.0, texto: 'El potenciostato acumula los metales sobre los electrodos de oro y bismuto mientras se agita la muestra (en campo ≈ 6 min)' },
  { id: 'barrido', nombre: 'Barrido', real: '10 s', demo: 3.0, texto: 'Barrido de voltaje (SWASV): cada metal se redisuelve a un voltaje distinto y se mide su corriente' },
  { id: 'transmision', nombre: 'Transmisión', real: '2 s', demo: 3.0, texto: 'El módulo LoRa 433 MHz envía la lectura, de nodo en nodo, hasta la puerta de enlace' },
  { id: 'descarga', nombre: 'Descarga', real: '5 s', demo: 2.6, texto: 'La muestra se descarga por el fondo y el nodo vuelve a deep sleep' }
];

export const ESCENARIOS = {
  aleatorio: 'Aleatorio',
  normal: 'Normal',
  precaucion: 'Precaución',
  alerta: 'Pico de mercurio (draga río arriba)'
};

export function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (r, a, b) => a + r() * (b - a);

export function clasificar(metal, valor) {
  const m = typeof metal === 'string' ? METALES.find((x) => x.id === metal) : metal;
  if (valor === null || valor === undefined || valor < m.lod) return 'nd';
  if (valor >= m.alerta) return 'alerta';
  if (valor >= m.precaucion) return 'precaucion';
  return 'normal';
}

export const ETIQUETA_ESTADO = { normal: 'Normal', precaucion: 'Precaución', alerta: 'ALERTA', nd: 'No detectable' };

export function estadoGeneral(medicion) {
  const orden = { nd: 0, normal: 1, precaucion: 2, alerta: 3 };
  let peor = 'normal';
  for (const m of METALES) {
    const e = clasificar(m, medicion.metales[m.id].valor);
    if (orden[e] > orden[peor]) peor = e;
  }
  return peor;
}

export function incertidumbre(metal, valor) {
  const m = typeof metal === 'string' ? METALES.find((x) => x.id === metal) : metal;
  return Math.max(m.lod * 0.6, valor * 0.15);
}

export function formatearMetal(metal, lectura) {
  const m = typeof metal === 'string' ? METALES.find((x) => x.id === metal) : metal;
  if (lectura.valor === null || lectura.valor < m.lod) return `< ${m.lod.toFixed(m.lod < 1 ? 1 : 0)}`;
  const d = m.dec;
  return `${lectura.valor.toFixed(d)} ± ${Math.max(lectura.u, Math.pow(10, -d)).toFixed(d)}`;
}

function rangos(escenario) {
  if (escenario === 'alerta') {
    return { Hg: [6.5, 13.5], As: [6, 14], Pb: [4, 12], Cd: [0.6, 2.2], Cu: [18, 45], Zn: [35, 90], turbidez: [520, 1150] };
  }
  if (escenario === 'precaucion') {
    return { Hg: [2.1, 5.4], As: [3, 7], Pb: [1, 6], Cd: [0.2, 1.2], Cu: [10, 25], Zn: [20, 55], turbidez: [280, 520] };
  }
  return { Hg: [0.12, 1.45], As: [0.8, 4], Pb: [0.1, 2.2], Cd: [0.02, 0.45], Cu: [3, 15], Zn: [8, 40], turbidez: [70, 240] };
}

export function elegirEscenario(escenario, r = Math.random) {
  if (escenario && escenario !== 'aleatorio') return escenario;
  const x = r();
  return x < 0.12 ? 'alerta' : x < 0.3 ? 'precaucion' : 'normal';
}

export function generarMedicion({ nodo = NODO_MAQUETA, escenario = 'aleatorio', t = Date.now(), r = Math.random, origen = 'automatica', factor = null } = {}) {
  const esc = elegirEscenario(escenario, r);
  const info = NODOS.find((n) => n.id === nodo) || NODOS[1];
  const f = factor ?? (esc === 'normal' ? info.base : 1);
  const rg = rangos(esc);
  const metales = {};
  for (const m of METALES) {
    let v = entre(r, rg[m.id][0], rg[m.id][1]) * f;
    if (v < m.lod) v = null;
    metales[m.id] = { valor: v, u: v === null ? 0 : incertidumbre(m, v) };
  }
  const hora = new Date(t).getHours();
  const agua = {
    turbidez: entre(r, rg.turbidez[0], rg.turbidez[1]) * (esc === 'normal' ? 0.8 + f * 0.25 : 1),
    ph: entre(r, 6.4, 7.4) - (esc === 'alerta' ? 0.3 : 0),
    conductividad: entre(r, 38, 95) + (esc === 'alerta' ? 40 : 0),
    temperatura: 25.6 + 2.2 * Math.sin(((hora - 9) / 24) * Math.PI * 2) + entre(r, -0.4, 0.4)
  };
  return {
    id: `${nodo}-${t}-${Math.floor(r() * 1e6)}`,
    nodo,
    t,
    origen,
    escenario: esc,
    metales,
    agua,
    salud: {
      bateria: Math.round(entre(r, 78, 99)),
      cargando: hora >= 7 && hora <= 16,
      rssi: Math.round(info.rssi + entre(r, -4, 4)),
      electrodoDias: 18,
      reactivoPct: 64,
      calidad: 'OK'
    }
  };
}

export function generarHistorial(dias = 30, ahora = Date.now()) {
  const HORA = 3600e3;
  const fin = Math.floor(ahora / HORA) * HORA;
  const inicio = fin - dias * 24 * HORA;
  const salida = {};
  NODOS.forEach((n, k) => {
    const r = mulberry32(2027 + k * 97);
    const eventos = [];
    const nEventos = n.id === 'AM-03' ? 1 : 3 + Math.floor(r() * 2);
    for (let i = 0; i < nEventos; i++) {
      eventos.push({ t: inicio + r() * (fin - inicio - 6 * HORA), dur: (6 + r() * 14) * HORA, pico: n.id === 'AM-03' ? 2.6 : 5 + r() * 7 });
    }
    const lista = [];
    let electrodoDias = Math.floor(r() * 20);
    let reactivo = 40 + r() * 50;
    for (let t = inicio; t <= fin; t += HORA) {
      const hora = new Date(t).getHours();
      let hg = n.base * (0.55 + 0.25 * Math.sin(t / (HORA * 31)) + r() * 0.35);
      let turb = 90 + 60 * Math.sin(t / (HORA * 57)) + r() * 50;
      let extra = 0;
      for (const e of eventos) {
        const dt = t - e.t;
        if (dt >= 0 && dt < e.dur * 2.5) {
          const k2 = dt < e.dur * 0.25 ? dt / (e.dur * 0.25) : Math.exp(-(dt - e.dur * 0.25) / (e.dur * 0.6));
          extra = Math.max(extra, k2);
          hg += e.pico * k2;
        }
      }
      turb += extra * (650 + r() * 300);
      const m = {};
      const base = { As: 1.6 + extra * 8, Pb: 0.6 + extra * 6, Cd: 0.12 + extra * 1.2, Cu: 6 + extra * 25, Zn: 18 + extra * 45 };
      for (const met of METALES) {
        let v = met.id === 'Hg' ? hg : base[met.id] * n.base * (0.75 + r() * 0.5);
        if (v < met.lod) v = null;
        m[met.id] = { valor: v, u: v === null ? 0 : incertidumbre(met, v) };
      }
      if ((t - inicio) % (24 * HORA) === 0) {
        electrodoDias += 1;
        if (electrodoDias > 45) electrodoDias = 0;
        reactivo -= 2.4;
        if (reactivo < 8) reactivo = 100;
      }
      const sol = Math.max(0, Math.sin(((hora - 6) / 12) * Math.PI));
      lista.push({
        id: `${n.id}-${t}`,
        nodo: n.id,
        t,
        origen: 'automatica',
        escenario: extra > 0.6 ? 'alerta' : 'normal',
        metales: m,
        agua: {
          turbidez: turb,
          ph: 6.9 + 0.25 * Math.sin(t / (HORA * 40)) + (r() - 0.5) * 0.2 - extra * 0.3,
          conductividad: 55 + 15 * Math.sin(t / (HORA * 70)) + r() * 8 + extra * 40,
          temperatura: 25.8 + 2 * Math.sin(((hora - 9) / 24) * Math.PI * 2) + (r() - 0.5) * 0.6
        },
        salud: {
          bateria: Math.round(Math.min(100, 72 + 26 * sol + 8 * Math.sin(t / (HORA * 90)) + r() * 3)),
          cargando: sol > 0.05,
          rssi: Math.round(n.rssi + (r() - 0.5) * 8),
          electrodoDias,
          reactivoPct: Math.round(reactivo),
          calidad: 'OK'
        }
      });
    }
    salida[n.id] = lista;
  });
  return salida;
}

const SDK_FIREBASE = 'https://www.gstatic.com/firebasejs/10.14.1';
const TIPOS_SOLO_LOCALES = new Set(['adios']);

// Canal de mensajes entre la maqueta, el panel y Mi Río.
// - Dentro de la misma computadora: BroadcastChannel (o localStorage).
// - Entre dispositivos: Firebase Realtime Database, si comun/firebase-config.js tiene la configuración.
export function crearCanal(alRecibir, opciones = {}) {
  const NOMBRE = 'amazonmercury-v2';
  const pagina = opciones.pagina || 'pagina';
  const yo = `${pagina}-${Math.random().toString(36).slice(2, 10)}`;
  const vistos = new Set();
  const oyentesRed = new Set();
  let red = { estado: 'local', conectados: {} };
  let fb = null;
  const pendientes = [];

  const entregar = (msg) => {
    if (!msg || !msg.tipo) return;
    if (msg._id) {
      if (vistos.has(msg._id)) return;
      vistos.add(msg._id);
      if (vistos.size > 500) vistos.delete(vistos.values().next().value);
    }
    alRecibir(msg);
  };
  const avisarRed = () => oyentesRed.forEach((f) => { try { f(red); } catch { /* ignorar */ } });

  let bc = null;
  try {
    bc = new BroadcastChannel(NOMBRE);
    bc.onmessage = (e) => entregar(e.data);
  } catch {
    bc = null;
    window.addEventListener('storage', (e) => {
      if (e.key !== NOMBRE || !e.newValue) return;
      try { entregar(JSON.parse(e.newValue).msg); } catch { /* ignorar */ }
    });
  }

  const enviarRed = (msg) => {
    if (!fb) { pendientes.push(msg); if (pendientes.length > 30) pendientes.shift(); return; }
    const { db, sdk, base } = fb;
    try {
      const nuevo = sdk.push(sdk.ref(db, `${base}/mensajes`));
      sdk.set(nuevo, { ...msg, _o: yo, t: sdk.serverTimestamp() }).catch(() => {});
      setTimeout(() => sdk.remove(nuevo).catch(() => {}), 30000);
      if (msg.tipo === 'resultado' && msg.medicion && msg.medicion.nodo) {
        sdk.set(sdk.ref(db, `${base}/ultima/${msg.medicion.nodo}`), { ...msg, _o: yo, t: sdk.serverTimestamp() }).catch(() => {});
      }
    } catch { /* sin red */ }
  };

  async function conectarFirebase() {
    let cfg;
    try { cfg = await import(`${new URL('./firebase-config.js', import.meta.url).href}?v=${Date.now()}`); } catch { return; }
    if (!cfg.FIREBASE_CONFIG || !cfg.FIREBASE_CONFIG.databaseURL) return;
    const sala = (new URLSearchParams(location.search).get('sala') || cfg.SALA || 'demo').replace(/[^\w-]/g, '').slice(0, 40) || 'demo';
    red = { estado: 'conectando', conectados: {}, sala };
    avisarRed();
    try {
      const [app, sdk] = await Promise.all([
        import(`${SDK_FIREBASE}/firebase-app.js`),
        import(`${SDK_FIREBASE}/firebase-database.js`)
      ]);
      const aplicacion = app.getApps().length ? app.getApp() : app.initializeApp(cfg.FIREBASE_CONFIG);
      const db = sdk.getDatabase(aplicacion);
      const base = `salas/${sala}`;

      const offset = await new Promise((res) => {
        const r = sdk.ref(db, '.info/serverTimeOffset');
        const fin = setTimeout(() => res(0), 4000);
        sdk.onValue(r, (s) => { clearTimeout(fin); res(s.val() || 0); }, { onlyOnce: true });
      });
      const ahora = () => Date.now() + offset;
      const desde = ahora() - 1500;

      // Mensajes nuevos de otros dispositivos
      sdk.onChildAdded(sdk.query(sdk.ref(db, `${base}/mensajes`), sdk.orderByChild('t'), sdk.startAt(desde)), (snap) => {
        const m = snap.val();
        if (!m || m._o === yo) return;
        delete m._o; delete m.t;
        entregar(m);
      });

      // Última medición de cada nodo, para quien entra tarde
      try {
        const ult = await sdk.get(sdk.ref(db, `${base}/ultima`));
        const lista = Object.values(ult.val() || {}).filter((m) => m && m.t && ahora() - m.t < 6 * 3600e3);
        lista.forEach((m) => { delete m._o; delete m.t; m.repeticion = true; m.solicitud = null; entregar(m); });
      } catch { /* sin datos */ }

      // Presencia: quién está conectado
      const miPresencia = sdk.ref(db, `${base}/conectados/${yo}`);
      sdk.onValue(sdk.ref(db, '.info/connected'), (s) => {
        if (s.val() === true) {
          sdk.onDisconnect(miPresencia).remove().then(() => sdk.set(miPresencia, { pagina, t: sdk.serverTimestamp() })).catch(() => {});
          red = { ...red, estado: 'en-linea' };
        } else if (red.estado === 'en-linea') {
          red = { ...red, estado: 'sin-conexion' };
        }
        avisarRed();
      });
      sdk.onValue(sdk.ref(db, `${base}/conectados`), (s) => {
        red = { ...red, conectados: s.val() || {} };
        avisarRed();
      });

      // Limpieza de mensajes viejos (solo la maqueta)
      if (pagina === 'maqueta') {
        try {
          const viejos = await sdk.get(sdk.query(sdk.ref(db, `${base}/mensajes`), sdk.orderByChild('t'), sdk.endAt(ahora() - 120000)));
          viejos.forEach((c) => { sdk.remove(c.ref).catch(() => {}); });
        } catch { /* ignorar */ }
      }

      fb = { db, sdk, base };
      pendientes.splice(0).forEach(enviarRed);
    } catch (e) {
      console.warn('[AmazonMercury] No se pudo conectar con Firebase; se usa solo el canal local.', e);
      red = { ...red, estado: 'sin-conexion' };
      avisarRed();
    }
  }
  conectarFirebase();

  return {
    yo,
    enviar(msg, { soloLocal = false } = {}) {
      const m = { ...msg, _id: `${yo}-${Math.random().toString(36).slice(2, 9)}` };
      vistos.add(m._id);
      if (bc) bc.postMessage(m);
      else {
        try { localStorage.setItem(NOMBRE, JSON.stringify({ msg: m, n: Math.random() })); } catch { /* sin almacenamiento */ }
      }
      if (!soloLocal && !TIPOS_SOLO_LOCALES.has(m.tipo)) enviarRed(m);
    },
    alCambiarRed(f) { oyentesRed.add(f); f(red); },
    get red() { return red; }
  };
}

export const CLAVE_LECTURAS = 'amazonmercury-lecturas-v2';

export function leerLecturasGuardadas() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_LECTURAS) || '[]');
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

export function guardarLectura(med) {
  try {
    const lista = leerLecturasGuardadas().filter((x) => x.id !== med.id);
    lista.push(med);
    localStorage.setItem(CLAVE_LECTURAS, JSON.stringify(lista.slice(-200)));
  } catch { /* sin almacenamiento */ }
}

export const TIPOS_REPORTE = [
  { id: 'color', icono: '🟤', texto: 'El agua tiene otro color' },
  { id: 'peces', icono: '🐟', texto: 'Peces muertos o raros' },
  { id: 'draga', icono: '⛴️', texto: 'Hay una draga cerca' },
  { id: 'olor', icono: '👃', texto: 'Olor extraño' },
  { id: 'nodo', icono: '🛟', texto: 'El nodo está dañado' },
  { id: 'otro', icono: '💬', texto: 'Otra cosa' }
];

export const CLAVE_REPORTES = 'amazonmercury-reportes-v1';

export function reportesSemilla(ahora = Date.now()) {
  const H = 3600e3;
  return [
    { id: 'rep-semilla-1', nodo: 'AM-01', tipo: 'color', texto: 'El río bajó muy marrón desde la mañana.', t: ahora - 31 * H, origen: 'Mi Río', simulado: true },
    { id: 'rep-semilla-2', nodo: 'AM-04', tipo: 'draga', texto: 'Se escucha una draga trabajando de noche, quebrada arriba.', t: ahora - 3 * 24 * H, origen: 'Guardián del Río', simulado: true },
    { id: 'rep-semilla-3', nodo: 'AM-02', tipo: 'nodo', texto: 'Rejilla con muchas hojas; se limpió.', t: ahora - 6 * 24 * H, origen: 'Guardián del Río', simulado: true }
  ];
}

export function leerReportes() {
  let propios = [];
  try {
    propios = JSON.parse(localStorage.getItem(CLAVE_REPORTES) || '[]');
    if (!Array.isArray(propios)) propios = [];
  } catch { propios = []; }
  return [...propios, ...reportesSemilla()].sort((a, b) => b.t - a.t);
}

export function guardarReporte(rep) {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_REPORTES) || '[]');
    const nueva = (Array.isArray(lista) ? lista : []).filter((x) => x.id !== rep.id);
    nueva.push(rep);
    localStorage.setItem(CLAVE_REPORTES, JSON.stringify(nueva.slice(-100)));
  } catch { /* sin almacenamiento */ }
}

export const TEXTO_COMUNIDAD = {
  normal: { titulo: 'Bien', frase: 'El agua del río está bien hoy', color: '#2f8a57', cara: 'feliz' },
  nd: { titulo: 'Bien', frase: 'El agua del río está bien hoy', color: '#2f8a57', cara: 'feliz' },
  precaucion: { titulo: 'Cuidado', frase: 'Hay más mercurio de lo normal', color: '#d99100', cara: 'preocupada' },
  alerta: { titulo: 'No usar para beber ni cocinar', frase: 'El río tiene mucho mercurio', color: '#d64545', cara: 'alerta' }
};

export function nivelHg(valor) {
  if (valor === null || valor === undefined || valor < 2) return { id: 'bajo', texto: 'Bajo', pos: Math.max(0.04, (valor || 0) / 6) * 0.33 };
  if (valor < 6) return { id: 'medio', texto: 'Medio', pos: 0.33 + ((valor - 2) / 4) * 0.33 };
  return { id: 'alto', texto: 'Alto', pos: Math.min(0.97, 0.66 + ((valor - 6) / 8) * 0.33) };
}
