/* ============================================================
   kgstudio.top — la zona como sistema orbital

   Un núcleo (el dominio raíz) y cuatro cuerpos en órbita (los
   subdominios). Se recorre arrastrando, con la rueda, con WASD
   o saltando entre sitios con Tab.

   La comprobación de estado enciende cada cuerpo: si el servidor
   responde, el nodo se prende naranja. Si no responde se queda
   apagado, nunca en rojo — un fallo de red del visitante no debe
   desmentir un sitio que está bien.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const root = document.documentElement;
const canvas = document.getElementById('scene');
const labels = Array.from(document.querySelectorAll('.node'));
const rows = Array.from(document.querySelectorAll('.rows a'));

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Datos de la zona ───────────────────────────────────────── */

const BODIES = [
  { id: 'portafolio', radius:  6.2, tilt: 0.30, speed: 0.115, phase: 0.0, size: 0.52 },
  { id: 'parla',      radius:  8.6, tilt: -0.22, speed: 0.082, phase: 1.9, size: 0.44 },
  { id: 'reinicia',   radius: 11.2, tilt: 0.45, speed: 0.061, phase: 3.6, size: 0.40 },
  { id: 'arriendos',  radius: 13.9, tilt: -0.38, speed: 0.046, phase: 5.2, size: 0.38 },
];

const COLOR_ORANGE = new THREE.Color('#f56f0d');
const COLOR_DIM = new THREE.Color('#4a443e');
const COLOR_VOID = 0x07070a;

/* ── ¿Hay WebGL? ────────────────────────────────────────────── */

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/* ── Estado de los sitios ───────────────────────────────────────
 * Corre siempre, haya escena o no: el listado también se enciende.
 */

const TIMEOUT_MS = 6000;
const liveFlags = new Map();

async function probe(id, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    liveFlags.set(id, true);
    labels.filter((n) => n.dataset.node === id).forEach((n) => { n.dataset.state = 'live'; });
    rows.filter((r) => r.dataset.row === id).forEach((r) => { r.dataset.state = 'live'; });
  } catch {
    // Sin señal: se queda apagado.
  } finally {
    clearTimeout(timer);
  }
}

labels.forEach((node) => probe(node.dataset.node, node.dataset.probe));

/* ── Listado: alterna con la escena ─────────────────────────── */

const toggle = document.getElementById('viewToggle');

if (toggle) {
  toggle.addEventListener('click', () => {
    const open = root.classList.toggle('sheet-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Volver a la zona' : 'Ver como lista';
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

/* ── Sin WebGL no hay escena: el listado queda como la página ── */

if (!webglAvailable()) {
  canvas.remove();
  document.getElementById('hint')?.remove();
  document.querySelector('.veil')?.remove();
  document.querySelector('.labels')?.remove();
} else {
  root.classList.add('has-webgl');
  build();
}

/* ── La escena ──────────────────────────────────────────────── */

function build() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(COLOR_VOID, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLOR_VOID, 0.021);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260);
  camera.position.set(0, 7.5, 24);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 46;
  controls.zoomSpeed = 0.7;
  controls.rotateSpeed = 0.55;
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 0.28;

  // Cualquier gesto del visitante manda: se corta el giro automático.
  ['pointerdown', 'wheel', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, () => { controls.autoRotate = false; }, { once: true, passive: true });
  });

  /* ── Estrellas ──────────────────────────────────────────── */

  function starfield(count, spread, size, color, opacity) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribución en cascarón esférico: nada de estrellas dentro del sistema.
      const r = spread * (0.55 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.7;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  const stars = starfield(1500, 95, 0.32, 0xbdb4aa, 0.75);
  const embers = starfield(180, 60, 0.5, 0xf56f0d, 0.4);
  scene.add(stars, embers);

  /* ── Núcleo: el dominio raíz ────────────────────────────── */

  const coreGroup = new THREE.Group();

  const coreGeo = new THREE.IcosahedronGeometry(2.5, 1);
  // Un sólido oscuro por dentro tapa los alambres traseros: sin eso,
  // el núcleo se lee como una maraña en vez de un cuerpo.
  const coreSolid = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: COLOR_VOID }));
  coreSolid.scale.setScalar(0.97);
  const coreWire = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
    color: COLOR_ORANGE, wireframe: true, transparent: true, opacity: 0.5,
  }));
  const coreHalo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.5, 1),
    new THREE.MeshBasicMaterial({ color: COLOR_ORANGE, wireframe: true, transparent: true, opacity: 0.08 }),
  );
  coreGroup.add(coreSolid, coreWire, coreHalo);
  scene.add(coreGroup);

  /* ── Cuerpos en órbita ──────────────────────────────────── */

  function ringTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(245,111,13,.9)');
    g.addColorStop(0.4, 'rgba(245,111,13,.25)');
    g.addColorStop(1, 'rgba(245,111,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = ringTexture();

  const bodies = BODIES.map((data) => {
    const group = new THREE.Group();
    group.rotation.x = data.tilt;
    group.rotation.z = data.tilt * 0.4;

    // Órbita dibujada: deja ver la estructura de la zona.
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * data.radius, 0, Math.sin(a) * data.radius));
    }
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }),
    );

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(data.size, 28, 28),
      new THREE.MeshBasicMaterial({ color: COLOR_DIM.clone() }),
    );

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.setScalar(data.size * 9);
    mesh.add(glow);

    group.add(orbit, mesh);
    scene.add(group);

    const label = labels.find((n) => n.dataset.node === data.id) || null;
    return { ...data, group, mesh, glow, orbit, label, angle: data.phase, world: new THREE.Vector3() };
  });

  /* ── Teclado: WASD y flechas ────────────────────────────── */

  const keys = new Set();
  const TRACKED = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!TRACKED.includes(k)) return;
    // No secuestrar las flechas si el visitante está tabulando enlaces.
    if (document.activeElement?.closest('.node, .sheet')) return;
    keys.add(k);
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const spherical = new THREE.Spherical();

  function applyKeys(dt) {
    if (keys.size === 0) return;
    const offset = camera.position.clone().sub(controls.target);
    spherical.setFromVector3(offset);

    const rot = 1.15 * dt;
    const dolly = 14 * dt;

    if (keys.has('a') || keys.has('arrowleft')) spherical.theta -= rot;
    if (keys.has('d') || keys.has('arrowright')) spherical.theta += rot;
    if (keys.has('w') || keys.has('arrowup')) spherical.radius -= dolly;
    if (keys.has('s') || keys.has('arrowdown')) spherical.radius += dolly;

    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.25, Math.PI - 0.25);

    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  }

  /* ── Enfocar un sitio con Tab lleva la cámara hasta él ──── */

  let focused = null;

  labels.forEach((node) => {
    const body = bodies.find((b) => b.id === node.dataset.node);
    node.addEventListener('focus', () => { focused = body; controls.autoRotate = false; });
    node.addEventListener('blur', () => { focused = null; });
    node.addEventListener('mouseenter', () => { focused = body; });
    node.addEventListener('mouseleave', () => { focused = null; });
  });

  const homeTarget = new THREE.Vector3(0, 0, 0);

  /* ── Bucle ──────────────────────────────────────────────── */

  const projected = new THREE.Vector3();
  const clock = new THREE.Clock();
  let running = true;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); loop(); }
  });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), 0.05);
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (!REDUCED) {
      coreGroup.rotation.y += dt * 0.14;
      coreGroup.rotation.x += dt * 0.05;
      coreHalo.rotation.y -= dt * 0.22;
      stars.rotation.y += dt * 0.006;
      embers.rotation.y -= dt * 0.01;
    }

    bodies.forEach((body) => {
      if (!REDUCED) body.angle += body.speed * dt;
      body.mesh.position.set(
        Math.cos(body.angle) * body.radius,
        0,
        Math.sin(body.angle) * body.radius,
      );
      body.mesh.getWorldPosition(body.world);

      // El encendido es la comprobación de estado, no un adorno.
      const live = liveFlags.get(body.id) === true;
      const target = live ? COLOR_ORANGE : COLOR_DIM;
      body.mesh.material.color.lerp(target, dt * 2.2);
      body.glow.material.opacity += ((live ? 0.85 : 0) - body.glow.material.opacity) * dt * 2.2;
      body.orbit.material.opacity += ((live ? 0.16 : 0.07) - body.orbit.material.opacity) * dt * 2;

      if (!body.label) return;

      projected.copy(body.world).project(camera);
      const behind = projected.z > 1;
      if (behind) {
        body.label.style.opacity = '0';
        body.label.style.pointerEvents = 'none';
        return;
      }

      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      body.label.style.setProperty('--x', `${x}px`);
      body.label.style.setProperty('--y', `${y}px`);

      // De lejos las etiquetas se apagan un poco para que el sistema
      // se lea limpio; de cerca abren su descripción.
      const dist = camera.position.distanceTo(body.world);
      body.label.style.opacity = String(THREE.MathUtils.clamp(1.35 - dist / 34, 0.3, 1));
      body.label.style.pointerEvents = 'auto';
      body.label.dataset.near = String(dist < 12);
    });

    applyKeys(dt);

    // Enfocar un sitio arrastra el centro de giro hasta él: explorar
    // deja de ser dar vueltas alrededor del mismo punto.
    controls.target.lerp(focused ? focused.world : homeTarget, dt * (focused ? 2.2 : 1.4));

    controls.update();
    renderer.render(scene, camera);
  }

  loop();
}
