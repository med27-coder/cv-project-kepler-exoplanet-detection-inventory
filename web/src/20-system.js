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
  X: '101101010101101', Z: '111001010100111', '?': '111001011000010', '%': '101001010100101', '-': '000000111000000', '/': '001001010100100',
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
    companion: (detail.nstars ?? 1) > 1 && !detail.cb,
    binary: Boolean(detail.cb),   // planets circling both stars of a binary
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
    // overview: the closest pass lands where the real one would on the log scale (else Pluto's
    // would reach Jupiter) and stays off the star sprite; true scale: real eccentricity
    const logE = p.ecc ? clamp(1 - sc.logR(p.a * (1 - p.ecc)) / sc.logR(p.a), 0, p.ecc) : 0;
    p.e = truth ? p.ecc : Math.min(logE, Math.max(0, 1 - (sc.starR + 4) / p.rx));
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
// Two stars orbiting each other, with the planets circling both ("Tatooine"). NASA's table describes the
// main star; the second one's size and colour are illustrative. When one passes in front of the other the
// light dips: that is how Kepler found these systems. Returns the brightness left (1 = no eclipse).
function drawBinary(t, dim) {
  const sc = scene, keep = { cx: sc.cx, cy: sc.cy, starR: sc.starR, starColor: sc.starColor, teff: sc.teff };
  const a = (REDUCED_MOTION ? 1 : t) * 0.9, sep = Math.max(7, keep.starR * 1.8);
  const teffB = (keep.teff ?? 5000) * 0.72;
  const A = { x: keep.cx - 0.36 * sep * Math.cos(a), y: keep.cy - 0.36 * sep * TILT * Math.sin(a),
              r: Math.max(2, Math.round(keep.starR * 0.8)), c: keep.starColor, teff: keep.teff, z: -Math.sin(a), light: 0.75 };
  const B = { x: keep.cx + 0.64 * sep * Math.cos(a), y: keep.cy + 0.64 * sep * TILT * Math.sin(a),
              r: Math.max(2, Math.round(keep.starR * 0.55)), c: starColor(teffB), teff: teffB, z: Math.sin(a), light: 0.25 };
  const [back, front] = [A, B].sort((p, q) => p.z - q.z);
  for (const s of [back, front]) {
    Object.assign(sc, { cx: Math.round(s.x), cy: Math.round(s.y), starR: s.r, starColor: s.c, teff: s.teff });
    drawStar(t, dim);
  }
  Object.assign(sc, keep);
  const gap = Math.hypot(back.x - front.x, (back.y - front.y) / Math.max(TILT, 0.05));
  const covered = Math.max(0, Math.min(1, (back.r + front.r - gap) / (2 * back.r)));
  return 1 - 0.6 * covered * back.light;
}

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
      if (!REDUCED_MOTION) achieve('flare');   // caught it (48-gallery.js)
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
  if (scene.binary) flux *= drawBinary(t, 0.75 + 0.25 * flux);
  else drawStar(t, 0.75 + 0.25 * flux);
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
