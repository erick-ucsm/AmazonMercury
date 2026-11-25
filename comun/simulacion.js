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

export function crearCanal(alRecibir) {
  const NOMBRE = 'amazonmercury-v2';
  let bc = null;
  try {
    bc = new BroadcastChannel(NOMBRE);
    bc.onmessage = (e) => alRecibir(e.data);
  } catch {
    bc = null;
    window.addEventListener('storage', (e) => {
      if (e.key !== NOMBRE || !e.newValue) return;
      try { alRecibir(JSON.parse(e.newValue).msg); } catch { /* ignorar */ }
    });
  }
  return {
    enviar(msg) {
      if (bc) bc.postMessage(msg);
      else {
        try { localStorage.setItem(NOMBRE, JSON.stringify({ msg, n: Math.random() })); } catch { /* sin almacenamiento */ }
      }
    }
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
