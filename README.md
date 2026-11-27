# AmazonMercury · Maqueta 3D + Panel profesional + Mi Río + Pitch

Maqueta 3D interactiva del nodo flotante de monitoreo de mercurio y otros 5 metales (ISC 2027 · Amazonía Viva), con dos paneles conectados en tiempo real: el **panel profesional** (clientes y autoridades) y **Mi Río** (la comunidad), más el **pitch** en diapositivas web.
- link de la maqueta 3D: https://erick-ucsm.github.io/AmazonMercury/
- link de las diapositivas del pitch: https://erick-ucsm.github.io/AmazonMercury/pitch/

> Todos los datos son **simulados** para la demostración.

## Estructura de la carpeta

```
AmazonMercury/
├── index.html            ← maqueta 3D
├── styles.css
├── script.js
├── README.md
├── assets/               ← logo (completo, ícono y favicon)
├── comun/
│   └── simulacion.js     ← datos simulados, umbrales y canal entre ventanas
├── panel/                ← panel profesional (minería, Estado)
│   ├── index.html
│   ├── panel.css
│   └── panel.js
├── comunidad/            ← Mi Río: panel simple para la comunidad (celular)
│   ├── index.html
│   ├── comunidad.css
│   └── comunidad.js
├── pitch/                ← pitch de 5:00 (13 diapositivas)
│   ├── index.html, styles.css, script.js
│   ├── GUION.md
│   └── assets/
└── modelo/
    └── amazonmercury.glb   ← tu exportación de Blender (opcional)
```

## Cómo se conectan la maqueta, el panel profesional y Mi Río

- En la maqueta, el botón **Panel de control** abre `panel/` en otra ventana. En el panel, **Abrir maqueta 3D** hace lo contrario.
- Las dos ventanas se hablan con `BroadcastChannel` (mismo sitio, sin servidor). Funciona en GitHub Pages y con Live Server, no con doble clic.
- En el panel, **Solicitar diagnóstico ahora** con el nodo **AM-02** hace que la maqueta ejecute el ciclo animado (admisión → reactivo → depósito → barrido → transmisión → descarga) y el resultado vuelve al panel.
- Si la maqueta no está abierta, o se elige otro nodo, el panel simula el diagnóstico por su cuenta.
- En *Opciones de la demostración* puedes forzar el escenario (normal, precaución o pico de mercurio) para mostrar una alerta en el pitch.
- Las lecturas de emergencia se guardan en el navegador (localStorage) y aparecen en el historial.
- **Mi Río** (`comunidad/?lugar=AM-02`) muestra el estado del río en lenguaje simple. Cuando el panel o la maqueta miden, Mi Río muestra "Estamos revisando el agua…" y cambia de color al llegar el resultado.
- El botón **Reportar algo raro** de Mi Río envía el reporte al panel profesional (sección "Reportes de la comunidad").

## Pitch

Abre `pitch/` (con Live Server o GitHub Pages). Controles: ← → avanzar, F pantalla completa, N guion con cronómetro, P vista del orador en otra ventana, **D demo en vivo** (panel + maqueta + Mi Río lado a lado). El guion completo está en `pitch/GUION.md`.

Si `modelo/amazonmercury.glb` no existe, la página muestra un modelo de referencia hecho en código.
Cuando pones el GLB, la página lo carga sola.

## Nombres de los objetos en Blender (para que cada pieza se pueda clicar)

El nombre del objeto, o de su Empty padre, tiene que contener una de estas palabras (sin importar mayúsculas ni tildes):

| Componente             | Nombre en Blender (ejemplo) |
|------------------------|-----------------------------|
| Casco flotante         | `casco`                     |
| Compartimento estanco  | `compartimento`             |
| Cúpula protectora      | `cupula`                    |
| Panel solar            | `panel_solar`               |
| Baterías 18650 (×2)    | `bateria`                   |
| ESP32                  | `esp32`                     |
| Potenciostato          | `potenciostato`             |
| Módulo LoRa            | `lora`                      |
| Antena LoRa            | `antena`                    |
| Celda de voltametría   | `sensor` o `celda`          |
| Sondas de calidad      | `sondas`                    |
| Cartucho de reactivo   | `reactivo` o `cartucho`     |
| Rejilla protectora     | `rejilla`                   |
| Argolla de amarre      | `argolla`                   |
| Compuerta de muestreo  | `compuerta`                 |

Para modelos de GrabCAD con muchas piezas: crea un Empty (Shift+A → Empty), llámalo `esp32` y emparenta todas las piezas del ESP32 a él (selecciona las piezas, luego el Empty, Ctrl+P → Object).

## Exportar el GLB

1. Aplica la escala: selecciona todo, Ctrl+A → All Transforms.
2. Archivo → Exportar → glTF 2.0 (.glb/.gltf).
3. Formato: **glTF Binary (.glb)**.
4. Include: marca *Visible Objects*.
5. Transform: **+Y Up** marcado.
6. Data → Mesh: *Apply Modifiers* marcado.
7. Guarda como `modelo/amazonmercury.glb`.

Si el archivo pesa mucho (más de 20 MB), usa el modificador *Decimate* en las piezas de GrabCAD o activa *Compression* (Draco) al exportar: la página ya lo soporta.

## Probar en tu computadora

Los módulos de JavaScript no funcionan abriendo el archivo con doble clic. Usa un servidor local:

- **VS Code:** instala la extensión *Live Server* → clic derecho en `index.html` → *Open with Live Server*.
- **Python:** en la carpeta del proyecto ejecuta `python -m http.server 8000` y abre http://localhost:8000

Trucos de URL:
- `?modelo=procedural` fuerza el modelo de referencia.
- `?modelo=modelo/otro.glb` carga otro archivo.

## Publicar en GitHub Pages

1. Crea un repositorio público en GitHub, por ejemplo `amazonmercury`.
2. Sube todos los archivos (botón *Add file → Upload files*, arrastra la carpeta completa con `modelo/`).
3. Ve a *Settings → Pages*.
4. En *Source* elige *Deploy from a branch*, rama `main`, carpeta `/ (root)` → *Save*.
5. En 1–2 minutos tu página estará en `https://TU-USUARIO.github.io/amazonmercury/`.

Con Git:

```bash
git init
git add .
git commit -m "Maqueta 3D AmazonMercury"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/amazonmercury.git
git push -u origin main
```

## Ajustes rápidos (al inicio de `script.js`)

- `CONFIG.tamanoGLB`: tamaño al que se escala tu modelo.
- `CONFIG.fraccionSumergida`: qué parte del modelo queda bajo el agua (0.38 = 38 %).
- Los textos de cada componente están en el arreglo `COMPONENTES`.
- Los umbrales del semáforo, los límites de detección y los nodos del mapa están en `comun/simulacion.js` (`METALES` y `NODOS`). Hg: precaución desde 2 µg/L (EPA) y alerta desde 6 µg/L (OMS). Pendiente: contrastar con el ECA para agua del Perú (D.S. 004-2017-MINAM).

## Demo con los celulares del jurado (Firebase)

Para que la maqueta, el panel profesional y Mi Río se comuniquen **entre dispositivos distintos**, se usa Firebase Realtime Database.

1. Crea un proyecto en https://console.firebase.google.com y, dentro, una **Realtime Database** (ubicación `us-central1`, modo bloqueado).
2. En **Realtime Database → Reglas**, pega el contenido de `comun/reglas-firebase.json` y publica.
3. En **Configuración del proyecto → Tus apps → Web (</>)**, registra una app y copia el objeto `firebaseConfig`.
4. Pégalo en `comun/firebase-config.js` en lugar de `null`. Debe incluir `databaseURL`.
5. Sube los cambios a GitHub. En la maqueta aparecerá **"En vivo · N dispositivos"**, y el botón **Abrir en celulares** muestra los QR.

Si `FIREBASE_CONFIG` queda en `null` o no hay internet, todo sigue funcionando como antes, dentro de una sola computadora.
