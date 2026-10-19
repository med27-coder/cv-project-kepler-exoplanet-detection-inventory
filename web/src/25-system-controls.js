// ---------------------------------------------------------------- system view controls
const sysTools = document.getElementById('sys-tools');
const scaleButton = document.getElementById('sys-scale');
// A scene with orbits to lay out, zoom and pan (not the "mystery" card or a custom one like the ISS).
const liveScene = () => Boolean(scene && !scene.mystery && !scene.custom);

let sceneSince = 0;
function setScene(next) {   // a new system: reset the view, keep the chosen scale mode
  scene = next;
  sceneSince = performance.now();   // for the Patient Observer achievement
  Object.assign(sview, { zoom: 1, panX: 0, panY: 0 });
  const live = liveScene();
  sysTools.hidden = !live;
  if (!live) document.getElementById('sys-hint').textContent = '';   // no stale "True scale" hint on cards
  sys.classList.toggle('interactive', live);
  if (live) {
    layout();
    if (pendingView) applyView(pendingView);
  }
  pendingView = null;
}

// Shareable views: the URL remembers zoom, true scale and Kepler's view (#Kepler-90?view=true&zoom=4).
let pendingView = null, hashTimer = 0;
function applyView(v) {
  if (v.view === 'true' || v.view === 'overview') {
    sview.mode = v.view;
    scaleButton.setAttribute('aria-pressed', String(sview.mode === 'true'));
  }
  setEdge(v.edge === '1');
  const zoom = Number(v.zoom);
  if (Number.isFinite(zoom) && zoom > 0) sview.zoom = clamp(zoom, ...SVIEW_ZOOM[sview.mode]);
  layout();
}
function rememberView() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const name = location.hash.slice(1).split('?')[0];
    if (!name || !liveScene()) return;
    const params = new URLSearchParams();
    if (sview.mode === 'true') params.set('view', 'true');
    if (Math.abs(sview.zoom - 1) > 0.01) params.set('zoom', String(+sview.zoom.toPrecision(3)));
    if (TILT === TILT_KEPLER) params.set('edge', '1');
    const extra = params.toString();
    history.replaceState(null, '', '#' + name + (extra ? '?' + extra : ''));
  }, 400);
}

// Kepler's view: nearly edge-on, so planets visibly cross the star when the light curve dips.
const edgeButton = document.getElementById('sys-edge');
function setEdge(on) {
  TILT = on ? TILT_KEPLER : TILT_SKY;
  edgeButton.setAttribute('aria-pressed', String(on));
}
edgeButton.addEventListener('click', () => {
  setEdge(TILT !== TILT_KEPLER);
  if (TILT === TILT_KEPLER) achieve('transit');
  if (liveScene()) layout();
});

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

let sysDrag = null, pinch = null;
const touches = new Map();   // pointerId -> [x, y] in canvas pixels, for two-finger pinch zoom
const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
const middle = () => { const [a, b] = [...touches.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
sys.addEventListener('pointerdown', e => {
  if (!liveScene()) return;
  touches.set(e.pointerId, sysPoint(e));
  try { sys.setPointerCapture(e.pointerId); } catch { /* pointer already gone: nothing to capture */ }
  if (touches.size === 2) {   // second finger: pinch instead of drag
    sysDrag = null;
    pinch = { dist: spread(), zoom: sview.zoom };
    return;
  }
  sysDrag = { x: e.clientX, y: e.clientY, panX: sview.panX, panY: sview.panY };
});
sys.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, sysPoint(e));
  if (pinch && touches.size === 2) { setSysZoom(pinch.zoom * spread() / pinch.dist, middle()); return; }
  if (!sysDrag) {   // hovering: name the planet under the pointer
    const hit = planetAt(e);
    if (scene && (hit?.name ?? null) !== (scene.hover ?? null)) { scene.hover = hit?.name ?? null; wake(); }
    return;
  }
  const r = sys.getBoundingClientRect();
  sview.panX = sysDrag.panX + (e.clientX - sysDrag.x) * SW / r.width;
  sview.panY = sysDrag.panY + (e.clientY - sysDrag.y) * SH / r.height;
  layout();
});
const endSysDrag = e => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  sysDrag = null;
  rememberView();
};
sys.addEventListener('pointerup', endSysDrag);
sys.addEventListener('click', e => { if (scene?.onTap?.(...sysPoint(e))) wake(); });   // things to catch in a scene (the ISS's meteors)
sys.addEventListener('pointerleave', () => { if (scene) scene.hover = null; });
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
  if (sview.mode === 'true') achieve('scale');
  if (liveScene()) { Object.assign(sview, { zoom: 1, panX: 0, panY: 0 }); layout(); }
});
