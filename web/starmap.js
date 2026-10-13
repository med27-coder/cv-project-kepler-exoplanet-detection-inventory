// Kepler Star Map: pixel map of the Kepler field + pixel-art star systems.
// Data comes from data/systems.js (scripts/export_starmap.py). Everything is drawn
// procedurally on two small canvases, so a system costs a few numbers, not an image.
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
  const SYSTEMS = DATA.systems;
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
  const starIndex = new Map(STARS.map((s, i) => [s, i]));

  // Colour of each star: drawn systems bright, "soon" systems dim, scored candidates by verdict.
  const starColors = STARS.map(s => {
    const mag = s[COL.kepmag] ?? 15;
    const light = Math.round(255 - Math.min(Math.max(mag - 9, 0), 8) * 14);   // brighter = lower mag
    const hasConfirmed = SYSTEMS[s[COL.name]]?.planets.some(p => p.status === 'confirmed');
    if (s[COL.sg] != null && !hasConfirmed) return s[COL.sg] >= SG_THRESHOLD ? MAP_COLORS.likely : MAP_COLORS.unlikely;
    if (s[COL.drawn]) return `rgb(${light - 30},${light - 15},${light})`;
    return `rgb(${light * 0.35 | 0},${light * 0.4 | 0},${light * 0.55 | 0})`;
  });

  // Highlights: light up the systems that match, dim the rest. Candidates count only once
  // Star Gazer calls them planets.
  const isPlanet = p => p.status !== 'candidate' || p.sg_planet === true;
  const HIGHLIGHTS = {
    hz: ['habitable zone', d => {
      const hz = habitableZone(d);
      return Boolean(hz) && d.planets.some(p => isPlanet(p) && p.sma >= hz[0] && p.sma <= hz[1]);
    }],
    earth: ['Earth-sized', d => d.planets.some(p => isPlanet(p) && p.radius >= 0.7 && p.radius <= 1.5)],
    multi: ['5+ planets', d => d.planets.filter(isPlanet).length >= 5],
    giant: ['giant planets', d => d.planets.some(p => isPlanet(p) && p.radius >= 6)],
  };
  const highlightSets = Object.fromEntries(Object.entries(HIGHLIGHTS).map(([key, [, test]]) =>
    [key, new Set(STARS.filter(s => SYSTEMS[s[COL.name]] && test(SYSTEMS[s[COL.name]])))]));
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
    const state = s[COL.drawn] ? '' : ' · soon';
    return `${s[COL.name]}${koi} · ${s[COL.kois]} KOI${s[COL.kois] > 1 ? 's' : ''}${s[COL.spot] ? ' ★' : ''}${state}`;
  }

  // ---------------------------------------------------------------- system view
  const sys = document.getElementById('system');
  const sctx = sys.getContext('2d');
  const STRIP = 22;   // light-curve strip along the bottom
  const SW = sys.width, SH = sys.height, CX = SW / 2, CY = Math.round((SH - STRIP) / 2), TILT = 0.42;
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
        sprite: planetSize(p.radius),
        look: planetLook(p),
        pal: [shade(color, 0.45), color, shade(color, 1.45), shade(color, 0.75)],   // shadow, base, lit, band
        kind: p.status,
        speed: (2 * Math.PI) / (1.5 * Math.sqrt(p.period ?? 10)),   // radians per second
        phase: hash(p.koi) * 2 * Math.PI,
        seed: p.koi,
      };
    });
    const reach = Math.max(...planets.map(p => p.a * (1 + p.ecc)));
    return {
      spriteR, srad: detail.srad ?? 1,
      starColor: starColor(detail.teff),
      companion: (detail.nstars ?? 1) > 1,
      hzAU: hz, hzLog: hz && hz.map(logR), earthLog: logR(1), home: Boolean(detail.home),
      pxPerAU: rMax / reach,   // true scale at zoom 1: the farthest planet just fits
      curve: [],
      planets,
    };
  }

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
      sc.starR = sc.spriteR;
      sc.hz = sc.hzLog && sc.hzLog.map(r => r * z);
      sc.earth = sc.earthLog * z;
    }
    for (const p of sc.planets) {
      p.rx = truth ? p.a * px : p.logR * z;
      const trueSize = (p.radius ?? 1) * AU_PER_REARTH * px;
      p.size = truth ? Math.min(40, Math.max(p.sprite, Math.round(trueSize))) : p.sprite;
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
      const ly = Math.round(cy - sc.earth * TILT) - 7;
      if (ly > 1 && cx > 10 && cx < SW - 10) pixelText(c, 'EARTH', Math.round(cx - 9), ly, '#7f8fb0');
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
  }

  // The star: dithered glow, limb darkening (edge darker than the middle), a slow sparkle.
  function drawStar(t, dim) {
    const r = Math.round(scene.starR), c = scene.starColor, cx = scene.cx, cy = scene.cy;
    if (cx + r < -4 || cx - r > SW + 4 || cy + r < -4 || cy - r > SH - STRIP + 4) return;
    if (r <= 40) {
      sctx.fillStyle = shade(c, 0.35 * dim);
      for (let dy = -r - 3; dy <= r + 3; dy++) {
        for (let dx = -r - 3; dx <= r + 3; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r + 0.5 && d < r + 3.2 && ((dx + dy) & 1) === 0) sctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
    disc(sctx, cx, cy, r, shade(c, 0.78 * dim));
    disc(sctx, cx, cy, Math.max(1, r - 1 - Math.floor(r / 12)), shade(c, dim));
    disc(sctx, cx - 1, cy - 1, Math.max(1, Math.round(r * 0.45)), shade(c, 1.35 * dim));
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
    sctx.drawImage(scene.layer, 0, 0);
    const t = REDUCED_MOTION ? 0 : seconds;
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
      if (b.p.kind === 'candidate') hollow(sctx, b.x, b.y, s + 0.5, b.p.pal[1]);
      else if (b.p.kind === 'other') diamond(sctx, b.x, b.y, s, b.p.pal[1]);
      else shadedPlanet(sctx, b.x, b.y, b.p, dx / d, dy / d);
      if (b.depth > 0) {   // transiting: a white tick above the planet
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(Math.round(b.x), Math.round(b.y) - s - 3, 1, 2);
      }
    };
    bodies.filter(b => b.behind).forEach(drawPlanet);
    drawStar(t, 0.75 + 0.25 * flux);
    bodies.filter(b => !b.behind).forEach(drawPlanet);
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

  function setScene(next) {   // a new system: reset the view, keep the chosen scale mode
    scene = next;
    Object.assign(sview, { zoom: 1, panX: 0, panY: 0 });
    const live = Boolean(scene && !scene.mystery);
    sysTools.hidden = !live;
    sys.classList.toggle('interactive', live);
    if (live) layout();
  }

  function setSysZoom(zoom, anchor) {   // anchor: canvas point that stays put (default: the star)
    if (!scene || scene.mystery) return;
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
    if (!scene || scene.mystery) return;
    Object.assign(sview, { zoom: 1, panX: 0, panY: 0 });
    layout();
    const reach = Math.max(...scene.planets.map(p => p.rx * (1 + p.e)), scene.hz ? scene.hz[1] : 0);
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
    if (!scene || scene.mystery) return;
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
    if (!scene || scene.mystery) return;
    const dir = e.deltaY < 0 ? 1 : -1;
    if (dir < 0 && sview.zoom <= SVIEW_ZOOM[sview.mode][0]) return;   // fully out: let the page scroll
    e.preventDefault();
    setSysZoom(sview.zoom * 1.25 ** dir, sysPoint(e));
  }, { passive: false });
  sys.addEventListener('keydown', e => {
    if (!scene || scene.mystery) return;
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
    if (scene && !scene.mystery) { Object.assign(sview, { zoom: 1, panX: 0, panY: 0 }); layout(); }
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
        <td><span class="dot ${cls}"></span>${esc(p.name)}${tess}${ecc}</td>
        <td class="num">${fmt(p.radius, 1)}</td>
        <td class="num">${mass}</td>
        <td class="num">${fmt(p.period, 1)}</td>
        <td class="num">${fmt(p.teq)}</td>
        <td class="num">${p.insol == null ? '-' : fmt(p.insol, p.insol < 10 ? 2 : 0)}</td>
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
      <p class="note">~ mass estimated from size · green band = habitable zone (approx.) · bottom strip = the
        star's brightness as Kepler sees it: it dips when a planet crosses in front (dips exaggerated) ·
        planet looks are a guess from size and temperature · Kepler ID ${esc(detail.kepid)}</p>`;
    wireSkyThumbs();
    setScene(buildScene(detail));
  }

  function showSoon(s) {
    title.textContent = s[COL.name].toUpperCase();
    const line = SOON[Math.floor(hash(s[COL.name]) * SOON.length)];
    info.innerHTML = `
      <p class="big">✦ ${esc(line.toUpperCase())} ✦</p>
      <div class="head">${skyThumb(s[COL.ra], s[COL.dec])}
      <p>${esc(label(s))}. Only unconfirmed candidates orbit this star, so its pixel portrait is still in the hangar
         until Star Gazer has scored them.</p></div>
      <p>${skyLink(s[COL.ra], s[COL.dec])} · ${fmt(Object.keys(SYSTEMS).length)} systems are already drawn; try one above.</p>`;
    wireSkyThumbs();
    setScene({ mystery: true });
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
  // Our own Solar System, drawn by the same engine. Not on the map (the map is the view from
  // here) and not in the type-ahead: search "Sun", "Solar System", "Earth" or "home" to find it.
  // Values: NASA Planetary Fact Sheet. Temperatures are equilibrium temperatures worked out the
  // way the Kepler catalog does (Bond albedo 0.3: 255 K / sqrt(AU)), so colours compare fairly.
  const HOME_QUERY = /^(the )?(sun|sol|solar system|earth|home|you are here)$/i;
  const SOLAR = {
    home: true, teff: 5772, srad: 1, smass: 1, age: 4.6, met: 0, spectype: 'G2 V',
    planets: [
      ['Mercury', 0.383, 0.0553, 87.97, 0.387, 0.206, 'antiquity'],
      ['Venus', 0.949, 0.815, 224.7, 0.723, 0.007, 'antiquity'],
      ['Earth', 1, 1, 365.25, 1, 0.017, 'here'],
      ['Mars', 0.532, 0.107, 687.0, 1.524, 0.094, 'antiquity'],
      ['Jupiter', 11.21, 317.8, 4331, 5.203, 0.049, 'antiquity'],
      ['Saturn', 9.45, 95.2, 10747, 9.537, 0.052, 'antiquity'],
      ['Uranus', 4.01, 14.5, 30589, 19.19, 0.047, 1781],
      ['Neptune', 3.88, 17.1, 59800, 30.07, 0.010, 1846],
    ].map(([name, radius, mass, period, sma, ecc, year]) => ({
      name, koi: 'Sol ' + name, status: 'confirmed', radius, mass, mass_kind: 'measured', period, sma, ecc,
      teq: Math.round(255 / Math.sqrt(sma)), insol: 1 / sma ** 2, year,
      note: name === 'Earth' ? 'home ★' : 'planet',
    })),
  };

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
      <p>Star: ${starLine(SOLAR)} · <a href="https://science.nasa.gov/solar-system/" target="_blank"
         rel="noopener noreferrer">NASA: our Solar System ↗</a></p>
      ${planetTable(SOLAR)}
      <p class="note">Found: known since antiquity, or the year it was discovered by telescope ·
        temperatures as the Kepler catalog would list them (no greenhouse effect: Venus is really
        ~737 K) · try TRUE SCALE to see how empty it really is · you found the easter egg!</p>`;
    setScene(buildScene(SOLAR));
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#Sun');
  }

  function select(s, updateHash = true) {
    selected = s;
    const detail = SYSTEMS[s[COL.name]];
    if (detail) showSystem(s, detail); else showSoon(s);
    keepInView(s);
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', String(c.dataset.name === s[COL.name])));
    if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(s[COL.name]));
  }

  function lookup(query, updateHash = true) {
    query = String(query).slice(0, MAX_QUERY);
    if (!query.trim()) return;
    if (HOME_QUERY.test(query.trim())) { showHome(updateHash); return; }
    const s = find(query);
    if (s) select(s, updateHash); else showUnknown(query);
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
          s[COL.drawn] ? plural(SYSTEMS[s[COL.name]].planets.length, 'planet') : 'soon'}</span></li>`).join('');
    suggest.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function setActive(i) {
    active = (i + options.length) % options.length;
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
    if (q) { input.value = q; lookup(q, false); }
  }
  window.addEventListener('hashchange', fromHash);
  renderBase();
  fromHash();

  let last = 0;
  function frame(now) {
    if (now - last > 120) { drawMap(now); last = now; }   // map twinkle needs only ~8 fps
    drawSystem(now / 1000);
    requestAnimationFrame(frame);
  }
  drawMap(0);
  drawSystem(0);
  requestAnimationFrame(frame);
})();
