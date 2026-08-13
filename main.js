/* ============================================================
   kgstudio.top — la zona como sistema orbital

   Un núcleo (el dominio raíz) y cuatro cuerpos en órbita (los
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

/* ── Datos de la zona ───────────────────────────────────────── */

/*
 * El portafolio no está aquí a propósito: no es un producto que yo opere,
 * es quien soy. Vive arriba, junto al cargo. Lo que orbita son cosas que
 * corren solas y se pueden caer.
 *
 * Las fases están repartidas para que cinco cuerpos no se alineen nunca en
 * la misma vertical, que es cuando las etiquetas se estorban.
 */
const BODIES = [
  { id: 'parla',     radius:  4.6, tilt:  0.30, speed: 0.125, phase: 0.0, size: 0.44 },
  { id: 'monetiq',   radius:  6.2, tilt: -0.24, speed: 0.094, phase: 1.4, size: 0.40 },
  { id: 'reinicia',  radius:  7.9, tilt:  0.42, speed: 0.072, phase: 2.9, size: 0.36 },
  { id: 'pagobot',   radius:  9.7, tilt: -0.34, speed: 0.056, phase: 4.3, size: 0.34 },
  { id: 'arriendos', radius: 11.6, tilt:  0.20, speed: 0.044, phase: 5.6, size: 0.33 },
];

const OUTER = 11.6;
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
  labels.forEach((n) => { n.dataset.selected = String(n === node); });
}

function closePanel() {
  panel.current = null;
  panel.el.hidden = true;
  panel.controls.hidden = false;
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(VOID, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

  const stars = starfield(1600, 110, 0.34, 0xcfc6bb, 0.8);
  const embers = starfield(200, 70, 0.55, 0xf56f0d, 0.45);
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
    const body = { ...data, group, mesh, hit, glow, orbit, label, angle: data.phase, world: new THREE.Vector3() };
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
   */

  const stage = { x: 0, y: 0, w: 0, h: 0 };
  let homeDistance = 26;

  function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pad = Math.min(W, H) * 0.06;

    if (WIDE.matches) {
      const railW = railEl.getBoundingClientRect().width;
      stage.x = railW; stage.y = 0;
      stage.w = Math.max(W - railW, 200); stage.h = H;
    } else {
      const t = railTop.getBoundingClientRect().height;
      const b = railBottom.getBoundingClientRect().height;
      stage.x = 0; stage.y = t;
      stage.w = W; stage.h = Math.max(H - t - b, 200);
    }

    // Correr el frustum: el centro del escenario deja de ser el del canvas.
    const shiftX = (stage.x + stage.w / 2) - W / 2;
    const shiftY = (stage.y + stage.h / 2) - H / 2;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, -shiftX, -shiftY, W, H);

    // Distancia que hace caber la órbita externa dentro del escenario.
    const half = Math.tan((FOV * Math.PI) / 360);
    const usable = Math.max(Math.min(stage.w - pad * 2, stage.h - pad * 2), 120);
    homeDistance = THREE.MathUtils.clamp((OUTER * 1.08 * H) / (half * usable), 15, 52);
    controls.maxDistance = homeDistance * 1.7;

    renderer.setSize(W, H, false);
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', layout);
  WIDE.addEventListener('change', layout);
  layout();

  // Arrancar a la distancia correcta para esta pantalla.
  camera.position.setLength(homeDistance);

  // En vertical el escenario se mide contra la altura del rail, y esa altura
  // cambia cuando entran las tipografías: hay que volver a medir y reencuadrar.
  document.fonts?.ready.then(() => {
    layout();
    if (!selected) camera.position.setLength(homeDistance);
  });

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
  let downAt = null;

  function updatePointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
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
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    if (hit) select(hit.object.__body);
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

  function hideLabel(label) {
    label.style.opacity = '0';
    label.style.pointerEvents = 'none';
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

  function occluded(body) {
    // ¿El núcleo se atraviesa entre la cámara y el cuerpo?
    toBody.copy(body.world).sub(camera.position);
    const distance = toBody.length();
    raycaster.set(camera.position, toBody.normalize());
    raycaster.far = distance;
    const blocked = raycaster.intersectObject(coreSolid, false).length > 0;
    raycaster.far = Infinity;
    return blocked;
  }

  function loop() {
    frame = requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), 0.05);
    const W = window.innerWidth;
    const H = window.innerHeight;

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

    // Hover sobre los cuerpos.
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    hovered = hit ? hit.object.__body : null;
    canvas.classList.toggle('is-over', !!hovered);

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
        hideLabel(body.label);
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
        hideLabel(body.label);
        return;
      }

      const dist = camera.position.distanceTo(body.world);
      const fade = THREE.MathUtils.clamp(1.5 - dist / (homeDistance * 1.5), 0.42, 1);
      const edge = 1 - out / EDGE_FADE;
      // Con un producto abierto, los demás nombres bajan la voz: el panel es
      // lo que se está leyendo.
      const dim = selected && !isActive ? 0.4 : 1;

      placements.push({
        label: body.label,
        x: THREE.MathUtils.clamp(px, left, right),
        y: THREE.MathUtils.clamp(py, top, bottom),
        opacity: (isActive ? 1 : fade * dim) * edge,
      });
    });

    /*
     * Separar las etiquetas que se pisan. Con cinco cuerpos es cuestión de
     * tiempo que dos queden a la misma altura. Se empujan solo en vertical:
     * moverlas en horizontal las despegaría de su cuerpo y ya no se sabría
     * cuál nombra cuál. Las que están en columnas distintas se dejan en paz.
     */
    placements.sort((a, b) => a.y - b.y);
    const GAP = 32;
    const TOP = stage.y + pad * 0.6;
    const LIMIT = stage.y + stage.h - pad * 0.6;
    // Dos pasadas: empujar hacia abajo y, cuando abajo ya no queda sitio,
    // devolver la diferencia hacia arriba. Empujar en un solo sentido hacía
    // que las últimas se pegaran todas al mismo píxel del fondo.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < placements.length; i++) {
        const prev = placements[i - 1];
        const cur = placements[i];
        if (Math.abs(cur.x - prev.x) > 140) continue;
        const overlap = GAP - (cur.y - prev.y);
        if (overlap <= 0) continue;
        const down = Math.min(Math.max(LIMIT - cur.y, 0), overlap);
        cur.y += down;
        if (overlap - down > 0) prev.y = Math.max(TOP, prev.y - (overlap - down));
      }
    }

    placements.forEach((p) => {
      p.label.style.setProperty('--x', `${Math.round(p.x)}px`);
      p.label.style.setProperty('--y', `${Math.round(p.y)}px`);
      // Una etiqueta casi transparente no debe seguir capturando el clic.
      p.label.style.pointerEvents = p.opacity > 0.25 ? 'auto' : 'none';
      p.label.style.opacity = String(p.opacity);
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
