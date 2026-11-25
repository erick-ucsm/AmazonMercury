import {
  NODOS, NODO_MAQUETA, METALES, FASES_CICLO, ESCENARIOS, ETIQUETA_ESTADO,
  clasificar, estadoGeneral, formatearMetal, generarMedicion, generarHistorial,
  crearCanal, leerLecturasGuardadas, guardarLectura, leerReportes, TIPOS_REPORTE
} from '../comun/simulacion.js';

const $ = (s) => document.querySelector(s);
const HORA = 3600e3;
const ZONA = 'America/Lima';
const fmtFecha = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
const fmtHora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
const fmtReloj = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: ZONA });
const fmtDia = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', timeZone: ZONA });
const fmtDiaMes = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', timeZone: ZONA });
const porNodo = Object.fromEntries(NODOS.map((n) => [n.id, n]));
const ORIGEN = { automatica: 'Automática (cada hora)', emergencia: 'Diagnóstico de emergencia', manual: 'Muestreo desde la maqueta 3D' };

const datos = generarHistorial(30);
leerLecturasGuardadas().forEach((m) => insertar(m));

const estado = {
  nodo: NODO_MAQUETA,
  rango: 168,
  maqueta: { ultimo: 0, ocupada: false },
  solicitud: null,
  idsNuevos: new Set(),
  vivo: null
};

function insertar(med) {
  const lista = datos[med.nodo];
  if (!lista || lista.some((x) => x.id === med.id)) return false;
  lista.push(med);
  lista.sort((a, b) => a.t - b.t);
  return true;
}

const ultimo = (nodo) => datos[nodo][datos[nodo].length - 1];
const hace = (t) => {
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};
const fmt = (v, d) => (v === null || v === undefined ? '—' : v.toFixed(d));

function calcularEventos() {
  const ev = [];
  for (const n of NODOS) {
    let actual = null;
    for (const r of datos[n.id]) {
      if (r.origen === 'emergencia' || r.origen === 'manual') {
        ev.push({ id: r.id, t: r.t, nodo: n.id, tipo: 'diag', estado: estadoGeneral(r), hg: r.metales.Hg.valor, turb: r.agua.turbidez, med: r });
        continue;
      }
      const hg = r.metales.Hg.valor || 0;
      if (hg >= 2) {
        if (!actual) actual = { id: r.id, t: r.t, nodo: n.id, hg, turb: r.agua.turbidez, fin: r.t, med: r };
        else {
          if (hg > actual.hg) { actual.hg = hg; actual.med = r; }
          actual.turb = Math.max(actual.turb, r.agua.turbidez);
          actual.fin = r.t;
        }
      } else if (actual) {
        actual.tipo = actual.hg >= 6 ? 'alerta' : 'precaucion';
        ev.push(actual);
        actual = null;
      }
    }
    if (actual) {
      actual.tipo = actual.hg >= 6 ? 'alerta' : 'precaucion';
      actual.enCurso = true;
      ev.push(actual);
    }
  }
  return ev.sort((a, b) => b.t - a.t);
}

function estadoNodo(nodo) {
  return clasificar('Hg', ultimo(nodo).metales.Hg.valor) === 'nd' ? 'normal' : clasificar('Hg', ultimo(nodo).metales.Hg.valor);
}

/* ---------------- Cabecera y conexión con la maqueta ---------------- */

function reloj() {
  $('#reloj').textContent = fmtReloj.format(new Date());
}
setInterval(reloj, 1000);
reloj();

let ventanaMaqueta = null;
$('#btnMaqueta').addEventListener('click', () => {
  try {
    if (ventanaMaqueta && !ventanaMaqueta.closed) { ventanaMaqueta.focus(); return; }
  } catch { /* otra ventana */ }
  const w = Math.min(1440, screen.availWidth - 40), h = Math.min(920, screen.availHeight - 40);
  ventanaMaqueta = window.open(new URL('../', location.href).href, 'amazonmercury-maqueta', `popup,width=${w},height=${h}`);
});

let ventanaMiRio = null;
$('#btnMiRio').addEventListener('click', () => {
  try {
    if (ventanaMiRio && !ventanaMiRio.closed) { ventanaMiRio.focus(); return; }
  } catch { /* otra ventana */ }
  ventanaMiRio = window.open(new URL(`../comunidad/?lugar=${estado.nodo}`, location.href).href, 'amazonmercury-mirio', 'popup,width=460,height=900');
});

const maquetaConectada = () => Date.now() - estado.maqueta.ultimo < 12000;

function pintarConexion() {
  const el = $('#estadoMaqueta');
  const ok = maquetaConectada();
  el.classList.toggle('conectada', ok && !estado.maqueta.ocupada);
  el.classList.toggle('ocupada', ok && estado.maqueta.ocupada);
  el.classList.toggle('desconectada', !ok);
  $('#estadoMaquetaTxt').textContent = !ok
    ? 'Maqueta 3D: no conectada'
    : estado.maqueta.ocupada ? `Maqueta 3D (${NODO_MAQUETA}): midiendo…` : `Maqueta 3D (${NODO_MAQUETA}): conectada`;
}

const canal = crearCanal(recibir);
canal.enviar({ tipo: 'ping' });
setInterval(() => {
  canal.enviar({ tipo: 'ping' });
  pintarConexion();
}, 4000);

function recibir(msg) {
  if (!msg || !msg.tipo) return;
  if (msg.tipo === 'pong' || msg.tipo === 'hola') {
    const antes = maquetaConectada();
    estado.maqueta.ultimo = Date.now();
    estado.maqueta.ocupada = !!msg.ocupado;
    if (!antes) aviso(`Maqueta 3D conectada: el nodo ${NODO_MAQUETA} responde a este panel.`, 'ok');
  }
  if (msg.tipo === 'adios') {
    estado.maqueta.ultimo = 0;
    aviso('La maqueta 3D se cerró. Los diagnósticos se simularán en este panel.');
  }
  if (msg.tipo === 'inicio') {
    estado.maqueta.ultimo = Date.now();
    estado.maqueta.ocupada = true;
    const s = estado.solicitud;
    if (s && s.id === msg.solicitud) s.iniciada = true;
    else if (msg.origen === 'manual') aviso(`La maqueta 3D inició un muestreo en ${NODO_MAQUETA}.`);
  }
  if (msg.tipo === 'fase') {
    estado.maqueta.ultimo = Date.now();
    const s = estado.solicitud;
    if (s && s.id === msg.solicitud) avanzarPaso(msg.fase);
  }
  if (msg.tipo === 'resultado' && msg.medicion) {
    const s = estado.solicitud;
    const esMia = s && s.id === msg.solicitud;
    if (insertar(msg.medicion)) {
      estado.idsNuevos.add(msg.medicion.id);
      if (esMia) mostrarResultado(msg.medicion);
      else {
        const e = estadoGeneral(msg.medicion);
        aviso(`Nueva lectura de ${msg.medicion.nodo} (maqueta 3D): Hg ${formatearMetal('Hg', msg.medicion.metales.Hg)} µg/L · ${ETIQUETA_ESTADO[e]}`, e === 'alerta' ? 'alerta' : '');
      }
      animarPaquete(msg.medicion.nodo);
      renderTodo();
    }
  }
  if (msg.tipo === 'fin') {
    estado.maqueta.ocupada = false;
    const s = estado.solicitud;
    if (s && s.id === msg.solicitud) terminarSolicitud();
  }
  if (msg.tipo === 'reporte' && msg.reporte) {
    reportesNuevos.add(msg.reporte.id);
    const t = TIPOS_REPORTE.find((x) => x.id === msg.reporte.tipo);
    aviso(`Reporte de la comunidad (${msg.reporte.nodo}): ${t ? t.texto : msg.reporte.tipo}`);
    renderReportes();
  }
  if (msg.tipo === 'ocupado') {
    const s = estado.solicitud;
    if (s && s.id === msg.solicitud && !s.local) {
      aviso('El nodo de la maqueta ya está midiendo. El diagnóstico se simula en el panel.');
      iniciarLocal(s);
    }
  }
  pintarConexion();
}

/* ---------------- Diagnóstico de emergencia ---------------- */

const PASOS = [
  { id: 'orden', nombre: 'Orden enviada', real: '< 1 s' },
  { id: 'escucha', nombre: 'Nodo recibe', real: '≤ 5 min' },
  ...FASES_CICLO.map((f) => ({ id: f.id, nombre: f.nombre, real: f.real }))
];

function renderPasos() {
  $('#pasosEm').innerHTML = PASOS.map((p, i) => `<li data-paso="${p.id}"><b>${i + 1}</b>${p.nombre}<small>${p.real}</small></li>`).join('');
}

function avanzarPaso(id) {
  const idx = PASOS.findIndex((p) => p.id === id);
  if (idx < 0) return;
  document.querySelectorAll('#pasosEm li').forEach((li, i) => {
    li.classList.toggle('hecho', i < idx);
    li.classList.toggle('activo', i === idx);
  });
  const textos = {
    orden: 'Orden enviada a la puerta de enlace LoRa de Puerto Maldonado…',
    escucha: `El nodo ${estado.solicitud.nodo} recibe la orden en su próxima ventana de escucha.`,
    admision: 'Se abre la compuerta y entra la muestra de agua.',
    reactivo: 'La microbomba agrega ~1 mL de buffer a la muestra.',
    deposito: 'Los metales se acumulan sobre los electrodos de oro y bismuto.',
    barrido: 'Barrido de voltaje: se mide la corriente de cada metal.',
    transmision: 'El resultado viaja por la malla LoRa hasta la puerta de enlace…',
    descarga: 'La muestra se descarga y el nodo vuelve a su ciclo automático.'
  };
  const real = PASOS[idx].real;
  if (id !== 'descarga' || !estado.solicitud.resultado) {
    $('#estadoEm').innerHTML = `<p class="em-progreso">${textos[id]}<small>Tiempo real en campo de esta etapa: ${real}${estado.solicitud.local ? ' · simulado en el panel' : ' · ejecutándose en la maqueta 3D'}</small></p>`;
  }
}

function solicitar() {
  if (estado.solicitud) return;
  const nodo = $('#selNodoEm').value;
  const s = {
    id: `sol-${Date.now()}`,
    nodo,
    escenario: $('#selEscenario').value,
    local: false,
    iniciada: false,
    resultado: null,
    timers: []
  };
  estado.solicitud = s;
  $('#btnEmergencia').disabled = true;
  $('#selNodoEm').disabled = true;
  renderPasos();
  avanzarPaso('orden');
  s.timers.push(setTimeout(() => avanzarPaso('escucha'), 1300));
  s.timers.push(setTimeout(() => {
    if (nodo === NODO_MAQUETA && maquetaConectada()) {
      canal.enviar({ tipo: 'solicitar', solicitud: s.id, nodo, escenario: s.escenario });
      s.timers.push(setTimeout(() => {
        if (!s.iniciada && estado.solicitud === s && !s.local) {
          aviso('La maqueta 3D no respondió. El diagnóstico se simula en el panel.');
          iniciarLocal(s);
        }
      }, 4500));
    } else {
      iniciarLocal(s);
    }
  }, 3300));
}

function iniciarLocal(s) {
  s.local = true;
  canal.enviar({ tipo: 'inicio', nodo: s.nodo, solicitud: s.id, origen: 'panel' });
  let t = 0;
  FASES_CICLO.forEach((f) => {
    s.timers.push(setTimeout(() => {
      if (estado.solicitud !== s) return;
      avanzarPaso(f.id);
      canal.enviar({ tipo: 'fase', nodo: s.nodo, solicitud: s.id, fase: f.id });
      if (f.id === 'transmision') {
        const previo = ultimo(s.nodo);
        const med = generarMedicion({ nodo: s.nodo, escenario: s.escenario, origen: 'emergencia' });
        med.salud = { ...previo.salud, calidad: 'OK' };
        guardarLectura(med);
        insertar(med);
        canal.enviar({ tipo: 'resultado', nodo: s.nodo, solicitud: s.id, medicion: med });
        estado.idsNuevos.add(med.id);
        animarPaquete(s.nodo);
        mostrarResultado(med);
        renderTodo();
      }
    }, t * 1000));
    t += f.demo;
  });
  s.timers.push(setTimeout(() => {
    canal.enviar({ tipo: 'fin', nodo: s.nodo, solicitud: s.id });
    terminarSolicitud();
  }, t * 1000));
}

function mostrarResultado(med) {
  const s = estado.solicitud;
  if (s) s.resultado = med;
  const e = estadoGeneral(med);
  const eHg = clasificar('Hg', med.metales.Hg.valor);
  const chips = METALES.filter((m) => m.id !== 'Hg').map((m) => {
    const em = clasificar(m, med.metales[m.id].valor);
    return `<span class="chip ${em}">${m.id} ${formatearMetal(m, med.metales[m.id])}</span>`;
  }).join('');
  const consejo = e === 'alerta'
    ? 'Nivel de alerta: se recomienda avisar a las comunidades río abajo.'
    : e === 'precaucion' ? 'Precaución: conviene repetir la medición y vigilar la turbidez.' : 'Sin riesgo inmediato según los valores guía.';
  $('#estadoEm').innerHTML = `
    <div class="em-resultado ${e}">
      <div class="em-hg"><small>Mercurio · ${med.nodo}</small><strong>${formatearMetal('Hg', med.metales.Hg)}</strong> <span style="font-size:1rem">µg/L</span></div>
      <div class="em-info">
        <p><b>${ETIQUETA_ESTADO[eHg]}</b> · ${consejo}</p>
        <div class="chips">${chips}<span class="chip">Turbidez ${fmt(med.agua.turbidez, 0)} NTU</span></div>
        ${e !== 'normal' ? `<p style="margin-top:8px"><button class="btn btn-emergencia btn-mini" data-alerta="${med.id}">Preparar alerta a comunidades</button></p>` : ''}
      </div>
    </div>`;
  aviso(`Diagnóstico de ${med.nodo}: Hg ${formatearMetal('Hg', med.metales.Hg)} µg/L · ${ETIQUETA_ESTADO[eHg]}`, e === 'alerta' ? 'alerta' : 'ok');
  estado.nodo = med.nodo;
}

function terminarSolicitud() {
  const s = estado.solicitud;
  if (!s) return;
  s.timers.forEach(clearTimeout);
  document.querySelectorAll('#pasosEm li').forEach((li) => {
    li.classList.remove('activo');
    li.classList.add('hecho');
  });
  estado.solicitud = null;
  $('#btnEmergencia').disabled = false;
  $('#selNodoEm').disabled = false;
  if (!s.resultado) $('#estadoEm').innerHTML = '<p class="em-espera">La solicitud terminó sin resultado. Intenta de nuevo.</p>';
}

/* ---------------- Mapa ---------------- */

const RIO = 'M 10 118 C 90 112, 170 140, 250 178 S 400 236, 480 222 S 600 168, 660 170 S 730 182, 752 176';
const AFLUENTE = 'M 60 412 C 80 360, 120 320, 165 285 S 230 215, 262 186';
let caminos = null;

function puntoEnRuta(path, x) {
  const L = path.getTotalLength();
  let mejor = null;
  for (let s = 0; s <= L; s += 2) {
    const p = path.getPointAtLength(s);
    if (!mejor || Math.abs(p.x - x) < Math.abs(mejor.x - x)) mejor = p;
  }
  return mejor;
}

function construirMapa() {
  const svg = $('#mapa');
  svg.innerHTML = `
    <defs>
      <pattern id="bosque" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="6" cy="7" r="5" fill="#c6dcbf"/><circle cx="19" cy="18" r="6" fill="#bfd6b6"/></pattern>
      <marker id="flechaRio" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#6aa9bd"/></marker>
    </defs>
    <rect width="760" height="420" fill="url(#bosque)" opacity="0.55"/>
    <path d="${RIO}" fill="none" stroke="#9fd0de" stroke-width="30" stroke-linecap="round"/>
    <path id="rutaRio" d="${RIO}" fill="none" stroke="#7fbdd0" stroke-width="16" stroke-linecap="round"/>
    <path d="${AFLUENTE}" fill="none" stroke="#9fd0de" stroke-width="14" stroke-linecap="round"/>
    <path id="rutaAfluente" d="${AFLUENTE}" fill="none" stroke="#86c1d3" stroke-width="7" stroke-linecap="round"/>
    <path d="M 520 205 L 580 182" stroke="#6aa9bd" stroke-width="2" marker-end="url(#flechaRio)"/>
    <text x="40" y="92" font-size="16" font-weight="700" fill="#3c7f93" font-family="Montserrat, sans-serif">Río Madre de Dios</text>
    <text x="540" y="222" font-size="12" fill="#5b8e9c">sentido de la corriente</text>
    <text x="22" y="395" font-size="13" font-weight="600" fill="#4e8797" transform="rotate(-48 22 395)">Quebrada Huepetuhe</text>
    <g id="enlaces"></g>
    <g id="puerta"></g>
    <g id="paquetes"></g>
    <g id="nodosMapa"></g>`;
  caminos = { principal: svg.querySelector('#rutaRio'), afluente: svg.querySelector('#rutaAfluente') };
  const pos = {};
  for (const n of NODOS) {
    const p = puntoEnRuta(n.id === 'AM-04' ? caminos.afluente : caminos.principal, n.x);
    pos[n.id] = { x: p.x, y: p.y };
  }
  pos.gw = { x: 655, y: 82 };
  estado.posMapa = pos;
  const cadena = ['AM-04', 'AM-01', 'AM-02', 'AM-03', 'gw'];
  $('#enlaces').innerHTML = cadena.slice(0, -1).map((id, i) => {
    const a = pos[id], b = pos[cadena[i + 1]];
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#1f7a8c" stroke-width="2" stroke-dasharray="6 6" opacity="0.7"/>`;
  }).join('');
  const g = pos.gw;
  $('#puerta').innerHTML = `
    <rect x="${g.x - 70}" y="${g.y - 58}" width="140" height="26" rx="6" fill="#0b2236"/>
    <text x="${g.x}" y="${g.y - 41}" text-anchor="middle" font-size="12" font-weight="600" fill="#fff">Puerta de enlace LoRa</text>
    <path d="M ${g.x} ${g.y - 28} L ${g.x - 12} ${g.y + 16} M ${g.x} ${g.y - 28} L ${g.x + 12} ${g.y + 16} M ${g.x - 8} ${g.y} L ${g.x + 8} ${g.y}" stroke="#0b2236" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${g.x}" cy="${g.y - 28}" r="4" fill="#f28c28"/>
    <text x="${g.x}" y="${g.y + 34}" text-anchor="middle" font-size="12.5" fill="#33505f">Puerto Maldonado → internet</text>`;
}

function renderMapa() {
  const pos = estado.posMapa;
  const colores = { normal: '#2f8a57', precaucion: '#f0b400', alerta: '#d64545' };
  $('#nodosMapa').innerHTML = NODOS.map((n) => {
    const p = pos[n.id];
    const e = estadoNodo(n.id);
    const r = ultimo(n.id);
    const derecha = n.id !== 'AM-03';
    const tx = derecha ? p.x + 20 : p.x - 20;
    const anchor = derecha ? 'start' : 'end';
    const ty = n.id === 'AM-02' ? p.y + 34 : p.y - 22;
    return `
      <g class="nodo ${n.id === estado.nodo ? 'sel' : ''}" data-nodo="${n.id}" tabindex="0" role="button" aria-label="Seleccionar nodo ${n.id}">
        ${e === 'alerta' ? `<circle cx="${p.x}" cy="${p.y}" r="14" fill="${colores.alerta}" opacity="0.35"><animate attributeName="r" values="14;30;14" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.45;0;0.45" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
        <circle class="anillo" cx="${p.x}" cy="${p.y}" r="13" fill="#fff" stroke="${colores[e]}" stroke-width="2"/>
        <circle cx="${p.x}" cy="${p.y}" r="8" fill="${colores[e]}"/>
        <text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="15" font-weight="700" fill="#0b2236" font-family="Montserrat, sans-serif">${n.id} · ${n.lugar}</text>
        <text x="${tx}" y="${ty + 17}" text-anchor="${anchor}" font-size="13.5" fill="#33505f">Hg ${formatearMetal('Hg', r.metales.Hg)} µg/L${n.id === NODO_MAQUETA ? ' · maqueta 3D' : ''}</text>
      </g>`;
  }).join('');
  document.querySelectorAll('#nodosMapa .nodo').forEach((el) => {
    const elegir = () => { estado.nodo = el.dataset.nodo; $('#selNodoEm').value = estado.nodo; renderTodo(); };
    el.addEventListener('click', elegir);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } });
  });
}

function animarPaquete(nodo) {
  const pos = estado.posMapa;
  if (!pos) return;
  const cadena = ['AM-04', 'AM-01', 'AM-02', 'AM-03', 'gw'];
  const desde = cadena.indexOf(nodo);
  const puntos = cadena.slice(desde).map((id) => `${pos[id].x},${pos[id].y}`);
  if (puntos.length < 2) return;
  const d = `M ${puntos.join(' L ')}`;
  const dur = 0.7 * (puntos.length - 1);
  const ns = 'http://www.w3.org/2000/svg';
  const c = document.createElementNS(ns, 'circle');
  c.setAttribute('r', '6');
  c.setAttribute('fill', '#f28c28');
  c.setAttribute('stroke', '#fff');
  c.setAttribute('stroke-width', '2');
  const anim = document.createElementNS(ns, 'animateMotion');
  anim.setAttribute('dur', `${dur}s`);
  anim.setAttribute('path', d);
  anim.setAttribute('fill', 'freeze');
  anim.setAttribute('begin', 'indefinite');
  c.appendChild(anim);
  $('#paquetes').appendChild(c);
  try { anim.beginElement(); } catch { /* sin SMIL */ }
  setTimeout(() => c.remove(), dur * 1000 + 300);
}

/* ---------------- Gráficas ---------------- */

function escala(d0, d1, r0, r1) {
  return (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

function ticksTiempo(t0, t1) {
  const rango = (t1 - t0) / HORA;
  const paso = rango <= 26 ? 4 * HORA : rango <= 170 ? 24 * HORA : 5 * 24 * HORA;
  const fmtT = rango <= 26 ? fmtHora : rango <= 170 ? fmtDia : fmtDiaMes;
  const offset = 5 * HORA;
  const ticks = [];
  for (let t = Math.ceil((t0 + offset) / paso) * paso - offset; t <= t1; t += paso) ticks.push({ t, txt: fmtT.format(new Date(t)) });
  return ticks;
}

function serieVisible() {
  const t1 = Date.now();
  const t0 = t1 - estado.rango * HORA;
  return { t0, t1, serie: datos[estado.nodo].filter((r) => r.t >= t0 - HORA) };
}

function dibujarHg() {
  const cont = $('#graficaHg');
  const W = cont.clientWidth || 700, H = cont.clientHeight || 250;
  const m = { l: 44, r: 54, t: 22, b: 24 };
  const { t0, t1, serie } = serieVisible();
  const maxHg = Math.max(7.5, ...serie.map((r) => (r.metales.Hg.valor || 0) + r.metales.Hg.u)) * 1.08;
  const x = escala(t0, t1, m.l, W - m.r);
  const y = escala(0, maxHg, H - m.b, m.t);
  const ticksY = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 25, 30].filter((v) => v <= maxHg);
  const pts = serie.map((r) => [x(Math.max(r.t, t0)), y(r.metales.Hg.valor || 0)]);
  const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = pts.length ? `${linea} L${pts[pts.length - 1][0].toFixed(1)},${y(0)} L${pts[0][0].toFixed(1)},${y(0)} Z` : '';
  const banda = serie.map((r, i) => `${i ? 'L' : 'M'}${x(Math.max(r.t, t0)).toFixed(1)},${y((r.metales.Hg.valor || 0) + r.metales.Hg.u).toFixed(1)}`).join('') +
    serie.slice().reverse().map((r) => `L${x(Math.max(r.t, t0)).toFixed(1)},${y(Math.max(0, (r.metales.Hg.valor || 0) - r.metales.Hg.u)).toFixed(1)}`).join('') + 'Z';
  const marcas = serie.filter((r) => r.origen !== 'automatica').map((r) => {
    const px = x(r.t), py = y(r.metales.Hg.valor || 0);
    return `<path d="M${px},${py - 7} L${px + 7},${py} L${px},${py + 7} L${px - 7},${py} Z" fill="#f28c28" stroke="#fff" stroke-width="1.5"/>`;
  }).join('');
  cont.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <rect x="${m.l}" y="${y(maxHg)}" width="${W - m.l - m.r}" height="${y(6) - y(maxHg)}" fill="#fde8e8" opacity="0.7"/>
      <rect x="${m.l}" y="${y(6)}" width="${W - m.l - m.r}" height="${y(2) - y(6)}" fill="#fff4d6" opacity="0.7"/>
      ${ticksY.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e6edf0"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${ticksTiempo(t0, t1).map((k) => `<text x="${x(k.t)}" y="${H - 6}" text-anchor="middle">${k.txt}</text>`).join('')}
      <line x1="${m.l}" x2="${W - m.r}" y1="${y(6)}" y2="${y(6)}" stroke="#d64545" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="${W - m.r + 6}" y="${y(6) + 4}" style="fill:#d64545;font-weight:700">OMS 6</text>
      <line x1="${m.l}" x2="${W - m.r}" y1="${y(2)}" y2="${y(2)}" stroke="#c98a00" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="${W - m.r + 6}" y="${y(2) + 4}" style="fill:#c98a00;font-weight:700">EPA 2</text>
      <text x="${m.l - 40}" y="11" style="font-weight:600">µg/L</text>
      <path d="${banda}" fill="#1f7a8c" opacity="0.12"/>
      <path d="${area}" fill="url(#gradHg)" opacity="0.35"/>
      <defs><linearGradient id="gradHg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7a8c"/><stop offset="1" stop-color="#1f7a8c" stop-opacity="0"/></linearGradient></defs>
      <path d="${linea}" fill="none" stroke="#16324f" stroke-width="1.8" stroke-linejoin="round"/>
      ${marcas}
      <line id="cursorHg" y1="${m.t}" y2="${H - m.b}" stroke="#0b2236" stroke-width="1" opacity="0"/>
      <circle id="puntoHg" r="4.5" fill="#0b2236" stroke="#fff" stroke-width="2" opacity="0"/>
      <rect id="capaHg" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>
    </svg>`;
  prepararHover(cont, serie, x, (r) => y(r.metales.Hg.valor || 0));
}

function dibujarTurbidez() {
  const cont = $('#graficaTurb');
  const W = cont.clientWidth || 700, H = cont.clientHeight || 110;
  const m = { l: 44, r: 54, t: 16, b: 20 };
  const { t0, t1, serie } = serieVisible();
  const maxT = Math.max(400, ...serie.map((r) => r.agua.turbidez)) * 1.1;
  const x = escala(t0, t1, m.l, W - m.r);
  const y = escala(0, maxT, H - m.b, m.t);
  const linea = serie.map((r, i) => `${i ? 'L' : 'M'}${x(Math.max(r.t, t0)).toFixed(1)},${y(r.agua.turbidez).toFixed(1)}`).join('');
  const area = serie.length ? `${linea} L${x(serie[serie.length - 1].t).toFixed(1)},${y(0)} L${x(Math.max(serie[0].t, t0)).toFixed(1)},${y(0)} Z` : '';
  cont.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <text x="${m.l}" y="11" style="font-weight:600;fill:#33505f">Turbidez (NTU) · una subida brusca puede indicar una draga río arriba</text>
      <line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="#e6edf0"/>
      <text x="${m.l - 8}" y="${y(maxT / 1.1) + 4}" text-anchor="end">${Math.round(maxT / 1.1)}</text>
      <text x="${m.l - 8}" y="${y(0) + 4}" text-anchor="end">0</text>
      <path d="${area}" fill="#b98a4c" opacity="0.25"/>
      <path d="${linea}" fill="none" stroke="#8a6232" stroke-width="1.5"/>
      <line id="cursorTurb" y1="${m.t}" y2="${H - m.b}" stroke="#0b2236" stroke-width="1" opacity="0"/>
      <rect id="capaTurb" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>
    </svg>`;
  prepararHover(cont, serie, x, null);
}

function prepararHover(cont, serie, x, yDe) {
  const svg = cont.querySelector('svg');
  const capa = svg.querySelector('rect[id^="capa"]');
  const tip = $('#tooltip');
  const caja = cont.closest('.grafica-caja');
  const mover = (e) => {
    const rect = svg.getBoundingClientRect();
    const escalaX = svg.viewBox.baseVal.width / rect.width;
    const px = (e.clientX - rect.left) * escalaX;
    let mejor = null;
    for (const r of serie) {
      const d = Math.abs(x(r.t) - px);
      if (!mejor || d < mejor.d) mejor = { r, d };
    }
    if (!mejor) return;
    const r = mejor.r;
    ['#cursorHg', '#cursorTurb'].forEach((s) => {
      const l = caja.querySelector(s);
      if (l) { l.setAttribute('x1', x(r.t)); l.setAttribute('x2', x(r.t)); l.setAttribute('opacity', 0.35); }
    });
    const pto = caja.querySelector('#puntoHg');
    if (pto && yDe) {
      pto.setAttribute('cx', x(r.t));
      pto.setAttribute('cy', yDe(r));
      pto.setAttribute('opacity', 1);
    }
    const e2 = clasificar('Hg', r.metales.Hg.valor);
    tip.hidden = false;
    tip.innerHTML = `<b>${fmtFecha.format(new Date(r.t))}</b><br><span class="t-hg">Hg ${formatearMetal('Hg', r.metales.Hg)} µg/L</span> · ${ETIQUETA_ESTADO[e2]}<br>Turbidez ${fmt(r.agua.turbidez, 0)} NTU · pH ${fmt(r.agua.ph, 1)}<br><span style="opacity:.75">${ORIGEN[r.origen] || r.origen}</span>`;
    const cajaRect = caja.getBoundingClientRect();
    let left = e.clientX - cajaRect.left + 14;
    if (left + 200 > cajaRect.width) left = e.clientX - cajaRect.left - 214;
    tip.style.left = `${left}px`;
    tip.style.top = `${e.clientY - cajaRect.top - 20}px`;
  };
  const salir = () => {
    tip.hidden = true;
    caja.querySelectorAll('#cursorHg, #cursorTurb, #puntoHg').forEach((el) => el.setAttribute('opacity', 0));
  };
  capa.addEventListener('mousemove', mover);
  capa.addEventListener('mouseleave', salir);
}

document.querySelectorAll('.segmentado button').forEach((b) => b.addEventListener('click', () => {
  estado.rango = Number(b.dataset.rango);
  document.querySelectorAll('.segmentado button').forEach((o) => o.classList.toggle('activo', o === b));
  dibujarHg();
  dibujarTurbidez();
}));

/* ---------------- Detalle, KPIs y eventos ---------------- */

function sparkline(valores, color) {
  if (valores.length < 2) return '';
  const min = Math.min(...valores), max = Math.max(...valores);
  const x = escala(0, valores.length - 1, 2, 198);
  const y = escala(min, max === min ? min + 1 : max, 28, 2);
  return `<svg viewBox="0 0 200 30" preserveAspectRatio="none"><path d="${valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
}

function renderDetalle() {
  const r = ultimo(estado.nodo);
  const n = porNodo[estado.nodo];
  const e = estadoGeneral(r);
  $('#detNodo').textContent = `${n.id} · ${n.lugar}`;
  $('#detFecha').textContent = `${fmtFecha.format(new Date(r.t))} · ${ORIGEN[r.origen] || r.origen} · ${hace(r.t)}`;
  const etq = $('#detEstado');
  etq.className = `etiqueta-estado ${e}`;
  etq.textContent = ETIQUETA_ESTADO[e];
  $('#tablaMetales').innerHTML = METALES.map((m) => {
    const lec = r.metales[m.id];
    const em = clasificar(m, lec.valor);
    const ref = m.guia || 3000;
    const pct = lec.valor ? lec.valor / ref : 0;
    const ancho = Math.min(100, (pct / 1.5) * 100);
    const txtPct = m.guia ? `${pct < 0.01 && lec.valor ? '< 1' : Math.round(pct * 100)} % del valor guía (${m.fuente})` : m.fuente;
    return `<tr>
      <td><div class="metal"><b>${m.id}</b><div>${m.nombre}<small>Electrodo de ${m.electrodo}</small></div></div></td>
      <td>${formatearMetal(m, lec)}</td>
      <td><div class="barra ${em}"><span style="width:${ancho}%"></span><i style="left:${(1 / 1.5) * 100}%"></i></div><span class="barra-txt">${txtPct}</span></td>
      <td><span class="etiqueta-estado ${em}">${ETIQUETA_ESTADO[em]}</span></td>
    </tr>`;
  }).join('');

  const ult24 = datos[estado.nodo].filter((x) => x.t > Date.now() - 24 * HORA);
  const turbAlta = r.agua.turbidez > 450;
  const params = [
    { id: 'turbidez', nombre: 'Turbidez', v: fmt(r.agua.turbidez, 0), u: 'NTU', aviso: turbAlta, color: '#8a6232' },
    { id: 'ph', nombre: 'pH', v: fmt(r.agua.ph, 1), u: '', color: '#1f7a8c' },
    { id: 'conductividad', nombre: 'Conductividad', v: fmt(r.agua.conductividad, 0), u: 'µS/cm', color: '#16324f' },
    { id: 'temperatura', nombre: 'Temperatura', v: fmt(r.agua.temperatura, 1), u: '°C', color: '#f28c28' }
  ];
  $('#paramsAgua').innerHTML = params.map((p) => `
    <div class="param ${p.aviso ? 'aviso' : ''}">
      <p>${p.nombre}${p.aviso ? ' · subida brusca' : ''}</p>
      <strong>${p.v} <small>${p.u}</small></strong>
      ${sparkline(ult24.map((x) => x.agua[p.id]), p.color)}
    </div>`).join('');

  const s = r.salud;
  const senal = Math.round(Math.min(100, Math.max(0, ((s.rssi + 120) / 40) * 100)));
  const restanElectrodo = Math.max(0, 45 - s.electrodoDias);
  const items = [
    { n: 'Batería (2 × 18650)', v: `${s.bateria} %`, p: s.bateria },
    { n: 'Panel solar 3 W', v: s.cargando ? 'Cargando' : 'De noche', p: s.cargando ? 100 : 0 },
    { n: 'Señal LoRa', v: `${s.rssi} dBm`, p: senal },
    { n: 'Reactivo', v: `${s.reactivoPct} %`, p: s.reactivoPct },
    { n: 'Electrodo (días de uso)', v: `${s.electrodoDias} d · cambio en ${restanElectrodo} d`, p: Math.max(0, 100 - (s.electrodoDias / 45) * 100) },
    { n: 'Última comunicación', v: hace(r.t), p: 100 }
  ];
  $('#saludNodo').innerHTML = items.map((it) => `
    <div class="salud-item">
      <p>${it.n}<b>${it.v}</b></p>
      <div class="medidor ${it.p < 25 ? 'bajo' : ''}"><span style="width:${it.p}%"></span></div>
    </div>`).join('');
}

function renderKpis(eventos) {
  const total = NODOS.length;
  $('#kpiNodos').innerHTML = `${total}<small> / ${total}</small>`;
  $('#kpiNodosSub').textContent = `Puerta de enlace en línea · ${maquetaConectada() ? `${NODO_MAQUETA} enlazado a la maqueta 3D` : 'malla LoRa sincronizada'}`;
  const r = ultimo(estado.nodo);
  const eHg = clasificar('Hg', r.metales.Hg.valor);
  $('#kpiHgCaja').className = `tarjeta kpi ${eHg === 'nd' ? 'normal' : eHg}`;
  $('#kpiHg').innerHTML = `${formatearMetal('Hg', r.metales.Hg)}<small> µg/L</small>`;
  $('#kpiHgSub').textContent = `${estado.nodo} · ${porNodo[estado.nodo].lugar} · ${ETIQUETA_ESTADO[eHg]} · ${hace(r.t)}`;
  const semana = eventos.filter((e) => e.t > Date.now() - 7 * 24 * HORA && e.tipo !== 'diag');
  const al = semana.filter((e) => e.tipo === 'alerta').length;
  $('#kpiAlertas').textContent = semana.length;
  $('#kpiAlertasSub').textContent = `${al} sobre 6 µg/L (OMS) · ${semana.length - al} entre 2 y 6 µg/L`;
  const n = NODOS.reduce((s, x) => s + datos[x.id].length, 0);
  $('#kpiMediciones').textContent = n.toLocaleString('es-PE');
}

function renderEventos(eventos) {
  const nombres = { alerta: 'Pico de mercurio · ALERTA', precaucion: 'Subida de mercurio · Precaución', diag: 'Diagnóstico de emergencia' };
  $('#tablaEventos').innerHTML = eventos.slice(0, 60).map((ev) => {
    const tipo = ev.tipo === 'diag' ? 'diag' : ev.tipo;
    const nombre = ev.tipo === 'diag'
      ? `${ev.med.origen === 'manual' ? 'Muestreo desde la maqueta 3D' : nombres.diag} · ${ETIQUETA_ESTADO[ev.estado]}`
      : `${nombres[ev.tipo]}${ev.enCurso ? ' · en curso' : ` · ${Math.max(1, Math.round((ev.fin - ev.t) / HORA) + 1)} h`}`;
    const puedeAlertar = ev.tipo === 'alerta' || (ev.tipo === 'diag' && ev.estado !== 'normal') || ev.tipo === 'precaucion';
    return `<tr class="${estado.idsNuevos.has(ev.id) ? 'fila-nueva' : ''}">
      <td>${fmtFecha.format(new Date(ev.t))}</td>
      <td><b>${ev.nodo}</b> · ${porNodo[ev.nodo].lugar}</td>
      <td><span class="tipo ${tipo}"><i></i>${nombre}</span></td>
      <td>${ev.hg === null || ev.hg === undefined ? '< 0.1' : ev.hg.toFixed(2)} µg/L</td>
      <td>${fmt(ev.turb, 0)} NTU</td>
      <td>${puedeAlertar ? `<button class="btn btn-borde btn-mini" data-alerta="${ev.med.id}">Ver alerta</button>` : '—'}</td>
    </tr>`;
  }).join('');
  estado.idsNuevos.clear();
}

function buscarMedicion(id) {
  for (const n of NODOS) {
    const r = datos[n.id].find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-alerta]');
  if (!b) return;
  const med = buscarMedicion(b.dataset.alerta);
  if (med) abrirAlerta(med);
});

function abrirAlerta(med) {
  const n = porNodo[med.nodo];
  const hg = formatearMetal('Hg', med.metales.Hg);
  const e = clasificar('Hg', med.metales.Hg.valor);
  const cuando = fmtFecha.format(new Date(med.t));
  const texto = e === 'alerta'
    ? `⚠ ALERTA AmazonMercury\n${n.rio} · ${n.lugar} · ${cuando}\nMercurio en el agua: ${hg} µg/L (valor guía OMS: 6 µg/L).\n\nNo use agua del río para beber ni cocinar hasta nuevo aviso. Hervir el agua NO elimina el mercurio.\nInformación: posta de salud más cercana.`
    : `AVISO DE PRECAUCIÓN AmazonMercury\n${n.rio} · ${n.lugar} · ${cuando}\nMercurio en el agua: ${hg} µg/L (sobre 2 µg/L, por debajo del valor guía OMS de 6 µg/L).\n\nPrefiera agua de una fuente segura mientras se confirma la medición. Hervir el agua NO elimina el mercurio.`;
  $('#smsTexto').textContent = texto;
  $('#modalAlerta').hidden = false;
}
document.querySelectorAll('#modalAlerta [data-cerrar]').forEach((el) => el.addEventListener('click', () => { $('#modalAlerta').hidden = true; }));
$('#btnSimEnvio').addEventListener('click', () => {
  $('#modalAlerta').hidden = true;
  aviso('Simulación: alerta registrada para comunidades y autoridades. No se envió ningún mensaje real.', 'ok');
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modalAlerta').hidden = true; });

$('#btnCsv').addEventListener('click', () => {
  const filas = [['fecha_hora_lima', 'nodo', 'origen', ...METALES.flatMap((m) => [`${m.id}_ugL`, `${m.id}_incert`]), 'turbidez_NTU', 'pH', 'conductividad_uScm', 'temperatura_C', 'bateria_pct', 'simulado']];
  for (const r of datos[estado.nodo]) {
    filas.push([
      fmtFecha.format(new Date(r.t)).replace(',', ''), r.nodo, r.origen,
      ...METALES.flatMap((m) => [r.metales[m.id].valor === null ? `<${m.lod}` : r.metales[m.id].valor.toFixed(m.dec + 1), r.metales[m.id].u.toFixed(m.dec + 1)]),
      r.agua.turbidez.toFixed(0), r.agua.ph.toFixed(2), r.agua.conductividad.toFixed(0), r.agua.temperatura.toFixed(1), r.salud.bateria, 'si'
    ]);
  }
  const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `amazonmercury_${estado.nodo}_simulado.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

/* ---------------- Avisos y modo demo ---------------- */

function aviso(texto, tipo = '') {
  const el = document.createElement('div');
  el.className = `aviso ${tipo}`;
  el.textContent = texto;
  $('#avisos').appendChild(el);
  setTimeout(() => el.remove(), 5200);
}

$('#chkVivo').addEventListener('change', (e) => {
  clearInterval(estado.vivo);
  if (!e.target.checked) return;
  estado.vivo = setInterval(() => {
    const n = NODOS[Math.floor(Math.random() * NODOS.length)];
    const previo = ultimo(n.id);
    const med = generarMedicion({ nodo: n.id, escenario: Math.random() < 0.1 ? 'precaucion' : 'normal', origen: 'automatica' });
    med.salud = { ...previo.salud };
    insertar(med);
    canal.enviar({ tipo: 'resultado', nodo: n.id, medicion: med });
    animarPaquete(n.id);
    renderTodo();
    aviso(`Lectura automática de ${n.id}: Hg ${formatearMetal('Hg', med.metales.Hg)} µg/L`);
  }, 20000);
});

const reportesNuevos = new Set();
function renderReportes() {
  const lista = leerReportes();
  $('#numReportes').textContent = `${lista.length} reportes`;
  $('#listaReportes').innerHTML = lista.slice(0, 12).map((r) => {
    const t = TIPOS_REPORTE.find((x) => x.id === r.tipo) || { icono: '💬', texto: r.tipo };
    return `<article class="reporte ${reportesNuevos.has(r.id) ? 'nuevo' : ''}">
      <span class="ri">${t.icono}</span>
      <div><b>${t.texto} · ${r.nodo} ${porNodo[r.nodo] ? porNodo[r.nodo].lugar : ''}</b>
      ${r.texto ? `<p>"${r.texto.replace(/[<>&]/g, '')}"</p>` : ''}
      <small>${fmtFecha.format(new Date(r.t))} · ${r.origen}${r.simulado ? ' · simulado' : ''}</small></div>
    </article>`;
  }).join('');
}

/* ---------------- Inicio ---------------- */

function renderTodo() {
  const eventos = calcularEventos();
  renderKpis(eventos);
  renderMapa();
  dibujarHg();
  dibujarTurbidez();
  renderDetalle();
  renderEventos(eventos);
  const n = porNodo[estado.nodo];
  $('#tituloGrafica').textContent = `Mercurio disuelto · ${n.id} ${n.lugar}`;
  $('#subGrafica').textContent = 'Franja = incertidumbre de la medición · ◆ = diagnóstico de emergencia o muestreo manual';
}

function iniciar() {
  $('#selNodoEm').innerHTML = NODOS.map((n) => `<option value="${n.id}">${n.id} · ${n.lugar}${n.id === NODO_MAQUETA ? ' (maqueta 3D)' : ''}</option>`).join('');
  $('#selNodoEm').value = estado.nodo;
  $('#selNodoEm').addEventListener('change', (e) => { estado.nodo = e.target.value; renderTodo(); });
  $('#selEscenario').innerHTML = Object.entries(ESCENARIOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#btnEmergencia').addEventListener('click', solicitar);
  renderPasos();
  construirMapa();
  renderTodo();
  renderReportes();
  pintarConexion();
  let ancho = 0;
  new ResizeObserver(() => {
    const w = $('#graficaHg').clientWidth;
    if (Math.abs(w - ancho) > 4) {
      ancho = w;
      dibujarHg();
      dibujarTurbidez();
    }
  }).observe($('#graficaHg'));
}

iniciar();
