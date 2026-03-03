/* ============================================================
   main.js — Leopold Keyboards
   three@0.162 supports KHR_mesh_quantization natively,
   so the original 25MB GLB loads directly — no conversion needed.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ── Nav active state ── */
const currentPage = document.body.dataset.page;
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.dataset.page === currentPage) a.classList.add('active');
});

/* ── CSS keyboard key hover ── */
document.querySelectorAll('.k').forEach(k => {
  k.addEventListener('mouseenter', () => { k.style.background = '#444'; k.style.transform = 'translateY(-2px)'; });
  k.addEventListener('mouseleave', () => { k.style.background = '';     k.style.transform = ''; });
});

/* ============================================================
   COLOUR STATE — persists across pages via localStorage
   ============================================================ */
const COLOUR_KEY = 'leopold_colour';
const getColour  = () => localStorage.getItem(COLOUR_KEY) || 'black';
const saveColour = c  => localStorage.setItem(COLOUR_KEY, c);

/* Colour applied directly to GLB mesh material.color.
   GLB material names:
     BaseWhite.001 = case & keycaps  ← recoloured
     BaseGreen     = PCB             ← recoloured
     Fabric        = cable           ← recoloured
     Switches / Indicators / Rubber  ← unchanged (kept realistic) */
const KB_COLOURS = {
  black: { base: 0x1c1c1c, pcb: 0x111111, cable: 0x222222 },
  white: { base: 0xdedad4, pcb: 0xa8b89a, cable: 0xdddddd },
  navy:  { base: 0x0d1b3e, pcb: 0x081226, cable: 0x0a1530 }
};

/* ============================================================
   VIEWER REGISTRY
   ============================================================ */
const VIEWERS = {};

function applyColour(viewerId, colourKey) {
  const v = VIEWERS[viewerId];
  if (!v || !v.model) return;
  const c = KB_COLOURS[colourKey];
  if (!c) return;
  v.model.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const n = child.material.name || '';
    if (n === 'BaseWhite.001') { child.material.color.setHex(c.base);  child.material.needsUpdate = true; }
    if (n === 'BaseGreen')     { child.material.color.setHex(c.pcb);   child.material.needsUpdate = true; }
    if (n === 'Fabric')        { child.material.color.setHex(c.cable); child.material.needsUpdate = true; }
  });
}

/* ============================================================
   CREATE VIEWER
   interactive = true  → drag to rotate, scroll to zoom
   interactive = false → auto-rotate only
   ============================================================ */
function createViewer(containerId, loadingId, viewerId, interactive) {
  if (VIEWERS[viewerId]) return;
  const container = document.getElementById(containerId);
  if (!container) return;

  /* Wait until container has real pixel dimensions before init.
     This prevents clientWidth=0 which breaks the renderer. */
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) {
    requestAnimationFrame(() => createViewer(containerId, loadingId, viewerId, interactive));
    return;
  }

  /* Scene */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141414);

  /* Camera */
  const cam = new THREE.PerspectiveCamera(42, w / h, 0.001, 1000);
  cam.position.set(0, 0.3, 1.8);
  cam.lookAt(0, 0, 0);

  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  container.appendChild(renderer.domElement);

  /* Lights */
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
  fill.position.set(-4, 2, -3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff4422, 0.2);
  rim.position.set(0, -3, -4);
  scene.add(rim);

  /* Shadow floor */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  /* Viewer state */
  const v = {
    scene, cam, renderer, model: null,
    autoRot: 0, isDragging: false,
    rotY: 0.3, rotX: 0.08, zoom: 1.8,
    lastX: 0, lastY: 0
  };
  VIEWERS[viewerId] = v;

  /* ── Load the 25MB GLB (served from /public at root) ──
     three@0.162 GLTFLoader handles KHR_mesh_quantization natively. */
  const loader = new GLTFLoader();
  loader.load(
    '/LeopoldFC980M.glb',
    (gltf) => {
      const model = gltf.scene;

      /* Centre + scale to fit viewer */
      const box  = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const ctr  = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(ctr);
      const s = 1.2 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(s);
      model.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
      model.traverse(c => {
        if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
      });

      scene.add(model);
      v.model = model;

      /* Apply saved colour to model meshes */
      applyColour(viewerId, getColour());

      /* Hide loading overlay */
      const ov = document.getElementById(loadingId);
      if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 500); }
    },
    (xhr) => {
      /* Show download progress % */
      if (xhr.total) {
        const ov = document.getElementById(loadingId);
        const sp = ov?.querySelector('span');
        if (sp) sp.textContent = `Loading model… ${Math.round(xhr.loaded / xhr.total * 100)}%`;
      }
    },
    (err) => {
      console.error('GLB error:', err);
      const ov = document.getElementById(loadingId);
      if (ov) ov.innerHTML = `
        <span style="color:#f88;text-align:center;padding:1rem;line-height:1.8">
          ⚠️ Model failed to load.<br>
          Run <b>npm install</b> then <b>npm run dev</b>
        </span>`;
    }
  );

  /* Orbit controls — interactive viewers only */
  if (interactive) {
    const xy = e => e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX,            y: e.clientY };

    renderer.domElement.addEventListener('mousedown',  e => { v.isDragging = true; const p = xy(e); v.lastX = p.x; v.lastY = p.y; });
    renderer.domElement.addEventListener('touchstart', e => { v.isDragging = true; const p = xy(e); v.lastX = p.x; v.lastY = p.y; }, { passive: true });
    window.addEventListener('mousemove',  e => { if (!v.isDragging) return; const p = xy(e); v.rotY += (p.x - v.lastX) * .008; v.rotX += (p.y - v.lastY) * .005; v.rotX = Math.max(-.6, Math.min(.7, v.rotX)); v.lastX = p.x; v.lastY = p.y; });
    window.addEventListener('touchmove',  e => { if (!v.isDragging) return; const p = xy(e); v.rotY += (p.x - v.lastX) * .008; v.rotX += (p.y - v.lastY) * .005; v.rotX = Math.max(-.6, Math.min(.7, v.rotX)); v.lastX = p.x; v.lastY = p.y; }, { passive: true });
    window.addEventListener('mouseup',   () => v.isDragging = false);
    window.addEventListener('touchend',  () => v.isDragging = false);
    renderer.domElement.addEventListener('wheel', e => {
      v.zoom += e.deltaY * .002;
      v.zoom = Math.max(.6, Math.min(4, v.zoom));
      e.preventDefault();
    }, { passive: false });
  }

  /* Resize observer */
  new ResizeObserver(() => {
    const rw = container.clientWidth;
    const rh = container.clientHeight;
    if (rw === 0 || rh === 0) return;
    cam.aspect = rw / rh;
    cam.updateProjectionMatrix();
    renderer.setSize(rw, rh);
  }).observe(container);

  /* Render loop */
  (function tick() {
    requestAnimationFrame(tick);
    if (!v.isDragging) v.autoRot += 0.004;
    if (v.model) {
      v.model.rotation.y = v.rotY + v.autoRot;
      v.model.rotation.x = v.rotX;
    }
    cam.position.set(0, v.zoom * 0.3, v.zoom);
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
  })();
}

/* ============================================================
   PAGE INITS
   ============================================================ */
function initHomePage() {
  createViewer('home-kb-viewer', 'home-kb-loading', 'home-kb', false);
}

function initDetailsPage() {
  const saved = getColour();
  document.querySelectorAll('.colour-opt').forEach(o =>
    o.classList.toggle('active', o.dataset.colour === saved)
  );
  createViewer('details-kb-viewer', 'details-kb-loading', 'details-kb', true);
}

function initPreorderPage() {
  const saved = getColour();
  document.querySelectorAll('.cbtn').forEach(b =>
    b.classList.toggle('active', b.dataset.colour === saved)
  );
  createViewer('preorder-kb-viewer', 'preorder-kb-loading', 'preorder-kb', false);
}

/* ── Global functions called by HTML onclick attributes ── */
window.setColour = (key, el) => {
  saveColour(key);
  document.querySelectorAll('.colour-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  ['details-kb', 'home-kb', 'preorder-kb'].forEach(id => applyColour(id, key));
};

window.setPreorderColour = (key, el) => {
  saveColour(key);
  document.querySelectorAll('.cbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  ['details-kb', 'home-kb', 'preorder-kb'].forEach(id => applyColour(id, key));
};

window.selectSwitch = el => {
  document.querySelectorAll('.swbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
};

/* ── Boot ── */
window.addEventListener('DOMContentLoaded', () => {
  if (currentPage === 'home')     initHomePage();
  if (currentPage === 'details')  initDetailsPage();
  if (currentPage === 'preorder') initPreorderPage();
});
