// Kepler Star Map: pixel map of the Kepler field + pixel-art star systems.
// Data comes from data/systems.js (scripts/export_starmap.py). Everything is drawn
// procedurally on two small canvases, so a system costs a few numbers, not an image.
// Built by scripts/build_web.py from web/src/*.js: edit those, not this file.
(function () {
  'use strict';

  // Clickjacking guard. GitHub Pages can't send frame-ancestors / X-Frame-Options headers, and
  // browsers block a framed page from navigating the top window without a click. So inside another
  // site's frame, replace the page with a single link that opens the real one, and stop here.
  if (window.top !== window.self) {
    const link = document.createElement('a');
    link.href = window.location.href;
    link.target = '_top';
    link.rel = 'noopener';
    link.textContent = 'Open the Kepler Star Map ↗';
    document.body.replaceChildren(link);
    return;
  }

  const DATA = window.STARMAP;
  const COL = Object.fromEntries(DATA.columns.map((c, i) => [c, i]));
  const STARS = DATA.stars;
  const TAGS = DATA.tags;

  // System details (star facts, planets) live in data/details/NN.js and load on demand, one chunk of
  // ~100 systems at a time. A <script> rather than fetch(), so the page also works from file://.
  const DETAILS = new Map();       // system name -> details
  const chunkLoads = new Map();    // chunk number -> Promise
  window.STARMAP_DETAILS = (k, systems) => {
    for (const [name, d] of Object.entries(systems)) DETAILS.set(name, d);
  };
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.addEventListener('load', resolve);
      tag.addEventListener('error', () => { tag.remove(); reject(new Error('offline')); });
      document.head.appendChild(tag);
    });
  }
  function loadChunk(k) {
    if (!chunkLoads.has(k)) {
      const load = loadScript(`data/details/${String(k).padStart(2, '0')}.js`);
      load.catch(() => chunkLoads.delete(k));
      chunkLoads.set(k, load);
    }
    return chunkLoads.get(k);
  }
  // Calls done(details) right away when the chunk is already loaded (no flicker), else after loading.
  function withDetail(s, done, failed) {
    const name = s[COL.name];
    if (DETAILS.has(name)) { done(DETAILS.get(name)); return; }
    loadChunk(s[COL.chunk]).then(() => done(DETAILS.get(name)), failed);
  }
  const prefetch = s => { if (s && !DETAILS.has(s[COL.name])) loadChunk(s[COL.chunk]).catch(() => {}); };
  const SPOTLIGHT = [...DATA.spotlight].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const SG_THRESHOLD = DATA.sg_threshold ?? 0.5;
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LY_PER_PC = 3.26156;
  const MAX_QUERY = 60;   // longest search text accepted (input maxlength, links, lookups)

  const SOON = [
    'Soon to cross the stars',
    'Still warming up its engines',
    'Charting a course, check back soon',
  ];

  // ---------------------------------------------------------------- lookup
  const byName = new Map(), byKoi = new Map(), byKepid = new Map();
  for (const s of STARS) {
    byName.set(s[COL.name].toLowerCase(), s);
    if (s[COL.koi] != null) byKoi.set(s[COL.koi], s);
    byKepid.set(s[COL.kepid], s);
  }

  function find(query) {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    let m;
    if ((m = q.match(/^kepler[\s-]*(\d+)(?:\s*[a-z])?$/))) return byName.get('kepler-' + Number(m[1]));
    if ((m = q.match(/^koi[\s-]*(\d+)(?:\.\d+)?$/))) return byKoi.get(Number(m[1]));
    if ((m = q.match(/^k0*(\d+)\.\d{2}$/))) return byKoi.get(Number(m[1]));
    if ((m = q.match(/^(?:kic|kepid)?[\s-]*(\d{5,9})$/))) return byKepid.get(Number(m[1]));
    return byName.get(q);
  }

  // ---------------------------------------------------------------- colours
  function starColor(teff) {
    if (teff == null) return '#fff1b0';
    if (teff < 3700) return '#ff8a5c';
    if (teff < 5200) return '#ffb36b';
    if (teff < 6000) return '#fff1b0';
    if (teff < 7500) return '#ffffff';
    return '#a8c8ff';
  }

  const PLANET_BANDS = [   // equilibrium temperature (K) -> canvas colour, CSS class (style.css)
    [1500, '#ff5a36', 't-molten'],
    [700, '#ffa64d', 't-scorching'],
    [350, '#e8d27a', 't-hot'],
    [180, '#4fd17a', 't-temperate'],
    [-Infinity, '#8fd3ff', 't-icy'],
  ];
  const band = teq => (teq == null ? null : PLANET_BANDS.find(([t]) => teq >= t));
  const planetColor = teq => band(teq)?.[1] ?? '#c0c6e0';
  const planetClass = teq => band(teq)?.[2] ?? '';
  const STATUSES = new Set(['confirmed', 'candidate', 'other']);
  function planetSize(radius) {   // Earth radii -> pixel radius
    if (radius == null || radius < 1.5) return 1;
    if (radius < 4) return 2;
    if (radius < 8) return 3;
    return 4;
  }

  const MAP_COLORS = { spot: '#ffd34d', spotDim: '#8a6d1f', likely: '#6fe39a', unlikely: '#ff7a59' };

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

  // Kepler's 21 CCD modules (data/ccd.js, scripts/make_ccd_footprint.py): why the stars sit in squares.
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

  // The real Milky Way behind the stars: Gaia DR3, pixelated, made by scripts/make_sky_backdrop.py
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
        b.fillStyle = '#5ce1e6';
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

  // ---------------------------------------------------------------- system view
  const sys = document.getElementById('system');
  const sctx = sys.getContext('2d');
  const STRIP = 22;   // light-curve strip along the bottom
  const SW = sys.width, SH = sys.height, CX = SW / 2, CY = Math.round((SH - STRIP) / 2);
  const TILT_SKY = 0.42, TILT_KEPLER = 0.05;   // orbit tilt on screen; Kepler saw these systems almost edge-on
  let TILT = TILT_SKY;
  const AU_PER_RSUN = 0.00465047, AU_PER_REARTH = 4.2635e-5;
  let scene = null;

  // The view of a system: 'overview' spaces orbits on a log scale so every planet shows;
  // 'true' uses real distances (and real sizes, once zoomed in far enough).
  const sview = { mode: 'overview', zoom: 1, panX: 0, panY: 0 };
  const SVIEW_ZOOM = { overview: [0.1, 16], true: [0.002, 20000] };

  // Deterministic "random" so a system always starts in the same pose.
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    // Final mix, so names that differ only in the last character ("K00351.01"/".02") spread out.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // '#rrggbb' scaled towards black (f < 1) or white (f > 1), as a CSS colour.
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = v => Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  // A 3×5 pixel font for the few labels drawn on the canvas (crisp at any page size).
  const GLYPHS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001',
    8: '111101111101111', 9: '111101111001111', '.': '000000000000010', ' ': '000000000000000',
    A: '010101111101101', U: '101101101101111', E: '111100111100111', R: '110101110101101',
    T: '111010010010010', H: '101101111101101', K: '101101110101101', M: '101111111101101',
    N: '110101101101101', C: '011100100100011', O: '010101101101010', F: '111100110100100',
    I: '111010010010111', D: '110101101101110', B: '110101110101110', G: '011100101101011',
    J: '001001001101010', L: '100100100100111', P: '110101110100100', Q: '010101101110011',
    S: '011100010001110', V: '101101101101010', W: '101101111111101', Y: '101101010010010',
    Z: '111001010100111', '-': '000000111000000', '/': '001001010100100',
  };
  function pixelText(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    [...text].forEach((ch, i) => {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1);
    });
  }
  const textWidth = text => text.length * 4 - 1;

  // Approximate habitable zone (AU) from the star's luminosity: L = R² (T / 5772 K)⁴,
  // edges where the planet gets 1.1× and 0.36× Earth's sunlight (roughly Kopparapu et al. 2013).
  function habitableZone(detail) {
    if (detail.teff == null || detail.srad == null) return null;
    const lum = detail.srad ** 2 * (detail.teff / 5772) ** 4;
    return [Math.sqrt(lum / 1.1), Math.sqrt(lum / 0.36)];
  }

  // Planet look from size and temperature (the pixel art is a guess at the type, not a measurement).
  function planetLook(p) {
    if (p.radius != null && p.radius >= 6) return 'giant';      // banded gas giant
    if (p.teq != null && p.teq >= 1500) return 'molten';         // lava glints
    if (p.teq != null && p.teq < 180 && (p.radius ?? 1) < 2.5) return 'icy';   // polar caps
    return 'plain';
  }

  // Position on a (possibly eccentric) orbit at mean anomaly m: Kepler's equation, star at a focus.
  function orbitPoint(p, m) {
    let E = m;
    for (let k = 0; k < 6 && p.e; k++) E -= (E - p.e * Math.sin(E) - m) / (1 - p.e * Math.cos(E));
    const x = p.rx * (Math.cos(E) - p.e), y = p.rx * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
    return [x * p.cosw - y * p.sinw, x * p.sinw + y * p.cosw];   // star-centred, before tilting
  }

  // System data in real units, plus the overview's log-scale radii (zoom 1). The view turns these
  // into pixels in layout().
  function buildScene(detail) {
    const spriteR = Math.max(3, Math.min(12, Math.round(3 + (detail.srad ?? 1) * 4)));
    const rMin = spriteR + 7, rMax = CX - 8;
    const toR = a => rMin + (Math.log(a) - lo) / (hi - lo) * (rMax - rMin);
    const logA = detail.planets.map(p => Math.log(p.sma));
    let lo = Math.min(...logA), hi = Math.max(...logA);
    const minSpan = 1.6;   // single planets / tight systems: don't stretch tiny ratios across the canvas
    if (hi - lo < minSpan) { const mid = (lo + hi) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    let radii = detail.planets.map(p => toR(p.sma));
    for (let i = 1; i < radii.length; i++) radii[i] = Math.max(radii[i], radii[i - 1] + 5);   // keep orbits apart
    const squeeze = radii.length ? Math.min(1, (rMax - rMin) / (radii[radii.length - 1] - rMin || 1)) : 1;
    const logR = a => rMin + (toR(a) - rMin) * squeeze;
    radii = radii.map(r => rMin + (r - rMin) * squeeze);
    const hz = habitableZone(detail);
    const planets = detail.planets.map((p, i) => {
      const w = hash(p.koi + 'w') * 2 * Math.PI;   // orbit orientation: not in the data, so fixed per planet
      const color = planetColor(p.teq);
      return {
        a: p.sma, ecc: p.ecc ?? 0, logR: radii[i], radius: p.radius,
        cosw: Math.cos(w), sinw: Math.sin(w),
        sprite: p.sprite ?? planetSize(p.radius),
        locked: (p.period ?? Infinity) < 10 && (p.teq ?? 0) >= 700,   // tidally locked: one hot face to its star
        art: p.art,
        look: planetLook(p),
        pal: [shade(color, 0.45), color, shade(color, 1.45), shade(color, 0.75)],   // shadow, base, lit, band
        kind: p.status,
        speed: (2 * Math.PI) / (1.5 * Math.sqrt(p.period ?? 10)),   // radians per second
        phase: hash(p.koi) * 2 * Math.PI,
        seed: p.koi,
      };
    });
    const reach = Math.max(...planets.map(p => p.a * (1 + p.ecc)));
    const belts = (detail.belts || []).map(belt => ({
      color: belt.color,
      dots: Array.from({ length: belt.n }, (_, k) => {
        const a = belt.a0 + hash(`${belt.name}a${k}`) * (belt.a1 - belt.a0);
        return { a, phase: hash(`${belt.name}p${k}`) * 2 * Math.PI,
                 speed: (2 * Math.PI) / (1.5 * Math.sqrt(365.25 * a ** 1.5)) };
      }),
    }));
    return {
      belts, logR, teff: detail.teff, logg: detail.logg, seed: String(detail.kepid ?? 'sun'),
      spriteR, srad: detail.srad ?? 1,
      starColor: starColor(detail.teff),
      companion: (detail.nstars ?? 1) > 1,
      hzAU: hz, hzLog: hz && hz.map(logR), earthLog: logR(1), home: Boolean(detail.home),
      pxPerAU: rMax / reach,   // true scale at zoom 1: the farthest planet just fits
      curve: [],
      planets,
    };
  }

  // Overview sprites grow gently when zoomed in (up to 3x), so detail shows up close.
  const grow = z => Math.min(3, Math.max(1, Math.sqrt(z)));

  // Pixel positions and sizes for the current view.
  function layout() {
    const sc = scene, z = sview.zoom, truth = sview.mode === 'true';
    const px = sc.pxPerAU * z;   // true scale: pixels per AU
    sc.cx = CX + sview.panX; sc.cy = CY + sview.panY;
    if (truth) {
      sc.starTrue = sc.srad * AU_PER_RSUN * px;
      sc.starR = Math.max(2, Math.min(4000, sc.starTrue));
      sc.hz = sc.hzAU && sc.hzAU.map(a => a * px);
      sc.earth = px;
    } else {
      sc.starR = Math.round(sc.spriteR * grow(z));
      sc.hz = sc.hzLog && sc.hzLog.map(r => r * z);
      sc.earth = sc.earthLog * z;
    }
    for (const belt of sc.belts) for (const d of belt.dots) d.rx = truth ? d.a * px : sc.logR(d.a) * z;
    for (const p of sc.planets) {
      p.rx = truth ? p.a * px : p.logR * z;
      const trueSize = (p.radius ?? 1) * AU_PER_REARTH * px;
      p.size = truth ? Math.min(40, Math.max(p.sprite, Math.round(trueSize))) : Math.min(12, Math.round(p.sprite * grow(z)));
      // overview: the closest pass stays off the star sprite; true scale: real eccentricity
      p.e = truth ? p.ecc : Math.min(p.ecc, Math.max(0, 1 - (sc.starR + 4) / p.rx));
    }
    sc.layer = staticLayer(sc);
    document.getElementById('sys-hint').textContent = !truth
      ? 'Overview: orbits spaced out (log scale) so every planet shows. Scroll to zoom, drag to move.'
      : sc.starTrue < sc.spriteR
        ? 'True scale: real distances. The star and planets are drawn bigger than life; zoom in to reach their real size.'
        : 'True scale: real distances and real sizes.';
    const level = document.getElementById('sys-level');
    level.textContent = z >= 10 ? `${Math.round(z)}×` : `${+z.toFixed(2)}×`;
    rememberView();
  }

  // Everything that doesn't move, drawn once per view: speckle, habitable zone, orbits, scale.
  function staticLayer(sc) {
    const layer = document.createElement('canvas');
    layer.width = SW; layer.height = SH;
    const c = layer.getContext('2d');
    const H = SH - STRIP, cx = sc.cx, cy = sc.cy;
    c.fillStyle = '#070b1a';
    c.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 70; k++) {
      c.fillStyle = k % 7 === 0 ? '#4a5590' : k % 3 === 0 ? '#2e3768' : '#1e2550';
      c.fillRect(Math.floor(hash('bg' + k) * SW), Math.floor(hash('y' + k) * H), 1, 1);
    }
    if (sc.hz) {   // green band between the two edges, hatched so orbits stay readable
      const [h0, h1] = sc.hz;
      c.fillStyle = '#1a5a3a';
      for (let y = 0; y < H; y++) {
        for (let x = (2 * y) % 5; x < SW; x += 5) {
          const rho = Math.hypot(x - cx, (y - cy) / TILT);
          if (rho > h0 && rho < h1 && rho > sc.starR + 3) c.fillRect(x, y, 1, 1);
        }
      }
    }
    // Is a ring of radius r around the star on screen at all? (skip rings far off-canvas)
    const far = Math.max(...[[0, 0], [SW, 0], [0, H], [SW, H]].map(([x, y]) => Math.hypot(x - cx, (y - cy) / TILT)));
    const near = Math.hypot(Math.max(0, -cx, cx - SW), Math.max(0, -cy, cy - H) / TILT);
    const visible = (inner, outer) => outer >= near && inner <= far;
    const ring = (r, e, cosw, sinw, color, step) => {
      const n = Math.min(6000, Math.round(r * 2.4));
      c.fillStyle = color;
      for (let k = 0; k < n; k += step) {
        const [X, Y] = orbitPoint({ rx: r, e, cosw, sinw }, (k / n) * 2 * Math.PI);
        const x = Math.round(cx + X), y = Math.round(cy + Y * TILT);
        if (y < H) c.fillRect(x, y, 1, 1);
      }
    };
    if (!sc.home && visible(sc.earth, sc.earth) && sc.earth > sc.starR + 4) {   // Earth's orbit, for scale
      ring(sc.earth, 0, 1, 0, '#4f5d80', 2);
      if (TILT === TILT_KEPLER) {   // flat ring: label its right end, off the star
        const lx = Math.round(cx + sc.earth + 3);
        if (lx < SW - 20 && cy > 4) pixelText(c, 'EARTH', lx, Math.round(cy) - 2, '#7f8fb0');
      } else {
        const ly = Math.round(cy - sc.earth * TILT) - 7;
        if (ly > 1 && cx > 10 && cx < SW - 10) pixelText(c, 'EARTH', Math.round(cx - 9), ly, '#7f8fb0');
      }
    }
    for (const p of sc.planets) {   // dotted orbits, sparser for candidates and other-method planets
      if (!visible(p.rx * (1 - p.e), p.rx * (1 + p.e))) continue;
      const confirmed = p.kind === 'confirmed';
      ring(p.rx, p.e, p.cosw, p.sinw, confirmed ? '#3a4888' : '#2c3770', confirmed ? 2 : 3);
    }
    if (sview.mode === 'true') {   // scale bar: a round number of AU, 20-60 px long
      const px = sc.pxPerAU * sview.zoom;
      const nice = [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
      const au = nice.find(v => v * px >= 20) ?? 50;
      const len = Math.round(au * px), x0 = 4, y0 = H - 5;
      c.fillStyle = '#9aa6d6';
      c.fillRect(x0, y0, len, 1); c.fillRect(x0, y0 - 2, 1, 3); c.fillRect(x0 + len - 1, y0 - 2, 1, 3);
      const km = Number((au * 149597871).toPrecision(2));
      pixelText(c, au >= 0.01 ? `${au} AU` : `${km} KM`, x0 + len + 3, y0 - 4, '#9aa6d6');
    }
    // light-curve strip: frame and the "full brightness" line
    c.fillStyle = '#0b1230';
    c.fillRect(0, H, SW, STRIP);
    c.fillStyle = '#1e2a5a';
    c.fillRect(0, H, SW, 1);
    for (let x = 4; x < SW - 4; x += 3) c.fillRect(x, H + 4, 1, 1);
    return layer;
  }

  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    const top = Math.max(-r, -cy - 1), bottom = Math.min(r, SH - STRIP - cy);
    for (let dy = Math.ceil(top); dy <= bottom; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), 2 * w + 1, 1);
    }
  }

  function diamond(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      const w = r + 1 - Math.abs(dy);
      ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), 2 * w + 1, 1);
    }
  }

  function hollow(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    const n = Math.max(12, Math.round(r * 6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      ctx.fillRect(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), 1, 1);
    }
  }

  // A lit sphere in three tones: (lx, ly) points from the planet towards its star.
  function shadedPlanet(ctx, x, y, p, lx, ly) {
    const r = p.size, x0 = Math.round(x), y0 = Math.round(y);
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
      for (let dx = -w; dx <= w; dx++) {
        const lit = (dx * lx + dy * ly) / (r + 0.5);
        let tone = lit > 0.3 ? 2 : lit < -0.35 ? 0 : 1;
        if (p.look === 'giant' && tone === 1 && ((Math.floor((dy + r) * 3 / r) % 2) === 1)) tone = 3;   // cloud bands
        let color = p.pal[tone];
        if (p.look === 'icy' && Math.abs(dy) >= r - Math.floor(r / 4)) color = tone ? '#f2f8ff' : '#9fb0c8';   // polar caps
        if (p.look === 'molten' && tone !== 0 && hash(`${p.seed}${dx},${dy}`) < 0.18) color = '#ffe08a';   // lava
        ctx.fillStyle = color;
        ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
      }
    }
    if (p.locked && r >= 2) {   // the point right under its star: always day there
      ctx.fillStyle = '#fff1c4';
      ctx.fillRect(x0 + Math.round(lx * r * 0.5), y0 + Math.round(ly * r * 0.5), 1, 1);
    }
  }

  // The star: dithered glow, limb darkening (edge darker than the middle), a slow sparkle.
  function drawStar(t, dim) {
    const r = Math.round(scene.starR), c = scene.starColor, cx = scene.cx, cy = scene.cy;
    if (cx + r < -4 || cx - r > SW + 4 || cy + r < -4 || cy - r > SH - STRIP + 4) return;
    // Star types: red dwarfs are spotty and flare now and then; giants and hot stars glow wider.
    const cool = scene.teff != null && scene.teff < 3900;
    const wide = (scene.logg != null && scene.logg < 3.5) || (scene.teff != null && scene.teff >= 6500);
    const halo = wide ? 5.2 : 3.2;
    if (r <= 40) {
      sctx.fillStyle = shade(c, 0.35 * dim);
      for (let dy = -r - 6; dy <= r + 6; dy++) {
        for (let dx = -r - 6; dx <= r + 6; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r + 0.5 && d < r + halo && ((dx + dy) & 1) === 0) sctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
    disc(sctx, cx, cy, r, shade(c, 0.78 * dim));
    disc(sctx, cx, cy, Math.max(1, r - 1 - Math.floor(r / 12)), shade(c, dim));
    disc(sctx, cx - 1, cy - 1, Math.max(1, Math.round(r * 0.45)), shade(c, 1.35 * dim));
    if (cool && r >= 4) {   // starspots, slowly turning with the star
      sctx.fillStyle = shade(c, 0.5 * dim);
      for (let k = 0; k < 3; k++) {
        const a = hash(scene.seed + 's' + k) * 2 * Math.PI + t * 0.15, rho = (0.2 + 0.5 * hash(scene.seed + 'r' + k)) * r;
        if (Math.cos(a) > -0.2) sctx.fillRect(Math.round(cx + rho * Math.sin(a)), Math.round(cy + rho * (hash(scene.seed + 'y' + k) - 0.5)), 2, 1);
      }
      if (((t + hash(scene.seed) * 23) % 23) < 0.7) {   // a flare: a brief bright arc on the edge
        sctx.fillStyle = '#ffffff';
        for (let k = -3; k <= 3; k++) sctx.fillRect(Math.round(cx + k), Math.round(cy - r - 1 - (k * k < 4 ? 1 : 0)), 1, 1);
      }
    }
    if (r > 40) return;
    const len = REDUCED_MOTION ? 2 : 2 + Math.round(1.5 + 1.5 * Math.sin(t * 1.3));
    sctx.fillStyle = shade(c, 1.2 * dim);
    for (let k = 1; k <= len; k++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sctx.fillRect(cx + dx * (r + 1 + k), cy + dy * (r + 1 + k), 1, 1);
    }
  }

  // Brightness Kepler would record: a planet passing in front of the star (seen edge-on, as from
  // Earth) blocks light in proportion to its area. Depths are exaggerated unless sizes are true.
  function transitDepth(b) {
    const r = scene.starR, s = b.p.size + 0.5;
    if (b.behind || Math.abs(b.X) > r + s) return 0;
    const cover = Math.min(1, (r + s - Math.abs(b.X)) / (2 * s));   // ingress / egress
    return Math.min(1, (s / r) ** 2) * cover;
  }

  let lastSample = 0;
  function drawCurve(seconds, flux) {
    const curve = scene.curve, width = SW - 8;
    if (!REDUCED_MOTION && seconds - lastSample > 0.05) {
      curve.push(flux);
      if (curve.length > width) curve.shift();
      lastSample = seconds;
    }
    const top = SH - STRIP + 4;
    sctx.fillStyle = '#6fe39a';
    curve.forEach((f, i) => sctx.fillRect(4 + width - curve.length + i, top + Math.min(STRIP - 7, Math.round((1 - f) * 40)), 1, 1));
  }

  function drawSystem(seconds) {
    if (!scene) {
      sctx.fillStyle = '#070b1a';
      sctx.fillRect(0, 0, SW, SH);
      return;
    }
    if (scene.mystery) return drawMystery(seconds);
    if (scene.custom) return scene.custom(seconds);
    sctx.fillStyle = '#070b1a';   // a blank (discarded) layer must not leave trails behind
    sctx.fillRect(0, 0, SW, SH);
    sctx.drawImage(scene.layer, 0, 0);
    const t = REDUCED_MOTION || scene.frozen ? 0 : seconds;   // frozen: planets stay where they were on one date
    for (let k = 0; k < 6; k++) {   // a few background stars twinkle
      if (Math.sin(t * (0.7 + k * 0.23) + k * 2.1) > 0.6) {
        sctx.fillStyle = '#c8d0ff';
        sctx.fillRect(Math.floor(hash('tw' + k) * SW), Math.floor(hash('tv' + k) * (SH - STRIP)), 1, 1);
      }
    }
    if (scene.companion) {   // another star in the system (true distance unknown here): top right
      disc(sctx, SW - 14, 12, 2, '#ffd9a0');
      sctx.fillStyle = '#ffd9a055';
      sctx.fillRect(SW - 19, 12, 11, 1); sctx.fillRect(SW - 14, 7, 1, 11);
    }

    const { cx, cy } = scene;
    for (const belt of scene.belts) {   // asteroid / Kuiper belts: drifting dots, inner ones faster
      sctx.fillStyle = belt.color;
      for (const d of belt.dots) {
        const a = d.phase + d.speed * t;
        const x = Math.round(cx + d.rx * Math.cos(a)), y = Math.round(cy + d.rx * TILT * Math.sin(a));
        if (x >= 0 && x < SW && y >= 0 && y < SH - STRIP) sctx.fillRect(x, y, 1, 1);
      }
    }
    const bodies = scene.planets.map(p => {
      const [X, Y] = orbitPoint(p, p.phase + p.speed * t);
      return { p, X, x: cx + X, y: cy + Y * TILT, behind: Y < 0 };
    });
    let flux = 1;
    for (const b of bodies) { b.depth = transitDepth(b); flux -= b.depth; }
    flux = Math.max(0, flux);

    const H = SH - STRIP;
    const drawPlanet = b => {
      const s = b.p.size;
      if (b.x + s < 0 || b.x - s > SW || b.y + s < 0 || b.y - s > H) return;
      const dx = cx - b.x, dy = cy - b.y, d = Math.hypot(dx, dy) || 1;
      if (b.p.art) solarPlanet(sctx, b.x, b.y, b.p, dx / d, dy / d, t);
      else if (b.p.kind === 'candidate') hollow(sctx, b.x, b.y, s + 0.5, b.p.pal[1]);
      else if (b.p.kind === 'other') diamond(sctx, b.x, b.y, s, b.p.pal[1]);
      else shadedPlanet(sctx, b.x, b.y, b.p, dx / d, dy / d);
      if (b.depth > 0) {   // transiting: a white tick above the planet
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(Math.round(b.x), Math.round(b.y) - s - 3, 1, 2);
      }
    };
    if (scene.ghost) sctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 1.5);   // unconfirmed: faint, flickering
    bodies.filter(b => b.behind).forEach(drawPlanet);
    sctx.globalAlpha = 1;
    drawStar(t, 0.75 + 0.25 * flux);
    if (scene.ghost) sctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 1.5);
    bodies.filter(b => !b.behind).forEach(drawPlanet);
    sctx.globalAlpha = 1;
    if (scene.ghost) pixelText(sctx, 'UNCONFIRMED', 4, 4, '#ffd34d');
    if (scene.overlay) scene.overlay(seconds);
    sctx.fillStyle = '#070b1a';   // keep anything big out of the light-curve strip
    sctx.fillRect(0, H + 1, SW, STRIP - 1);
    sctx.drawImage(scene.layer, 0, H + 1, SW, STRIP - 1, 0, H + 1, SW, STRIP - 1);
    drawCurve(seconds, flux);
  }

  // Not drawn yet: a dim star, a slowly turning dashed ring and a blinking question mark.
  const QUESTION = ['01110', '10001', '00001', '00110', '00100', '00000', '00100'];
  function drawMystery(seconds) {
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    sctx.fillStyle = '#28305a';
    for (let k = 0; k < 40; k++) sctx.fillRect(Math.floor(hash('bg' + k) * SW), Math.floor(hash('y' + k) * SH), 1, 1);
    disc(sctx, CX, CY, 6, '#3a4366');
    const a0 = REDUCED_MOTION ? 0 : seconds * 0.6;
    sctx.fillStyle = '#ffd34d';
    for (let k = 0; k < 24; k += 2) {
      const a = a0 + (k / 24) * 2 * Math.PI;
      sctx.fillRect(Math.round(CX + 30 * Math.cos(a)), Math.round(CY + 30 * TILT * Math.sin(a)), 1, 1);
    }
    if (REDUCED_MOTION || Math.sin(seconds * 3) > -0.3) {
      QUESTION.forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit === '1') sctx.fillRect(CX - 2 + x, CY - 22 + y, 1, 1);
      }));
    }
  }

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
    if (!sysDrag) return;
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

  // ---------------------------------------------------------------- info panel
  const title = document.getElementById('sys-title');
  const info = document.getElementById('info');

  // Every value written with innerHTML goes through esc() or fmt(); the data is our own export,
  // but escaping everything means a bad or tampered data file still can't inject markup.
  function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmt = (v, d = 0) => (v == null ? '-' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function skyLink(ra, dec) {
    const url = 'https://aladin.cds.unistra.fr/AladinLite/?target=' + encodeURIComponent(`${Number(ra)} ${Number(dec)}`) +
                '&fov=0.08&survey=' + encodeURIComponent('CDS/P/DSS2/color');
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">See the real sky here ↗</a>`;
  }

  // Real photos of the sky around the star, from three surveys (via CDS hips2fits), fetched on
  // demand at 40×40 and shown pixelated: about 1 KB each, nothing stored with the page.
  const SURVEYS = [
    ['DSS2', 'CDS/P/DSS2/color', 'Digitized Sky Survey (visible light, photographic plates)'],
    ['PS1', 'CDS/P/PanSTARRS/DR1/color-z-zg-g', 'Pan-STARRS DR1 (visible light, sharper and deeper)'],
    ['2MASS', 'CDS/P/2MASS/color', '2MASS (infrared: cool stars and dust glow)'],
  ];
  let survey = 0;   // kept while browsing systems
  function skyUrl(ra, dec, k) {
    return 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=' + encodeURIComponent(SURVEYS[k][1]) +
           `&width=40&height=40&fov=0.04&projection=TAN&coordsys=icrs&ra=${Number(ra)}&dec=${Number(dec)}&format=jpg`;
  }
  function skyThumb(ra, dec) {
    const buttons = SURVEYS.map(([name, , about], k) =>
      `<button type="button" data-k="${k}" title="${esc(about)}" aria-pressed="${k === survey}">${esc(name)}</button>`).join('');
    return `<figure class="sky" data-ra="${Number(ra)}" data-dec="${Number(dec)}">
              <img src="${esc(skyUrl(ra, dec, survey))}" width="40" height="40" loading="lazy"
                   referrerpolicy="no-referrer" alt="Real sky photo around the star (${esc(SURVEYS[survey][0])})">
              <figcaption>real sky</figcaption><div class="surveys">${buttons}</div></figure>`;
  }

  // Survey buttons swap the photo; it hides if it can't load (offline, service down). Listeners,
  // not inline handlers, so the Content Security Policy can forbid inline scripts.
  function wireSkyThumbs() {
    info.querySelectorAll('.sky').forEach(fig => {
      const img = fig.querySelector('img');
      img.addEventListener('error', () => { fig.hidden = true; });
      fig.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        survey = Number(b.dataset.k);
        img.src = skyUrl(fig.dataset.ra, fig.dataset.dec, survey);
        img.alt = `Real sky photo around the star (${SURVEYS[survey][0]})`;
        fig.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      }));
    });
  }

  // A sentence about the star from its numbers (NASA's tables, Gaia via Berger et al. 2020).
  function starLine(d) {
    const bits = [];
    if (d.spectype) bits.push(`type ${esc(d.spectype)}`);
    bits.push(`${fmt(d.teff)} K`, `${fmt(d.srad, 2)} × Sun's size`);
    if (d.smass != null) bits.push(`${fmt(d.smass, 2)} × Sun's mass`);
    if (d.age != null) bits.push(`~${fmt(d.age, 1)} billion years old`);
    if (d.met != null) bits.push(d.met > 0.1 ? 'metal-rich' : d.met < -0.1 ? 'metal-poor' : 'Sun-like metals');
    if (d.logg != null && d.logg < 3.9) bits.push(d.logg < 3.5 ? 'a giant star' : 'a subgiant (ageing)');
    if (d.dist_pc != null) bits.push(`${fmt(d.dist_pc * LY_PER_PC)} light-years away`);
    if (d.nstars > 1) bits.push(`one of ${fmt(d.nstars)} stars in the system`);
    return bits.join(' · ');
  }

  function nasaLink(host) {
    const url = 'https://exoplanetarchive.ipac.caltech.edu/overview/' + encodeURIComponent(host);
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">NASA overview ↗</a>`;
  }

  function statusText(p) {
    if (p.note) return esc(p.note);
    if (p.status === 'other') return esc(p.method);
    if (p.status === 'candidate' && p.sg != null) {
      return `candidate · Star Gazer ${fmt(Math.round(p.sg * 100))}% ${p.sg_planet ? 'planet' : '(likely false positive)'}`;
    }
    return esc(p.status);
  }

  function planetTable(detail) {
    const rows = detail.planets.map(p => {
      const cls = `${planetClass(p.teq)} ${STATUSES.has(p.status) ? p.status : ''}`;
      const mass = p.mass == null ? '-' : (p.mass_kind === 'estimated' ? '~' : '') + fmt(p.mass, 1);
      const tess = p.toi ? ` <abbr class="badge" title="Seen again by NASA's TESS mission as ${esc(p.toi)}">TESS</abbr>` : '';
      const ecc = p.ecc >= 0.1 ? ` <abbr class="badge" title="Oval orbit: eccentricity ${fmt(p.ecc, 2)}">e ${fmt(p.ecc, 2)}</abbr>` : '';
      return `
      <tr>
        <td><span class="dot ${cls}"></span>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a>` : esc(p.name)}${tess}${ecc}</td>
        <td class="num">${fmt(p.radius, 1)}</td>
        <td class="num">${mass}</td>
        <td class="num">${fmt(p.period, 1)}</td>
        <td class="num">${fmt(p.teq)}</td>
        <td class="num">${p.insol == null ? '-' : fmt(p.insol, p.insol < 0.1 ? 4 : p.insol < 10 ? 2 : 0)}</td>
        <td>${statusText(p)}</td>
        <td class="num">${p.year == null ? '-' : esc(p.year)}</td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>Planet</th><th class="num">Size (Earths)</th><th class="num">Mass (Earths)</th>
          <th class="num">Year (days)</th><th class="num">Temp (K)</th><th class="num">Sunlight (vs Earth)</th>
          <th>Status</th><th class="num">Found</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  // Plain-language reasons a candidate might not be a planet (same rules as the export's leaderboard).
  function redFlags(p) {
    const flags = [...(p.flags || [])];
    if (p.snr != null && p.snr < 10) flags.push('weak signal');
    if (p.radius != null && p.radius > 20) flags.push('too big for a planet');
    if (p.nasa != null && p.nasa < 0.5) flags.push("NASA's vetting score is low");
    return flags;
  }

  // One "case file" per candidate: the evidence for and against it being a real planet.
  function caseFiles(detail) {
    const cands = detail.planets.filter(p => p.status === 'candidate');
    if (!cands.length) return '';
    const pct = v => (v == null ? 'not scored yet' : `${fmt(Math.round(v * 100))}%`);
    const items = cands.map(p => {
      const flags = redFlags(p);
      const good = [];
      if (p.toi) good.push(`seen again by TESS (${esc(p.toi)})`);
      if (p.snr != null && p.snr >= 20) good.push('strong, clear signal');
      return `
        <li><b>${esc(p.name)}</b>: NASA vetting ${pct(p.nasa)} · Star Gazer ${pct(p.sg)}${
          p.snr != null ? ` · signal strength ${fmt(p.snr)}` : ''}
          <br>${good.length ? `<span class="pro">✔ ${good.join(' · ')}</span> ` : ''}${
          flags.length ? `<span class="con">✖ ${flags.map(esc).join(' · ')}</span>` : '<span class="pro">no red flags</span>'}</li>`;
    }).join('');
    return `<h3 class="facts-title">CASE FILES</h3><ul class="facts cases">${items}</ul>`;
  }

  function showSystem(s, detail) {
    title.textContent = s[COL.name].toUpperCase();
    const count = k => detail.planets.filter(p => p.status === k).length;
    const parts = count('confirmed') ? [plural(count('confirmed'), 'confirmed planet')] : [];
    if (count('candidate')) parts.push(`${plural(count('candidate'), 'candidate')} (hollow)`);
    if (count('other')) parts.push(`${count('other')} more from NASA's planet list (◆)`);
    const links = [skyLink(detail.ra, detail.dec), ...(detail.host ? [nasaLink(detail.host)] : [])];
    info.innerHTML = `
      <div class="head">${skyThumb(detail.ra, detail.dec)}<div>
        <p>Star: ${starLine(detail)}</p>
        <p>${parts.join(' + ')} · ${links.join(' · ')}</p>
      </div></div>
      ${planetTable(detail)}
      ${caseFiles(detail)}
      <p class="note">~ mass estimated from size · green band = habitable zone (approx.) · bottom strip = the
        star's brightness as Kepler sees it: it dips when a planet crosses in front (dips exaggerated) ·
        planet looks are a guess from size and temperature · Kepler ID ${esc(detail.kepid)}</p>`;
    wireSkyThumbs();
    setScene(buildScene(detail));
  }

  // Only unscored candidates orbit this star: drawn as ghosts, with their case files.
  function showUnconfirmed(s, detail) {
    title.textContent = s[COL.name].toUpperCase();
    const line = SOON[Math.floor(hash(s[COL.name]) * SOON.length)];
    info.innerHTML = `
      <p class="big">✦ ${esc(line.toUpperCase())} ✦</p>
      <div class="head">${skyThumb(detail.ra, detail.dec)}<div>
        <p>Star: ${starLine(detail)}</p>
        <p>${plural(detail.planets.length, 'unconfirmed candidate')}, drawn as ghosts until Star Gazer scores them
           and NASA decides · ${skyLink(detail.ra, detail.dec)}</p>
      </div></div>
      ${planetTable(detail)}
      ${caseFiles(detail)}
      <p class="note">Candidates are signals that look like transits but haven't been confirmed or ruled out ·
        Kepler ID ${esc(detail.kepid)}</p>`;
    wireSkyThumbs();
    const scene = buildScene(detail);
    scene.ghost = true;
    setScene(scene);
  }

  // Details couldn't load (offline): the old "still in the hangar" card, from the index alone.
  function showSoon(s) {
    title.textContent = s[COL.name].toUpperCase();
    info.innerHTML = `
      <p class="big">✦ SOON TO CROSS THE STARS ✦</p>
      <div class="head">${skyThumb(s[COL.ra], s[COL.dec])}
      <p>${esc(label(s))}. This system's details couldn't be loaded right now; check your connection and try again.</p></div>
      <p>${skyLink(s[COL.ra], s[COL.dec])}</p>`;
    wireSkyThumbs();
    setScene({ mystery: true });
  }

  // "Next planets": the candidates most likely to be real (worked out by the export).
  function showLeaderboard() {
    selected = null;
    title.textContent = 'NEXT PLANETS';
    const pct = v => (v == null ? '-' : `${fmt(Math.round(v * 100))}%`);
    const table = (rows, caption) => !rows.length ? '' : `
      <h3 class="facts-title">${esc(caption)}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Candidate</th><th>System</th><th class="num">Size (Earths)</th>
          <th class="num">NASA vetting</th><th class="num">Star Gazer</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${esc(r.planet)}</td>
          <td><button type="button" class="linkish" data-name="${esc(r.system)}">${esc(r.system)}</button></td>
          <td class="num">${fmt(r.radius, 1)}</td><td class="num">${pct(r.nasa)}</td><td class="num">${pct(r.sg)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    info.innerHTML = `
      <p>Unconfirmed candidates most likely to be real planets: NASA's own vetting and Star Gazer agree, and
         nothing in their case file looks wrong (no weak signal, not too big, no NASA warning flags).</p>
      ${table(DATA.leaderboard.top, 'TOP CANDIDATES')}
      ${table(DATA.leaderboard.hz, 'IN THE HABITABLE ZONE')}
      <p class="note">Educational ranking, not a scientific classification. Click a system to open it.</p>`;
    info.querySelectorAll('button[data-name]').forEach(b =>
      b.addEventListener('click', () => { const s = byName.get(b.dataset.name.toLowerCase()); if (s) choose(s); }));
    setScene(null);
  }

  function showUnknown(query) {
    title.textContent = 'NO SIGNAL';
    info.innerHTML = `
      <p class="big alert">✖ NO SIGNAL</p>
      <p>Nothing called “${esc(query)}” in the Kepler field.</p>
      <p>Try <b>Kepler-90</b>, <b>KOI-351</b>, a KOI like <b>K00351.01</b> or a Kepler ID like <b>11442793</b>.</p>`;
    setScene(null);
    selected = null;
  }

  // ---------------------------------------------------------------- easter egg: home
  // Our own Solar System, drawn by the same engine with hand-made pixel art (we know what these
  // planets look like). Not on the map (the map is the view from here) and not in the type-ahead:
  // search "Sun", "Solar System", "Earth" or "home" to find it.
  // Values: NASA Planetary Fact Sheet. Temperatures are equilibrium temperatures worked out the
  // way the Kepler catalog does (Bond albedo 0.3: 255 K / sqrt(AU)), so colours compare fairly.
  const HOME_QUERY = /^(the )?(sun|sol|solar system|earth|home|you are here)$/i;
  const NASA_SCIENCE = 'https://science.nasa.gov/';
  const SOLAR = {
    home: true, teff: 5772, srad: 1, smass: 1, age: 4.6, met: 0, spectype: 'G2 V',
    planets: [
      // name, radius (Earths), mass (Earths), period (d), a (AU), e, found, sprite radius (px)
      ['Mercury', 0.383, 0.0553, 87.97, 0.387, 0.206, 'antiquity', 2],
      ['Venus', 0.949, 0.815, 224.7, 0.723, 0.007, 'antiquity', 2],
      ['Earth', 1, 1, 365.25, 1, 0.017, 'here', 3],
      ['Mars', 0.532, 0.107, 687.0, 1.524, 0.094, 'antiquity', 2],
      ['Jupiter', 11.21, 317.8, 4331, 5.203, 0.049, 'antiquity', 6],
      ['Saturn', 9.45, 95.2, 10747, 9.537, 0.052, 'antiquity', 5],
      ['Uranus', 4.01, 14.5, 30589, 19.19, 0.047, 1781, 4],
      ['Neptune', 3.88, 17.1, 59800, 30.07, 0.010, 1846, 4],
    ].map(([name, radius, mass, period, sma, ecc, year, sprite]) => ({
      name, koi: 'Sol ' + name, status: 'confirmed', radius, mass, mass_kind: 'measured', period, sma, ecc,
      teq: Math.round(255 / Math.sqrt(sma)), insol: 1 / sma ** 2, year, sprite,
      art: name.toLowerCase(), url: `${NASA_SCIENCE}${name.toLowerCase()}/`,
      note: name === 'Earth' ? 'home ★' : 'planet',
    })),
    // drawn as drifting dots; edges are approximate
    belts: [
      { name: 'asteroid belt', a0: 2.2, a1: 3.2, n: 170, color: '#8c8475' },
      { name: 'Kuiper Belt', a0: 30, a1: 50, n: 240, color: '#56708f' },
    ],
  };

  // Pixel colour of each Solar System planet at (dx, dy) on a disc of radius r; `spin` (pixels)
  // scrolls surface features sideways so the planet turns.
  const SOLAR_ART = {
    mercury: (dx, dy, r, spin) => (hash(`me${Math.floor(dx + spin)},${dy}`) < 0.25 ? '#6f6a66' : '#9c9792'),
    venus: (dx, dy, r, spin) => (hash(`ve${Math.floor((dx + spin) / 2)},${dy}`) < 0.3 ? '#d4c08a' : '#eadcaf'),
    earth: (dx, dy, r, spin) => {
      if (Math.abs(dy) >= r - Math.floor(r / 8)) return '#eef6ff';           // ice caps
      // features scale with the sprite, so a big Earth gets continents rather than speckle
      const cell = Math.max(2, Math.round(r / 5)), wrap = 9;
      const x = Math.floor((dx + spin) / cell), y = Math.floor((dy + r) / cell);
      const cloud = Math.max(1, Math.round(cell / 2));
      if (hash(`cl${Math.floor((dx + spin * 1.6) / cloud)},${Math.floor(dy / cloud)}`) < 0.1) return '#ffffff';
      const land = hash(`la${((x % wrap) + wrap) % wrap},${y}`);
      return land < 0.32 ? '#4f9a46' : land < 0.42 ? '#a98b55' : '#2f6fd0';    // forest, desert, ocean
    },
    mars: (dx, dy, r, spin) => {
      if (dy <= -r) return '#f3ede4';                                         // north polar cap
      return hash(`ma${Math.floor((dx + spin) / 2)},${dy}`) < 0.3 ? '#8e3d22' : '#c45a32';
    },
    jupiter: (dx, dy, r, spin) => {
      const span = 4 * r, spot = ((spin * 0.7) % span + span) % span - 2 * r;   // Great Red Spot drifts across
      if (dy === Math.round(r * 0.4) && Math.abs(dx - spot) <= 1) return '#c4533a';
      return ['#f0e3c4', '#c9a473', '#e6d3a8', '#a8774c', '#efe0bd'][Math.floor((dy + r) / (2 * r + 1) * 5)];
    },
    saturn: (dx, dy, r) => ['#eadcab', '#d3b77c', '#e6d09a', '#c9ab72'][Math.floor((dy + r) / (2 * r + 1) * 4)],
    uranus: (dx, dy, r) => (dy % 3 === 0 ? '#98d6dc' : '#ace6eb'),
    neptune: (dx, dy, r) => {
      if (Math.abs(dx + Math.round(r * 0.3)) <= 1 && dy === -Math.round(r * 0.3)) return '#1c357a';   // dark spot
      return dy % 2 === 0 ? '#3b6bd6' : '#335fc4';
    },
  };

  // Rings as dotted ellipses around the planet: the far half before the planet, the near half after.
  function planetRing(ctx, x, y, rx, ry, color, near) {
    ctx.fillStyle = color;
    const n = Math.round(rx * 7);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      if ((Math.sin(a) > 0) !== near) continue;
      ctx.fillRect(Math.round(x + rx * Math.cos(a)), Math.round(y + ry * Math.sin(a)), 1, 1);
    }
  }

  function solarPlanet(ctx, x, y, p, lx, ly, t) {
    const r = p.size, x0 = Math.round(x), y0 = Math.round(y), art = SOLAR_ART[p.art];
    const spin = REDUCED_MOTION ? 0 : t * (p.art === 'jupiter' || p.art === 'saturn' ? 3 : 1.5);
    const ring = p.art === 'saturn' ? [r * 2.2, r * 0.75, '#d9c79a'] : p.art === 'uranus' ? [r * 0.5, r * 1.7, '#7fb5ba'] : null;
    if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], false);
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
      for (let dx = -w; dx <= w; dx++) {
        const lit = (dx * lx + dy * ly) / (r + 0.5);
        ctx.fillStyle = shade(art(dx, dy, r, spin).toLowerCase(), lit > 0.3 ? 1.15 : lit < -0.35 ? 0.45 : 0.9);
        ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
      }
    }
    if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], true);
    if (p.art === 'earth' && !p.noMoon) {   // the Moon, once every 27.3 days
      const a = (REDUCED_MOTION ? 1 : t) * (2 * Math.PI) / (1.5 * Math.sqrt(27.3)) * 4;
      ctx.fillStyle = '#c9c6c0';
      ctx.fillRect(Math.round(x0 + (r + 3) * Math.cos(a)), Math.round(y0 + (r + 3) * TILT * Math.sin(a)), 1, 1);
    }
  }

  function homeFacts() {
    const link = (path, text) => `<a href="${esc(path)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
    return `
      <h3 class="facts-title">THE SUN</h3>
      <ul class="facts">
        <li><b>Names:</b> officially just <b>the Sun</b> (the IAU asks for a capital S, like Earth and Moon);
          <b>Sol</b> in Latin, which gives us "solar"; <b>Helios</b>, the Sun god of ancient Greece;
          astronomers' symbol <b>☉</b>.</li>
        <li>A G2 V yellow dwarf, about 4.6 billion years old.</li>
        <li>Holds 99.8% of the Solar System's mass: more than 330,000 Earths.</li>
        <li>About 1.4 million km across; about 5,500 °C at the surface and 15 million °C in the core.</li>
        <li>About 150 million km from Earth: its light takes 8 minutes 20 seconds to reach us.</li>
        <li>Carries us once around the Milky Way every ~230 million years.</li>
      </ul>
      <h3 class="facts-title">BEYOND THE PLANETS</h3>
      <ul class="facts">
        <li><b>Asteroid belt</b> (grey dots): between Mars and Jupiter. All asteroids together weigh less than
          our Moon; the largest asteroid, Vesta, is about 530 km across.</li>
        <li><b>Dwarf planets</b>: Ceres (in the asteroid belt, the only one in the inner Solar System), Pluto,
          Haumea, Makemake and Eris.</li>
        <li><b>Kuiper Belt</b> (blue dots, zoom out or FIT): a doughnut of icy worlds beyond Neptune, home to Pluto
          and most dwarf planets, possibly millions of objects. New Horizons flew past Arrokoth there on
          1 January 2019.</li>
        <li><b>Heliosphere</b>: the bubble blown by the solar wind. Voyager 1 crossed its edge into interstellar
          space in 2012, Voyager 2 in 2018.</li>
        <li><b>Oort Cloud</b>: thought to lie far beyond the Kuiper Belt, the source of long-period comets.
          It has never been imaged directly.</li>
      </ul>
      <p class="note">Official sources: ${[
        link(`${NASA_SCIENCE}solar-system/`, 'NASA: Solar System'),
        link(`${NASA_SCIENCE}sun/facts/`, 'NASA: Sun facts'),
        link('https://nssdc.gsfc.nasa.gov/planetary/factsheet/', 'NASA Planetary Fact Sheet'),
        link(`${NASA_SCIENCE}solar-system/asteroids/`, 'NASA: asteroids'),
        link(`${NASA_SCIENCE}dwarf-planets/`, 'NASA: dwarf planets'),
        link(`${NASA_SCIENCE}solar-system/kuiper-belt/`, 'NASA: Kuiper Belt'),
        link(`${NASA_SCIENCE}solar-system/oort-cloud/`, 'NASA: Oort Cloud'),
        link(`${NASA_SCIENCE}mission/voyager/`, 'NASA: Voyager'),
        link('https://ssd.jpl.nasa.gov/', 'JPL Solar System Dynamics'),
        link('https://iauarchive.eso.org/public/naming/', 'IAU: naming'),
      ].join(' · ')}</p>`;
  }

  function showHome(updateHash = true) {
    selected = null;
    title.textContent = 'THE SOLAR SYSTEM';
    info.innerHTML = `
      <p class="big">★ YOU ARE HERE ★</p>
      <p>Our own system, about 26,700 light-years from the centre of the Milky Way. It isn't a pixel on
         the map because the map <em>is</em> the view from here: Kepler, trailing Earth around the Sun,
         stared at one patch of Cygnus and Lyra, and every star you can click is hundreds to thousands of
         light-years down that line of sight. Seen from Kepler-90, Earth would dim the Sun by just 0.008%
         for 13 hours once a year, so small that a Kepler looking back at us would most likely miss it.</p>
      ${planetTable(SOLAR)}
      ${homeFacts()}
      <p class="note">Found: known since antiquity, or the year it was discovered by telescope ·
        temperatures as the Kepler catalog would list them (no greenhouse effect: Venus is really
        ~464 °C) · planet sizes on the drawing are exaggerated; try TRUE SCALE to see how empty it
        really is · you found the easter egg!</p>`;
    setScene(buildScene(SOLAR));
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#Sun');
  }

  let selectToken = 0;   // a slow chunk load must not overwrite a newer selection
  function select(s, updateHash = true) {
    selected = s;
    const token = ++selectToken;
    withDetail(s, detail => {
      if (token !== selectToken) return;
      if (s[COL.drawn]) showSystem(s, detail); else showUnconfirmed(s, detail);
    }, () => { if (token === selectToken) showSoon(s); });
    if (token === selectToken && !DETAILS.has(s[COL.name])) {   // still loading
      title.textContent = s[COL.name].toUpperCase();
      info.innerHTML = '<p class="status">Loading…</p>';
    }
    keepInView(s);
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', String(c.dataset.name === s[COL.name])));
    if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(s[COL.name]));
  }

  function lookup(query, updateHash = true) {
    query = String(query).slice(0, MAX_QUERY);
    if (!query.trim()) return;
    if (HOME_QUERY.test(query.trim())) { showHome(updateHash); return; }
    if (ISS_QUERY.test(query.trim())) { showISS(updateHash); return; }
    if (CRAFT_QUERY.test(query.trim())) { showSpacecraft(updateHash); return; }
    const s = find(query);
    if (s) select(s, updateHash); else showUnknown(query);
  }

  // ---------------------------------------------------------------- easter eggs: spacecraft and the ISS
  // "spacecraft" / "JWST" / "Voyager" / "rovers"...: the Solar System frozen on one real date, with
  // the planets and humanity's spacecraft beyond Earth orbit where NASA JPL Horizons puts them
  // (scripts/fetch_spacecraft.py -> data/spacecraft.js, loaded only here). Earth-orbit satellites
  // are left out on purpose; "ISS" / "space station" opens the International Space Station instead.
  const CRAFT_QUERY = /^(spacecraft|space ?craft|probes?|space ?probes?|robots|missions|jwst|james webb( space telescope)?|webb|voyager( ?[12])?|new horizons|parker( solar probe)?|juno|europa clipper|rovers?|mars rovers?|curiosity|perseverance)$/i;
  const ISS_QUERY = /^(the )?(iss|international space station|space station)$/i;
  const CRAFT_SPOT = '#e8f4ff', CRAFT_LABEL = '#9fd8ff';

  let craftLoad = null;
  function loadCraft() {
    if (!craftLoad) {
      craftLoad = loadScript('data/spacecraft.js').then(() => window.STARMAP_SPACECRAFT);
      craftLoad.catch(() => { craftLoad = null; });
    }
    return craftLoad;
  }

  // Radius on screen for a distance from the Sun, matching the planets in either view mode.
  function screenRadius(sc, au) {
    return sview.mode === 'true' ? au * sc.pxPerAU * sview.zoom : sc.logR(au) * sview.zoom;
  }

  // Spacecraft as blinking crosses with labels that don't overlap (nearer the Sun wins).
  function drawCraft(sc, crafts, seconds) {
    const boxes = [];
    const free = (x, y, w) => !boxes.some(b => x < b[0] + b[2] + 2 && x + w + 2 > b[0] && Math.abs(y - b[1]) < 7);
    const marsCrew = crafts.filter(c => c.where === 'orbiting Mars');
    for (const c of crafts) {
      const R = screenRadius(sc, c.r_au), a = c.lon * Math.PI / 180;
      const x = Math.round(sc.cx + R * Math.cos(a)), y = Math.round(sc.cy + R * TILT * Math.sin(a));
      if (x < -2 || x > SW + 2 || y < -2 || y > SH - STRIP) continue;
      const on = REDUCED_MOTION || Math.sin(seconds * 4 + c.lon) > -0.5;
      sctx.fillStyle = on ? CRAFT_SPOT : '#6f86a8';
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sctx.fillRect(x + dx, y + dy, 1, 1);
      const label = c.where === 'orbiting Mars' ? (c === marsCrew[0] ? `${marsCrew.length} ORBITERS` : null) : c.label;
      if (!label) continue;
      const w = textWidth(label), lx = x + 3, ly = y - 7;
      if (lx + w < SW && ly > 0 && free(lx, ly, w)) {
        pixelText(sctx, label, lx, ly, CRAFT_LABEL);
        boxes.push([lx, ly, w]);
      }
    }
  }

  function craftTable(data) {
    const delay = min => (min < 1 ? `${fmt(min * 60)} s` : min < 120 ? `${fmt(min)} min` : `${fmt(min / 60, 1)} h`);
    const rows = [...data.spacecraft].sort((a, b) => b.r_au - a.r_au).map(c => `
      <tr><td><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a></td>
        <td>${esc(c.where)}</td><td class="num">${fmt(c.r_au, c.r_au < 10 ? 2 : 0)}</td>
        <td class="num">${delay(c.light_min)}</td><td class="num">${esc(c.launched)}</td><td>${esc(c.agency)}</td></tr>`).join('');
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>Spacecraft</th><th>Where</th><th class="num">From the Sun (AU)</th>
          <th class="num">Signal delay</th><th class="num">Launched</th><th>Agency</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  function showSpacecraft(updateHash = true) {
    selected = null;
    const token = ++selectToken;
    title.textContent = 'SPACECRAFT';
    info.innerHTML = '<p class="status">Loading positions…</p>';
    if (updateHash) history.replaceState(null, '', '#Spacecraft');
    loadCraft().then(data => {
      if (token !== selectToken) return;
      const rovers = data.rovers.map(r => `<li><b><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></b>
        (${esc(r.agency)}): landed in ${esc(r.site)} on ${esc(r.landed)}${r.note ? `; ${esc(r.note)}` : ''}.</li>`).join('');
      info.innerHTML = `
        <p class="big">★ HUMANITY'S ROBOTS ★</p>
        <p>Where our spacecraft beyond Earth orbit were on <b>${esc(data.date)}</b>, from NASA JPL's Horizons system
           (the planets are frozen at their real positions that day too). White crosses on the drawing; press FIT to
           zoom out to the Voyagers, or TRUE SCALE and zoom into Earth to find the telescopes at L1 and L2.
           Satellites orbiting Earth are left out; try searching <b>ISS</b>.</p>
        ${craftTable(data)}
        <h3 class="facts-title">ON MARS</h3>
        <ul class="facts">${rovers}</ul>
        <p class="note">Signal delay = how long radio (light) takes to travel between Earth and the spacecraft ·
          sources: ${esc(data.source)}, NASA and ESA mission pages · you found an easter egg!</p>`;
      const sc = buildScene({ ...SOLAR, planets: SOLAR.planets.map(p => ({ ...p, ecc: 0 })) });
      sc.planets.forEach((p, i) => {   // real positions on that date: ecliptic longitude, circular orbits
        const lon = data.planets[SOLAR.planets[i].name]?.lon ?? 0;
        Object.assign(p, { phase: lon * Math.PI / 180, cosw: 1, sinw: 0 });
      });
      sc.frozen = true;
      sc.overlay = seconds => drawCraft(sc, data.spacecraft, seconds);
      sc.reach = () => Math.max(...data.spacecraft.map(c => screenRadius(sc, c.r_au)));
      setScene(sc);
    }, () => { if (token === selectToken) info.innerHTML = '<p>Spacecraft positions could not be loaded; check your connection.</p>'; });
  }

  // The International Space Station: a pixel Earth with the station on a to-scale orbit (sped up).
  const EARTH_R_PX = 34, ISS_ALT_KM = 400, EARTH_KM = 6371, ISS_ORBIT_S = 12;   // 92-minute orbit in 12 s
  function drawISS(seconds) {
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 70; k++) {
      sctx.fillStyle = k % 7 === 0 ? '#4a5590' : '#1e2550';
      sctx.fillRect(Math.floor(hash('bg' + k) * SW), Math.floor(hash('y' + k) * SH), 1, 1);
    }
    const t = REDUCED_MOTION ? 0 : seconds, cx = CX, cy = Math.round(SH / 2);
    const R = EARTH_R_PX * (EARTH_KM + ISS_ALT_KM) / EARTH_KM;     // the orbit really is this close
    const tiltOrbit = 0.45, turn = -0.35;
    const at = th => {
      const x = R * Math.cos(th), y = R * tiltOrbit * Math.sin(th);
      return [cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn), Math.sin(th) < 0];
    };
    const theta = (t / ISS_ORBIT_S) * 2 * Math.PI;
    const orbit = (behind) => {
      sctx.fillStyle = '#3a4888';
      for (let k = 0; k < 120; k += 2) {
        const [x, y, back] = at((k / 120) * 2 * Math.PI);
        if (back === behind && (!back || Math.hypot(x - cx, y - cy) > EARTH_R_PX + 0.5)) sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    };
    const station = (x, y) => {
      x = Math.round(x); y = Math.round(y);
      sctx.fillStyle = '#5d7bd6';                       // solar arrays
      sctx.fillRect(x - 4, y - 1, 3, 3); sctx.fillRect(x + 2, y - 1, 3, 3);
      sctx.fillStyle = '#e6e6e6';                       // truss and modules
      sctx.fillRect(x - 1, y, 3, 1); sctx.fillRect(x, y - 1, 1, 3);
    };
    const [ix, iy, behind] = at(theta);
    const hidden = behind && Math.hypot(ix - cx, iy - cy) <= EARTH_R_PX + 1;
    orbit(true);
    if (behind && !hidden) station(ix, iy);
    solarPlanet(sctx, cx, cy, { art: 'earth', size: EARTH_R_PX, seed: 'iss', noMoon: true }, -0.9, -0.3, t * 0.4);
    orbit(false);
    if (!behind) station(ix, iy);
    if (!hidden) pixelText(sctx, 'ISS', Math.round(ix) + 6, Math.round(iy) - 8, '#ffd34d');
    pixelText(sctx, 'ORBIT 92 MIN', 4, SH - 9, '#5a6a8a');
  }

  function showISS(updateHash = true) {
    selected = null;
    ++selectToken;
    title.textContent = 'INTERNATIONAL SPACE STATION';
    info.innerHTML = `
      <p class="big">★ PEOPLE LIVE UP HERE ★</p>
      <p>The International Space Station, drawn to scale: its orbit is only about 400 km above the ground, so close it
         almost touches the pixel Earth. The animation is sped up about 460 times.</p>
      <ul class="facts">
        <li>Continuously crewed since <b>November 2000</b>.</li>
        <li>Built and run by <b>five space agencies from 15 countries</b>: NASA, Roscosmos, ESA, JAXA and CSA.</li>
        <li>Circles Earth about every <b>90 minutes</b>, <b>16 times a day</b>, at about five miles (8 km) per second.</li>
        <li><b>109 m</b> end to end (about a football field) and about <b>420 tonnes</b>.</li>
        <li>You can see it with your own eyes: it's the brightest moving "star" after sunset or before dawn.</li>
      </ul>
      <p>${['https://www.nasa.gov/international-space-station/|NASA: the space station',
            'https://spotthestation.nasa.gov/|NASA Spot the Station: when it passes over you']
        .map(s => s.split('|')).map(([u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`).join(' · ')}</p>
      <p class="note">Sources: NASA space station facts and figures · the orbit shown is illustrative, not the
        live position · you found an easter egg!</p>`;
    setScene({ custom: drawISS });
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#ISS');
  }

  // ---------------------------------------------------------------- wiring
  const input = document.getElementById('query');
  const suggest = document.getElementById('suggest');
  document.getElementById('search').addEventListener('submit', e => {
    e.preventDefault();
    closeSuggestions();
    lookup(input.value);
  });

  // Type-ahead: system names and KOI numbers, spotlight and drawn systems first.
  const searchIndex = STARS.map(s => ({
    s,
    keys: [s[COL.name].toLowerCase(), ...(s[COL.koi] != null ? [`koi-${s[COL.koi]}`] : [])],
    rank: s[COL.spot] ? 0 : s[COL.drawn] ? 1 : 2,
  }));
  let options = [], active = -1;

  function closeSuggestions() {
    suggest.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    options = []; active = -1;
  }

  function showSuggestions() {
    let q = input.value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (/^koi\s*\d/.test(q)) q = q.replace(/^koi\s*-?\s*/, 'koi-');
    if (/^kepler\s*\d/.test(q)) q = q.replace(/^kepler\s*-?\s*/, 'kepler-');
    if (q.length < 2) { closeSuggestions(); return; }
    const starts = [], contains = [];
    for (const item of searchIndex) {
      if (item.keys.some(k => k.startsWith(q))) starts.push(item);
      else if (item.keys.some(k => k.includes(q))) contains.push(item);
    }
    const byRank = (a, b) => a.rank - b.rank ||
      a.s[COL.name].localeCompare(b.s[COL.name], 'en', { numeric: true });
    options = [...starts.sort(byRank), ...contains.sort(byRank)].slice(0, 8).map(item => item.s);
    if (!options.length) { closeSuggestions(); return; }
    active = -1;
    suggest.innerHTML = options.map((s, i) => `
      <li role="option" id="opt-${i}" data-i="${i}">${esc(s[COL.name])}
        <span>${s[COL.koi] != null && !s[COL.name].startsWith('KOI') ? `KOI-${fmt(s[COL.koi])} · `.replace(/,/g, '') : ''}${
          s[COL.drawn] ? plural(s[COL.np], 'planet') : plural(s[COL.np], 'candidate')}</span></li>`).join('');
    suggest.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function setActive(i) {
    active = (i + options.length) % options.length;
    prefetch(options[active]);
    suggest.querySelectorAll('li').forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', `opt-${active}`);
  }

  function choose(s) {
    input.value = s[COL.name];
    closeSuggestions();
    select(s);
  }

  input.addEventListener('input', showSuggestions);
  input.addEventListener('keydown', e => {
    if (suggest.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(options[active]); }
    else if (e.key === 'Escape') closeSuggestions();
  });
  input.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
  suggest.addEventListener('mousedown', e => {   // mousedown fires before the input's blur
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); choose(options[Number(li.dataset.i)]); }
  });

  // Surprise me: a random drawn system.
  const drawnStars = STARS.filter(s => s[COL.drawn]);
  document.getElementById('random').addEventListener('click', () => {
    choose(drawnStars[Math.floor(Math.random() * drawnStars.length)]);
  });

  // Highlight toggles under the map.
  const highlightBox = document.getElementById('highlights');
  for (const [key, [name]] of Object.entries(HIGHLIGHTS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.key = key;
    b.setAttribute('aria-pressed', 'false');
    b.textContent = `${name} (${fmt(highlightSets[key].size)})`;
    b.addEventListener('click', () => {
      highlight = highlight === key ? null : key;
      highlightBox.querySelectorAll('button').forEach(x =>
        x.setAttribute('aria-pressed', String(x.dataset.key === highlight)));
      renderBase();
    });
    highlightBox.appendChild(b);
  }
  const board = document.createElement('button');
  board.type = 'button'; board.className = 'chip'; board.textContent = '🏆 next planets';
  board.addEventListener('click', showLeaderboard);
  highlightBox.appendChild(board);

  const chips = document.getElementById('chips');
  for (const name of SPOTLIGHT) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = name; b.dataset.name = name;
    b.addEventListener('click', () => { input.value = name; lookup(name); });
    chips.appendChild(b);
  }

  document.getElementById('legend-sg').hidden = !DATA.scored;
  document.getElementById('exported').textContent = `Exported ${DATA.exported}.`;

  function fromHash() {
    let q;
    try {
      q = decodeURIComponent(location.hash.slice(1)).slice(0, MAX_QUERY);
    } catch {
      return;   // malformed %-escape in a hand-edited link: ignore it
    }
    const [name, query = ''] = q.split('?');
    const params = new URLSearchParams(query);
    pendingView = { view: params.get('view'), zoom: params.get('zoom'), edge: params.get('edge') };
    if (name) { input.value = name; lookup(name, false); }
  }
  window.addEventListener('hashchange', fromHash);
  renderBase();
  fromHash();

  // ---------------------------------------------------------------- animation loop
  // Power savers: the system view runs at 30 fps (pixel art looks the same), the map at ~8 fps;
  // a canvas scrolled out of sight isn't drawn; with both out of sight, or after a few idle minutes,
  // the loop stops completely and the last frame stays on screen. Any interaction wakes it.
  // (Browsers already pause it in hidden tabs.)
  const MAP_MS = 120, IDLE_MS = 3 * 60 * 1000;
  let SYSTEM_MS = 1000 / 30;   // Animation menu: 60 / 30 / 15 fps, or off (one still frame per change)
  const fpsMenu = document.getElementById('fps');
  fpsMenu.addEventListener('change', () => {
    const fps = Number(fpsMenu.value);
    SYSTEM_MS = fps ? 1000 / fps : Infinity;
    wake();
  });
  const onScreen = new Map([[map, true], [sys, true]]);
  let lastMap = 0, lastSys = 0, lastActive = performance.now(), running = false;

  function frame(now) {
    const visible = onScreen.get(map) || onScreen.get(sys);
    if (!visible || now - lastActive > IDLE_MS) { running = false; return; }
    if (SYSTEM_MS === Infinity) {   // animation off: draw the current state once, then sleep until something changes
      drawMap(now);
      drawSystem(0);
      running = false;
      return;
    }
    if (onScreen.get(map) && now - lastMap >= MAP_MS) { drawMap(now); lastMap = now; }
    if (onScreen.get(sys) && now - lastSys >= SYSTEM_MS) { drawSystem(now / 1000); lastSys = now; }
    requestAnimationFrame(frame);
  }
  function wake() {
    lastActive = performance.now();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  for (const evt of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'focusin']) {
    window.addEventListener(evt, wake, { passive: true, capture: true });
  }
  // Browsers may throw away the pixels of off-screen canvases (our cached layers) while the tab is
  // in the background or after a graphics reset; the cached layers are then blank. Redraw them
  // whenever the page comes back, or the browser says it restored a canvas. Cheap: a few ms.
  function refreshLayers() {
    renderBase();
    if (liveScene()) layout();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    refreshLayers();
    wake();
  });
  window.addEventListener('pageshow', e => { if (e.persisted) { refreshLayers(); wake(); } });
  for (const canvas of [map, sys, base]) canvas.addEventListener('contextrestored', () => { refreshLayers(); wake(); });
  window.addEventListener('hashchange', wake);
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver(entries => {
      for (const e of entries) onScreen.set(e.target, e.isIntersecting);
      if (onScreen.get(map) || onScreen.get(sys)) wake();
    });
    watcher.observe(map);
    watcher.observe(sys);
  }
  drawMap(0);
  drawSystem(0);
  wake();
})();
