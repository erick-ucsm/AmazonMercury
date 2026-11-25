import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FASES_CICLO, METALES, NODO_MAQUETA, ETIQUETA_ESTADO, clasificar, estadoGeneral, formatearMetal, generarMedicion, crearCanal, guardarLectura } from './comun/simulacion.js';

const parametros = new URLSearchParams(location.search);


const CONFIG = {
  modeloGLB: parametros.get('modelo') || 'modelo/amazonmercury.glb',
  forzarProcedural: parametros.get('modelo') === 'procedural',
  tamanoGLB: 2.6,
  fraccionSumergida: 0.38,
  rutaDraco: 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
};

const COMPONENTES = [
  {
    id: 'casco', nombre: 'Casco flotante', categoria: 'Estructura',
    funcion: 'Mantiene el nodo a flote, estable en la corriente.',
    info: 'Casco de polietileno rotomoldeado con collar naranja de alta visibilidad. El peso (baterías, cartucho y celda) va abajo para bajar el centro de gravedad.',
    specs: ['Polietileno rotomoldeado', 'Collar de flotación naranja', 'Bandas reflectivas', 'Vida útil estimada: 5 años o más'],
    match: /casco|hull|flotador|maceta|buoy|collar/
  },
  {
    id: 'compartimento', nombre: 'Compartimento estanco', categoria: 'Protección',
    funcion: 'Caja sellada IP67 que protege la electrónica.',
    info: 'Compartimento estanco IP67. Protege el ESP32, el potenciostato, el módulo LoRa, las baterías y el cartucho de reactivo de la lluvia y la humedad.',
    specs: ['IP67', 'Junta de sellado perimetral', 'Núcleo seco para baterías y reactivo'],
    match: /compart|estanco|caja|enclosure|carcasa/
  },
  {
    id: 'cupula', nombre: 'Cúpula protectora', categoria: 'Protección',
    funcion: 'Protege el panel solar de golpes, ramas y aves.',
    info: 'Cúpula baja de policarbonato con filtro UV (no acrílico, que se pone amarillo y se raja). Su forma curva hace que la lluvia limpie el polvo. Tiene rejillas de ventilación en el borde para que no se caliente por dentro y púas en la parte superior para que no se posen las aves.',
    specs: ['Policarbonato con filtro UV', 'Rejillas de ventilación en el borde', 'Púas antiaves', 'Quita ~10–15 % de luz → panel algo más grande (estimado)'],
    match: /cupula|domo|dome|cubierta/
  },
  {
    id: 'panel', nombre: 'Panel solar redondo', categoria: 'Energía',
    funcion: 'Alimenta el nodo y recarga las baterías durante el día.',
    info: 'Panel solar monocristalino redondo de 3 W y ~19 cm de diámetro, bajo la cúpula. Con 3 W el nodo es autosuficiente todo el año midiendo cada hora, incluso en la época de lluvias de Madre de Dios (estimación de diseño).',
    specs: ['3 W · 6 V', 'Redondo, ~19 cm de diámetro', 'Celdas monocristalinas', 'Cargador solar con protección de temperatura'],
    match: /panel|solar/
  },
  {
    id: 'bateria', nombre: 'Baterías 18650 (×2)', categoria: 'Energía',
    funcion: 'Guardan energía para la noche y los días nublados.',
    info: 'Dos baterías de litio 18650 en paralelo, abajo del núcleo para bajar el centro de gravedad y mantenerse frescas junto al agua. Sin sol, aguantan unos 10 días midiendo cada hora (estimado).',
    specs: ['2 × Li-ion 3,7 V en paralelo', '≈ 6000 mAh en total', 'Sin sol: ≈ 10 días (estimado)', 'Cambio cada 2–3 años'],
    match: /bater|18650|battery|pila/
  },
  {
    id: 'esp32', nombre: 'ESP32', categoria: 'Control',
    funcion: 'Cerebro del nodo.',
    info: 'Controla el ciclo de muestreo, la compuerta, la microbomba, el potenciostato y el módulo LoRa. Entre mediciones duerme (deep sleep) y despierta 1 segundo cada 5 minutos para escuchar órdenes de emergencia del panel de control.',
    specs: ['Doble núcleo', 'Deep sleep entre muestreos', 'Ventana de escucha: 1 s cada 5 min', 'Medición automática cada hora'],
    match: /esp32|esp-32|esp_32|microcontrol/
  },
  {
    id: 'potenciostato', nombre: 'Potenciostato', categoria: 'Medición',
    funcion: 'Aplica el voltaje a los electrodos y mide la corriente.',
    info: 'Placa analógica que hace la voltametría de onda cuadrada (SWASV): primero acumula los metales sobre los electrodos y luego hace un barrido de voltaje. Cada metal se redisuelve a un voltaje distinto, y la corriente indica cuánto hay.',
    specs: ['Voltametría SWASV', 'Controlado por el ESP32', 'Mide corriente en nA–µA'],
    match: /potencio|potentiostat|afe/
  },
  {
    id: 'lora', nombre: 'Módulo LoRa (433 MHz)', categoria: 'Comunicación',
    funcion: 'Comunicación de largo alcance sin señal celular.',
    info: 'Envía cada lectura de nodo en nodo hasta la puerta de enlace. Todos los nodos despiertan a la misma hora para reenviar datos, así ninguno gasta batería escuchando todo el tiempo.',
    specs: ['433 MHz', 'Conexión SPI al ESP32', 'Malla con horario sincronizado'],
    match: /lora|sx127|ra-?02/
  },
  {
    id: 'antena', nombre: 'Antena LoRa', categoria: 'Comunicación',
    funcion: 'Transmisión de señal.',
    info: 'Antena de 433 MHz, fuera de la cúpula. Alcance de varios kilómetros en línea de vista.',
    specs: ['433 MHz', 'Conector SMA', 'Varios km en línea de vista'],
    match: /antena|antenna/
  },
  {
    id: 'sensor', nombre: 'Celda de voltametría', categoria: 'Medición',
    funcion: 'Mide mercurio y otros 5 metales en la misma muestra.',
    info: 'Celda electroquímica con electrodo de oro (Hg, As, Cu, Pb), electrodo de bismuto (Cd, Zn), electrodo de referencia y contraelectrodo. Detecta mercurio por debajo del valor guía de la OMS (6 µg/L): un estudio del INIS-OIEA reporta límites de 0,07–0,4 µg/L. Mide el mercurio disuelto; se valida cada mes con laboratorio.',
    specs: ['Hg · As · Pb · Cd · Cu · Zn', 'Límite de detección Hg ≈ 0,1 µg/L', 'Electrodo serigrafiado: cambio cada 1–3 meses (estimado)', 'Reemplaza al Hg-ISE de la versión 1'],
    match: /sensor|sonda|probe|electrodo|celda|voltam/
  },
  {
    id: 'sondas', nombre: 'Sondas de calidad del agua', categoria: 'Medición',
    funcion: 'Miden turbidez, pH, conductividad y temperatura.',
    info: 'Sonda multiparámetro junto a la celda. Una subida brusca de turbidez puede indicar una draga río arriba y sirve para confirmar un pico de mercurio.',
    specs: ['Turbidez (NTU)', 'pH', 'Conductividad (µS/cm)', 'Temperatura (°C)'],
    match: /sondas|multiparam|turbidez|calidad/
  },
  {
    id: 'reactivo', nombre: 'Cartucho de reactivo y microbomba', categoria: 'Muestreo',
    funcion: 'Prepara la muestra para la voltametría.',
    info: 'Cartucho de ~1 L con buffer ácido. En cada medición la microbomba dosifica ~1 mL a la muestra. Con un reporte por hora dura unas 6 semanas y se rellena en el mantenimiento.',
    specs: ['≈ 1 L de buffer ácido', '≈ 1 mL por medición', 'Duración ≈ 6 semanas (estimado)', 'Microbomba peristáltica'],
    match: /reactivo|cartucho|bomba|pump|reagent/
  },
  {
    id: 'rejilla', nombre: 'Rejilla protectora', categoria: 'Protección',
    funcion: 'Protección contra peces, ramas y residuos.',
    info: 'Rejilla que protege la celda y las sondas de la fauna acuática y los sedimentos grandes, dejando pasar el agua. Se limpia en la revisión diaria.',
    specs: ['Acero inoxidable', 'Deja pasar el agua', 'Limpieza diaria'],
    match: /rejilla|grill|jaula|cage|malla/
  },
  {
    id: 'argolla', nombre: 'Argolla de amarre', categoria: 'Fijación',
    funcion: 'Fijación del nodo.',
    info: 'Punto de amarre para fijar el nodo con cuerda y evitar que la corriente lo arrastre.',
    specs: ['Acero inoxidable', 'Cuerda a punto fijo o ancla'],
    match: /argolla|amarre|mooring|cuerda|anclaje/
  },
  {
    id: 'compuerta', nombre: 'Compuerta de muestreo', categoria: 'Muestreo', extra: true,
    funcion: 'Deja entrar una pequeña muestra de agua y luego la descarga.',
    info: 'La compuerta se abre un momento para que entre poca agua a la cámara que rodea el núcleo. Se mezcla con el reactivo, la celda la mide y luego el agua se descarga por el fondo antes del siguiente ciclo.',
    specs: ['Apertura temporal', 'Cámara de muestreo anular', 'Drenaje inferior'],
    match: /compuerta|valvula|gate|admision|drenaje/
  }
];

const PRIORIDAD_MATCH = ['rejilla', 'antena', 'cupula', 'panel', 'bateria', 'esp32', 'potenciostato', 'lora', 'compuerta', 'reactivo', 'sondas', 'sensor', 'argolla', 'compartimento', 'casco'];
const PASANTES = new Set(['cupula']);
const TRANSPARENTES_EN_INTERIOR = new Set(['casco', 'compartimento']);
const INTERNOS = new Set(['bateria', 'esp32', 'lora', 'potenciostato', 'reactivo']);
const porId = Object.fromEntries(COMPONENTES.map((c, i) => [c.id, { ...c, numero: i + 1 }]));

const FASES = FASES_CICLO.map((f) => ({ ...f, dur: f.demo }));
const F = Object.fromEntries(FASES_CICLO.map((f, i) => [f.id, i]));

const $ = (s) => document.querySelector(s);
const esMovil = () => window.innerWidth <= 820;

const estado = {
  autoRotar: true,
  explosion: 0,
  explosionObjetivo: 0,
  interior: false,
  etiquetas: !esMovil(),
  agua: true,
  seleccion: null,
  hover: null,
  modo: 'procedural',
  ciclo: null,
  foco: null,
  intro: 0
};

const visor = $('#visor');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
visor.appendChild(renderer.domElement);

const capaEtiquetas = new CSS2DRenderer();
capaEtiquetas.setSize(window.innerWidth, window.innerHeight);
capaEtiquetas.domElement.className = 'capa-etiquetas';
visor.appendChild(capaEtiquetas.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd3e6e1, 28, 120);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.75;
controls.minDistance = 1.3;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.66;
controls.enablePan = true;
controls.screenSpacePanning = true;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.65;

const nodo = new THREE.Group();
nodo.name = 'NodoAmazonMercury';
scene.add(nodo);

const registro = new Map();
let pickables = [];
let extras = {};
let mixer = null;

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texturaDe(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function alturaOla(x, z, t) {
  return 0.03 * Math.sin(x * 1.25 + t * 1.3) +
    0.022 * Math.sin(z * 1.6 - t * 1.05 + x * 0.35) +
    0.01 * Math.sin((x + z) * 3.2 + t * 2.4);
}

function crearCielo() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      cArriba: { value: new THREE.Color(0x3f8fc9) },
      cHorizonte: { value: new THREE.Color(0xd3e6e1) },
      cAbajo: { value: new THREE.Color(0x8aa58a) },
      dirSol: { value: new THREE.Vector3(0.55, 0.62, 0.45).normalize() }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 cArriba;
      uniform vec3 cHorizonte;
      uniform vec3 cAbajo;
      uniform vec3 dirSol;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(cHorizonte, cArriba, pow(smoothstep(0.0, 1.0, h), 0.55)) : mix(cHorizonte, cAbajo, smoothstep(0.0, -0.25, h));
        float sol = max(dot(normalize(vDir), dirSol), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(sol, 400.0) * 2.5 + pow(sol, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  cielo.renderOrder = -10;
  cielo.frustumCulled = false;
  scene.add(cielo);
  return cielo;
}

function texturaNormalAgua() {
  const N = 256;
  const [c, g] = lienzo(N, N);
  const img = g.createImageData(N, N);
  const alt = new Float32Array(N * N);
  const ondas = [];
  for (let i = 0; i < 14; i++) {
    ondas.push({
      kx: Math.round((Math.random() * 2 - 1) * 6),
      ky: Math.round((Math.random() * 2 - 1) * 6) || 1,
      f: Math.random() * Math.PI * 2,
      a: 1 / (1 + i * 0.35)
    });
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let h = 0;
      for (const o of ondas) h += o.a * Math.sin(((x * o.kx + y * o.ky) / N) * Math.PI * 2 + o.f);
      alt[y * N + x] = h;
    }
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = alt[y * N + ((x + 1) % N)] - alt[y * N + ((x - 1 + N) % N)];
      const dy = alt[((y + 1) % N) * N + x] - alt[((y - 1 + N) % N) * N + x];
      const v = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize();
      const k = (y * N + x) * 4;
      img.data[k] = (v.x * 0.5 + 0.5) * 255;
      img.data[k + 1] = (v.y * 0.5 + 0.5) * 255;
      img.data[k + 2] = (v.z * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = texturaDe(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(36, 8);
  return t;
}

const uniformesAgua = { uTiempo: { value: 0 } };

function crearRio() {
  const grupo = new THREE.Group();
  const geo = new THREE.PlaneGeometry(280, 44, 420, 66);
  geo.rotateX(-Math.PI / 2);
  const normal = texturaNormalAgua();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x5f6b44,
    roughness: 0.1,
    metalness: 0.0,
    transparent: true,
    opacity: 0.66,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.3,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uniformesAgua.uTiempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTiempo;
        vec3 olaInfo(vec2 p, float t) {
          float a = p.x * 1.25 + t * 1.3;
          float b = p.y * 1.6 - t * 1.05 + p.x * 0.35;
          float c = (p.x + p.y) * 3.2 + t * 2.4;
          float h = 0.03 * sin(a) + 0.022 * sin(b) + 0.01 * sin(c);
          float dx = 0.0375 * cos(a) + 0.0077 * cos(b) + 0.032 * cos(c);
          float dz = 0.0352 * cos(b) + 0.032 * cos(c);
          return vec3(h, dx, dz);
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 olaN = olaInfo(position.xz, uTiempo);
        vec3 objectNormal = normalize(vec3(-olaN.y, 1.0, -olaN.z));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        transformed.y += olaN.x;`);
  };
  const agua = new THREE.Mesh(geo, mat);
  agua.renderOrder = 2;
  grupo.add(agua);

  const lecho = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 120).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3b3424, roughness: 1 })
  );
  lecho.position.y = -3.2;
  grupo.add(lecho);

  const sedimento = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 120).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x6b6040, transparent: true, opacity: 0.35, depthWrite: false })
  );
  sedimento.position.y = -1.9;
  grupo.add(sedimento);

  scene.add(grupo);
  return { grupo, agua, normal };
}

function crearSelva() {
  const g = new THREE.Group();
  const matOrilla = new THREE.MeshStandardMaterial({ color: 0x5b5733, roughness: 1 });
  const matBarro = new THREE.MeshStandardMaterial({ color: 0x7a6544, roughness: 1 });
  for (const s of [-1, 1]) {
    const orilla = new THREE.Mesh(new THREE.BoxGeometry(420, 3.2, 90), matOrilla);
    orilla.position.set(0, -1.15, s * 66);
    orilla.receiveShadow = true;
    g.add(orilla);
    const barro = new THREE.Mesh(new THREE.BoxGeometry(420, 0.6, 6), matBarro);
    barro.position.set(0, -0.1, s * 21.5);
    barro.rotation.x = s * 0.18;
    g.add(barro);
  }

  const N = 900;
  const troncoGeo = new THREE.CylinderGeometry(0.12, 0.24, 1, 6);
  troncoGeo.translate(0, 0.5, 0);
  const copaGeo = new THREE.IcosahedronGeometry(1, 1);
  const troncos = new THREE.InstancedMesh(troncoGeo, new THREE.MeshStandardMaterial({ color: 0x4a3b2a, roughness: 1 }), N);
  const copas = new THREE.InstancedMesh(copaGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), N);
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const lado = i % 2 ? 1 : -1;
    const x = (Math.random() * 2 - 1) * 200;
    const z = lado * (23 + Math.pow(Math.random(), 1.4) * 55);
    const h = 3 + Math.random() * 6;
    d.position.set(x, 0.45, z);
    d.rotation.set(0, Math.random() * 6.28, 0);
    d.scale.set(1, h, 1);
    d.updateMatrix();
    troncos.setMatrixAt(i, d.matrix);
    const s = 1.8 + Math.random() * 2.6;
    d.position.set(x, 0.45 + h + s * 0.25, z);
    d.scale.set(s, s * (0.65 + Math.random() * 0.4), s);
    d.updateMatrix();
    copas.setMatrixAt(i, d.matrix);
    col.setHSL(0.24 + Math.random() * 0.1, 0.42 + Math.random() * 0.2, 0.16 + Math.random() * 0.12);
    copas.setColorAt(i, col);
  }
  g.add(troncos, copas);
  scene.add(g);
  return g;
}

function crearLuces() {
  const hemi = new THREE.HemisphereLight(0xe3f4ff, 0x3d4a2c, 0.55);
  scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sol.position.set(5.5, 8, 4.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -3.2; sc.right = 3.2; sc.top = 3.2; sc.bottom = -3.2; sc.near = 1; sc.far = 25;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  scene.add(sol);
  const contra = new THREE.DirectionalLight(0x9fd8ff, 0.7);
  contra.position.set(-6, 3, -5);
  scene.add(contra);
}

function texturaPanel() {
  const W = 1024, H = 860;
  const [c, g] = lienzo(W, H);
  g.fillStyle = '#d6dadf';
  g.fillRect(0, 0, W, H);
  const cols = 7, filas = 4, m = 16, gap = 9;
  const cw = (W - 2 * m - (cols - 1) * gap) / cols;
  const ch = (H - 2 * m - (filas - 1) * gap) / filas;
  for (let r = 0; r < filas; r++) {
    for (let k = 0; k < cols; k++) {
      const x = m + k * (cw + gap);
      const y = m + r * (ch + gap);
      const grd = g.createLinearGradient(x, y, x + cw, y + ch);
      grd.addColorStop(0, '#132a55');
      grd.addColorStop(0.5, '#0b1a3a');
      grd.addColorStop(1, '#17336a');
      g.fillStyle = grd;
      const ch2 = 16;
      g.beginPath();
      g.moveTo(x + ch2, y);
      g.lineTo(x + cw - ch2, y);
      g.lineTo(x + cw, y + ch2);
      g.lineTo(x + cw, y + ch - ch2);
      g.lineTo(x + cw - ch2, y + ch);
      g.lineTo(x + ch2, y + ch);
      g.lineTo(x, y + ch - ch2);
      g.lineTo(x, y + ch2);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(120,150,200,0.25)';
      g.lineWidth = 1;
      for (let yy = y + 6; yy < y + ch; yy += 7) {
        g.beginPath();
        g.moveTo(x + 2, yy);
        g.lineTo(x + cw - 2, yy);
        g.stroke();
      }
      g.fillStyle = '#c9ced6';
      for (let b = 1; b <= 2; b++) g.fillRect(x + (cw * b) / 3 - 2, y, 4, ch);
    }
  }
  return texturaDe(c);
}

function texturaPanelRedondo() {
  const N = 1024;
  const [c, g] = lienzo(N, N);
  g.fillStyle = '#c9ced6';
  g.fillRect(0, 0, N, N);
  g.save();
  g.beginPath();
  g.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#0d1d3d';
  g.fillRect(0, 0, N, N);
  const lado = 150, gap = 10, R = N / 2 - 22;
  for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
      const cx = N / 2 + x * (lado + gap);
      const cy = N / 2 + y * (lado + gap);
      const esquinas = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => Math.hypot(cx + a * lado / 2 - N / 2, cy + b * lado / 2 - N / 2));
      if (Math.min(...esquinas) > R) continue;
      const grd = g.createLinearGradient(cx - lado / 2, cy - lado / 2, cx + lado / 2, cy + lado / 2);
      grd.addColorStop(0, '#16336a');
      grd.addColorStop(0.5, '#0b1a3a');
      grd.addColorStop(1, '#1b3d7a');
      g.save();
      g.beginPath();
      g.arc(N / 2, N / 2, R, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = grd;
      g.fillRect(cx - lado / 2, cy - lado / 2, lado, lado);
      g.strokeStyle = 'rgba(120,150,200,0.22)';
      g.lineWidth = 1;
      for (let yy = cy - lado / 2 + 6; yy < cy + lado / 2; yy += 7) {
        g.beginPath();
        g.moveTo(cx - lado / 2 + 2, yy);
        g.lineTo(cx + lado / 2 - 2, yy);
        g.stroke();
      }
      g.fillStyle = '#c9ced6';
      for (let b = 1; b <= 2; b++) g.fillRect(cx - lado / 2 + (lado * b) / 3 - 2, cy - lado / 2, 4, lado);
      g.restore();
    }
  }
  g.restore();
  g.strokeStyle = '#aab2bc';
  g.lineWidth = 14;
  g.beginPath();
  g.arc(N / 2, N / 2, N / 2 - 14, 0, Math.PI * 2);
  g.stroke();
  return texturaDe(c);
}

function texturaCartucho() {
  const W = 512, H = 256;
  const [c, g] = lienzo(W, H);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1f7a8c';
  g.fillRect(0, 0, W, 46);
  g.fillStyle = '#ffffff';
  g.font = '700 30px "Inter", sans-serif';
  g.fillText('REACTIVO · BUFFER', 20, 33);
  g.fillStyle = '#0b2236';
  g.font = '600 26px "Inter", sans-serif';
  g.fillText('≈ 1 L · 1 mL por medición', 20, 100);
  g.fillText('Rellenar cada 6 semanas', 20, 140);
  g.fillStyle = '#f28c28';
  g.fillRect(0, 210, W, 12);
  return texturaDe(c);
}

function texturaEtiquetaCasco() {
  const W = 1600, H = 210;
  const [c, g] = lienzo(W, H);
  g.clearRect(0, 0, W, H);
  const cx = 210, cy = 105;
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = '#1b6b4c';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-10, 80);
  g.quadraticCurveTo(0, 0, 20, -80);
  g.stroke();
  g.fillStyle = '#1f7a57';
  for (let i = 0; i < 4; i++) {
    const yy = 50 - i * 34;
    for (const s of [-1, 1]) {
      g.save();
      g.translate(4 + i * 4, yy);
      g.rotate(s * 0.9 - 0.2);
      g.beginPath();
      g.ellipse(s * 26, 0, 26, 10, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.restore();
  g.fillStyle = '#0ea5e9';
  g.beginPath();
  g.moveTo(330, 40);
  g.bezierCurveTo(300, 90, 290, 110, 290, 128);
  g.arc(330, 128, 40, Math.PI, 0, true);
  g.bezierCurveTo(370, 110, 360, 90, 330, 40);
  g.fill();
  g.fillStyle = '#14513d';
  g.font = '700 104px "Space Grotesk", "Inter", sans-serif';
  g.textBaseline = 'middle';
  g.fillText('AMAZONMERCURY', 400, 92);
  g.fillStyle = '#2a6f7f';
  g.font = '600 40px "Inter", sans-serif';
  g.fillText('MONITOREO DE MERCURIO · LoRa 433 MHz · UCSM', 404, 170);
  return texturaDe(c);
}

function texturaBateria() {
  const W = 512, H = 256;
  const [c, g] = lienzo(W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#1d8a52');
  grd.addColorStop(1, '#156b40');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#e9fff3';
  g.font = '700 46px "Inter", sans-serif';
  g.fillText('18650', 30, 70);
  g.font = '600 30px "Inter", sans-serif';
  g.fillText('Li-ion 3.7V', 30, 120);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 200, W, 8);
  g.fillRect(280, 0, 6, H);
  return texturaDe(c);
}

function texturaRejillaEntrada() {
  const W = 256, H = 160;
  const [c, g] = lienzo(W, H);
  g.fillStyle = '#10171a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#4b5a61';
  for (let y = 10; y < H; y += 22) {
    for (let x = 12; x < W; x += 22) {
      g.beginPath();
      g.arc(x + ((y / 22) % 2) * 11, y, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  return texturaDe(c);
}

function texturaEspuma() {
  const N = 512;
  const [c, g] = lienzo(N, N);
  g.clearRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = N * (0.3 + Math.random() * 0.18);
    const x = N / 2 + Math.cos(a) * r;
    const y = N / 2 + Math.sin(a) * r;
    const s = 2 + Math.random() * 7;
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.4})`;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  return texturaDe(c);
}

function formaRedondeada(puntos, radios) {
  const s = new THREE.Shape();
  const n = puntos.length;
  for (let i = 0; i < n; i++) {
    const p0 = puntos[(i - 1 + n) % n];
    const p1 = puntos[i];
    const p2 = puntos[(i + 1) % n];
    const r = radios[i];
    const v1 = new THREE.Vector2().subVectors(p0, p1).normalize();
    const v2 = new THREE.Vector2().subVectors(p2, p1).normalize();
    const a = p1.clone().addScaledVector(v1, r);
    const b = p1.clone().addScaledVector(v2, r);
    if (i === 0) s.moveTo(a.x, a.y);
    else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(p1.x, p1.y, b.x, b.y);
  }
  s.closePath();
  return s;
}

function tubo(puntos, radio, mat, segs = 40) {
  const curva = new THREE.CatmullRomCurve3(puntos);
  return new THREE.Mesh(new THREE.TubeGeometry(curva, segs, radio, 8, false), mat);
}

function construirProcedural() {
  const M = {
    pe: new THREE.MeshPhysicalMaterial({ color: 0xedf1ea, roughness: 0.52, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    naranja: new THREE.MeshPhysicalMaterial({ color: 0xf2741c, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    reflectivo: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.25, metalness: 0.4 }),
    abs: new THREE.MeshPhysicalMaterial({ color: 0x2a3137, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    junta: new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.6 }),
    pcbNegro: new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.5 }),
    pcbAzul: new THREE.MeshStandardMaterial({ color: 0x1b4f8f, roughness: 0.45 }),
    pcbVerde: new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.45 }),
    blindaje: new THREE.MeshStandardMaterial({ color: 0xcdd1d6, metalness: 1, roughness: 0.3 }),
    oro: new THREE.MeshStandardMaterial({ color: 0xd8a945, metalness: 1, roughness: 0.28 }),
    acero: new THREE.MeshStandardMaterial({ color: 0xbfc5cc, metalness: 1, roughness: 0.22 }),
    aluminio: new THREE.MeshStandardMaterial({ color: 0xc6cbd1, metalness: 0.9, roughness: 0.38 }),
    goma: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.75 }),
    plasticoNegro: new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.55 }),
    pvc: new THREE.MeshPhysicalMaterial({ color: 0xdfe9ec, roughness: 0.12, transparent: true, opacity: 0.42, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
    cuerda: new THREE.MeshStandardMaterial({ color: 0xb48e55, roughness: 0.95 }),
    rojo: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.5 }),
    negroCable: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }),
    amarillo: new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 }),
    azul: new THREE.MeshStandardMaterial({ color: 0x2f6fde, roughness: 0.5 }),
    verdeCable: new THREE.MeshStandardMaterial({ color: 0x2e9e4f, roughness: 0.5 })
  };

  const G = {};
  for (const c of COMPONENTES) {
    G[c.id] = new THREE.Group();
    G[c.id].name = c.id;
    nodo.add(G[c.id]);
  }
  const decor = new THREE.Group();
  decor.name = 'cableado';
  decor.userData.ocultarAlExplotar = true;
  nodo.add(decor);

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const perfil = [
    [0.0, -0.95], [0.5, -0.95], [0.8, -0.9], [0.97, -0.79], [1.045, -0.6], [1.065, -0.2], [1.078, 0.44],
    [1.14, 0.465], [1.152, 0.52], [1.125, 0.56], [1.0, 0.56], [1.0, -0.6], [0.93, -0.77], [0.76, -0.855],
    [0.5, -0.88], [0.0, -0.88]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  add(G.casco, new THREE.LatheGeometry(perfil, 128), M.pe);
  add(G.casco, new THREE.RingGeometry(0.5, 1.0, 96).rotateX(-Math.PI / 2), M.pe, 0, 0.545, 0);
  add(G.casco, new THREE.TorusGeometry(1.215, 0.16, 32, 128).rotateX(Math.PI / 2), M.naranja, 0, 0.05, 0);
  for (let i = 0; i < 6; i++) {
    const banda = add(G.casco, new THREE.TorusGeometry(1.215, 0.1615, 16, 8, 0.11).rotateX(Math.PI / 2), M.reflectivo, 0, 0.05, 0);
    banda.rotation.y = (i / 6) * Math.PI * 2 + 0.3;
  }
  const texEtq = texturaEtiquetaCasco();
  const matEtq = new THREE.MeshStandardMaterial({ map: texEtq, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const centro of [0, Math.PI]) {
    add(G.casco, new THREE.CylinderGeometry(1.087, 1.087, 0.2, 96, 1, true, centro - 0.72, 1.44), matEtq, 0, 0.335, 0);
  }

  const huella = [[-0.7, -0.45], [0.7, -0.45], [0.7, 0.1], [0.3, 0.1], [0.3, 0.45], [-0.7, 0.45]]
    .map(([x, z]) => new THREE.Vector2(x, -z));
  const formaCaja = formaRedondeada(huella, [0.09, 0.09, 0.07, 0.13, 0.07, 0.09]);
  const geoCaja = new THREE.ExtrudeGeometry(formaCaja, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4, curveSegments: 14 });
  geoCaja.rotateX(-Math.PI / 2);
  add(G.compartimento, geoCaja, M.abs, 0, 0.58, 0);
  const geoJunta = new THREE.ExtrudeGeometry(formaCaja, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.03, bevelSegments: 1, curveSegments: 14 });
  geoJunta.rotateX(-Math.PI / 2);
  add(G.compartimento, geoJunta, M.junta, 0, 0.815, 0);
  add(G.compartimento, new THREE.CylinderGeometry(0.5, 0.5, 1.41, 64), M.abs, 0, -0.16, 0);
  for (const [x, z] of [[-0.62, -0.37], [0.62, -0.37], [-0.62, 0.37], [0.22, 0.37], [0.62, 0.02]]) {
    add(G.compartimento, new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), M.acero, x, 0.912, z);
  }
  const led = add(G.compartimento, new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshStandardMaterial({ color: 0x22ff99, emissive: 0x22ff88, emissiveIntensity: 1.5 }), 0.52, 0.91, -0.18);
  led.userData.esLed = true;
  add(G.compartimento, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24), M.goma, 0.52, 0.915, -0.33);
  add(G.compartimento, new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16).rotateZ(Math.PI / 2), M.goma, -0.75, 0.7, 0);

  const px = -0.15, pz = 0, py = 0.93, rPanel = 0.5;
  add(G.panel, new THREE.CylinderGeometry(rPanel + 0.035, rPanel + 0.045, 0.04, 96), M.aluminio, px, py, pz);
  const vidrio = new THREE.MeshPhysicalMaterial({ map: texturaPanelRedondo(), roughness: 0.12, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  add(G.panel, new THREE.CircleGeometry(rPanel + 0.03, 96).rotateX(-Math.PI / 2), vidrio, px, py + 0.0205, pz);

  const rCup = 0.575, yCup = py + 0.035, hCup = 0.24;
  const matCupula = new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const domo = add(G.cupula, new THREE.SphereGeometry(rCup, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2), matCupula, px, yCup, pz);
  domo.scale.y = hCup / rCup;
  domo.renderOrder = 4;
  add(G.cupula, new THREE.CylinderGeometry(rCup + 0.02, rCup + 0.03, 0.05, 96, 1, true), M.plasticoNegro, px, yCup - 0.005, pz);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const ranura = add(G.cupula, new THREE.BoxGeometry(0.012, 0.026, 0.07), M.goma, px + Math.cos(a) * (rCup + 0.031), yCup - 0.005, pz + Math.sin(a) * (rCup + 0.031));
    ranura.rotation.y = -a;
  }
  const alturaDomo = (r) => yCup + hCup * Math.sqrt(Math.max(0, 1 - (r / rCup) ** 2));
  for (const [rr, n] of [[0.05, 4], [0.14, 8]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr * 7;
      const pua = new THREE.Group();
      pua.position.set(px + Math.cos(a) * rr, alturaDomo(rr), pz + Math.sin(a) * rr);
      pua.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      add(pua, new THREE.CylinderGeometry(0.0035, 0.006, 0.13, 6), M.acero, 0, 0.065, 0);
      G.cupula.add(pua);
    }
  }

  const matBat = new THREE.MeshStandardMaterial({ map: texturaBateria(), roughness: 0.4, side: THREE.DoubleSide });
  for (const bx of [-0.105, 0.105]) {
    add(G.bateria, new THREE.CylinderGeometry(0.09, 0.09, 0.6, 48, 1, true), matBat, bx, -0.5, 0);
    add(G.bateria, new THREE.CylinderGeometry(0.088, 0.088, 0.02, 48), M.acero, bx, -0.19, 0);
    add(G.bateria, new THREE.CylinderGeometry(0.035, 0.035, 0.018, 24), M.acero, bx, -0.172, 0);
    add(G.bateria, new THREE.CylinderGeometry(0.088, 0.088, 0.02, 48), M.acero, bx, -0.81, 0);
    for (const y of [-0.3, -0.68]) add(G.bateria, new THREE.TorusGeometry(0.095, 0.008, 8, 32).rotateX(Math.PI / 2), M.plasticoNegro, bx, y, 0);
  }
  add(G.bateria, new THREE.BoxGeometry(0.46, 0.04, 0.24), M.plasticoNegro, 0, -0.84, 0);
  add(G.bateria, new THREE.BoxGeometry(0.03, 0.012, 0.03), M.acero, 0, -0.165, 0);

  const rx = 0.24, rz = -0.25;
  const matBotella = new THREE.MeshPhysicalMaterial({ map: texturaCartucho(), roughness: 0.35, transparent: true, opacity: 0.92 });
  add(G.reactivo, new THREE.CylinderGeometry(0.085, 0.085, 0.5, 40), matBotella, rx, -0.42, rz);
  add(G.reactivo, new THREE.CylinderGeometry(0.06, 0.08, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: 0xf3efe2, roughness: 0.3 }), rx, -0.145, rz);
  add(G.reactivo, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x1f7a8c, roughness: 0.5 }), rx, -0.1, rz);
  const bomba = new THREE.Group();
  bomba.position.set(0.25, 0.08, -0.3);
  G.reactivo.add(bomba);
  add(bomba, new THREE.CylinderGeometry(0.04, 0.04, 0.11, 24).rotateZ(Math.PI / 2), M.plasticoNegro, -0.04, 0, 0);
  const cabezal = add(bomba, new THREE.CylinderGeometry(0.052, 0.052, 0.045, 32).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.4, emissive: 0x000000 }), 0.04, 0, 0);
  const tubosReactivo = [];
  const matTubo = new THREE.MeshStandardMaterial({ color: 0xf2c07a, roughness: 0.3, transparent: true, opacity: 0.85, emissive: 0x000000 });
  tubosReactivo.push(tubo([
    new THREE.Vector3(rx, -0.08, rz),
    new THREE.Vector3(0.27, 0.02, -0.3),
    new THREE.Vector3(0.29, 0.08, -0.3)
  ], 0.01, matTubo, 16));
  tubosReactivo.push(tubo([
    new THREE.Vector3(0.3, 0.08, -0.3),
    new THREE.Vector3(0.1, 0.0, -0.36),
    new THREE.Vector3(-0.3, -0.2, -0.3),
    new THREE.Vector3(-0.6, -0.55, -0.16),
    new THREE.Vector3(-0.74, -1.0, -0.06),
    new THREE.Vector3(-0.76, -1.42, -0.04)
  ], 0.01, matTubo, 60));
  tubosReactivo.forEach((t) => G.reactivo.add(t));

  const ex = -0.28, ey = 0.66, ez = -0.15;
  add(G.esp32, new RoundedBoxGeometry(0.52, 0.022, 0.27, 2, 0.006), M.pcbNegro, ex, ey, ez);
  add(G.esp32, new RoundedBoxGeometry(0.18, 0.03, 0.16, 2, 0.004), M.blindaje, ex + 0.12, ey + 0.026, ez);
  add(G.esp32, new THREE.BoxGeometry(0.06, 0.006, 0.16), M.pcbNegro, ex + 0.24, ey + 0.014, ez);
  for (let i = 0; i < 5; i++) add(G.esp32, new THREE.BoxGeometry(0.006, 0.002, 0.12), M.oro, ex + 0.22 + i * 0.01, ey + 0.018, ez + (i % 2 ? 0.01 : -0.01));
  add(G.esp32, new THREE.BoxGeometry(0.07, 0.03, 0.08), M.acero, ex - 0.245, ey + 0.02, ez);
  add(G.esp32, new THREE.BoxGeometry(0.04, 0.02, 0.04), M.blindaje, ex - 0.15, ey + 0.02, ez + 0.08);
  add(G.esp32, new THREE.BoxGeometry(0.04, 0.02, 0.04), M.blindaje, ex - 0.15, ey + 0.02, ez - 0.08);
  add(G.esp32, new THREE.BoxGeometry(0.05, 0.015, 0.035), M.plasticoNegro, ex - 0.06, ey + 0.018, ez + 0.04);
  add(G.esp32, new THREE.BoxGeometry(0.02, 0.012, 0.02), new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 0.8 }), ex - 0.1, ey + 0.016, ez - 0.06);
  const pinGeo = new THREE.BoxGeometry(0.01, 0.07, 0.01);
  const pines = new THREE.InstancedMesh(pinGeo, M.oro, 30);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 30; i++) {
    const fila = i < 15 ? 1 : -1;
    dummy.position.set(ex - 0.2 + (i % 15) * 0.0254 * 1.1, ey - 0.03, ez + fila * 0.115);
    dummy.updateMatrix();
    pines.setMatrixAt(i, dummy.matrix);
  }
  G.esp32.add(pines);
  for (const f of [1, -1]) add(G.esp32, new THREE.BoxGeometry(0.4, 0.025, 0.025), M.plasticoNegro, ex - 0.022, ey - 0.024, ez + f * 0.115);

  const lx = 0.02, ly = 0.635, lz = 0.27;
  add(G.lora, new RoundedBoxGeometry(0.19, 0.014, 0.18, 2, 0.004), M.pcbAzul, lx, ly, lz);
  add(G.lora, new RoundedBoxGeometry(0.15, 0.024, 0.14, 2, 0.003), M.blindaje, lx, ly + 0.018, lz);
  add(G.lora, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), M.oro, lx + 0.07, ly + 0.012, lz + 0.07);
  for (let i = 0; i < 8; i++) add(G.lora, new THREE.BoxGeometry(0.012, 0.004, 0.016), M.oro, lx - 0.08 + i * 0.022, ly + 0.008, lz - 0.085);
  for (const f of [-1, 1]) add(G.lora, new THREE.BoxGeometry(0.16, 0.03, 0.02), M.plasticoNegro, lx, ly - 0.022, lz + f * 0.075);
  const pigtail = tubo([
    new THREE.Vector3(lx + 0.07, ly + 0.02, lz + 0.07),
    new THREE.Vector3(lx + 0.14, ly + 0.08, lz + 0.05),
    new THREE.Vector3(0.24, 0.73, 0.27),
    new THREE.Vector3(0.29, 0.73, 0.27)
  ], 0.008, M.negroCable, 24);
  G.lora.add(pigtail);

  const qx = -0.36, qy = 0.635, qz = 0.27;
  add(G.potenciostato, new RoundedBoxGeometry(0.24, 0.014, 0.17, 2, 0.004), M.pcbVerde, qx, qy, qz);
  add(G.potenciostato, new THREE.BoxGeometry(0.07, 0.014, 0.07), M.pcbNegro, qx + 0.02, qy + 0.013, qz);
  add(G.potenciostato, new THREE.BoxGeometry(0.035, 0.01, 0.025), M.pcbNegro, qx - 0.07, qy + 0.011, qz + 0.05);
  add(G.potenciostato, new THREE.BoxGeometry(0.035, 0.01, 0.025), M.pcbNegro, qx - 0.07, qy + 0.011, qz - 0.05);
  add(G.potenciostato, new THREE.BoxGeometry(0.05, 0.03, 0.03), M.plasticoNegro, qx - 0.1, qy + 0.02, qz);
  for (let i = 0; i < 4; i++) add(G.potenciostato, new THREE.CylinderGeometry(0.008, 0.008, 0.02, 12), M.blindaje, qx + 0.08, qy + 0.016, qz - 0.045 + i * 0.03);

  add(G.antena, new THREE.CylinderGeometry(0.035, 0.035, 0.07, 6).rotateZ(Math.PI / 2), M.oro, 0.335, 0.73, 0.27);
  add(G.antena, new THREE.CylinderGeometry(0.028, 0.028, 0.06, 24).rotateZ(Math.PI / 2), M.oro, 0.39, 0.73, 0.27);
  add(G.antena, new THREE.SphereGeometry(0.04, 24, 16), M.goma, 0.44, 0.75, 0.27);
  const varilla = new THREE.Group();
  varilla.position.set(0.44, 0.77, 0.27);
  varilla.rotation.z = -0.12;
  G.antena.add(varilla);
  add(varilla, new THREE.CylinderGeometry(0.03, 0.04, 0.16, 24), M.goma, 0, 0.08, 0);
  add(varilla, new THREE.CylinderGeometry(0.018, 0.028, 1.05, 24), M.goma, 0, 0.68, 0);
  for (let i = 0; i < 6; i++) add(varilla, new THREE.TorusGeometry(0.024 - i * 0.001, 0.004, 8, 24).rotateX(Math.PI / 2), M.goma, 0, 0.25 + i * 0.07, 0);
  add(varilla, new THREE.SphereGeometry(0.022, 16, 12), M.goma, 0, 1.21, 0);
  const puntaAntena = new THREE.Object3D();
  puntaAntena.position.set(0, 1.22, 0);
  varilla.add(puntaAntena);

  const sx = -0.8, sz = 0;
  add(G.sensor, new THREE.CylinderGeometry(0.055, 0.055, 2.05, 40, 1, true), M.pvc, sx, -0.4, sz);
  add(G.sensor, new THREE.CylinderGeometry(0.016, 0.016, 2.0, 12), M.negroCable, sx, -0.42, sz);
  add(G.sensor, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), M.goma, sx, 0.62, sz);
  const cableSup = tubo([
    new THREE.Vector3(sx, 0.64, sz),
    new THREE.Vector3(sx, 0.72, sz),
    new THREE.Vector3(sx + 0.03, 0.73, sz),
    new THREE.Vector3(-0.73, 0.7, 0)
  ], 0.016, M.negroCable, 16);
  G.sensor.add(cableSup);
  add(G.sensor, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), M.goma, sx, -1.43, sz);
  add(G.sensor, new THREE.CylinderGeometry(0.072, 0.064, 0.16, 40), M.plasticoNegro, sx, -1.52, sz);
  add(G.sensor, new THREE.CylinderGeometry(0.074, 0.074, 0.015, 40), M.acero, sx, -1.47, sz);
  const discoE = (r, mat, dx, dz) => add(G.sensor, new THREE.CylinderGeometry(r, r, 0.012, 24), mat, sx + dx, -1.604, sz + dz);
  const matOroE = new THREE.MeshStandardMaterial({ color: 0xe0b84f, metalness: 1, roughness: 0.22, emissive: 0x000000 });
  const matBismuto = new THREE.MeshStandardMaterial({ color: 0xa79bb3, metalness: 0.85, roughness: 0.3, emissive: 0x000000 });
  const punta = discoE(0.021, matOroE, 0.025, 0);
  punta.userData.puntaSensor = true;
  const bismuto = discoE(0.019, matBismuto, -0.025, 0);
  discoE(0.009, new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.3 }), 0, 0.034);
  discoE(0.011, M.acero, 0, -0.034);

  const mx = sx + 0.075, mz = sz + 0.085;
  const matSonda = new THREE.MeshStandardMaterial({ color: 0x23404a, roughness: 0.45 });
  add(G.sondas, new THREE.CylinderGeometry(0.028, 0.028, 2.0, 24), matSonda, mx, -0.48, mz);
  add(G.sondas, new THREE.CylinderGeometry(0.034, 0.034, 0.05, 24), M.goma, mx, 0.55, mz);
  add(G.sondas, new THREE.CylinderGeometry(0.031, 0.031, 0.015, 24), M.naranja, mx, -1.3, mz);
  add(G.sondas, new THREE.SphereGeometry(0.011, 16, 10), new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }), mx + 0.012, -1.488, mz);
  add(G.sondas, new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), M.acero, mx - 0.012, -1.495, mz + 0.008);
  const ventana = add(G.sondas, new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x38bdf8, emissiveIntensity: 0.4 }), mx, -1.481, mz - 0.014);
  G.sondas.add(tubo([
    new THREE.Vector3(mx, 0.57, mz),
    new THREE.Vector3(mx, 0.68, mz),
    new THREE.Vector3(-0.71, 0.7, 0.08)
  ], 0.01, M.negroCable, 12));

  const rTop = -0.905, rBot = -1.7, rr = 0.165;
  const barraGeo = new THREE.CylinderGeometry(0.008, 0.008, rTop - rBot, 8);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(G.rejilla, barraGeo, M.acero, sx + Math.cos(a) * rr, (rTop + rBot) / 2, sz + Math.sin(a) * rr);
  }
  for (let k = 0; k < 5; k++) {
    add(G.rejilla, new THREE.TorusGeometry(rr, k === 0 || k === 4 ? 0.014 : 0.008, 8, 48).rotateX(Math.PI / 2), M.acero, sx, rTop - k * ((rTop - rBot) / 4), sz);
  }
  for (const r of [0, Math.PI / 2]) {
    const cruz = add(G.rejilla, new THREE.CylinderGeometry(0.008, 0.008, rr * 2, 8).rotateZ(Math.PI / 2), M.acero, sx, rBot, sz);
    cruz.rotation.y = r;
  }

  const ax = 0.45;
  add(G.argolla, new THREE.CylinderGeometry(0.09, 0.11, 0.05, 32), M.acero, ax, -0.965, 0);
  add(G.argolla, new THREE.BoxGeometry(0.05, 0.06, 0.03), M.acero, ax, -1.01, 0);
  add(G.argolla, new THREE.TorusGeometry(0.075, 0.018, 16, 48), M.acero, ax, -1.11, 0);
  const cuerda = tubo([
    new THREE.Vector3(ax, -1.185, 0),
    new THREE.Vector3(ax + 0.3, -1.45, 0.05),
    new THREE.Vector3(ax + 1.6, -1.95, 0.4),
    new THREE.Vector3(ax + 4.5, -2.6, 1.2),
    new THREE.Vector3(ax + 9, -3.2, 2.4)
  ], 0.016, M.cuerda, 80);
  G.argolla.add(cuerda);

  const tc = Math.PI * 1.5;
  const matRej = new THREE.MeshStandardMaterial({ map: texturaRejillaEntrada(), roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  add(G.compuerta, new THREE.CylinderGeometry(1.071, 1.071, 0.3, 32, 1, true, tc - 0.25, 0.5), matRej, 0, -0.35, 0);
  for (const y of [-0.18, -0.52]) {
    const riel = add(G.compuerta, new THREE.TorusGeometry(1.08, 0.012, 8, 48, 1.4).rotateX(Math.PI / 2), M.acero, 0, y, 0);
    riel.rotation.y = -(tc - 0.7) + Math.PI / 2;
  }
  const pivote = new THREE.Group();
  G.compuerta.add(pivote);
  const placa = add(pivote, new THREE.CylinderGeometry(1.092, 1.092, 0.33, 32, 1, true, tc - 0.3, 0.6), new THREE.MeshPhysicalMaterial({ color: 0x1f7a5a, roughness: 0.4, clearcoat: 0.6, side: THREE.DoubleSide }), 0, -0.35, 0);
  add(pivote, new THREE.BoxGeometry(0.03, 0.12, 0.05), M.acero, -1.1, -0.35, 0.23);
  placa.userData.placa = true;
  add(G.compuerta, new THREE.CylinderGeometry(0.03, 0.025, 0.08, 16), M.plasticoNegro, -0.66, -0.95, 0.1);

  const aguaCamara = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.505, 0), new THREE.Vector2(0.995, 0), new THREE.Vector2(0.995, 1), new THREE.Vector2(0.505, 1)], 96),
    new THREE.MeshPhysicalMaterial({ color: 0x6f8a63, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })
  );
  aguaCamara.position.y = -0.86;
  aguaCamara.scale.y = 0.0001;
  aguaCamara.visible = false;
  nodo.add(aguaCamara);

  const espuma = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.75, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texturaEspuma(), transparent: true, depthWrite: false, opacity: 0.55 })
  );
  espuma.position.y = 0.02;
  espuma.renderOrder = 3;
  nodo.add(espuma);

  const cables = [
    { mat: M.rojo, pts: [[-0.2, 0.62, -0.035], [-0.12, 0.6, 0.05], [-0.05, 0.6, 0.16], [-0.02, 0.62, 0.19]] },
    { mat: M.negroCable, pts: [[-0.18, 0.62, -0.035], [-0.1, 0.59, 0.06], [-0.03, 0.6, 0.16], [0.0, 0.62, 0.19]] },
    { mat: M.amarillo, pts: [[-0.16, 0.62, -0.035], [-0.08, 0.6, 0.07], [0.0, 0.6, 0.16], [0.03, 0.62, 0.19]] },
    { mat: M.azul, pts: [[-0.14, 0.62, -0.035], [-0.06, 0.61, 0.08], [0.02, 0.6, 0.16], [0.06, 0.62, 0.19]] },
    { mat: M.verdeCable, pts: [[-0.12, 0.62, -0.035], [-0.04, 0.6, 0.08], [0.04, 0.61, 0.15], [0.09, 0.62, 0.19]] },
    { mat: M.rojo, pts: [[0.03, -0.17, 0.0], [0.05, 0.2, 0.05], [-0.1, 0.55, 0.0], [-0.42, 0.62, -0.03]] },
    { mat: M.negroCable, pts: [[-0.03, -0.17, 0.0], [-0.05, 0.2, -0.05], [-0.18, 0.55, -0.05], [-0.44, 0.62, -0.03]] },
    { mat: M.negroCable, pts: [[-0.18, 0.9, 0.38], [-0.2, 0.8, 0.3], [-0.3, 0.68, 0.1], [-0.4, 0.66, 0.0]] }
  ];
  for (const c of cables) decor.add(tubo(c.pts.map((p) => new THREE.Vector3(...p)), 0.007, c.mat, 24));

  const crearParticulas = (n, color) => {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.2, transparent: true, opacity: 0.85 }), n);
    im.visible = false;
    im.frustumCulled = false;
    im.userData.semillas = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]);
    nodo.add(im);
    return im;
  };

  const offsets = {
    casco: [0, 0, 0],
    compartimento: [0, 0.95, 0],
    cupula: [0, 2.1, 0],
    panel: [0, 1.75, 0],
    bateria: [1.75, 0.35, 0.35],
    potenciostato: [-0.75, 1.35, 0.6],
    sondas: [-1.35, -0.2, 0.45],
    reactivo: [1.1, 0.15, -1.45],
    esp32: [-0.2, 1.42, -0.35],
    lora: [0.35, 1.45, 0.45],
    antena: [0.75, 1.1, 0.45],
    sensor: [-0.95, -0.25, 0],
    rejilla: [-0.95, -0.85, 0],
    argolla: [0.6, -0.55, 0],
    compuerta: [-0.7, 0, 0]
  };
  const anclas = {
    casco: [0.98, 0.42, 0.62],
    compartimento: [-0.62, 0.82, 0.42],
    cupula: [-0.15, 1.2, 0],
    panel: [-0.62, 0.97, 0.2],
    bateria: [0.2, -0.45, 0],
    potenciostato: [-0.48, 0.66, 0.36],
    sondas: [-0.7, -0.7, 0.14],
    reactivo: [0.24, -0.2, -0.33],
    esp32: [-0.42, 0.7, -0.22],
    lora: [0.02, 0.67, 0.3],
    antena: [0.32, 1.9, 0.27],
    sensor: [-0.85, -1.22, 0.06],
    rejilla: [-0.8, -1.72, 0.17],
    argolla: [0.53, -1.14, 0],
    compuerta: [-1.09, -0.3, 0]
  };

  extras = {
    aguaCamara,
    pivoteCompuerta: pivote,
    puntaSensor: punta,
    mallasSensor: [bismuto],
    ventanaTurbidez: ventana,
    cabezalBomba: cabezal,
    tubosReactivo,
    puntaAntena,
    espuma,
    entrada: crearParticulas(34, 0x9cc9d6),
    remolino: crearParticulas(26, 0xb9e6f0),
    salida: crearParticulas(22, 0x9cc9d6),
    led
  };

  for (const c of COMPONENTES) {
    registrarComponente(c.id, [G[c.id]], [new THREE.Vector3(...offsets[c.id])], new THREE.Vector3(...anclas[c.id]));
  }
  nodo.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = !o.material.transparent;
      o.receiveShadow = true;
    }
  });
  extras.espuma.castShadow = false;
}

function prepararMateriales(malla) {
  const lista = Array.isArray(malla.material) ? malla.material : [malla.material];
  const clonados = lista.map((m) => {
    const c = m.clone();
    c.userData.base = {
      transparent: c.transparent,
      opacity: c.opacity,
      depthWrite: c.depthWrite,
      emissive: c.emissive ? c.emissive.clone() : null,
      emissiveIntensity: c.emissiveIntensity ?? 1
    };
    return c;
  });
  malla.material = Array.isArray(malla.material) ? clonados : clonados[0];
}

function materialesDe(malla) {
  return Array.isArray(malla.material) ? malla.material : [malla.material];
}

function registrarComponente(id, objetos, offsets, ancla) {
  const mallas = [];
  const nodos = objetos.map((obj, i) => {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.userData.componente = id;
        prepararMateriales(o);
        mallas.push(o);
      }
    });
    return { obj, base: obj.position.clone(), offset: offsets[i] || new THREE.Vector3() };
  });

  const def = porId[id];
  const el = document.createElement('div');
  el.className = 'etiqueta3d';
  el.innerHTML = `<b>${def.numero}</b>${def.nombre}`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    seleccionar(id, true);
  });
  const etiqueta = new CSS2DObject(el);
  const anclaLocal = objetos[0].worldToLocal(nodo.localToWorld(ancla.clone()));
  etiqueta.position.copy(anclaLocal);
  objetos[0].add(etiqueta);

  registro.set(id, { def, nodos, mallas, etiqueta, el });
}

function recalcularPickables() {
  pickables = [];
  registro.forEach((r) => r.mallas.forEach((m) => pickables.push(m)));
}

function normalizarNombre(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function componenteDeNombre(nombre) {
  const n = normalizarNombre(nombre);
  for (const id of PRIORIDAD_MATCH) if (porId[id].match.test(n)) return id;
  return null;
}

function montarGLB(gltf) {
  const raiz = gltf.scene;
  const caja = new THREE.Box3().setFromObject(raiz);
  const tam = caja.getSize(new THREE.Vector3());
  const escala = CONFIG.tamanoGLB / Math.max(tam.x, tam.y, tam.z);
  raiz.scale.multiplyScalar(escala);
  raiz.updateMatrixWorld(true);
  const caja2 = new THREE.Box3().setFromObject(raiz);
  const centro = caja2.getCenter(new THREE.Vector3());
  const alto = caja2.max.y - caja2.min.y;
  raiz.position.x -= centro.x;
  raiz.position.z -= centro.z;
  raiz.position.y += -alto * CONFIG.fraccionSumergida - caja2.min.y;
  nodo.add(raiz);
  nodo.updateMatrixWorld(true);

  const asignados = {};
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    let actual = o;
    while (actual && actual !== raiz) {
      const id = componenteDeNombre(actual.name);
      if (id) {
        asignados[id] = asignados[id] || new Set();
        asignados[id].add(actual);
        break;
      }
      actual = actual.parent;
    }
  });

  const cajaModelo = new THREE.Box3().setFromObject(raiz);
  const centroModelo = cajaModelo.getCenter(new THREE.Vector3());
  const radio = cajaModelo.getSize(new THREE.Vector3()).length() / 2;

  for (const id of Object.keys(asignados)) {
    const objetos = [...asignados[id]].filter((o) => ![...asignados[id]].some((p) => p !== o && esAncestro(p, o)));
    const offsets = objetos.map((obj) => {
      if (id === 'casco') return new THREE.Vector3();
      const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      const dir = c.clone().sub(centroModelo);
      if (dir.length() < 1e-3) dir.set(0, 1, 0);
      const mundo = dir.normalize().multiplyScalar(radio * 0.55).add(new THREE.Vector3(0, radio * 0.12, 0));
      const p = obj.parent;
      const a = p.worldToLocal(c.clone());
      const b = p.worldToLocal(c.clone().add(mundo));
      return b.sub(a);
    });
    const cajaComp = new THREE.Box3();
    objetos.forEach((o) => cajaComp.expandByObject(o));
    const anclaMundo = cajaComp.getCenter(new THREE.Vector3());
    anclaMundo.y = cajaComp.max.y;
    registrarComponente(id, objetos, offsets, nodo.worldToLocal(anclaMundo));
  }

  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(raiz);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  }

  const ant = registro.get('antena');
  if (ant) {
    const caja3 = new THREE.Box3();
    ant.nodos.forEach((n) => caja3.expandByObject(n.obj));
    const punta = new THREE.Object3D();
    const p = caja3.getCenter(new THREE.Vector3());
    p.y = caja3.max.y;
    punta.position.copy(ant.nodos[0].obj.worldToLocal(p));
    ant.nodos[0].obj.add(punta);
    extras.puntaAntena = punta;
  }
  const sen = registro.get('sensor');
  if (sen) extras.mallasSensor = sen.mallas;

  const encontrados = Object.keys(asignados).length;
  $('#modoModelo').innerHTML = `Modelo: <i>${CONFIG.modeloGLB.split('/').pop()}</i> · ${encontrados}/${COMPONENTES.length} componentes detectados`;
  console.info('[AmazonMercury] Componentes detectados en el GLB:', Object.keys(asignados));
  if (encontrados < COMPONENTES.length) {
    console.info('[AmazonMercury] Faltan:', COMPONENTES.filter((c) => !asignados[c.id]).map((c) => c.id), '→ nombra esos objetos en Blender.');
  }
}

function esAncestro(a, b) {
  let p = b.parent;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
}

const anillos = [];
function crearAnillosLoRa() {
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.01, 8, 96).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0, depthWrite: false })
    );
    m.visible = false;
    m.renderOrder = 5;
    scene.add(m);
    anillos.push(m);
  }
}

function construirLista() {
  const ol = $('#listaComponentes');
  ol.innerHTML = '';
  COMPONENTES.forEach((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'item-comp';
    b.dataset.id = c.id;
    b.innerHTML = `<span class="num">${i + 1}</span><span>${c.nombre}</span>${c.extra ? '<span class="extra">mecanismo</span>' : ''}`;
    if (!registro.has(c.id)) {
      b.classList.add('no-encontrado');
      b.title = `No se encontró en el modelo. En Blender nombra el objeto con "${c.id}".`;
    }
    b.addEventListener('click', () => seleccionar(c.id, true));
    li.appendChild(b);
    ol.appendChild(li);
  });
}

function seleccionar(id, enfocar = false) {
  if (estado.seleccion && registro.has(estado.seleccion)) {
    const prev = registro.get(estado.seleccion);
    prev.mallas.forEach(restaurarEmisivo);
    prev.el.classList.remove('activo');
  }
  estado.seleccion = id;
  document.querySelectorAll('.item-comp').forEach((b) => b.classList.toggle('activo', b.dataset.id === id));
  const panel = $('#panelInfo');
  if (!id) {
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
    return;
  }
  const def = porId[id];
  $('#piNum').textContent = def.numero;
  $('#piCat').textContent = def.categoria;
  $('#piNombre').textContent = def.nombre;
  $('#piFuncion').textContent = def.funcion;
  $('#piInfo').textContent = def.info;
  $('#piSpecs').innerHTML = def.specs.map((s) => `<li>${s}</li>`).join('');
  const aviso = $('#piAviso');
  if (!registro.has(id)) {
    aviso.hidden = false;
    aviso.textContent = `Esta pieza aún no está en el modelo 3D. En Blender, nombra el objeto (o su Empty padre) con "${id}" y vuelve a exportar el GLB.`;
  } else {
    aviso.hidden = true;
  }
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
  const r = registro.get(id);
  if (r && INTERNOS.has(id) && !estado.interior && estado.explosionObjetivo < 0.5) setInterior(true);
  if (r) {
    r.el.classList.add('activo');
    if (enfocar) enfocarComponente(id);
  }
  if (estado.autoRotar) setAutoRotar(false);
}

function restaurarEmisivo(m) {
  materialesDe(m).forEach((mat) => {
    const b = mat.userData.base;
    if (b && b.emissive && mat.emissive) {
      mat.emissive.copy(b.emissive);
      mat.emissiveIntensity = b.emissiveIntensity;
    }
  });
}

function cajaComponente(id) {
  const r = registro.get(id);
  const caja = new THREE.Box3();
  r.nodos.forEach((n) => caja.expandByObject(n.obj));
  return caja;
}

function enfocarComponente(id) {
  const caja = cajaComponente(id);
  if (caja.isEmpty()) return;
  const centro = caja.getCenter(new THREE.Vector3());
  const radio = Math.max(caja.getSize(new THREE.Vector3()).length() / 2, 0.25);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = THREE.MathUtils.clamp(radio * 3.4, 1.6, 7) * (camera.aspect < 0.9 ? 1.5 : 1);
  if (id === 'casco' || id === 'argolla') dir.y = Math.max(dir.y, 0.25);
  dir.normalize();
  const objetivo = centro.clone();
  if (esMovil()) objetivo.y -= dist * 0.22;
  estado.foco = {
    t: 0,
    desdeT: controls.target.clone(),
    haciaT: objetivo,
    desdeC: camera.position.clone(),
    haciaC: objetivo.clone().addScaledVector(dir, dist)
  };
}

function vistaInicial(animada = true) {
  const factor = camera.aspect < 0.9 ? 1.4 : camera.aspect < 1.3 ? 1.2 : 1;
  const objetivo = new THREE.Vector3(0, 0.05, 0);
  const pos = new THREE.Vector3(4.5, 1.75, 5.0).multiplyScalar(factor);
  if (animada) {
    estado.foco = { t: 0, desdeT: controls.target.clone(), haciaT: objetivo, desdeC: camera.position.clone(), haciaC: pos };
  } else {
    controls.target.copy(objetivo);
    camera.position.copy(pos);
  }
}

function setAutoRotar(v) {
  estado.autoRotar = v;
  controls.autoRotate = v;
  $('#btnRotar').classList.toggle('activo', v);
}

function setInterior(v) {
  estado.interior = v;
  $('#btnRayos').classList.toggle('activo', v);
  registro.forEach((r, id) => {
    if (!TRANSPARENTES_EN_INTERIOR.has(id)) return;
    r.mallas.forEach((m) => {
      materialesDe(m).forEach((mat) => {
        const b = mat.userData.base;
        if (v) {
          mat.transparent = true;
          mat.opacity = Math.min(b.opacity, id === 'casco' ? 0.3 : 0.22);
          mat.depthWrite = false;
        } else {
          mat.transparent = b.transparent;
          mat.opacity = b.opacity;
          mat.depthWrite = b.depthWrite;
        }
        mat.needsUpdate = true;
      });
      m.castShadow = !v;
    });
  });
  if (extras.aguaCamara) extras.aguaCamara.visible = v && extras.aguaCamara.scale.y > 0.01;
}

function setExplosion(v, moverCamara = true) {
  estado.explosionObjetivo = v ? 1 : 0;
  $('#btnExplosion').classList.toggle('activo', v);
  if (!moverCamara) return;
  const objetivo = new THREE.Vector3(0, v ? 0.7 : 0.05, 0);
  const dir = camera.position.clone().sub(controls.target).normalize();
  dir.y = Math.max(dir.y, v ? 0.42 : 0.2);
  dir.normalize();
  const dist = (v ? 9.2 : 6.9) * (camera.aspect < 0.9 ? 1.45 : 1);
  estado.foco = { t: 0, desdeT: controls.target.clone(), haciaT: objetivo, desdeC: camera.position.clone(), haciaC: objetivo.clone().addScaledVector(dir, dist) };
}

function setEtiquetas(v) {
  estado.etiquetas = v;
  $('#btnEtiquetas').classList.toggle('activo', v);
  capaEtiquetas.domElement.classList.toggle('oculto-etiquetas', !v);
}

function setAgua(v) {
  estado.agua = v;
  $('#btnAgua').classList.toggle('activo', v);
  rio.agua.visible = v;
  if (extras.espuma) extras.espuma.visible = v;
}

const raycaster = new THREE.Raycaster();
const puntero = new THREE.Vector2();
let inicioPuntero = null;

function componenteBajoPuntero(e) {
  const r = renderer.domElement.getBoundingClientRect();
  puntero.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  puntero.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(puntero, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  let respaldo = null;
  for (const h of hits) {
    if (!h.object.visible) continue;
    const id = h.object.userData.componente;
    if (PASANTES.has(id) || (estado.interior && TRANSPARENTES_EN_INTERIOR.has(id))) {
      respaldo = respaldo || id;
      continue;
    }
    return id;
  }
  return respaldo;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  inicioPuntero = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!inicioPuntero) return;
  const movido = Math.hypot(e.clientX - inicioPuntero.x, e.clientY - inicioPuntero.y);
  inicioPuntero = null;
  if (movido > 6) return;
  const id = componenteBajoPuntero(e);
  seleccionar(id, !!id);
});
const tooltip = $('#tooltip');
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) {
    tooltip.hidden = true;
    return;
  }
  const id = componenteBajoPuntero(e);
  estado.hover = id;
  renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
  if (id) {
    tooltip.hidden = false;
    tooltip.textContent = `${porId[id].numero}. ${porId[id].nombre}`;
    tooltip.style.left = `${e.clientX}px`;
    tooltip.style.top = `${e.clientY}px`;
  } else {
    tooltip.hidden = true;
  }
});
renderer.domElement.addEventListener('pointerleave', () => {
  tooltip.hidden = true;
  estado.hover = null;
});
controls.addEventListener('start', () => {
  estado.foco = null;
});

function moverSeleccion(paso) {
  const ids = COMPONENTES.map((c) => c.id);
  const i = ids.indexOf(estado.seleccion);
  const sig = ids[(i + paso + ids.length) % ids.length];
  seleccionar(sig, true);
}

$('#cerrarInfo').addEventListener('click', () => seleccionar(null));
$('#piPrev').addEventListener('click', () => moverSeleccion(-1));
$('#piNext').addEventListener('click', () => moverSeleccion(1));
$('#btnRotar').addEventListener('click', () => setAutoRotar(!estado.autoRotar));
$('#btnExplosion').addEventListener('click', () => setExplosion(estado.explosionObjetivo < 0.5));
$('#btnRayos').addEventListener('click', () => setInterior(!estado.interior));
$('#btnEtiquetas').addEventListener('click', () => setEtiquetas(!estado.etiquetas));
$('#btnAgua').addEventListener('click', () => setAgua(!estado.agua));
$('#btnReset').addEventListener('click', () => {
  seleccionar(null);
  setExplosion(false, false);
  setInterior(false);
  vistaInicial(true);
});
$('#btnCiclo').addEventListener('click', () => iniciarCiclo());
$('#btnPanel').addEventListener('click', abrirPanel);

const modal = $('#modal');
$('#btnProyecto').addEventListener('click', () => {
  modal.hidden = false;
});
modal.querySelectorAll('[data-cerrar]').forEach((el) => el.addEventListener('click', () => {
  modal.hidden = true;
}));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modal.hidden) modal.hidden = true;
    else seleccionar(null);
  }
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' && estado.seleccion) moverSeleccion(1);
  if (e.key === 'ArrowLeft' && estado.seleccion) moverSeleccion(-1);
});

let ventanaPanel = null;
function abrirPanel() {
  const url = new URL('panel/', location.href).href;
  try {
    if (ventanaPanel && !ventanaPanel.closed) {
      ventanaPanel.focus();
      return;
    }
  } catch { /* otra ventana */ }
  const w = Math.min(1440, screen.availWidth - 40), h = Math.min(920, screen.availHeight - 40);
  ventanaPanel = window.open(url, 'amazonmercury-panel', `popup,width=${w},height=${h}`);
  if (!ventanaPanel) location.href = url;
}

const canal = crearCanal((msg) => {
  if (!msg || !msg.tipo) return;
  if (msg.tipo === 'ping') canal.enviar({ tipo: 'pong', nodo: NODO_MAQUETA, ocupado: !!estado.ciclo });
  if (msg.tipo === 'solicitar' && (!msg.nodo || msg.nodo === NODO_MAQUETA)) {
    if (estado.ciclo) {
      canal.enviar({ tipo: 'ocupado', solicitud: msg.solicitud, nodo: NODO_MAQUETA });
      return;
    }
    iniciarCiclo({ escenario: msg.escenario, origen: 'emergencia', solicitud: msg.solicitud });
  }
});
canal.enviar({ tipo: 'hola', nodo: NODO_MAQUETA });
window.addEventListener('beforeunload', () => canal.enviar({ tipo: 'adios', nodo: NODO_MAQUETA }));

function iniciarCiclo(opciones = {}) {
  if (estado.ciclo) return;
  const origen = opciones.origen || 'manual';
  const medicion = generarMedicion({ nodo: NODO_MAQUETA, escenario: opciones.escenario || 'aleatorio', origen });
  estado.ciclo = { t: 0, fase: -1, medicion, solicitud: opciones.solicitud || null, origen, interiorPrevio: estado.interior };
  setExplosion(false, false);
  setInterior(true);
  if (estado.autoRotar) setAutoRotar(false);
  $('#btnCiclo').disabled = true;
  const hud = $('#hud');
  hud.hidden = false;
  hud.classList.toggle('emergencia', origen === 'emergencia');
  $('#hudOrigen').hidden = origen !== 'emergencia';
  $('#hudLectura').hidden = true;
  $('#hudLectura').innerHTML = '';
  $('#hudPasos').innerHTML = FASES.map((f, i) => `<div class="hud-paso" data-i="${i}">${i + 1}. ${f.nombre}</div>`).join('');
  canal.enviar({ tipo: 'inicio', nodo: NODO_MAQUETA, solicitud: estado.ciclo.solicitud, origen });
  if (!estado.seleccion) {
    estado.foco = {
      t: 0,
      desdeT: controls.target.clone(),
      haciaT: new THREE.Vector3(-0.4, -0.75, 0),
      desdeC: camera.position.clone(),
      haciaC: new THREE.Vector3(-4.3, -0.05, 4.6).multiplyScalar(camera.aspect < 0.9 ? 1.5 : 1)
    };
  }
}

function terminarCiclo() {
  const c = estado.ciclo;
  setInterior(c.interiorPrevio);
  $('#btnCiclo').disabled = false;
  if (extras.aguaCamara) {
    extras.aguaCamara.scale.y = 0.0001;
    extras.aguaCamara.visible = false;
  }
  ['entrada', 'salida', 'remolino'].forEach((k) => { if (extras[k]) extras[k].visible = false; });
  anillos.forEach((a) => { a.visible = false; });
  pintarPunta(null);
  pintarReactivo(0);
  canal.enviar({ tipo: 'fin', nodo: NODO_MAQUETA, solicitud: c.solicitud });
  estado.ciclo = null;
  setTimeout(() => {
    if (!estado.ciclo) $('#hud').hidden = true;
  }, 9000);
  $('#hudTexto').textContent = c.origen === 'emergencia'
    ? 'Diagnóstico enviado al panel de control. El nodo vuelve a su ciclo automático de cada hora.'
    : 'Ciclo completo. Próxima medición automática en 1 hora.';
}

const suave = (x) => x * x * (3 - 2 * x);
const limitar = (x) => Math.min(Math.max(x, 0), 1);

function pintarPunta(color, intensidad = 0) {
  const mats = [];
  if (extras.puntaSensor) mats.push(...materialesDe(extras.puntaSensor));
  if (extras.mallasSensor) extras.mallasSensor.forEach((m) => mats.push(...materialesDe(m)));
  mats.forEach((mat) => {
    if (!mat.emissive) return;
    if (color === null) {
      const b = mat.userData.base;
      if (b && b.emissive) {
        mat.emissive.copy(b.emissive);
        mat.emissiveIntensity = b.emissiveIntensity;
      }
    } else {
      mat.emissive.set(color);
      mat.emissiveIntensity = intensidad;
    }
  });
}

function pintarReactivo(k) {
  const lista = [];
  if (extras.cabezalBomba) lista.push(extras.cabezalBomba);
  if (extras.tubosReactivo) lista.push(...extras.tubosReactivo);
  lista.forEach((m) => materialesDe(m).forEach((mat) => {
    if (!mat.emissive) return;
    if (k <= 0) {
      const b = mat.userData.base;
      if (b && b.emissive) mat.emissive.copy(b.emissive);
      mat.emissiveIntensity = b ? b.emissiveIntensity : 1;
    } else {
      mat.emissive.set(0xf28c28);
      mat.emissiveIntensity = k;
    }
  }));
}

function animarParticulas(im, activo, fn) {
  if (!im) return;
  im.visible = activo;
  if (!activo) return;
  const d = new THREE.Object3D();
  im.userData.semillas.forEach((sem, i) => {
    fn(d, sem);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
}

function actualizarCiclo(dt, t) {
  const c = estado.ciclo;
  if (!c) return;
  c.t += dt;
  let acum = 0;
  let idx = FASES.length;
  let local = 0;
  for (let i = 0; i < FASES.length; i++) {
    if (c.t < acum + FASES[i].dur) {
      idx = i;
      local = (c.t - acum) / FASES[i].dur;
      break;
    }
    acum += FASES[i].dur;
  }
  if (idx >= FASES.length) {
    terminarCiclo();
    return;
  }
  const total = FASES.reduce((s, f) => s + f.dur, 0);
  $('#hudBarra').style.width = `${(c.t / total) * 100}%`;
  if (idx !== c.fase) {
    c.fase = idx;
    const f = FASES[idx];
    $('#hudTexto').innerHTML = `${f.texto}<span class="hud-real">Tiempo real en campo: ${f.real}</span>`;
    document.querySelectorAll('.hud-paso').forEach((el, i) => {
      el.classList.toggle('activo', i === idx);
      el.classList.toggle('hecho', i < idx);
    });
    canal.enviar({ tipo: 'fase', nodo: NODO_MAQUETA, solicitud: c.solicitud, fase: f.id, indice: idx });
    if (idx === F.transmision) {
      c.medicion.t = Date.now();
      mostrarLectura(c.medicion);
      guardarLectura(c.medicion);
      canal.enviar({ tipo: 'resultado', nodo: NODO_MAQUETA, solicitud: c.solicitud, medicion: c.medicion });
    }
  }

  const general = estadoGeneral(c.medicion);
  const colorEstado = general === 'alerta' ? 0xff3b3b : general === 'precaucion' ? 0xffb020 : 0x22e08f;

  let apertura = 0;
  let nivel = 0;
  if (idx === F.admision) {
    apertura = local < 0.72 ? suave(limitar(local / 0.2)) : suave(limitar((1 - local) / 0.22));
    nivel = suave(limitar(local / 0.85));
  } else if (idx < F.descarga) {
    nivel = 1;
  } else {
    nivel = 1 - suave(limitar(local / 0.85));
  }
  if (extras.pivoteCompuerta) extras.pivoteCompuerta.rotation.y = -apertura * 0.62;
  if (extras.aguaCamara) {
    extras.aguaCamara.scale.y = Math.max(nivel * 0.6, 0.0001);
    extras.aguaCamara.visible = estado.interior && nivel > 0.01;
    extras.aguaCamara.material.color.set(idx >= F.reactivo && idx < F.descarga ? 0x8a8a5a : 0x6f8a63);
  }

  animarParticulas(extras.entrada, idx === F.admision && apertura > 0.4, (d, [a, b, s]) => {
    const p = (t * 0.55 + s) % 1;
    const th = Math.PI * 1.5 + (a - 0.5) * 0.42;
    const r = THREE.MathUtils.lerp(1.75, 0.8, p);
    d.position.set(Math.sin(th) * r, -0.32 + (b - 0.5) * 0.2 - p * 0.18, Math.cos(th) * r);
    d.scale.setScalar(p > 0.92 ? (1 - p) * 12 : 1);
  });
  animarParticulas(extras.remolino, idx === F.deposito || idx === F.barrido, (d, [a, b, s]) => {
    const giro = t * (idx === F.deposito ? 3.2 : 1.2) + s * Math.PI * 2;
    const r = 0.09 + a * 0.06;
    d.position.set(-0.8 + Math.cos(giro) * r, -1.62 - b * 0.06 + Math.sin(giro * 2) * 0.01, Math.sin(giro) * r);
    d.scale.setScalar(0.55 + b * 0.4);
  });
  animarParticulas(extras.salida, idx === F.descarga && local < 0.92, (d, [a, b]) => {
    const p = (t * 0.9 + a) % 1;
    d.position.set(-0.66 - p * 0.12 + (a - 0.5) * 0.05, -0.97 - p * 0.75, 0.1 - p * 0.08 + (b - 0.5) * 0.05);
    d.scale.setScalar(1 - p * 0.5);
  });

  pintarReactivo(idx === F.reactivo ? 0.5 + Math.sin(t * 14) * 0.4 : 0);

  if (idx === F.deposito) {
    pintarPunta(0xf2c14e, 0.35 + Math.sin(t * 4) * 0.3);
  } else if (idx === F.barrido) {
    pintarPunta(Math.sin(t * 22) > 0 ? 0x5eead4 : 0xf2c14e, 0.9);
  } else if (idx === F.transmision) {
    pintarPunta(colorEstado, 0.9);
  } else {
    pintarPunta(null);
  }
  if (extras.ventanaTurbidez) {
    materialesDe(extras.ventanaTurbidez).forEach((m) => { m.emissiveIntensity = idx === F.barrido ? 1.4 + Math.sin(t * 18) * 0.6 : 0.4; });
  }

  const puntaA = extras.puntaAntena;
  anillos.forEach((a, i) => {
    if (idx !== F.transmision || !puntaA) {
      a.visible = false;
      return;
    }
    const p = (local * 2.2 + i / 3) % 1;
    puntaA.getWorldPosition(a.position);
    a.position.y -= p * 0.3;
    a.scale.setScalar(0.08 + p * 3.2);
    a.material.opacity = (1 - p) * 0.9;
    a.material.color.set(general === 'alerta' ? 0xff8a8a : general === 'precaucion' ? 0xffc46b : 0x5eead4);
    a.visible = true;
  });
}

function mostrarLectura(med) {
  const general = estadoGeneral(med);
  const filas = METALES.map((m) => {
    const e = clasificar(m, med.metales[m.id].valor);
    return `<div class="hl-fila ${e}"><b>${m.id}</b><span>${formatearMetal(m, med.metales[m.id])}</span><em>${ETIQUETA_ESTADO[e]}</em></div>`;
  }).join('');
  const agua = med.agua;
  const el = $('#hudLectura');
  el.hidden = false;
  el.innerHTML = `
    <div class="hl-cab ${general}">
      <span>Hg: <strong>${formatearMetal('Hg', med.metales.Hg)} µg/L</strong></span>
      <span class="hl-estado">${ETIQUETA_ESTADO[clasificar('Hg', med.metales.Hg.valor)]}</span>
    </div>
    <div class="hl-grid">${filas}</div>
    <p class="hl-agua">Turbidez ${agua.turbidez.toFixed(0)} NTU${agua.turbidez > 450 ? ' ↑' : ''} · pH ${agua.ph.toFixed(1)} · ${agua.conductividad.toFixed(0)} µS/cm · ${agua.temperatura.toFixed(1)} °C</p>
    ${general === 'alerta' ? '<p class="hl-msg">⚠ No use agua del río para beber ni cocinar hasta nuevo aviso.</p>' : ''}
    <small>Lectura simulada para la demostración · µg/L · umbrales de Hg: 2 µg/L (EPA) y 6 µg/L (OMS)</small>`;
}

function aplicarExplosion(dt) {
  const k = 1 - Math.exp(-dt * 5);
  estado.explosion += (estado.explosionObjetivo - estado.explosion) * k;
  if (Math.abs(estado.explosionObjetivo - estado.explosion) < 0.0005) estado.explosion = estado.explosionObjetivo;
  const e = suave(limitar(estado.explosion));
  registro.forEach((r) => r.nodos.forEach((n) => {
    n.obj.position.copy(n.base).addScaledVector(n.offset, e);
  }));
  nodo.children.forEach((o) => {
    if (o.userData.ocultarAlExplotar) o.visible = e < 0.05;
  });
}

function aplicarResaltado(t) {
  const pulso = 0.35 + Math.sin(t * 5) * 0.2;
  if (estado.seleccion && registro.has(estado.seleccion)) {
    registro.get(estado.seleccion).mallas.forEach((m) => {
      if (estado.ciclo && m === extras.puntaSensor) return;
      materialesDe(m).forEach((mat) => {
        if (!mat.emissive) return;
        mat.emissive.set(0x19e6b0);
        mat.emissiveIntensity = pulso;
      });
    });
  }
}

function actualizarFoco(dt) {
  const f = estado.foco;
  if (!f) return;
  f.t = Math.min(f.t + dt / 1.1, 1);
  const k = suave(f.t);
  controls.target.lerpVectors(f.desdeT, f.haciaT, k);
  camera.position.lerpVectors(f.desdeC, f.haciaC, k);
  if (f.t >= 1) estado.foco = null;
}

function flotar(t) {
  const h = alturaOla(0, 0, t);
  const hx = alturaOla(0.6, 0, t) - alturaOla(-0.6, 0, t);
  const hz = alturaOla(0, 0.6, t) - alturaOla(0, -0.6, t);
  nodo.position.y = h * 0.85;
  nodo.rotation.z = Math.atan(hx / 1.2) * 0.7;
  nodo.rotation.x = -Math.atan(hz / 1.2) * 0.7;
  nodo.rotation.y = Math.sin(t * 0.13) * 0.05;
}

let cielo;
let rio;
const reloj = new THREE.Clock();

let ultimoFrame = performance.now();
setInterval(() => {
  const ahora = performance.now();
  if (estado.ciclo && ahora - ultimoFrame > 400) {
    const dt = Math.min((ahora - ultimoFrame) / 1000, 1.5);
    ultimoFrame = ahora;
    actualizarCiclo(dt, reloj.elapsedTime);
  }
}, 250);

function animar() {
  ultimoFrame = performance.now();
  const dtReal = Math.min(reloj.getDelta(), 0.25);
  const dt = Math.min(dtReal, 0.1);
  const t = reloj.elapsedTime;
  uniformesAgua.uTiempo.value = t;
  if (rio.normal) rio.normal.offset.set(t * 0.012, t * 0.004);
  flotar(t);
  aplicarExplosion(dt);
  actualizarFoco(dtReal);
  actualizarCiclo(dtReal, t);
  aplicarResaltado(t);
  if (extras.espuma) extras.espuma.rotation.y = t * 0.03;
  if (extras.led) {
    const on = Math.sin(t * 3) > 0.6 || (estado.ciclo && estado.ciclo.fase === F.transmision);
    extras.led.material.emissiveIntensity = on ? 2 : 0.15;
  }
  if (mixer) mixer.update(dt);
  cielo.position.copy(camera.position);
  controls.update();
  renderer.render(scene, camera);
  capaEtiquetas.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  capaEtiquetas.setSize(window.innerWidth, window.innerHeight);
});

function progreso(p, texto) {
  $('#cargadorBarra').style.width = `${Math.round(p * 100)}%`;
  if (texto) $('#cargadorTexto').textContent = texto;
}

async function existeArchivo(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

function cargarGLB(url) {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(CONFIG.rutaDraco);
  loader.setDRACOLoader(draco);
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, (e) => {
      if (e.total) progreso(0.3 + (e.loaded / e.total) * 0.6, `Cargando modelo 3D… ${Math.round((e.loaded / e.total) * 100)}%`);
    }, reject);
  });
}

async function iniciar() {
  progreso(0.1, 'Preparando la escena 3D…');
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 118px "Space Grotesk"'),
        document.fonts.load('600 40px "Inter"')
      ]),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  } catch { /* fuentes opcionales */ }

  cielo = crearCielo();
  rio = crearRio();
  crearSelva();
  crearLuces();
  crearAnillosLoRa();
  progreso(0.25, 'Buscando el modelo de Blender…');

  let cargado = false;
  if (!CONFIG.forzarProcedural && await existeArchivo(CONFIG.modeloGLB)) {
    try {
      const gltf = await cargarGLB(CONFIG.modeloGLB);
      montarGLB(gltf);
      estado.modo = 'glb';
      cargado = true;
    } catch (err) {
      console.error('[AmazonMercury] No se pudo cargar el GLB, uso el modelo de referencia.', err);
    }
  }
  if (!cargado) {
    construirProcedural();
    estado.modo = 'procedural';
    $('#modoModelo').innerHTML = 'Modelo de referencia <i>(procedural)</i> · coloca tu GLB en <i>modelo/amazonmercury.glb</i>';
  }

  recalcularPickables();
  construirLista();
  setEtiquetas(estado.etiquetas);
  progreso(1, 'Listo');

  vistaInicial(false);
  const destino = camera.position.clone();
  camera.position.multiplyScalar(2.2).add(new THREE.Vector3(0, 2.5, 0));
  estado.foco = { t: 0, desdeT: controls.target.clone(), haciaT: controls.target.clone(), desdeC: camera.position.clone(), haciaC: destino };
  renderer.setAnimationLoop(animar);
  setTimeout(() => $('#cargador').classList.add('listo'), 250);
}

iniciar().catch((err) => {
  console.error(err);
  progreso(1, 'Error al iniciar la escena. Revisa la consola (F12).');
});
