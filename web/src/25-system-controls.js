// ---------------------------------------------------------------- system view controls
const sysTools = document.getElementById('sys-tools');
const scaleButton = document.getElementById('sys-scale');
// A scene with orbits to lay out, zoom and pan (not the "mystery" card or a custom one like the ISS).
const liveScene = () => Boolean(scene && !scene.mystery && !scene.custom);

function setScene(next) {   // a new system: reset the view, keep the chosen scale mode
  scene = next;
  Object.assign(sview, { zoom: 1, panX: 0, panY: 0 });
  const live = liveScene();
  sysTools.hidden = !live;
  sys.classList.toggle('interactive', live);
  if (live) layout();
}

function setSysZoom(zoom, anchor) {   // anchor: canvas point that stays put (default: the star)
  if (!liveScene()) return;
  const [lo, hi] = SVIEW_ZOOM[sview.mode];
  zoom = clamp(zoom, lo, hi);
  const [ax, ay] = anchor || [scene.cx, scene.cy];
  const f = zoom / sview.zoom;
  sview.panX = ax - CX - (ax - CX - sview.panX) * f;
  sview.panY = ay - CY - (ay - CY - sview.panY) * f;
  sview.zoom = zoom;
  layout();
}

// Zoom so every orbit and the whole habitable zone fit, centred on the star.
function fitAll() {
  if (!liveScene()) return;
  Object.assign(sview, { zoom: 1, panX: 0, panY: 0 });
  layout();
  const reach = Math.max(...scene.planets.map(p => p.rx * (1 + p.e)), scene.hz ? scene.hz[1] : 0,
                         ...scene.belts.flatMap(b => b.dots.map(d => d.rx)), scene.reach ? scene.reach() : 0);
  const room = Math.min(CX - 6, (SH - STRIP) / 2 / TILT - 4);
  sview.zoom = clamp(room / reach, ...SVIEW_ZOOM[sview.mode]);
  layout();
}

function sysPoint(evt) {
  const r = sys.getBoundingClientRect();
  return [(evt.clientX - r.left) * SW / r.width, (evt.clientY - r.top) * SH / r.height];
}

let sysDrag = null;
sys.addEventListener('pointerdown', e => {
  if (!liveScene()) return;
  sysDrag = { x: e.clientX, y: e.clientY, panX: sview.panX, panY: sview.panY };
  sys.setPointerCapture(e.pointerId);
});
sys.addEventListener('pointermove', e => {
  if (!sysDrag) return;
  const r = sys.getBoundingClientRect();
  sview.panX = sysDrag.panX + (e.clientX - sysDrag.x) * SW / r.width;
  sview.panY = sysDrag.panY + (e.clientY - sysDrag.y) * SH / r.height;
  layout();
});
const endSysDrag = () => { sysDrag = null; };
sys.addEventListener('pointerup', endSysDrag);
sys.addEventListener('pointercancel', endSysDrag);
sys.addEventListener('dblclick', fitAll);
sys.addEventListener('wheel', e => {
  if (!liveScene()) return;
  const dir = e.deltaY < 0 ? 1 : -1;
  if (dir < 0 && sview.zoom <= SVIEW_ZOOM[sview.mode][0]) return;   // fully out: let the page scroll
  e.preventDefault();
  setSysZoom(sview.zoom * 1.25 ** dir, sysPoint(e));
}, { passive: false });
sys.addEventListener('keydown', e => {
  if (!liveScene()) return;
  const pan = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
  if (e.key === '+' || e.key === '=') setSysZoom(sview.zoom * 1.5);
  else if (e.key === '-' || e.key === '_') setSysZoom(sview.zoom / 1.5);
  else if (e.key === '0') fitAll();
  else if (pan) { sview.panX += pan[0]; sview.panY += pan[1]; layout(); }
  else return;
  e.preventDefault();
});
document.getElementById('sys-in').addEventListener('click', () => setSysZoom(sview.zoom * 1.5));
document.getElementById('sys-out').addEventListener('click', () => setSysZoom(sview.zoom / 1.5));
document.getElementById('sys-fit').addEventListener('click', fitAll);
scaleButton.addEventListener('click', () => {
  sview.mode = sview.mode === 'true' ? 'overview' : 'true';
  scaleButton.setAttribute('aria-pressed', String(sview.mode === 'true'));
  if (liveScene()) { Object.assign(sview, { zoom: 1, panX: 0, panY: 0 }); layout(); }
});
