(() => {
  const ANCHO = 1600;
  const ALTO = 900;
  const params = new URLSearchParams(location.search);
  const esOrador = params.has('orador');
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('amazonmercury-pitch') : null;

  const deck = document.getElementById('deck');
  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length;
  const principales = slides.filter((s) => !s.classList.contains('anexo')).length;
  const etiqueta = (i) => (i < principales ? `${i + 1} / ${principales}` : `Anexo ${String.fromCharCode(65 + i - principales)}`);
  let actual = 0;
  let inicioReloj = null;

  slides.forEach((s) => s.querySelectorAll('.anim').forEach((el) => {
    el.style.setProperty('--d', el.dataset.d || 0);
  }));

  function escalar() {
    const k = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
    deck.style.transform = `scale(${k})`;
  }

  function semilla(n) {
    let x = n;
    return () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
  }

  function copas(r, y0, alto, color, n, rmin, rmax) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 1700 - 50 + r() * 40;
      const rad = rmin + r() * (rmax - rmin);
      const y = y0 - r() * alto;
      s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(0)}" fill="${color}"/>`;
    }
    s += `<rect x="0" y="${y0}" width="1600" height="200" fill="${color}"/>`;
    return s;
  }

  function arteRio(svg) {
    const r = semilla(7);
    let peces = '';
    const posPeces = [[260, 700, 1], [520, 800, -1], [880, 690, 1], [1180, 790, -1], [1420, 690, 1], [700, 860, 1]];
    posPeces.forEach(([x, y, d], i) => {
      peces += `<g class="pez" style="animation-delay:${i * 0.8}s" transform="translate(${x} ${y}) scale(${d * 1.6} 1.6)">
        <path d="M-40 0c14-18 44-22 60-6l18-12v36l-18-12C4 22-26 18-40 0z" fill="#0a2a36" opacity=".9"/>
        <circle cx="-26" cy="-3" r="2.5" fill="#5ec4d6" opacity=".6"/></g>`;
    });
    let gotas = '';
    for (let i = 0; i < 70; i++) {
      const x = r() * 1600;
      const y = 520 + r() * 380;
      const rad = 1.5 + r() * 3.5;
      gotas += `<circle class="hg" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" style="animation-delay:${(r() * 6).toFixed(2)}s;animation-duration:${(5 + r() * 6).toFixed(1)}s"/>`;
    }
    let reflejos = '';
    for (let i = 0; i < 26; i++) {
      const x = r() * 1600;
      const y = 490 + r() * 120;
      const w = 30 + r() * 140;
      reflejos += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="2" rx="1" fill="#9fd6e0" opacity="${(0.08 + r() * 0.18).toFixed(2)}"/>`;
    }
    svg.innerHTML = `
      <defs>
        <linearGradient id="cieloP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040d15"/><stop offset=".55" stop-color="#0d2f40"/><stop offset="1" stop-color="#1c5a62"/></linearGradient>
        <linearGradient id="aguaP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14485a"/><stop offset=".25" stop-color="#0d3443"/><stop offset="1" stop-color="#051922"/></linearGradient>
        <radialGradient id="lunaP"><stop offset="0" stop-color="#f6f1df" stop-opacity=".9"/><stop offset=".18" stop-color="#f6f1df" stop-opacity=".35"/><stop offset="1" stop-color="#f6f1df" stop-opacity="0"/></radialGradient>
        <linearGradient id="sombraP" x1="0" x2="1"><stop offset="0" stop-color="#040d15" stop-opacity=".85"/><stop offset=".6" stop-color="#040d15" stop-opacity=".2"/><stop offset="1" stop-color="#040d15" stop-opacity="0"/></linearGradient>
        <radialGradient id="hgGrad"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9d3dc"/><stop offset="1" stop-color="#6f8796"/></radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#cieloP)"/>
      <circle cx="1290" cy="170" r="260" fill="url(#lunaP)"/>
      <circle cx="1290" cy="170" r="44" fill="#f4eedc" opacity=".92"/>
      <g opacity=".95">${copas(r, 400, 70, '#0c2c2a', 60, 30, 70)}</g>
      <g>${copas(r, 440, 50, '#092320', 70, 26, 56)}</g>
      <g>${copas(r, 475, 30, '#061a18', 80, 20, 44)}</g>
      <rect y="480" width="1600" height="420" fill="url(#aguaP)"/>
      ${reflejos}
      <rect x="1240" y="486" width="100" height="3" fill="#f4eedc" opacity=".5"/><rect x="1260" y="500" width="64" height="2" fill="#f4eedc" opacity=".35"/>
      <g class="canoa" transform="translate(1120 512)">
        <path d="M-150 10C-90 34 90 34 150 10L136 0H-136z" fill="#03100f"/>
        <path d="M-20 0v-46" stroke="#03100f" stroke-width="10" stroke-linecap="round"/>
        <circle cx="-20" cy="-62" r="13" fill="#03100f"/>
        <path d="M-32 -50 -70 -10" stroke="#03100f" stroke-width="7" stroke-linecap="round"/>
        <path d="M-12 -40 120 -120" stroke="#03100f" stroke-width="4"/>
        <path d="M120 -120 Q150 -40 152 40" stroke="#03100f" stroke-width="1.5" fill="none" opacity=".8"/>
        <path d="M60 4v-30M80 4v-24" stroke="#03100f" stroke-width="8" stroke-linecap="round"/>
        <circle cx="70" cy="-38" r="10" fill="#03100f"/>
      </g>
      <g fill="url(#hgGrad)" class="gotas">${gotas}</g>
      ${peces}
      <rect width="1600" height="900" fill="url(#sombraP)"/>`;
  }

  function arteCierre(svg) {
    const r = semilla(21);
    let nodos = '';
    [[1090, 610, 0.9], [1290, 670, 1.15], [1480, 620, 1]].forEach(([x, y, k], i) => {
      nodos += `<g transform="translate(${x} ${y}) scale(${k})" class="boya" style="animation-delay:${i * 0.7}s">
        <circle class="senal" r="40" style="animation-delay:${i * 0.5}s"/><circle class="senal" r="40" style="animation-delay:${i * 0.5 + 1.2}s"/>
        <ellipse cx="0" cy="22" rx="46" ry="12" fill="#f28c28"/>
        <path d="M-34 0h68l-6 22h-56z" fill="#e9eef1"/>
        <rect x="-22" y="-14" width="44" height="14" rx="3" fill="#2a3137"/>
        <path d="M14 -14v-60" stroke="#111" stroke-width="4" stroke-linecap="round"/>
        <circle cx="14" cy="-76" r="5" fill="#5ec4d6"/>
      </g>`;
    });
    let estrellas = '';
    for (let i = 0; i < 90; i++) {
      estrellas += `<circle cx="${(r() * 1600).toFixed(0)}" cy="${(r() * 360).toFixed(0)}" r="${(0.6 + r() * 1.4).toFixed(1)}" fill="#fff" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`;
    }
    svg.innerHTML = `
      <defs>
        <linearGradient id="cieloC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050f1a"/><stop offset=".6" stop-color="#0f3346"/><stop offset="1" stop-color="#2b6b6a"/></linearGradient>
        <linearGradient id="aguaC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b5b66"/><stop offset="1" stop-color="#06202a"/></linearGradient>
        <linearGradient id="sombraC" x1="0" x2="1"><stop offset="0" stop-color="#040d15" stop-opacity=".9"/><stop offset=".55" stop-color="#040d15" stop-opacity=".35"/><stop offset="1" stop-color="#040d15" stop-opacity=".1"/></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#cieloC)"/>
      ${estrellas}
      <g>${copas(r, 470, 60, '#0b2a26', 60, 30, 66)}</g>
      <g>${copas(r, 520, 40, '#071d1a', 70, 22, 50)}</g>
      <rect y="530" width="1600" height="370" fill="url(#aguaC)"/>
      ${nodos}
      <rect width="1600" height="900" fill="url(#sombraC)"/>`;
  }

  function contar(el) {
    const fin = parseFloat(el.dataset.valor);
    const miles = el.dataset.miles;
    const dur = 1400;
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const v = Math.round(fin * (1 - Math.pow(1 - p, 3)));
      el.textContent = miles ? v.toLocaleString('es-PE').replace(/,/g, ' ') : String(v);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  function notasDe(i) {
    const n = slides[i].querySelector('.notas');
    return n ? n.innerHTML : '';
  }

  function ir(i, emitir = true) {
    i = Math.max(0, Math.min(total - 1, i));
    slides[actual].classList.remove('activa');
    actual = i;
    const s = slides[actual];
    void s.offsetWidth;
    s.classList.add('activa');
    s.querySelectorAll('.contar').forEach(contar);
    document.getElementById('contador').textContent = etiqueta(actual);
    document.getElementById('barraProgreso').style.width = `${Math.min(1, (actual + 1) / principales) * 100}%`;
    if (location.hash !== `#${actual + 1}`) history.replaceState(null, '', `#${actual + 1}`);
    actualizarNotas();
    if (emitir && canal) canal.postMessage({ tipo: 'ir', i: actual });
  }

  function actualizarNotas() {
    document.getElementById('pnTitulo').textContent = `${etiqueta(actual)} · ${slides[actual].dataset.titulo || ''}`;
    document.getElementById('pnTexto').innerHTML = notasDe(actual);
    document.getElementById('pnSiguiente').textContent = actual + 1 < total ? slides[actual + 1].dataset.titulo : 'Fin';
  }

  function relojTexto() {
    if (!inicioReloj) return '00:00';
    const s = Math.floor((Date.now() - inicioReloj) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function pantallaCompleta() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function alternarNotas() {
    const p = document.getElementById('panelNotas');
    p.hidden = !p.hidden;
    if (!p.hidden && !inicioReloj) inicioReloj = Date.now();
  }

  function abrirOrador() {
    if (!inicioReloj) inicioReloj = Date.now();
    window.open(`${location.pathname}?orador#${actual + 1}`, 'amazonmercury-orador', 'width=1100,height=760');
  }

  const RUTAS = { panel: '../panel/', maqueta: '../index.html', mirio: '../comunidad/?lugar=AM-02' };

  function modoDemo(modo) {
    const v = document.getElementById('visorDemo');
    const cuerpo = v.querySelector('.vm-cuerpo');
    cuerpo.className = `vm-cuerpo modo-${modo}`;
    v.querySelectorAll('.vm-tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.modo === modo));
    v.querySelectorAll('iframe').forEach((f) => {
      const visible = modo === 'demo' || f.dataset.marco === modo;
      if (visible && !f.getAttribute('src')) f.setAttribute('src', RUTAS[f.dataset.marco]);
    });
  }

  function abrirMaqueta(modo = 'demo') {
    document.getElementById('visorDemo').hidden = false;
    modoDemo(typeof modo === 'string' ? modo : 'demo');
  }

  function cerrarMaqueta() {
    document.getElementById('visorDemo').hidden = true;
  }

  function iniciarPresentacion() {
    document.querySelectorAll('[data-arte="rio"] .arte-rio').forEach(arteRio);
    document.querySelectorAll('[data-arte="cierre"] .arte-cierre').forEach(arteCierre);
    escalar();
    window.addEventListener('resize', escalar);
    const desdeHash = parseInt(location.hash.slice(1), 10);
    slides[0].classList.remove('activa');
    ir(Number.isFinite(desdeHash) ? desdeHash - 1 : 0, false);

    document.getElementById('btnAnt').addEventListener('click', () => ir(actual - 1));
    document.getElementById('btnSig').addEventListener('click', () => ir(actual + 1));
    document.getElementById('btnNotas').addEventListener('click', alternarNotas);
    document.getElementById('btnOrador').addEventListener('click', abrirOrador);
    document.getElementById('btnPantalla').addEventListener('click', pantallaCompleta);
    document.querySelectorAll('[data-abrir-demo]').forEach((b) => b.addEventListener('click', () => abrirMaqueta(b.dataset.abrirDemo)));
    document.querySelectorAll('[data-cerrar-demo]').forEach((b) => b.addEventListener('click', cerrarMaqueta));
    document.querySelectorAll('.vm-tabs button').forEach((b) => b.addEventListener('click', () => modoDemo(b.dataset.modo)));
    document.getElementById('btnDemo').addEventListener('click', () => abrirMaqueta('demo'));

    window.addEventListener('keydown', (e) => {
      if (!document.getElementById('visorDemo').hidden) {
        if (e.key === 'Escape') cerrarMaqueta();
        return;
      }
      const k = e.key;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); ir(actual + 1); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); ir(actual - 1); }
      else if (k === 'Home') ir(0);
      else if (k === 'End') ir(total - 1);
      else if (k === 'f' || k === 'F') pantallaCompleta();
      else if (k === 'n' || k === 'N') alternarNotas();
      else if (k === 'p' || k === 'P') abrirOrador();
      else if (k === 'd' || k === 'D') abrirMaqueta('demo');
    });

    let x0 = null;
    window.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) ir(actual + (dx < 0 ? 1 : -1));
      x0 = null;
    });

    let temp;
    window.addEventListener('mousemove', () => {
      document.body.classList.add('mostrar-ui');
      clearTimeout(temp);
      temp = setTimeout(() => document.body.classList.remove('mostrar-ui'), 2000);
    });
    setTimeout(() => document.getElementById('ayuda').classList.add('oculta'), 4500);
    setInterval(() => { document.getElementById('pnReloj').textContent = relojTexto(); }, 1000);

    if (canal) {
      canal.onmessage = (ev) => {
        const m = ev.data;
        if (m.tipo === 'ir') ir(m.i, false);
        if (m.tipo === 'hola') canal.postMessage({ tipo: 'ir', i: actual });
      };
    }
  }

  function iniciarOrador() {
    document.body.classList.add('orador');
    const vista = document.createElement('div');
    vista.className = 'vista-orador';
    vista.innerHTML = `
      <div class="vo-principal">
        <span class="vo-num" id="voNum"></span>
        <h1 id="voTitulo"></h1>
        <div class="vo-notas" id="voNotas"></div>
      </div>
      <div class="vo-lado">
        <div class="vo-reloj" id="voReloj">00:00</div>
        <button class="vo-reset" id="voReset">Reiniciar cronómetro</button>
        <div class="vo-sig"><small>Siguiente</small><p id="voSig"></p></div>
        <div class="vo-botones"><button id="voAnt">← Anterior</button><button id="voSigBtn">Siguiente →</button></div>
        <p style="color:#8fb0b8;font-size:14px">Deja esta ventana en tu laptop y la presentación en el proyector. Ambas avanzan juntas.</p>
      </div>`;
    document.body.appendChild(vista);
    let i = Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1);
    let t0 = Date.now();
    const pintar = () => {
      document.getElementById('voNum').textContent = i < principales ? `Diapositiva ${i + 1} de ${principales}` : etiqueta(i);
      document.getElementById('voTitulo').textContent = slides[i].dataset.titulo || '';
      document.getElementById('voNotas').innerHTML = notasDe(i);
      document.getElementById('voSig').textContent = i + 1 < total ? slides[i + 1].dataset.titulo : 'Fin de la presentación';
    };
    const mover = (n) => {
      i = Math.max(0, Math.min(total - 1, n));
      pintar();
      if (canal) canal.postMessage({ tipo: 'ir', i });
    };
    document.getElementById('voAnt').addEventListener('click', () => mover(i - 1));
    document.getElementById('voSigBtn').addEventListener('click', () => mover(i + 1));
    document.getElementById('voReset').addEventListener('click', () => { t0 = Date.now(); });
    window.addEventListener('keydown', (e) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); mover(i + 1); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); mover(i - 1); }
    });
    setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      document.getElementById('voReloj').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    if (canal) {
      canal.onmessage = (ev) => {
        if (ev.data.tipo === 'ir') { i = ev.data.i; pintar(); }
      };
      canal.postMessage({ tipo: 'hola' });
    }
    pintar();
  }

  if (esOrador) iniciarOrador();
  else iniciarPresentacion();
})();
