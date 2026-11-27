import {
  NODOS, NODO_MAQUETA, FASES_CICLO, TIPOS_REPORTE, TEXTO_COMUNIDAD,
  estadoGeneral, clasificar, formatearMetal, nivelHg, generarHistorial,
  crearCanal, leerLecturasGuardadas, guardarReporte
} from '../comun/simulacion.js';

const $ = (s) => document.querySelector(s);
const HORA = 3600e3;
const ZONA = 'America/Lima';
const fmtHora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
const fmtDiaCorto = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: ZONA });
const fmtDiaClave = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONA });
const ORDEN_RIO = ['AM-04', 'AM-01', 'AM-02', 'AM-03'];
const porNodo = Object.fromEntries(NODOS.map((n) => [n.id, n]));

const datos = generarHistorial(30);
leerLecturasGuardadas().forEach(insertar);

const params = new URLSearchParams(location.search);
let lugar = params.get('lugar');
if (!porNodo[lugar]) {
  try { lugar = localStorage.getItem('mirio-lugar'); } catch { lugar = null; }
}
if (!porNodo[lugar]) lugar = NODO_MAQUETA;

let detalleAbierto = false;
let midiendo = null;

function insertar(med) {
  const lista = datos[med.nodo];
  if (!lista || lista.some((x) => x.id === med.id)) return false;
  lista.push(med);
  lista.sort((a, b) => a.t - b.t);
  return true;
}

const ultimo = (nodo) => datos[nodo][datos[nodo].length - 1];
const estadoDe = (med) => {
  const e = estadoGeneral(med);
  return e === 'nd' ? 'normal' : e;
};
const hace = (t) => {
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'hace un momento';
  if (min === 1) return 'hace 1 minuto';
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.round(min / 60);
  return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
};

function gotaSVG(estado) {
  const color = TEXTO_COMUNIDAD[estado].color;
  const caras = {
    normal: `<path d="M56 112 q19 18 38 0" stroke="#133241" stroke-width="6" fill="none" stroke-linecap="round"/>
             <ellipse cx="54" cy="96" rx="7" ry="9" fill="#133241"/><ellipse cx="96" cy="96" rx="7" ry="9" fill="#133241"/>
             <circle cx="44" cy="112" r="7" fill="#ff8f8f" opacity=".45"/><circle cx="106" cy="112" r="7" fill="#ff8f8f" opacity=".45"/>`,
    precaucion: `<path d="M58 118 q8-6 17 0 t17 0" stroke="#133241" stroke-width="6" fill="none" stroke-linecap="round"/>
             <ellipse cx="54" cy="98" rx="7" ry="8" fill="#133241"/><ellipse cx="96" cy="98" rx="7" ry="8" fill="#133241"/>
             <path d="M44 82 l18 4 M106 82 l-18 4" stroke="#133241" stroke-width="5" stroke-linecap="round"/>`,
    alerta: `<ellipse cx="75" cy="120" rx="11" ry="13" fill="#133241"/>
             <circle cx="54" cy="96" r="9" fill="#fff"/><circle cx="96" cy="96" r="9" fill="#fff"/>
             <circle cx="54" cy="97" r="5" fill="#133241"/><circle cx="96" cy="97" r="5" fill="#133241"/>
             <path d="M42 80 l20 8 M108 80 l-20 8" stroke="#133241" stroke-width="5" stroke-linecap="round"/>
             <g transform="translate(128 26)"><circle r="18" fill="#fff" stroke="${color}" stroke-width="4"/><path d="M0 -9v10" stroke="${color}" stroke-width="5" stroke-linecap="round"/><circle cy="8" r="2.8" fill="${color}"/></g>`
  };
  return `<svg viewBox="0 0 150 180" aria-hidden="true">
    <ellipse cx="75" cy="172" rx="44" ry="7" fill="#133241" opacity=".12"/>
    <g class="salta">
      <path class="cuerpo" d="M75 6 C55 44 22 74 22 112 a53 53 0 0 0 106 0 C128 74 95 44 75 6z" fill="${color}"/>
      <path d="M50 70 C42 84 38 96 40 108" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".45"/>
      <ellipse cx="75" cy="112" rx="44" ry="40" fill="#fff" opacity=".18"/>
      ${caras[estado]}
    </g>
  </svg>`;
}

const CONSEJOS = {
  normal: [
    ['😊', 'El río está bien hoy. Puede usarlo como siempre.', true],
    ['🫖', 'Para tomar, use agua tratada o hervida: así se eliminan los microbios.'],
    ['👀', 'Si ve algo raro en el agua, avísenos con el botón "Reportar".']
  ],
  precaucion: [
    ['🪣', 'Para beber y cocinar, prefiera agua de pozo, de lluvia o embotellada.', true],
    ['🔥', 'Hervir el agua NO quita el mercurio.'],
    ['⏱️', 'Estamos midiendo cada hora. Revise de nuevo más tarde.']
  ],
  alerta: [
    ['⛔', 'NO use agua del río para beber ni cocinar hasta nuevo aviso.', true],
    ['🔥', 'Hervir el agua NO quita el mercurio.'],
    ['📢', 'Avise a sus vecinos y a la posta de salud más cercana.']
  ]
};

function render() {
  const n = porNodo[lugar];
  const r = ultimo(lugar);
  const e = estadoDe(r);
  const t = TEXTO_COMUNIDAD[e];
  document.body.classList.remove('normal', 'precaucion', 'alerta');
  document.body.classList.add(e);
  document.title = e === 'alerta' ? `⚠ Alerta · Mi Río ${n.lugar}` : `Mi Río · ${n.lugar}`;

  $('#lugares').innerHTML = ORDEN_RIO.map((id) => {
    const est = estadoDe(ultimo(id));
    return `<button class="lugar" data-lugar="${id}" aria-pressed="${id === lugar}"><i class="${est}"></i>${porNodo[id].lugar}</button>`;
  }).join('');
  document.querySelectorAll('.lugar').forEach((b) => b.addEventListener('click', () => {
    lugar = b.dataset.lugar;
    try { localStorage.setItem('mirio-lugar', lugar); } catch { /* sin almacenamiento */ }
    detalleAbierto = false;
    render();
  }));

  const banner = $('#banner');
  banner.hidden = e !== 'alerta';
  banner.innerHTML = `<span class="bi">⚠️</span><div>ALERTA en ${n.lugar}: no use agua del río para beber ni cocinar hasta nuevo aviso.<small>Hervir el agua no quita el mercurio. Avise a sus vecinos.</small></div>`;

  $('#gota').innerHTML = gotaSVG(e);
  $('#estadoLugar').textContent = `Agua del río en ${n.lugar}`;
  $('#estadoTitulo').textContent = t.titulo;
  $('#estadoFrase').textContent = t.frase;

  const hg = r.metales.Hg.valor;
  const nivel = nivelHg(hg);
  const etq = $('#hgNivel');
  etq.textContent = nivel.texto;
  etq.className = `hg-nivel ${nivel.id}`;
  $('#hgMarca').style.left = `${(nivel.pos * 100).toFixed(1)}%`;
  const otros = ['As', 'Pb', 'Cd', 'Cu', 'Zn'].filter((m) => ['precaucion', 'alerta'].includes(clasificar(m, r.metales[m].valor)));
  $('#detalle').innerHTML = `Mercurio: <strong>${formatearMetal('Hg', r.metales.Hg)} µg/L</strong> (microgramos por litro). Hasta 2 está bien; desde 6 ya no es seguro para beber, según la OMS.<br>${otros.length ? `También hay más de lo normal de: <strong>${otros.join(', ')}</strong>.` : 'Los otros metales (arsénico, plomo, cadmio, cobre y zinc) están normales.'} Turbidez: ${r.agua.turbidez.toFixed(0)} NTU.`;
  $('#detalle').hidden = !detalleAbierto;
  $('#btnDetalle').textContent = detalleAbierto ? 'Ocultar el número' : 'Ver el número exacto';
  $('#btnDetalle').setAttribute('aria-expanded', detalleAbierto);

  const proxima = Math.max(1, Math.ceil(((Math.floor(Date.now() / HORA) + 1) * HORA - Date.now()) / 60000));
  $('#actualizado').textContent = `Actualizado ${hace(r.t)} · próxima medición en ${proxima} min`;

  $('#consejos').innerHTML = CONSEJOS[e].map(([ico, txt, fuerte]) => `<li class="${fuerte ? 'fuerte' : ''}"><span class="e">${ico}</span>${txt}</li>`).join('');

  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const clave = fmtDiaClave.format(new Date(Date.now() - i * 24 * HORA));
    const del = datos[lugar].filter((x) => fmtDiaClave.format(new Date(x.t)) === clave);
    const orden = { normal: 0, precaucion: 1, alerta: 2 };
    const peor = del.reduce((p, x) => (orden[estadoDe(x)] > orden[p] ? estadoDe(x) : p), 'normal');
    dias.push({ nombre: i === 0 ? 'Hoy' : fmtDiaCorto.format(new Date(Date.now() - i * 24 * HORA)).replace('.', ''), peor, hoy: i === 0 });
  }
  $('#dias').innerHTML = dias.map((d) => `<li class="${d.hoy ? 'es-hoy' : ''}"><b class="${d.peor}" title="${TEXTO_COMUNIDAD[d.peor].titulo}"></b>${d.nombre}</li>`).join('');

  const colores = { normal: '#2f8a57', precaucion: '#d99100', alerta: '#d64545' };
  const corto = { normal: 'Bien', precaucion: 'Cuidado', alerta: 'No usar' };
  $('#tramos').innerHTML = ORDEN_RIO.map((id, i) => {
    const est = estadoDe(ultimo(id));
    const pos = i === 0 ? 'Afluente, río arriba' : i === ORDEN_RIO.length - 1 ? 'Río abajo' : `Tramo ${i}`;
    return `<li class="${id === lugar ? 'yo' : ''}" style="--c:${colores[est]}"><div>${porNodo[id].lugar}${id === lugar ? ' (tu comunidad)' : ''}<small>${pos}</small></div><span class="est">${corto[est]}</span></li>`;
  }).join('');
  const idx = ORDEN_RIO.indexOf(lugar);
  const arriba = ORDEN_RIO.slice(0, idx).filter((id) => estadoDe(ultimo(id)) !== 'normal');
  const viejo = $('.aviso-arriba');
  if (viejo) viejo.remove();
  if (arriba.length && e === 'normal') {
    const p = document.createElement('p');
    p.className = 'aviso-arriba';
    p.textContent = `Río arriba, en ${arriba.map((id) => porNodo[id].lugar).join(' y ')}, hay más mercurio. Podría llegar aquí en las próximas horas: esté atento.`;
    $('#tramos').after(p);
  }

  $('#guardianTxt').textContent = `Persona de ${n.lugar} capacitada por AmazonMercury. Cuida el nodo, lo limpia cada día y avisa si algo cambia.`;
  $('#guardianVisita').textContent = `✔ Revisó y limpió el nodo hoy a las 07:30`;
}

function pintarMidiendo() {
  const el = $('#midiendo');
  if (!midiendo || midiendo.nodo !== lugar) { el.hidden = true; return; }
  const f = FASES_CICLO.find((x) => x.id === midiendo.fase);
  el.hidden = false;
  el.innerHTML = `<span class="reloj-arena">⏳</span><div>Estamos revisando el agua de ${porNodo[lugar].lugar} ahora mismo…<br><small>${f ? `Paso: ${f.nombre.toLowerCase()}` : 'Preparando la medición'}</small></div>`;
}

function aviso(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.hidden = true; }, 4200);
}

const canal = crearCanal((msg) => {
  if (!msg || !msg.tipo) return;
  if ((msg.tipo === 'inicio' || msg.tipo === 'fase') && msg.nodo) {
    midiendo = { nodo: msg.nodo, fase: msg.fase || null };
    pintarMidiendo();
  }
  if (msg.tipo === 'fin') {
    midiendo = null;
    pintarMidiendo();
  }
  if (msg.tipo === 'resultado' && msg.medicion && insertar(msg.medicion)) {
    if (msg.medicion.nodo === lugar && !msg.repeticion) {
      const e = estadoDe(msg.medicion);
      aviso(e === 'alerta' ? '⚠ Nueva medición: el río tiene mucho mercurio' : e === 'precaucion' ? 'Nueva medición: cuidado, hay más mercurio' : 'Nueva medición: el río está bien');
      if (e === 'alerta' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    render();
  }
}, { pagina: 'mirio' });

$('#btnDetalle').addEventListener('click', () => {
  detalleAbierto = !detalleAbierto;
  render();
});

$('#btnEscuchar').addEventListener('click', () => {
  const b = $('#btnEscuchar');
  if (!('speechSynthesis' in window)) {
    aviso('Tu celular no permite leer en voz alta.');
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    b.classList.remove('hablando');
    return;
  }
  const r = ultimo(lugar);
  const e = estadoDe(r);
  const texto = `${$('#estadoLugar').textContent}. ${TEXTO_COMUNIDAD[e].titulo}. ${TEXTO_COMUNIDAD[e].frase}. Mercurio: ${nivelHg(r.metales.Hg.valor).texto}. ${CONSEJOS[e].map((c) => c[1]).join(' ')}`;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-PE';
  u.rate = 0.92;
  const voz = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('es'));
  if (voz) u.voice = voz;
  u.onend = () => b.classList.remove('hablando');
  b.classList.add('hablando');
  speechSynthesis.speak(u);
});

let tipoElegido = null;
$('#opcionesReporte').innerHTML = TIPOS_REPORTE.map((t) => `<button class="opcion" data-tipo="${t.id}" aria-pressed="false"><span class="e">${t.icono}</span>${t.texto}</button>`).join('');
document.querySelectorAll('.opcion').forEach((b) => b.addEventListener('click', () => {
  tipoElegido = b.dataset.tipo;
  document.querySelectorAll('.opcion').forEach((o) => o.setAttribute('aria-pressed', o === b));
  $('#btnEnviarReporte').disabled = false;
}));
$('#btnReportar').addEventListener('click', () => {
  tipoElegido = null;
  $('#textoReporte').value = '';
  $('#btnEnviarReporte').disabled = true;
  document.querySelectorAll('.opcion').forEach((o) => o.setAttribute('aria-pressed', 'false'));
  $('#modalReporte').hidden = false;
});
document.querySelectorAll('#modalReporte [data-cerrar]').forEach((el) => el.addEventListener('click', () => { $('#modalReporte').hidden = true; }));
$('#btnEnviarReporte').addEventListener('click', () => {
  if (!tipoElegido) return;
  const rep = { id: `rep-${Date.now()}`, nodo: lugar, tipo: tipoElegido, texto: $('#textoReporte').value.trim(), t: Date.now(), origen: 'Mi Río' };
  guardarReporte(rep);
  canal.enviar({ tipo: 'reporte', reporte: rep });
  $('#modalReporte').hidden = true;
  aviso('¡Gracias! Tu reporte llegó al equipo y al Guardián del Río.');
});
$('#btnAvisos').addEventListener('click', () => aviso('Demostración: en la versión real te inscribes con tu número y recibes las alertas por WhatsApp o SMS.'));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modalReporte').hidden = true; });

render();
canal.enviar({ tipo: 'ping' });
setInterval(render, 60000);
