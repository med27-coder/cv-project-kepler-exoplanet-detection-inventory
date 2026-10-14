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
const toHome = (ra, dec) => [offX + (-ra * cosd - xMin) * scale, offY + (-dec - yMin) * scale];

// Kepler's 21 CCD modules (data/ccd.js, scripts/starmap/make_ccd_footprint.py): why the stars sit in squares.
const CCD = (window.STARMAP_CCD || []).map(poly => poly.map(([ra, dec]) => toHome(ra, dec)));
let showCcd = true;

// Depth view: the field seen from the side. Earth on the left, each star at its distance (NASA /
// Gaia); its height is its angle from the field's centre times its distance, so the field opens
// out as the cone Kepler looked down. Stars without a distance are left out.
let depth = false;
const DEPTH = (() => {
  const dists = STARS.map(s => s[COL.dist]).filter(d => d != null).sort((a, b) => a - b);
  const far = dists[Math.floor(dists.length * 0.98)] || 1;   // the farthest 2% sit at the edge
  const x0 = PAD + 12, w = MW - x0 - PAD;
  const pos = STARS.map((s, i) => {
    const d = s[COL.dist];
    if (d == null) return [-99, -99];
    const f = Math.min(1, d / far);
    return [x0 + f * w, MH / 2 + (home[i][1] - MH / 2) * f * 0.95];
  });
  return { far, x0, w, pos };
})();
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

// The real Milky Way behind the stars: Gaia DR3, pixelated, made by scripts/starmap/make_sky_backdrop.py
// in this map's projection (it covers the map at zoom 1). The map works without it.
const sky = new Image();
sky.addEventListener('load', () => renderBase());
sky.src = 'sky.png';

const base = document.createElement('canvas');   // all stars for the current view, redrawn on change
base.width = MW; base.height = MH;
function renderDepth(b) {
  screen = DEPTH.pos.map(([x, y]) => [Math.round(x), Math.round(y)]);
  b.fillStyle = '#070b1a';
  b.fillRect(0, 0, MW, MH);
  const ex = PAD + 4, ey = MH / 2;
  b.fillStyle = '#1e2550';   // the cone Kepler looked down
  for (let x = DEPTH.x0; x < MW - PAD; x += 2) {
    const f = (x - DEPTH.x0) / DEPTH.w, half = (MH / 2 - PAD) * 0.95 * f;
    b.fillRect(x, Math.round(ey - half), 1, 1);
    b.fillRect(x, Math.round(ey + half), 1, 1);
  }
  const lyPerPx = DEPTH.far * LY_PER_PC / DEPTH.w;
  const step = lyPerPx * DEPTH.w > 6000 ? 2000 : 1000;
  for (let ly = step; ly / LY_PER_PC < DEPTH.far; ly += step) {   // distance ticks
    const x = Math.round(DEPTH.x0 + ly / lyPerPx);
    b.fillStyle = '#3a4888';
    b.fillRect(x, MH - PAD - 6, 1, 3);
    pixelText(b, `${ly / 1000}K LY`, x - 8, MH - PAD - 1 - 5 + 6, '#5a6aa0');
  }
  b.fillStyle = '#4f9a46';   // Earth, with a label
  b.fillRect(ex - 1, ey - 1, 3, 3);
  b.fillStyle = '#2f6fd0';
  b.fillRect(ex, ey - 1, 1, 1);
  pixelText(b, 'EARTH', ex - 1, ey - 9, '#9fd8ff');
  pixelText(b, 'SIDE VIEW', MW - PAD - textWidth('SIDE VIEW'), PAD, '#5a6aa0');
}

function drawCcd(b) {
  b.fillStyle = '#2b3566';
  for (const poly of CCD) {
    for (let k = 0; k < poly.length; k++) {
      const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % poly.length];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * view.zoom);
      for (let j = 0; j <= n; j++) {
        const [x, y] = toCanvas([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
        if (x >= 0 && y >= 0 && x < MW && y < MH) b.fillRect(x, y, 1, 1);
      }
    }
  }
}

function renderBase() {
  const b0 = base.getContext('2d');
  if (depth) {
    renderDepth(b0);
    drawStars(b0, 1);
    return;
  }
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
  if (showCcd) drawCcd(b);
  drawStars(b, view.zoom >= 4 ? 2 : 1);
  document.getElementById('zoom-level').textContent = `${view.zoom}×`;
  map.classList.toggle('zoomed', view.zoom > 1);
}

function drawStars(b, size) {
  const lit = highlight && highlightSets[highlight];
  STARS.forEach((s, i) => {
    const [x, y] = screen[i];
    if (x < -2 || y < -2 || x > MW + 2 || y > MH + 2) return;
    if (lit && lit.has(s)) {
      b.fillStyle = '#b56cff';   // highlight: violet, distinct for every colour vision
      b.fillRect(x - 1, y - 1, size + 1, size + 1);
    } else {
      b.fillStyle = starColors[i];
      b.globalAlpha = lit ? 0.3 : 1;
      b.fillRect(x, y, size, size);
      b.globalAlpha = 1;
    }
  });
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
  if (depth) return;
  if (!anchor && selected) {
    const [x, y] = toCanvas(home[starIndex.get(selected)]);
    if (x >= 0 && y >= 0 && x <= MW && y <= MH) anchor = [x, y];
  }
  setZoom(ZOOMS[clamp(ZOOMS.indexOf(view.zoom) + dir, 0, ZOOMS.length - 1)], anchor);
}

function keepInView(s) {   // when zoomed in, re-centre on a star that's near or past the edge
  if (view.zoom === 1 || depth) return;
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
  drawKeplerOnMap(t);
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
  const onKepler = overKepler(e);
  map.classList.toggle('on-kepler', onKepler);
  hovered = onKepler ? null : starAt(e);
  hoverLine.textContent = onKepler ? '▸ The Kepler space telescope · click for its story'
    : hovered ? `▸ ${label(hovered)}` : HOVER_HINT;
  prefetch(hovered);   // details are usually loaded before the click
});
map.addEventListener('pointerup', e => {
  const wasDrag = drag && drag.moved;
  drag = null;
  if (wasDrag) return;
  if (overKepler(e)) { input.value = 'Kepler'; lookup('Kepler'); return; }
  const s = starAt(e);
  if (s) select(s);
});
map.addEventListener('pointercancel', () => { drag = null; });
map.addEventListener('pointerleave', () => { hovered = null; map.classList.remove('on-kepler'); hoverLine.textContent = HOVER_HINT; });
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
const ccdButton = document.getElementById('ccd'), depthButton = document.getElementById('depth');
ccdButton.addEventListener('click', () => {
  showCcd = !showCcd;
  ccdButton.setAttribute('aria-pressed', String(showCcd));
  renderBase();
});
depthButton.addEventListener('click', () => {
  depth = !depth;
  if (depth) { view.zoom = 1; view.cx = MW / 2; view.cy = MH / 2; }
  depthButton.setAttribute('aria-pressed', String(depth));
  for (const id of ['zoom-in', 'zoom-out']) document.getElementById(id).disabled = depth;
  map.closest('.panel').querySelector('h2').textContent = depth ? 'SIDE VIEW FROM EARTH' : 'THE KEPLER FIELD';
  renderBase();
});
document.getElementById('zoom-out').addEventListener('click', () => stepZoom(-1));

function label(s) {
  const koi = s[COL.koi] != null && !s[COL.name].startsWith('KOI') ? ` · KOI-${s[COL.koi]}` : '';
  const state = s[COL.drawn] ? '' : ' · unconfirmed';
  const far = s[COL.dist] != null ? ` · ${fmt(s[COL.dist] * LY_PER_PC)} ly` : '';
  return `${s[COL.name]}${koi} · ${s[COL.kois]} KOI${s[COL.kois] > 1 ? 's' : ''}${s[COL.spot] ? ' ★' : ''}${state}${far}`;
}
