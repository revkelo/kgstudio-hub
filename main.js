/* ============================================================
   kgstudio.top — la zona como sistema orbital

   Un núcleo (el dominio raíz) y los cuerpos en órbita (los
   subdominios). Se recorre arrastrando, con la rueda, con WASD,
   con Tab o tocando un cuerpo.

   El encendido de cada cuerpo ES la comprobación de estado: si
   el servidor responde, se prende naranja. Si no responde queda
   apagado, nunca en rojo — un fallo de red del visitante no debe
   desmentir un sitio que está bien.

   LAYOUT: la interfaz ocupa `.rail` y el sistema se corre al
   espacio libre con camera.setViewOffset(). Las etiquetas y el
   raycast usan la misma matriz de proyección, así que siguen el
   desplazamiento solos y nada queda encima de los cuerpos.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const root = document.documentElement;
const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');
const railEl = document.getElementById('rail');
const railTop = document.getElementById('railTop');
const railBottom = document.getElementById('railBottom');
const sheet = document.getElementById('lista');
const labels = Array.from(document.querySelectorAll('.node'));
const rows = Array.from(document.querySelectorAll('.rows a'));

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const WIDE = window.matchMedia('(min-width: 64rem)');
const COARSE = window.matchMedia('(hover: none) and (pointer: coarse)');
// Dónde está el rail. Tiene que decir lo mismo que styles.css: si aquí y allá
// no coinciden, el sistema se centra en una banda que no es la que quedó libre.
const SIDE = window.matchMedia('(min-width: 64rem), (min-width: 40rem) and (max-height: 34rem)');

/* ── Datos de la zona ───────────────────────────────────────── */

/*
 * El portafolio no está aquí a propósito: no es un producto que yo opere,
 * es quien soy. Vive arriba, junto al cargo. Lo que orbita son cosas que
 * corren solas y se pueden caer.
 *
 * Las fases están repartidas para que los cuerpos no se alineen nunca en
 * la misma vertical, que es cuando las etiquetas se estorban.
 *
 * `agd` es el único que no es producto propio: es el sitio de un cliente
 * que también vive en la zona. Orbita igual porque también se puede caer.
 */
const BODIES = [
  { id: 'parla',     radius:  4.6, tilt:  0.30, speed: 0.125, phase: 0.0, size: 0.44 },
  { id: 'monetiq',   radius:  6.2, tilt: -0.24, speed: 0.094, phase: 1.4, size: 0.40 },
  { id: 'reinicia',  radius:  7.9, tilt:  0.42, speed: 0.072, phase: 2.9, size: 0.36 },
  { id: 'pagobot',   radius:  9.7, tilt: -0.34, speed: 0.056, phase: 4.3, size: 0.34 },
  { id: 'arriendos', radius: 11.6, tilt:  0.20, speed: 0.044, phase: 5.6, size: 0.33 },
  { id: 'agd',       radius: 13.5, tilt: -0.16, speed: 0.036, phase: 2.1, size: 0.32 },
];

const OUTER = 13.5;
const FOV = 50;
const COLOR_ORANGE = new THREE.Color('#f56f0d');
const COLOR_DIM = new THREE.Color('#4a443e');
const VOID = 0x07070a;

/* ── Comprobación de estado ─────────────────────────────────────
 * Corre haya escena o no: el listado también se enciende.
 */

const TIMEOUT_MS = 6000;
const live = new Map();
const countNum = document.getElementById('countNum');
const countAll = document.getElementById('countAll');

// Todo lo que declare `data-probe` se comprueba: los cuerpos en órbita, y
// también el portafolio, que no orbita pero es parte de la zona.
const probes = Array.from(document.querySelectorAll('[data-probe]'));
if (countAll) countAll.textContent = String(probes.length);

async function probe(el) {
  const id = el.dataset.node;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(el.dataset.probe, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    live.set(id, true);
    el.dataset.state = 'live';
    rows.filter((r) => r.dataset.row === id).forEach((r) => { r.dataset.state = 'live'; });
    if (countNum) countNum.textContent = String(live.size);
    if (panel.el && panel.current === id) paintPanelState(true);
  } catch {
    // Sin señal: se queda apagado.
  } finally {
    clearTimeout(timer);
  }
}

/* ── Panel del sitio seleccionado ───────────────────────────── */

const panel = {
  el: document.getElementById('panel'),
  state: document.getElementById('panelState'),
  title: document.getElementById('panelTitle'),
  host: document.getElementById('panelHost'),
  desc: document.getElementById('panelDesc'),
  stack: document.getElementById('panelStack'),
  go: document.getElementById('panelGo'),
  close: document.getElementById('panelClose'),
  controls: document.getElementById('controls'),
  current: null,
};

function paintPanelState(isLive) {
  panel.el.dataset.state = isLive ? 'live' : 'down';
  panel.state.textContent = isLive ? 'responde' : 'sin respuesta aún';
}

function openPanel(node) {
  panel.current = node.dataset.node;
  panel.title.textContent = node.dataset.title;
  panel.host.textContent = new URL(node.href).host;
  panel.desc.textContent = node.dataset.desc;
  panel.stack.textContent = node.dataset.stack;
  panel.go.href = node.href;
  paintPanelState(live.get(node.dataset.node) === true);
  panel.el.hidden = false;
  panel.controls.hidden = true;
  // En vertical el panel necesita sitio: la marca lo cede (ver styles.css).
  root.classList.add('panel-open');
  labels.forEach((n) => { n.dataset.selected = String(n === node); });
}

function closePanel() {
  panel.current = null;
  panel.el.hidden = true;
  panel.controls.hidden = false;
  root.classList.remove('panel-open');
  labels.forEach((n) => { n.dataset.selected = 'false'; });
}

/* ── Vista de lista ─────────────────────────────────────────── */

const toggle = document.getElementById('viewToggle');

function setSheet(open) {
  root.classList.toggle('sheet-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Volver a la zona' : 'Prefiero una lista';
  // Cerrado no debe ser alcanzable con Tab: está fuera de pantalla.
  if (root.classList.contains('has-webgl')) sheet.inert = !open;
}

toggle.addEventListener('click', () => setSheet(!root.classList.contains('sheet-open')));

// La hoja tapa el botón que la abrió, así que lleva su propia salida.
document.getElementById('sheetMin')?.addEventListener('click', () => {
  setSheet(false);
  toggle.focus();
});

/*
 * Y se puede bajar arrastrando la barra, que es lo que uno intenta en el
 * teléfono al ver un agarre. Se sigue el dedo en vivo y se decide al soltar:
 * pasado el umbral se minimiza, si no vuelve a su sitio.
 */
const sheetBar = document.getElementById('sheetBar');
if (sheetBar) {
  const DISMISS = 90;
  let dragY = null;

  const move = (e) => {
    if (dragY === null) return;
    const dy = Math.max(e.clientY - dragY, 0);
    sheet.style.transform = dy ? `translateY(${dy}px)` : '';
  };

  const end = (e) => {
    if (dragY === null) return;
    const dy = Math.max(e.clientY - dragY, 0);
    dragY = null;
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    if (dy > DISMISS) setSheet(false);
  };

  sheetBar.addEventListener('pointerdown', (e) => {
    // El botón de minimizar se apaña solo.
    if (e.target.closest('button')) return;
    dragY = e.clientY;
    sheet.classList.add('is-dragging');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

/* ── ¿Hay WebGL? ────────────────────────────────────────────── */

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

probes.forEach(probe);

if (!webglAvailable()) {
  // Sin escena la página se vuelve documento: la identidad se queda
  // (es lo que hace conocer a alguien) y solo se van la escena y las
  // instrucciones de una exploración que aquí no existe.
  root.classList.add('no-webgl');
  canvas.remove();
  boot.remove();
  document.querySelector('.veil')?.remove();
  document.querySelector('.labels')?.remove();
} else {
  root.classList.add('has-webgl');
  setSheet(false);
  build();
}

/* ── Escena ─────────────────────────────────────────────────── */

function build() {
  /*
   * En el teléfono lo que se siente como "va raro" muchas veces no es el
   * encuadre: son los fotogramas. Un móvil con pantalla a 3× estaba pintando
   * nueve veces más píxeles que un portátil, con antialias encima, para una
   * escena de líneas finas sobre negro donde el suavizado casi no se nota.
   * Se le baja el listón: dos tercios de resolución y sin antialias. La
   * diferencia se ve en la fluidez, no en la imagen.
   */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !COARSE.matches,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(VOID, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, COARSE.matches ? 1.6 : 2));

  const scene = new THREE.Scene();
  // La niebla da profundidad al sistema, pero las estrellas se excluyen:
  // a su distancia las borraría por completo.
  scene.fog = new THREE.FogExp2(VOID, 0.019);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  camera.position.set(0, 8, 26);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  // Por dentro del halo del núcleo no hay nada que ver y se pierde el norte.
  controls.minDistance = 7;
  controls.zoomSpeed = 0.75;
  controls.rotateSpeed = 0.5;
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 0.3;

  /* ── Estrellas ──────────────────────────────────────────── */

  function starfield(count, spread, size, color, opacity) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = spread * (0.5 + Math.random() * 0.5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.75;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, transparent: true, opacity,
      depthWrite: false, fog: false,
    }));
  }

  // Menos estrellas en el teléfono: en una pantalla de cinco pulgadas la
  // mitad no se distinguen y sí se pagan.
  const denso = COARSE.matches ? 0.55 : 1;
  const stars = starfield(Math.round(1600 * denso), 110, 0.34, 0xcfc6bb, 0.8);
  const embers = starfield(Math.round(200 * denso), 70, 0.55, 0xf56f0d, 0.45);
  scene.add(stars, embers);

  /* ── Núcleo ─────────────────────────────────────────────── */

  const coreGroup = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(2.2, 1);
  // Un sólido opaco por dentro tapa los alambres traseros y sirve
  // además para saber cuándo un cuerpo queda escondido detrás.
  const coreSolid = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: VOID }));
  coreSolid.scale.setScalar(0.97);
  const coreWire = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
    color: COLOR_ORANGE, wireframe: true, transparent: true, opacity: 0.5,
  }));
  const coreHalo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.1, 1),
    new THREE.MeshBasicMaterial({ color: COLOR_ORANGE, wireframe: true, transparent: true, opacity: 0.08 }),
  );
  coreGroup.add(coreSolid, coreWire, coreHalo);
  scene.add(coreGroup);

  /* ── Cuerpos ────────────────────────────────────────────── */

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(245,111,13,.95)');
    g.addColorStop(0.35, 'rgba(245,111,13,.28)');
    g.addColorStop(1, 'rgba(245,111,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = glowTexture();

  const bodies = BODIES.map((data) => {
    const group = new THREE.Group();
    group.rotation.x = data.tilt;
    group.rotation.z = data.tilt * 0.4;

    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * data.radius, 0, Math.sin(a) * data.radius));
    }
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }),
    );

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(data.size, 30, 30),
      new THREE.MeshBasicMaterial({ color: COLOR_DIM.clone() }),
    );
    // El objetivo de clic es más grande que la esfera: acertarle a una
    // bolita de 0.4 en movimiento sería un castigo, sobre todo en táctil.
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(data.size * 3.2, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    mesh.add(hit);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.setScalar(data.size * 10);
    mesh.add(glow);

    group.add(orbit, mesh);
    scene.add(group);

    const label = labels.find((n) => n.dataset.node === data.id) || null;
    const body = {
      ...data, group, mesh, hit, glow, orbit, label,
      angle: data.phase, world: new THREE.Vector3(),
      // Medio ancho y medio alto de la etiqueta, medidos al hacer el layout.
      // Estos valores solo se usan hasta la primera medición.
      halfW: 55, halfH: 15,
      // Cuánto está apartada de su sitio ahora mismo, suavizado. `labelShown`
      // evita heredar el empujón de la última vez que se vio.
      push: 0, labelShown: false,
    };
    if (label) label.__body = body;
    hit.__body = body;
    return body;
  });

  const hitTargets = bodies.map((b) => b.hit);

  /* ── Layout: reservar el rail y correr el sistema ───────────
   *
   * `stage` es el rectángulo libre. El frustum se desplaza para que
   * el sistema quede centrado ahí, y la distancia se calcula para
   * que la órbita externa entre completa en ese rectángulo.
   *
   * `stage` es el encuadre que se está usando ahora y `want` al que
   * habría que ir; entre los dos hay un suavizado. Reencuadrar de golpe
   * era lo que hacía que en el teléfono la escena diera brincos, y por
   * dos motivos distintos:
   *
   *  - La barra de direcciones del navegador aparece y desaparece sola,
   *    y con ella cambia `innerHeight` en 60-100 px. Cada aparición era
   *    un salto del sistema entero.
   *  - Al abrir un producto, el panel crece dentro del rail y la banda
   *    libre se encoge de un fotograma al siguiente.
   *
   * Ahora ambos son un movimiento de cámara, que es lo que parecen: el
   * encuadre se acomoda en lugar de teletransportarse.
   */

  const stage = { x: 0, y: 0, w: 0, h: 0 };
  const want = { x: 0, y: 0, w: 0, h: 0 };
  let homeDistance = 26;
  let wantDistance = 26;
  let framed = false;
  const reframe = new THREE.Vector3();

  function measure() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pad = Math.min(W, H) * 0.06;

    if (SIDE.matches) {
      const railW = railEl.getBoundingClientRect().width;
      want.x = railW; want.y = 0;
      want.w = Math.max(W - railW, 200); want.h = H;
    } else {
      const t = railTop.getBoundingClientRect().height;
      const b = railBottom.getBoundingClientRect().height;
      want.x = 0; want.y = t;
      want.w = W; want.h = Math.max(H - t - b, 200);
    }

    /*
     * Distancia que hace caber la órbita externa: se calcula por ancho y por
     * alto y manda la mayor, que es la que cabe en los dos.
     *
     * En vertical el rail no es una pared, es un degradado. En un teléfono la
     * banda libre es un tercio de la pantalla y exigir que el sistema entrase
     * entero lo dejaba diminuto —cinco puntitos en el centro— con las órbitas
     * tan juntas que los nombres se pisaban sin remedio. Dejar que las de
     * fuera se cuelen un poco bajo el degradado se ve mejor y, de paso, apaga
     * las etiquetas de los cuerpos que se salen: son justo las que sobraban.
     */
    const half = Math.tan((FOV * Math.PI) / 360);
    const bleed = SIDE.matches ? 1 : 1.34;
    const fit = (usable) => (OUTER * 1.08 * H) / (half * Math.max(usable, 120));
    const before = wantDistance;
    wantDistance = THREE.MathUtils.clamp(
      Math.max(fit(want.w - pad * 2), fit(want.h * bleed - pad * 2)),
      15, 52,
    );

    // Un reencuadre de verdad —girar el teléfono, cambiar de ventana— se
    // lleva la cámara con él, conservando el zoom que el visitante traía.
    // Los temblores de la barra de direcciones se quedan bajo el umbral.
    if (framed && Math.abs(wantDistance - before) / before > 0.06) {
      reframe.copy(camera.position).sub(controls.target).multiplyScalar(wantDistance / before);
      camera.position.copy(controls.target).add(reframe);
    }

    renderer.setSize(W, H, false);
    camera.aspect = W / H;

    // Las etiquetas cambian de tamaño con la tipografía y con el ancho de
    // pantalla, y de su tamaño depende cuándo se consideran encimadas.
    measureLabels();
  }

  // Cada fotograma acerca el encuadre real al que se quiere. El primero es
  // instantáneo: no hay nada desde donde venir.
  function frameStage(dt) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const k = framed ? 1 - Math.exp(-7 * dt) : 1;
    framed = true;

    stage.x += (want.x - stage.x) * k;
    stage.y += (want.y - stage.y) * k;
    stage.w += (want.w - stage.w) * k;
    stage.h += (want.h - stage.h) * k;
    homeDistance += (wantDistance - homeDistance) * k;

    // Correr el frustum: el centro del escenario deja de ser el del canvas.
    const shiftX = (stage.x + stage.w / 2) - W / 2;
    const shiftY = (stage.y + stage.h / 2) - H / 2;
    camera.setViewOffset(W, H, -shiftX, -shiftY, W, H);
    camera.updateProjectionMatrix();
    controls.maxDistance = homeDistance * 1.7;
  }

  window.addEventListener('resize', measure);
  SIDE.addEventListener('change', measure);
  // En el teléfono `resize` no siempre llega cuando la barra del navegador se
  // mueve; `visualViewport` sí lo cuenta.
  window.visualViewport?.addEventListener('resize', measure);

  /*
   * Y el rail se mide solo. Su alto cambia sin que la ventana cambie: al
   * abrir un producto entra el panel, al cerrarlo vuelven los controles.
   * Antes eso no reencuadraba nada, así que en vertical el panel se comía
   * media escena y los cuerpos de abajo quedaban debajo del texto.
   */
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(measure);
    ro.observe(railTop);
    ro.observe(railBottom);
  }

  measure();
  stage.x = want.x; stage.y = want.y; stage.w = want.w; stage.h = want.h;
  homeDistance = wantDistance;

  // Arrancar a la distancia correcta para esta pantalla.
  camera.position.setLength(homeDistance);

  // En vertical el escenario se mide contra la altura del rail, y esa altura
  // cambia cuando entran las tipografías: hay que volver a medir.
  document.fonts?.ready.then(measure);

  // Y una medida más al primer cuadro: en el `measure()` inicial las etiquetas
  // todavía no tienen caja si la hoja de estilos acaba de aplicarse.
  requestAnimationFrame(measureLabels);

  /* ── Selección ──────────────────────────────────────────── */

  let selected = null;
  let hovered = null;
  let hoveredLabel = null;
  const homeTarget = new THREE.Vector3();
  const aim = new THREE.Vector3();

  function select(body) {
    selected = body;
    controls.autoRotate = false;
    if (body?.label) openPanel(body.label);
  }

  function deselect() {
    selected = null;
    closePanel();
  }

  panel.close.addEventListener('click', () => {
    deselect();
    canvas.focus?.();
  });

  labels.forEach((node) => {
    // Pasar por la etiqueta resalta el cuerpo igual que pasar por la
    // esfera, pero no mueve la cámara: eso solo pasa al seleccionar.
    node.addEventListener('mouseenter', () => { hoveredLabel = node.__body; });
    node.addEventListener('mouseleave', () => { hoveredLabel = null; });
    // Con teclado, Tab enfoca y la cámara viaja hasta el cuerpo.
    node.addEventListener('focus', () => select(node.__body));
    // Un clic en la etiqueta selecciona; para abrir el sitio está el
    // botón del panel. Así se puede explorar sin salirse de la página.
    node.addEventListener('click', (e) => {
      e.preventDefault();
      select(node.__body);
    });
  });

  /* ── Puntero: hover y clic sobre los cuerpos ────────────── */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const screen = new THREE.Vector3();
  let downAt = null;

  function updatePointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  /*
   * Elegir un cuerpo con el dedo no es apuntar con el ratón: la yema tapa lo
   * que se quiere tocar y lo que llega es el centro del contacto, no lo que
   * uno estaba mirando. Con raycast a secas había que insistir dos y tres
   * veces sobre una bolita que además se mueve.
   *
   * Primero se prueba el rayo, que es exacto cuando acierta; si no da en
   * nada, se toma el cuerpo más cercano al toque en pantalla dentro de un
   * radio de dedo. Con ratón el radio es pequeño: ahí sí se apunta.
   */
  function pickAt(cx, cy) {
    pointer.x = (cx / window.innerWidth) * 2 - 1;
    pointer.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const direct = raycaster.intersectObjects(hitTargets, false)[0];
    if (direct) return direct.object.__body;

    let best = null;
    let bestD = COARSE.matches ? 46 : 18;
    bodies.forEach((body) => {
      screen.copy(body.world).project(camera);
      if (screen.z > 1) return;
      const px = (screen.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-screen.y * 0.5 + 0.5) * window.innerHeight;
      const d = Math.hypot(px - cx, py - cy);
      if (d < bestD) { bestD = d; best = body; }
    });
    return best;
  }

  canvas.addEventListener('pointermove', (e) => {
    updatePointer(e);
    canvas.classList.toggle('is-grabbing', downAt !== null);
  });

  canvas.addEventListener('pointerdown', (e) => {
    updatePointer(e);
    downAt = { x: e.clientX, y: e.clientY };
    canvas.classList.add('is-grabbing');
  });

  canvas.addEventListener('pointerup', (e) => {
    canvas.classList.remove('is-grabbing');
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    // Arrastrar no debe seleccionar: solo un toque limpio.
    if (moved > 6) return;
    // Con la lista arriba, tocar la zona que asoma la minimiza. Es lo que
    // se espera de una hoja: tocar fuera la cierra.
    if (root.classList.contains('sheet-open')) {
      setSheet(false);
      return;
    }
    const body = pickAt(e.clientX, e.clientY);
    if (body) select(body);
    else deselect();
  });

  canvas.addEventListener('pointerleave', () => {
    downAt = null;
    canvas.classList.remove('is-grabbing', 'is-over');
    hovered = null;
  });

  /* ── Teclado ────────────────────────────────────────────── */

  const keys = new Set();
  const MOVE = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  function typingElsewhere() {
    const el = document.activeElement;
    return !!el && !!el.closest('.rail, .sheet');
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    if (k === 'escape') {
      if (root.classList.contains('sheet-open')) setSheet(false);
      else deselect();
      return;
    }
    if (k === 'r' && !typingElsewhere()) {
      deselect();
      controls.autoRotate = !REDUCED;
      return;
    }
    if (!MOVE.includes(k)) return;
    // No secuestrar las flechas si el foco está en la interfaz o hay
    // una lista abierta que el visitante puede querer desplazar.
    if (typingElsewhere() || root.classList.contains('sheet-open')) return;
    keys.add(k);
    e.preventDefault();
  });

  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();

  function applyKeys(dt) {
    if (keys.size === 0) return;
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);

    const rot = 1.2 * dt;
    const dolly = homeDistance * 0.6 * dt;

    if (keys.has('a') || keys.has('arrowleft')) spherical.theta -= rot;
    if (keys.has('d') || keys.has('arrowright')) spherical.theta += rot;
    if (keys.has('w') || keys.has('arrowup')) spherical.radius -= dolly;
    if (keys.has('s') || keys.has('arrowdown')) spherical.radius += dolly;

    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.22, Math.PI - 0.22);

    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
  }

  /* ── Reanudar el giro tras un rato quieto ───────────────── */

  let idle = 0;
  ['pointerdown', 'wheel', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, () => {
      idle = 0;
      controls.autoRotate = false;
    }, { passive: true });
  });

  /* ── Bucle ──────────────────────────────────────────────── */

  const projected = new THREE.Vector3();
  const toBody = new THREE.Vector3();
  const placements = [];
  // Franja de borde en la que una etiqueta se apaga al salirse del escenario.
  const EDGE_FADE = 70;
  // Aire mínimo entre dos etiquetas que se pisan, además de su propio alto.
  const AIR = 10;

  /*
   * El tamaño real de cada etiqueta, medido una vez. Antes se suponía que
   * todas ocupaban 32 × 140 px, y no es cierto: "arriendos" es bastante más
   * ancha que "parla". Con un ancho supuesto, dos nombres separados 150 px se
   * daban por libres aunque se estuvieran pisando, y dos separados 130 px se
   * apartaban sin necesidad — moverse sin motivo también se ve mal.
   */
  function measureLabels() {
    bodies.forEach((body) => {
      if (!body.label) return;
      const r = body.label.getBoundingClientRect();
      // Si aún no tiene caja (fuentes sin cargar) se conserva la anterior.
      if (r.width) { body.halfW = r.width / 2; body.halfH = r.height / 2; }
    });
  }

  function hideLabel(body) {
    body.label.style.opacity = '0';
    body.label.style.pointerEvents = 'none';
    // Al reaparecer debe hacerlo en su sitio, no viajando desde donde
    // estaba hace rato: se marca para que el suavizado no interpole.
    body.labelShown = false;
  }
  const clock = new THREE.Clock();
  let frame = 0;
  let booted = false;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!frame) {
      clock.getDelta();
      frame = requestAnimationFrame(loop);
    }
  });

  /*
   * ¿El núcleo se atraviesa entre la cámara y el cuerpo? Esto era un raycast
   * por cuerpo y por fotograma contra la malla del núcleo: seis barridos de
   * triángulos cada 16 ms, que en el teléfono se notaban.
   *
   * A efectos de tapar, el núcleo es una esfera centrada en el origen, así
   * que basta mirar a qué distancia pasa el rayo del centro. Mismo resultado,
   * media docena de multiplicaciones.
   */
  const CORE_R2 = (2.2 * 0.97) ** 2;

  function occluded(body) {
    toBody.copy(body.world).sub(camera.position);
    const distance = toBody.length();
    toBody.divideScalar(distance);
    // Dónde pasa el rayo más cerca del origen. Fuera del tramo cámara→cuerpo
    // el núcleo no puede estorbar: o queda detrás, o más allá del cuerpo.
    const t = -camera.position.dot(toBody);
    if (t <= 0 || t >= distance) return false;
    return camera.position.lengthSq() - t * t < CORE_R2;
  }

  function loop() {
    frame = requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), 0.05);
    const W = window.innerWidth;
    const H = window.innerHeight;

    frameStage(dt);

    idle += dt;
    if (idle > 7 && !selected && !REDUCED && !root.classList.contains('sheet-open')) {
      controls.autoRotate = true;
    }

    if (!REDUCED) {
      coreGroup.rotation.y += dt * 0.14;
      coreGroup.rotation.x += dt * 0.045;
      coreHalo.rotation.y -= dt * 0.24;
      stars.rotation.y += dt * 0.005;
      embers.rotation.y -= dt * 0.009;
    }

    // Hover sobre los cuerpos. En táctil no existe tal cosa: el puntero se
    // queda clavado donde se tocó por última vez y dejaba un cuerpo crecido
    // para siempre, como si el dedo siguiera encima.
    if (COARSE.matches) {
      hovered = null;
    } else {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      hovered = hit ? hit.object.__body : null;
      canvas.classList.toggle('is-over', !!hovered);
    }

    const pad = Math.min(W, H) * 0.05;

    bodies.forEach((body) => {
      if (!REDUCED) body.angle += body.speed * dt;
      body.mesh.position.set(
        Math.cos(body.angle) * body.radius,
        0,
        Math.sin(body.angle) * body.radius,
      );
      body.mesh.getWorldPosition(body.world);

      const isLive = live.get(body.id) === true;
      const isActive = body === selected || body === hovered || body === hoveredLabel;

      body.mesh.material.color.lerp(isLive ? COLOR_ORANGE : COLOR_DIM, dt * 2.4);
      const wantScale = isActive ? 1.5 : 1;
      body.mesh.scale.setScalar(THREE.MathUtils.lerp(body.mesh.scale.x, wantScale, dt * 7));
      body.glow.material.opacity += (((isLive ? 0.85 : 0) * (isActive ? 1.25 : 1)) - body.glow.material.opacity) * dt * 3;
      body.orbit.material.opacity += (((isActive ? 0.3 : (isLive ? 0.15 : 0.07))) - body.orbit.material.opacity) * dt * 3;

      if (!body.label) return;

      projected.copy(body.world).project(camera);

      if (projected.z > 1 || occluded(body)) {
        hideLabel(body);
        return;
      }

      const px = (projected.x * 0.5 + 0.5) * W;
      const py = (-projected.y * 0.5 + 0.5) * H;

      /*
       * Una etiqueta clavada al borde deja de nombrar a su cuerpo: apunta a
       * un sitio donde no hay nada. Antes se recortaban al escenario y, al
       * acercarse a un cuerpo, las cuatro que se salían acababan apiladas en
       * la misma esquina, ilegibles. Ahora salirse se paga con opacidad: se
       * desvanecen en la franja del borde y desaparecen al cruzarla.
       */
      const left = stage.x + pad;
      const right = stage.x + stage.w - pad;
      const top = stage.y + pad * 0.6;
      const bottom = stage.y + stage.h - pad * 0.6;
      const out = Math.max(left - px, px - right, top - py, py - bottom, 0);
      if (out > EDGE_FADE) {
        hideLabel(body);
        return;
      }

      const dist = camera.position.distanceTo(body.world);
      const fade = THREE.MathUtils.clamp(1.5 - dist / (homeDistance * 1.5), 0.42, 1);
      const edge = 1 - out / EDGE_FADE;
      // Con un producto abierto, los demás nombres bajan la voz: el panel es
      // lo que se está leyendo.
      const dim = selected && !isActive ? 0.4 : 1;

      const y = THREE.MathUtils.clamp(py, top, bottom);
      placements.push({
        body,
        x: THREE.MathUtils.clamp(px, left, right),
        // `y` la mueve la separación; `rawY` se guarda para saber cuánto la
        // apartó y poder suavizar solo esa diferencia.
        y,
        rawY: y,
        opacity: (isActive ? 1 : fade * dim) * edge,
        // Para el cupo de abajo: lo abierto o tocado no se descarta nunca, y
        // entre los demás mandan los que están más cerca de la cámara.
        rank: isActive ? Infinity : -dist,
      });
    });

    /*
     * Cupo de nombres visibles. En un teléfono no caben seis: la banda libre
     * mide un tercio de lo que mide en un portátil y la separación acababa
     * apilándolos contra el borde, todos pegados y ninguno legible. Se
     * quedan el abierto y los más cercanos; el resto sigue ahí, como punto,
     * y basta tocarlo para saber qué es. En pantalla ancha no hay cupo.
     */
    const cupo = WIDE.matches
      ? placements.length
      : THREE.MathUtils.clamp(Math.floor(stage.h / 64), 3, 4);
    if (placements.length > cupo) {
      placements.sort((a, b) => b.rank - a.rank);
      for (let i = cupo; i < placements.length; i++) hideLabel(placements[i].body);
      placements.length = cupo;
    }

    /*
     * Separar las etiquetas que se pisan. Con seis cuerpos es cuestión de
     * tiempo que dos queden a la misma altura. Se empujan solo en vertical:
     * moverlas en horizontal las despegaría de su cuerpo y ya no se sabría
     * cuál nombra cuál. Las que están en columnas distintas se dejan en paz.
     *
     * Cada pareja se aparta a medias y en sentidos opuestos, y se repite la
     * pasada reordenando. Antes se empujaba solo a la de abajo y, cuando no
     * cabía, se corregía a la de arriba — que ya había sido dada por buena y
     * podía volver a pisar a la anterior. Además el arreglo se ordenaba una
     * sola vez, así que tras el primer empujón las comparaciones se hacían
     * contra un orden que ya no existía: quedaban solapes sin resolver (uno
     * de cada treinta casos) y desplazamientos de hasta 90 px de golpe.
     */
    const TOP = stage.y + pad * 0.6;
    const LIMIT = stage.y + stage.h - pad * 0.6;

    /*
     * Todas contra todas, no solo contra la vecina de arriba: si la de en
     * medio está en otra columna, la primera y la tercera se pisan y por
     * vecindad nunca se comparaban. Con seis etiquetas son quince parejas,
     * así que mirarlas todas no cuesta nada.
     *
     * Se repite hasta que nadie se mueva; apartar a dos puede acercar a un
     * tercero. En la práctica termina en cuatro o cinco vueltas, y el tope
     * está solo para que no se quede dando vueltas si algo no converge.
     */
    for (let pass = 0; pass < 12; pass++) {
      let movido = false;

      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          let a = placements[i];
          let b = placements[j];
          // `a` es siempre la de arriba: así el reparto es simétrico.
          if (a.y > b.y) { const t = a; a = b; b = t; }

          // ¿Se pisan de verdad? Con los anchos reales de cada una.
          if (Math.abs(b.x - a.x) >= a.body.halfW + b.body.halfW) continue;

          const sobra = (a.body.halfH + b.body.halfH + AIR) - (b.y - a.y);
          if (sobra <= 0) continue;

          // A medias y en sentidos opuestos: el grupo se abre por el centro
          // en vez de arrastrar a una sola hasta el fondo del escenario.
          const mitad = sobra / 2;
          a.y = Math.max(TOP + a.body.halfH, a.y - mitad);
          b.y = Math.min(LIMIT - b.body.halfH, b.y + mitad);
          movido = true;
        }
      }

      if (!movido) break;
    }

    /*
     * Suavizado, pero SOLO del empujón, no de la posición.
     *
     * Al cruzarse dos cuerpos la separación aparece y desaparece de un
     * fotograma al siguiente, y el nombre pega un tirón. La tentación es
     * filtrar la posición final, y es un error: un filtro de primer orden
     * deja un desfase constante de velocidad/k, así que mientras el sistema
     * gira la etiqueta se quedaría flotando detrás de su propio cuerpo — que
     * es justo lo que no puede pasar, porque entonces deja de nombrarlo.
     *
     * Lo que se suaviza es cuánto se aparta de su sitio. Cuando nadie la
     * estorba el empujón es cero y la etiqueta va clavada a su cuerpo, sin
     * retraso; cuando hay que apartarla, se aparta progresivamente.
     */
    const seguimiento = 1 - Math.exp(-16 * dt);

    placements.forEach((p) => {
      const body = p.body;
      // `p.y` trae ya la separación aplicada; `p.rawY` es donde caería sola.
      const empujon = p.y - p.rawY;

      if (body.labelShown) {
        body.push += (empujon - body.push) * seguimiento;
      } else {
        // Recién aparecida: sin empujón heredado, aparece donde le toca.
        body.push = 0;
        body.labelShown = true;
      }

      p.finalY = THREE.MathUtils.clamp(p.rawY + body.push, TOP, LIMIT);
      p.drop = false;
    });

    /*
     * Última palabra, y sobre la posición que de verdad se va a pintar —la
     * suavizada, no la que salió del reparto—. Si dos siguen pisándose,
     * porque el escenario no da para más o porque se están cruzando ahora
     * mismo, se apaga la menos importante. Un nombre encima de otro no se
     * lee, y dos ilegibles son peor que uno solo: el que se va sigue ahí
     * como punto y basta tocarlo.
     */
    for (let i = 0; i < placements.length; i++) {
      const a = placements[i];
      if (a.drop) continue;
      for (let j = i + 1; j < placements.length; j++) {
        const b = placements[j];
        if (b.drop) continue;
        if (Math.abs(b.x - a.x) >= a.body.halfW + b.body.halfW) continue;
        if (Math.abs(b.finalY - a.finalY) >= a.body.halfH + b.body.halfH) continue;
        const fuera = a.rank >= b.rank ? b : a;
        fuera.drop = true;
        if (fuera === a) break;
      }
    }

    placements.forEach((p) => {
      const body = p.body;
      if (p.drop) {
        hideLabel(body);
        return;
      }

      const y = p.finalY;
      const label = body.label;
      // Sin redondear: a un píxel entero el nombre tiembla cuando el sistema
      // gira despacio, porque la posición salta de un píxel al siguiente.
      label.style.setProperty('--x', `${p.x.toFixed(2)}px`);
      label.style.setProperty('--y', `${y.toFixed(2)}px`);
      // Una etiqueta casi transparente no debe seguir capturando el clic.
      label.style.pointerEvents = p.opacity > 0.25 ? 'auto' : 'none';
      label.style.opacity = String(p.opacity);
    });
    placements.length = 0;

    applyKeys(dt);

    // Seleccionar arrastra el centro de giro hasta el cuerpo y acerca
    // la cámara: explorar deja de ser dar vueltas al mismo punto.
    // El centro de giro no salta al cuerpo, se queda a medio camino entre el
    // núcleo y él: así el cuerpo elegido queda a la vista sin echar el resto
    // del sistema fuera del escenario.
    if (selected) aim.copy(selected.world).multiplyScalar(0.55);
    else aim.copy(homeTarget);
    controls.target.lerp(aim, dt * (selected ? 2.4 : 1.5));

    if (selected) {
      offset.copy(camera.position).sub(controls.target);
      // Acercarse, no aterrizar encima: a 0.42 el núcleo llenaba la pantalla,
      // los demás cuerpos se salían del escenario y se perdía el sistema, que
      // es lo que hay que seguir viendo mientras se lee un producto.
      const want = THREE.MathUtils.clamp(homeDistance * 0.66, controls.minDistance + 3, controls.maxDistance);
      offset.setLength(THREE.MathUtils.lerp(offset.length(), want, dt * 1.6));
      camera.position.copy(controls.target).add(offset);
    }

    controls.update();
    renderer.render(scene, camera);

    if (!booted) {
      booted = true;
      boot.classList.add('is-done');
      setTimeout(() => boot.remove(), 600);
    }
  }

  frame = requestAnimationFrame(loop);
}
