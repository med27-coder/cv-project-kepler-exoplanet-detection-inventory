// ---------------------------------------------------------------- map
const map = document.getElementById('map');
const mctx = map.getContext('2d');
const MW = map.width, MH = map.height, PAD = 6;
const ZOOMS = [1, 2, 4, 8];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// RA scaled by cos(dec), east to the left as on the sky. `home` is each star's position
// at zoom 1, in map pixels (unrounded, so zooming in spreads crowded stars apart).
const ras = STARS.map(s => s[COL.ra]), decs = STARS.map(s => s[COL.dec]);
const dec0 = (Math.min(...decs) + Math.max(...decs)) / 2;
const cosd = Math.cos(dec0 * Math.PI / 180);
const xs = ras.map(r => -r * cosd), ys = decs.map(d => -d);
const xMin = Math.min(...xs), yMin = Math.min(...ys);
const span = Math.max(Math.max(...xs) - xMin, Math.max(...ys) - yMin);
const scale = (Math.min(MW, MH) - 2 * PAD) / span;
const offX = (MW - (Math.max(...xs) - xMin) * scale) / 2;
const offY = (MH - (Math.max(...ys) - yMin) * scale) / 2;
const home = STARS.map((s, i) => [offX + (xs[i] - xMin) * scale, offY + (ys[i] - yMin) * scale]);
const starIndex = new Map(STARS.map((s, i) => [s, i]));

// Colour of each star: drawn systems bright, "soon" systems dim, scored candidates by verdict.
const starColors = STARS.map(s => {
  const mag = s[COL.kepmag] ?? 15;
  const light = Math.round(255 - Math.min(Math.max(mag - 9, 0), 8) * 14);   // brighter = lower mag
  if (s[COL.sg] != null && !s[COL.nconf]) return s[COL.sg] >= SG_THRESHOLD ? MAP_COLORS.likely : MAP_COLORS.unlikely;
  if (s[COL.drawn]) return `rgb(${light - 30},${light - 15},${light})`;
  return `rgb(${light * 0.35 | 0},${light * 0.4 | 0},${light * 0.55 | 0})`;
});

// Highlights: light up the systems that match, dim the rest. The tags are worked out by the
// export (candidates count only once Star Gazer calls them planets), so no details are needed.
const HIGHLIGHTS = {
  hz: ['habitable zone', TAGS.hz],
  earth: ['Earth-sized', TAGS.earth],
  multi: ['5+ planets', TAGS.multi],
  giant: ['giant planets', TAGS.giant],
  tess: ['seen by TESS', TAGS.tess],
};
const highlightSets = Object.fromEntries(Object.entries(HIGHLIGHTS).map(([key, [, bit]]) =>
  [key, new Set(STARS.filter(s => s[COL.tags] & bit))]));
let highlight = null;

// View: the map point shown at the canvas centre, and the zoom factor.
const view = { zoom: 1, cx: MW / 2, cy: MH / 2 };
let screen = [];   // each star's canvas position for the current view
const toCanvas = ([x, y]) => [Math.round((x - view.cx) * view.zoom + MW / 2),
                              Math.round((y - view.cy) * view.zoom + MH / 2)];
const toMap = (sx, sy) => [(sx - MW / 2) / view.zoom + view.cx, (sy - MH / 2) / view.zoom + view.cy];

// The real Milky Way behind the stars: Gaia DR3, pixelated, made by scripts/make_sky_backdrop.py
// in this map's projection (it covers the map at zoom 1). The map works without it.
const sky = new Image();
sky.addEventListener('load', () => renderBase());
sky.src = 'sky.png';

const base = document.createElement('canvas');   // all stars for the current view, redrawn on change
base.width = MW; base.height = MH;
function renderBase() {
  const half = MW / 2 / view.zoom;
  view.cx = clamp(view.cx, half, MW - half);
  view.cy = clamp(view.cy, half, MH - half);
  screen = home.map(toCanvas);
  const b = base.getContext('2d');
  b.fillStyle = '#070b1a';
  b.fillRect(0, 0, MW, MH);
  if (sky.complete && sky.naturalWidth) {
    b.imageSmoothingEnabled = false;
    b.drawImage(sky, MW / 2 - view.cx * view.zoom, MH / 2 - view.cy * view.zoom, MW * view.zoom, MH * view.zoom);
  }
  const size = view.zoom >= 4 ? 2 : 1;
  const lit = highlight && highlightSets[highlight];
  STARS.forEach((s, i) => {
    const [x, y] = screen[i];
    if (x < -2 || y < -2 || x > MW + 2 || y > MH + 2) return;
    if (lit && lit.has(s)) {
      b.fillStyle = '#5ce1e6';
      b.fillRect(x - 1, y - 1, size + 1, size + 1);
    } else {
      b.fillStyle = starColors[i];
      b.globalAlpha = lit ? 0.3 : 1;
      b.fillRect(x, y, size, size);
      b.globalAlpha = 1;
    }
  });
  document.getElementById('zoom-level').textContent = `${view.zoom}×`;
  map.classList.toggle('zoomed', view.zoom > 1);
}

function setZoom(zoom, anchor) {   // anchor: canvas point that stays put (default: centre)
  zoom = clamp(zoom, ZOOMS[0], ZOOMS[ZOOMS.length - 1]);
  if (zoom === view.zoom) return;
  const [ax, ay] = anchor || [MW / 2, MH / 2];
  const [mx, my] = toMap(ax, ay);
  view.zoom = zoom;
  view.cx = mx - (ax - MW / 2) / zoom;
  view.cy = my - (ay - MH / 2) / zoom;
  renderBase();
}
// Buttons and keys zoom around the selected star when it's on screen, else the centre.
function stepZoom(dir, anchor) {
  if (!anchor && selected) {
    const [x, y] = toCanvas(home[starIndex.get(selected)]);
    if (x >= 0 && y >= 0 && x <= MW && y <= MH) anchor = [x, y];
  }
  setZoom(ZOOMS[clamp(ZOOMS.indexOf(view.zoom) + dir, 0, ZOOMS.length - 1)], anchor);
}

function keepInView(s) {   // when zoomed in, re-centre on a star that's near or past the edge
  if (view.zoom === 1) return;
  const [x, y] = toCanvas(home[starIndex.get(s)]);
  if (x < 16 || y < 16 || x > MW - 16 || y > MH - 16) {
    [view.cx, view.cy] = home[starIndex.get(s)];
    renderBase();
  }
}

const spotIdx = STARS.map((s, i) => (s[COL.spot] ? i : -1)).filter(i => i >= 0);
let selected = null, hovered = null;

function drawMap(t) {
  mctx.fillStyle = '#070b1a';   // never rely on the cached layer alone (see refreshLayers)
  mctx.fillRect(0, 0, MW, MH);
  mctx.drawImage(base, 0, 0);
  const spot = view.zoom >= 4 ? 3 : 2;
  spotIdx.forEach((i, k) => {
    const on = REDUCED_MOTION || Math.sin(t / 400 + k * 1.7) > -0.6;
    mctx.fillStyle = on ? MAP_COLORS.spot : MAP_COLORS.spotDim;
    mctx.fillRect(screen[i][0] - 1, screen[i][1] - 1, spot, spot);
  });
  for (const [s, color] of [[hovered, '#9aa6d6'], [selected, '#ffd34d']]) {
    if (!s) continue;
    const [x, y] = screen[starIndex.get(s)];
    mctx.fillStyle = color;
    for (const [dx, dy] of [[-4, 0], [-3, 0], [3, 0], [4, 0], [0, -4], [0, -3], [0, 3], [0, 4]]) {
      mctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

function canvasPoint(evt) {
  const r = map.getBoundingClientRect();
  return [(evt.clientX - r.left) * MW / r.width, (evt.clientY - r.top) * MH / r.height];
}

function starAt(evt) {
  const [x, y] = canvasPoint(evt);
  let best = null, bestD = 4.5 * 4.5;   // pick radius in canvas pixels
  STARS.forEach((s, i) => {
    // Spotlight, then drawn systems win ties so they're easy to hit.
    const d = (screen[i][0] - x) ** 2 + (screen[i][1] - y) ** 2 - (s[COL.spot] ? 6 : s[COL.drawn] ? 2 : 0);
    if (d < bestD) { bestD = d; best = s; }
  });
  return best;
}

// Arrow keys: jump to the nearest star in that direction (in sky coordinates, any zoom).
function neighbour(from, dx, dy) {
  const [x0, y0] = from ? home[starIndex.get(from)] : toMap(MW / 2, MH / 2);
  let best = null, bestCost = Infinity;
  STARS.forEach((s, i) => {
    if (s === from) return;
    const vx = home[i][0] - x0, vy = home[i][1] - y0;
    const along = vx * dx + vy * dy;
    if (along <= 0) return;
    const cost = along + 2 * Math.abs(vx * dy - vy * dx);
    if (cost < bestCost) { bestCost = cost; best = s; }
  });
  return best;
}

const hoverLine = document.getElementById('hover');
const HOVER_HINT = hoverLine.textContent;
let drag = null;   // {x, y, cx, cy, moved} while a pointer is down on the map

map.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
  map.setPointerCapture(e.pointerId);
});
map.addEventListener('pointermove', e => {
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    drag.moved = true;
    if (view.zoom > 1) {
      const r = map.getBoundingClientRect();
      view.cx = drag.cx - (e.clientX - drag.x) * MW / r.width / view.zoom;
      view.cy = drag.cy - (e.clientY - drag.y) * MH / r.height / view.zoom;
      renderBase();
    }
    return;
  }
  hovered = starAt(e);
  hoverLine.textContent = hovered ? `▸ ${label(hovered)}` : HOVER_HINT;
  prefetch(hovered);   // details are usually loaded before the click
});
map.addEventListener('pointerup', e => {
  const wasDrag = drag && drag.moved;
  drag = null;
  if (!wasDrag) { const s = starAt(e); if (s) select(s); }
});
map.addEventListener('pointercancel', () => { drag = null; });
map.addEventListener('pointerleave', () => { hovered = null; hoverLine.textContent = HOVER_HINT; });
map.addEventListener('wheel', e => {
  const dir = e.deltaY < 0 ? 1 : -1;
  if (dir < 0 && view.zoom === 1) return;   // fully zoomed out: let the page scroll
  e.preventDefault();
  stepZoom(dir, canvasPoint(e));
}, { passive: false });
map.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); return; }
  if (e.key === '-' || e.key === '_') { e.preventDefault(); stepZoom(-1); return; }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir) return;
  e.preventDefault();
  const s = neighbour(selected, ...dir);
  if (s) { select(s); hoverLine.textContent = `▸ ${label(s)}`; }
});
document.getElementById('zoom-in').addEventListener('click', () => stepZoom(1));
document.getElementById('zoom-out').addEventListener('click', () => stepZoom(-1));

function label(s) {
  const koi = s[COL.koi] != null && !s[COL.name].startsWith('KOI') ? ` · KOI-${s[COL.koi]}` : '';
  const state = s[COL.drawn] ? '' : ' · unconfirmed';
  return `${s[COL.name]}${koi} · ${s[COL.kois]} KOI${s[COL.kois] > 1 ? 's' : ''}${s[COL.spot] ? ' ★' : ''}${state}`;
}
