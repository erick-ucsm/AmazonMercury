# AmazonMercury · Maqueta 3D web

Maqueta 3D interactiva del nodo flotante de monitoreo de mercurio (ISC 2027 · Amazonía Viva).

## Estructura de la carpeta

```
amazonmercury/
├── index.html
├── styles.css
├── script.js
├── README.md
└── modelo/
    └── amazonmercury.glb   ← tu exportación de Blender (opcional)
```

Si `modelo/amazonmercury.glb` no existe, la página muestra un modelo de referencia hecho en código.
Cuando pones el GLB, la página lo carga sola.

## Nombres de los objetos en Blender (para que cada pieza se pueda clicar)

El nombre del objeto, o de su Empty padre, tiene que contener una de estas palabras (sin importar mayúsculas ni tildes):

| Componente             | Nombre en Blender (ejemplo) |
|------------------------|-----------------------------|
| Casco flotante         | `casco`                     |
| Compartimento estanco  | `compartimento`             |
| Panel solar            | `panel_solar`               |
| Batería 18650          | `bateria`                   |
| ESP32                  | `esp32`                     |
| Módulo LoRa            | `lora`                      |
| Antena LoRa            | `antena`                    |
| Sensor de mercurio     | `sensor`                    |
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
- `CONFIG.umbralAlerta`: umbral de ejemplo (μg/L) para mostrar "ALERTA" en la simulación. Cámbialo por el valor normativo que usen en su presentación.
- Los textos de cada componente están en el arreglo `COMPONENTES`.
