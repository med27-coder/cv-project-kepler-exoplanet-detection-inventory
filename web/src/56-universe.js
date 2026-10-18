// ---------------------------------------------------------------- the universe, in sectors (docs/plans/UNIVERSE_SECTORS.md)
// The UNIVERSE button swaps the map for a zoom-out ladder: Kepler's field (the map itself) -> the Sun's
// neighbourhood -> the Milky Way -> the Local Group -> Laniakea -> the observable universe. ◀ ▶ (or the arrow
// keys) step through it. Positions and distances are real where the text says so (sources in each sector's
// note); the Milky Way, Laniakea and the cosmic web are labelled illustrations. Now and then a flare drifts
// across: catch it, and it's an astronaut, lost in orbit (secret achievement).
const uniCanvas = document.getElementById('universe-view');
const uctx = uniCanvas.getContext('2d');
const UW = uniCanvas.width, UH = uniCanvas.height, UCX = UW / 2, UCY = UH / 2;
const LY_PC = 3.2616;   // light-years per parsec

// The Sun's neighbourhood: every star with confirmed planets within 4 parsecs (NASA Exoplanet Archive,
// pscomppars, queried 17 October 2026: name, RA, Dec in degrees, distance in parsecs, planets), plus the
// best-known nearby stars without confirmed planets (SIMBAD positions, rounded).
const NEAR_HOSTS = [
  ['PROXIMA', 217.393, -62.676, 1.301, 2], ['BARNARD', 269.449, 4.738, 1.827, 4], ['EPS ERIDANI', 53.228, -9.458, 3.203, 1],
  ['GJ 887', 346.503, -35.847, 3.287, 4], ['ROSS 128', 176.938, 0.799, 3.375, 1], ['GL 725 A', 280.683, 59.638, 3.521, 1],
  ['GJ 15 A', 4.613, 44.025, 3.562, 2], ['TAU CETI', 26.009, -15.934, 3.603, 3], ['EPS INDI', 330.871, -56.797, 3.639, 1],
  ['GJ 1061', 54.003, -44.514, 3.673, 3], ['YZ CETI', 18.133, -16.996, 3.712, 3], ['TEEGARDEN', 43.269, 16.865, 3.831, 3],
  ['KAPTEYN', 77.959, -45.043, 3.933, 1],
];
const NEAR_STARS = [   // no confirmed planets: name, RA, Dec, distance (pc), colour
  ['ALPHA CEN', 219.90, -60.83, 1.339, '#fff1b0'], ['WOLF 359', 164.12, 7.01, 2.41, '#ff8a5c'],
  ['LALANDE 21185', 165.83, 35.97, 2.55, '#ff8a5c'], ['SIRIUS', 101.29, -16.72, 2.64, '#cfe3ff'], ['PROCYON', 114.83, 5.22, 3.51, '#fff7e0'],
];
const KEPLER_FIELD = [290.67, 44.5];   // the field's centre (RA, Dec), in Cygnus and Lyra

// Local Group galaxies (McConnachie 2012, AJ 144, 4): galactic longitude, latitude (degrees), distance in
// millions of light-years. Seen from above the Milky Way's north pole.
const LOCAL_GROUP = [
  ['ANDROMEDA', 121.17, -21.57, 2.55, 7], ['TRIANGULUM', 133.61, -31.33, 2.64, 4], ['NGC 6822', 25.34, -18.40, 1.50, 2],
  ['IC 1613', 129.73, -60.58, 2.46, 2], ['LEO I', 225.99, 49.11, 0.83, 1], ['LMC', 280.47, -32.89, 0.166, 2],
  ['SMC', 302.80, -44.30, 0.209, 1], ['', 5.57, -14.17, 0.085, 1], ['', 121.15, -21.98, 2.64, 1], ['', 120.72, -21.14, 2.69, 1],
];

const SECTORS = [
  { name: "KEPLER'S FIELD", size: 'the map: stars out to a few thousand light-years',
    facts: 'Every pixel is a star Kepler watched, in Cygnus and Lyra. Half of them are within about 2,800 light-years (NASA, Gaia). Step out with ▶.' },
  { name: 'OUR NEIGHBOURHOOD', size: 'about 13 light-years around the Sun', draw: drawNeighbourhood,
    facts: 'The nearest stars, seen from above the sky\'s north pole, distances to scale. Ringed stars have confirmed planets (NASA Exoplanet Archive): Proxima Centauri b, 4.2 light-years away, is the closest known exoplanet. Even Voyager 1 would need about 75,000 years to get there. The dashed line points toward Kepler\'s field, hundreds of times farther away.' },
  { name: 'THE MILKY WAY', size: 'about 100,000 light-years across', draw: drawMilkyWay,
    facts: 'Our galaxy holds a few hundred billion stars. The Sun is about 26,700 light-years from the centre (GRAVITY 2019), in a small arm, the Orion Spur. Kepler\'s field is the tiny wedge: it looked a few thousand light-years along our arm. Illustration of the galaxy\'s shape (after NASA/JPL-Caltech): nobody has seen it from outside.' },
  { name: 'THE LOCAL GROUP', size: 'about 6 million light-years shown', draw: drawLocalGroup,
    facts: 'Our galaxy\'s family: the Milky Way and Andromeda, the two giants, with Triangulum and dozens of small galaxies. Distances to scale (McConnachie 2012); the galaxies are drawn far bigger than life. Andromeda, 2.5 million light-years away, is the farthest thing most people can see with their own eyes. It is falling toward us; recent studies give about even odds that the two galaxies merge in the next 10 billion years.' },
  { name: 'LANIAKEA', size: 'about 520 million light-years across', draw: drawLaniakea,
    facts: 'Our supercluster, mapped in 2014 by how galaxies move (Tully et al., Nature): about 100,000 galaxies flowing toward a region called the Great Attractor. Laniakea is Hawaiian for "immeasurable heaven". The Virgo Cluster, about 54 million light-years away, is the nearest large cluster. Illustration of the flows.' },
  { name: 'THE OBSERVABLE UNIVERSE', size: 'about 93 billion light-years across', draw: drawObservable,
    facts: 'Everything whose light has had time to reach us. The universe is 13.8 billion years old, but space has stretched while that light travelled, so the edge is now about 46 billion light-years away in every direction (Planck 2018). Galaxies gather along a cosmic web of filaments. At the edge glows the oldest light, the cosmic microwave background, from when the universe was 380,000 years old. Illustration.' },
];

let universeOn = false, sector = 1, lastUni = 0;
const sectorLayers = new Map();   // the parts of each sector that never change, drawn once
const uniButton = document.getElementById('universe'), uniNav = document.getElementById('uni-nav');
const uniTitle = document.getElementById('uni-title'), uniFacts = document.getElementById('uni-facts');
const uniPrev = document.getElementById('uni-in'), uniNext = document.getElementById('uni-out');
const mapLegend = map.closest('.panel').querySelector('.legend');

// ---- drawing helpers
const uniText = (ctx, text, x, y, color) => {   // pixel text on a dark backing, kept on the canvas
  const w = textWidth(text);
  x = Math.round(Math.min(Math.max(1, x), UW - w - 1)); y = Math.round(Math.min(Math.max(1, y), UH - 6));
  ctx.fillStyle = 'rgba(7, 11, 26, 0.75)';
  ctx.fillRect(x - 1, y - 1, w + 2, 7);
  pixelText(ctx, text, x, y, color);
};
function labeller(ctx) {
  const boxes = [];
  const free = (x, y, w, h) => !boxes.some(([bx, by, bw, bh]) => x < bx + bw && bx < x + w && y < by + bh && by < y + h);
  return {
    reserve: (x, y, r = 2) => boxes.push([x - r, y - r, 2 * r + 1, 2 * r + 1]),
    put: (text, x, y, colour, r = 2) => {   // r: the size of the thing labelled
      const w = textWidth(text) + 2, h = 7;
      for (const [dx, dy] of [[r + 2, -3], [-w - r - 1, -3], [-w / 2, -r - 9], [-w / 2, r + 2]]) {
        const lx = Math.round(clamp(x + dx, 1, UW - w - 1)), ly = Math.round(clamp(y + dy, 1, UH - h - 1));
        if (!free(lx, ly, w, h)) continue;
        boxes.push([lx, ly, w, h]);
        uniText(ctx, text, lx + 1, ly + 1, colour);
        return true;
      }
      return false;
    },
  };
}
function starfield(put, seed, n, colours = ['#3a4370', '#5a6a9a', '#8090c0']) {
  for (let k = 0; k < n; k++) put(Math.floor(hash(`${seed}x${k}`) * UW), Math.floor(hash(`${seed}y${k}`) * UH), colours[k % colours.length]);
}
const sectorLayer = i => {
  if (!sectorLayers.has(i)) sectorLayers.set(i, layer(UW, UH, (put, ctx) => { ctx.fillStyle = '#070b1a'; ctx.fillRect(0, 0, UW, UH); SECTORS[i].draw(put, ctx); }));
  return sectorLayers.get(i);
};
function dashedLine(put, x0, y0, x1, y1, colour, on = 2, off = 2) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let k = 0; k <= n; k++) if (k % (on + off) < on) put(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), colour);
}
function ring(put, cx, cy, r, colour, step = 3) {
  const n = Math.ceil(2 * Math.PI * r);
  for (let k = 0; k < n; k += step) put(Math.round(cx + r * Math.cos(k / r)), Math.round(cy + r * Math.sin(k / r)), colour);
}

// ---- 2: the Sun's neighbourhood (equatorial plane, seen from the north celestial pole)
function drawNeighbourhood(put, ctx) {
  starfield(put, 'nb', 60);
  const s = 84 / (4.0 * LY_PC);   // pixels per light-year: 4 parsecs to the edge
  const at = (ra, dec, pc) => {
    const d = pc * LY_PC * Math.cos(dec * Math.PI / 180) * s, a = ra * Math.PI / 180;
    return [UCX + d * Math.cos(a), UCY - d * Math.sin(a)];
  };
  const L = labeller(ctx);
  for (const ly of [5, 10]) {
    ring(put, UCX, UCY, ly * s, '#1e2a55');
    L.put(`${ly} LY`, UCX - 9, UCY + ly * s - 2, '#5a6a9a');
  }
  const a = KEPLER_FIELD[0] * Math.PI / 180;
  dashedLine(put, UCX, UCY, UCX + 90 * Math.cos(a), UCY - 90 * Math.sin(a), '#7a5cc0');
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [2, 0], [0, -1], [0, 2]]) put(UCX + dx, UCY + dy, '#ffd34d');
  const stars = [
    ...NEAR_HOSTS.map(([name, ra, dec, pc]) => ({ name, xy: at(ra, dec, pc), host: true })),
    ...NEAR_STARS.map(([name, ra, dec, pc, colour]) => ({ name, xy: at(ra, dec, pc), colour })),
  ];
  for (const { xy: [x, y], host, colour } of stars) {
    put(Math.round(x), Math.round(y), host ? '#ffb070' : colour);
    if (host) ring(put, Math.round(x), Math.round(y), 2.5, '#4fd17a', 1);
    else put(Math.round(x) + 1, Math.round(y), colour);
    L.reserve(Math.round(x), Math.round(y), host ? 3 : 1);
  }
  L.reserve(UCX, UCY, 2);
  L.put('SUN', UCX, UCY, '#ffd34d', 3);
  L.put('TO KEPLER', UCX + 62 * Math.cos(a), UCY - 62 * Math.sin(a), '#b56cff');
  const order = ['PROXIMA', 'ALPHA CEN', 'BARNARD', 'SIRIUS', 'TAU CETI', 'EPS ERIDANI', 'WOLF 359', 'PROCYON', 'TEEGARDEN',
                 'LALANDE 21185', 'ROSS 128', 'GJ 887', 'EPS INDI', 'KAPTEYN', 'YZ CETI', 'GJ 1061', 'GL 725 A', 'GJ 15 A'];
  for (const name of order) {   // the best-known first; a label that doesn't fit is left out
    const st = stars.find(x => x.name === name);
    if (st) L.put(name, st.xy[0], st.xy[1], st.host ? '#4fd17a' : '#9aa6b8', st.host ? 3 : 1);
  }
}

// ---- 3: the Milky Way from above its north pole (illustration; Sun and Kepler's view to scale)
const LY_PER_PX_MW = 50000 / 82;
function drawMilkyWay(put, ctx) {
  starfield(put, 'mw', 50, ['#2a3360', '#3a4370']);
  for (let k = 0; k < 2200; k++) {   // the disk between the arms: faint, thinning outward
    const a = hash(`da${k}`) * Math.PI * 2, r = 82 * hash(`dr${k}`) ** 0.75;
    put(Math.round(UCX + r * Math.cos(a)), Math.round(UCY - r * Math.sin(a)), r < 40 ? '#3a4a80' : '#2a3666');
  }
  // Trailing spiral arms (the galaxy turns clockwise seen from the north): log spirals, pitch about 12 degrees.
  const arms = [[0.3, 1, '#9fc4e8'], [Math.PI + 0.3, 1, '#9fc4e8'], [Math.PI / 2 + 0.6, 0.55, '#6a8cba'], [-Math.PI / 2 + 0.6, 0.55, '#6a8cba']];
  for (const [theta0, weight, colour] of arms) {
    for (let k = 0; k < 2600 * weight; k++) {
      const r = 9 + 72 * hash(`arm${theta0}${k}`) ** 0.8, theta = theta0 + Math.log(r / 9) / Math.tan(12 * Math.PI / 180) * 0.32;
      const spread = (hash(`sp${theta0}${k}`) - 0.5) * (2 + r * 0.09);
      const x = UCX + (r + spread) * Math.cos(theta), y = UCY - (r + spread) * Math.sin(theta);
      put(Math.round(x), Math.round(y), hash(`c${k}${theta0}`) < 0.12 ? '#ffd9e8' : colour);
    }
  }
  for (let k = 0; k < 1400; k++) {   // the bulge and bar, tilted about 27 degrees to the Sun-centre line
    const u = (hash(`bx${k}`) - 0.5) * 2, v = (hash(`by${k}`) - 0.5) * 2;
    if (u * u + v * v * 9 > 1) continue;
    const bx = u * 22, by = v * 22, t = (90 - 27) * Math.PI / 180;
    put(Math.round(UCX + bx * Math.cos(t) - by * Math.sin(t)), Math.round(UCY - bx * Math.sin(t) - by * Math.cos(t)), k % 5 ? '#fff1b0' : '#ffc93c');
  }
  const sunY = UCY + 26700 / LY_PER_PX_MW;   // the Sun, below the centre
  // Kepler's field: galactic longitude about 76 degrees (toward the turning direction, here to the left), about
  // 5,000 light-years deep for nine stars in ten: a wedge a few pixels long.
  const l = 76.3 * Math.PI / 180, len = Math.max(6, 5400 / LY_PER_PX_MW);
  for (let k = 1; k <= len; k++) for (let w = -k * 0.35; w <= k * 0.35; w += 0.5) {
    put(Math.round(UCX - Math.sin(l) * k - Math.cos(l) * w), Math.round(sunY - Math.cos(l) * k + Math.sin(l) * w), '#b56cff');
  }
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(UCX + dx, Math.round(sunY) + dy, '#ffd34d');
  uniText(ctx, 'SUN', UCX + 4, sunY + 2, '#ffd34d');
  uniText(ctx, 'KEPLER', UCX - 36, sunY - 9, '#b56cff');
  uniText(ctx, 'CENTRE', UCX - 11, UCY - 30, '#fff1b0');
}

// ---- 4: the Local Group (galactic coordinates from above the Milky Way's north pole; distances to scale)
function drawLocalGroup(put, ctx) {
  starfield(put, 'lg', 40, ['#2a3360', '#3a4370']);
  const s = 82 / 3.0;   // pixels per million light-years
  const at = (l, b, d) => { const r = d * Math.cos(b * Math.PI / 180) * s, a = l * Math.PI / 180; return [UCX - r * Math.sin(a), UCY - r * Math.cos(a)]; };
  const L = labeller(ctx);
  for (const mly of [1, 2, 3]) {
    ring(put, UCX, UCY, mly * s, '#1e2a55');
    if (mly < 3) L.put(`${mly} MLY`, UCX - 12, UCY + mly * s - 2, '#5a6a9a');
  }
  const galaxy = (x, y, r, tilt, colour, core) => {
    for (let k = 0; k < r * r * 9; k++) {
      const a = hash(`g${x}${k}`) * Math.PI * 2, d = r * hash(`h${y}${k}`) ** 0.7;
      const gx = d * Math.cos(a), gy = d * Math.sin(a) * tilt;
      put(Math.round(x + gx), Math.round(y + gy), d < r * 0.35 ? core : colour);
    }
  };
  galaxy(UCX, UCY, 4, 1, '#9fc4e8', '#fff1b0');
  L.reserve(UCX, UCY, 4);
  const placed = LOCAL_GROUP.map(([name, l, b, d, size]) => {
    const [x, y] = at(l, b, d);
    if (size >= 4) galaxy(x, y, size, 0.45, '#9fc4e8', '#fff1b0');
    else if (size >= 2) galaxy(x, y, size, 0.8, '#7f95c8', '#d6e8f8');
    else put(Math.round(x), Math.round(y), '#9fc4e8');
    L.reserve(Math.round(x), Math.round(y), size);
    return [name, x, y, size];
  });
  L.put('MILKY WAY', UCX, UCY, '#ffd34d', 5);
  for (const [name, x, y, size] of placed) if (name && !['LMC', 'SMC'].includes(name)) L.put(name, x, y, '#c8d0ff', size + 1);
  L.put('MAGELLANIC CLOUDS', UCX - 4, UCY - 6, '#c8d0ff');
}

// ---- 5: Laniakea (illustration: galaxies streaming toward the Great Attractor)
function drawLaniakea(put, ctx) {
  const gax = UCX + 18, gay = UCY + 8;   // the Great Attractor
  for (let k = 0; k < 520; k++) {   // flow lines: start on the basin's edge, curl inward
    let x = UCX + Math.cos(k * 2.399) * 88 * (0.55 + 0.45 * hash(`la${k}`)), y = UCY + Math.sin(k * 2.399) * 80 * (0.55 + 0.45 * hash(`lb${k}`));
    for (let step = 0; step < 60; step++) {
      const dx = gax - x, dy = gay - y, d = Math.hypot(dx, dy);
      if (d < 3) break;
      x += dx / d * 1.3 - dy / d * 0.35; y += dy / d * 1.3 + dx / d * 0.35;
      if (step % 3 === 0) put(Math.round(x), Math.round(y), step < 20 ? '#2a3a70' : step < 40 ? '#3f5aa0' : '#6a8ad0');
    }
  }
  for (let k = 0; k < 160; k++) {   // galaxies along the streams
    const a = hash(`lg${k}`) * Math.PI * 2, r = 85 * hash(`lr${k}`) ** 0.6;
    put(Math.round(UCX + r * Math.cos(a)), Math.round(UCY + r * Math.sin(a) * 0.92), k % 4 ? '#c8d0ff' : '#fff1b0');
  }
  for (let k = 0; k < 30; k++) put(Math.round(gax + (hash(`ga${k}`) - 0.5) * 9), Math.round(gay + (hash(`gb${k}`) - 0.5) * 7), '#ffd9a0');
  const lgx = UCX - 46, lgy = UCY - 22, s = 170 / 520;   // the Local Group, and Virgo about 54 million light-years away
  for (let k = 0; k < 24; k++) put(Math.round(lgx + 54 * s + (hash(`v${k}`) - 0.5) * 6), Math.round(lgy + (hash(`w${k}`) - 0.5) * 5), '#fff1b0');
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(lgx + dx, lgy + dy, '#ffd34d');
  uniText(ctx, 'YOU ARE HERE', lgx - 22, lgy - 9, '#ffd34d');
  uniText(ctx, 'VIRGO', lgx + 54 * s - 8, lgy + 5, '#fff1b0');
  uniText(ctx, 'GREAT ATTRACTOR', gax - 28, gay + 7, '#ffd9a0');
  ring(put, UCX, UCY, 89, '#3a2a7a', 4);
}

// ---- 6: the observable universe (illustration: the cosmic web, the oldest light at the edge)
function drawObservable(put, ctx) {
  const R = 86, nodes = [];
  for (let k = 0; k < 120; k++) {
    const a = hash(`on${k}`) * Math.PI * 2, r = R * 0.92 * Math.sqrt(hash(`or${k}`));
    nodes.push([UCX + r * Math.cos(a), UCY + r * Math.sin(a)]);
  }
  for (const [i, [x0, y0]] of nodes.entries()) {   // filaments: each knot links to its two nearest
    const near = nodes.map(([x, y], j) => [Math.hypot(x - x0, y - y0), j]).filter(([, j]) => j !== i).sort((p, q) => p[0] - q[0]).slice(0, 2);
    for (const [d, j] of near) {
      const [x1, y1] = nodes[j];
      for (let t = 0; t <= d; t += 1.2) if (hash(`f${i}${j}${t}`) < 0.55) put(Math.round(x0 + (x1 - x0) * t / d), Math.round(y0 + (y1 - y0) * t / d), '#2f3d7e');
    }
    for (let k = 0; k < 4; k++) put(Math.round(x0 + (hash(`k${i}${k}`) - 0.5) * 4), Math.round(y0 + (hash(`l${i}${k}`) - 0.5) * 4), k % 2 ? '#c8d0ff' : '#ffd9e8');
  }
  const CMB = ['#2a4fb0', '#3f7fd0', '#7fbfe0', '#e0c070', '#e08a3c', '#b04a2a'];   // the oldest light, mottled
  for (let y = 0; y < UH; y++) for (let x = 0; x < UW; x++) {
    const d = Math.hypot(x - UCX, y - UCY);
    if (d >= R && d < R + 5) put(x, y, CMB[Math.floor(hash(`cmb${Math.floor(x / 2)}_${Math.floor(y / 2)}`) * CMB.length)]);
  }
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(UCX + dx, UCY + dy, '#ffd34d');
  uniText(ctx, 'YOU ARE HERE', UCX - 22, UCY + 5, '#ffd34d');
  uniText(ctx, 'OLDEST LIGHT', UCX - 22, 2, '#e0c070');
}

// ---- lost in orbit: a flare that is really an astronaut
const forceAstronaut = /[?&]astronaut\b/.test(location.search);

let flare = null, nextFlare = 0, caught = 0;
function planFlare(now) { nextFlare = now + (forceAstronaut ? 300 : 20_000 + Math.random() * 50_000); }
function updateFlare(now) {
  if (!flare && now >= nextFlare) {
    const fromLeft = Math.random() < 0.5, y0 = 30 + Math.random() * (UH - 60);
    flare = { born: now, x0: fromLeft ? -4 : UW + 4, y0, vx: (fromLeft ? 1 : -1) * UW / 16_000, vy: (Math.random() - 0.5) * 0.002 };
  }
  if (flare && (now - flare.born > 16_000)) { flare = null; planFlare(now); }
  if (flare) {
    const t = now - flare.born;
    flare.x = flare.x0 + flare.vx * t; flare.y = flare.y0 + flare.vy * t;
    uniCanvas.dataset.flare = `${Math.round(flare.x)},${Math.round(flare.y)}`;
  } else delete uniCanvas.dataset.flare;
}
function drawFlare(now) {
  if (caught && now - caught < 4000) {   // caught: the astronaut, big, tumbling slowly
    const spin = REDUCED_MOTION ? 0 : (now - caught) / 900, cx = UCX, cy = UCY;
    uctx.fillStyle = 'rgba(7, 11, 26, 0.78)';   // the sector dims, so the astronaut and the words stand out
    uctx.fillRect(0, 0, UW, UH);
    drawAstronaut(uctx, cx, cy, spin, 1.5);
    for (let k = 0; k < 20; k++) { uctx.fillStyle = '#4a5590'; uctx.fillRect(Math.round(cx + 8 + k * 2), Math.round(cy + 6 + Math.sin(k / 3 + now / 300) * 3), 1, 1); }
    uniText(uctx, 'LOST IN ORBIT', UCX - 25, UCY + 30, '#ff9a3c');
    return;
  }
  if (!flare) return;
  const x = Math.round(flare.x), y = Math.round(flare.y), big = REDUCED_MOTION || Math.sin(now / 160) > 0;
  uctx.fillStyle = '#ffffff';
  uctx.fillRect(x, y, 1, 1);
  uctx.fillStyle = '#9fd8ff';
  for (const k of big ? [1, 2, 3] : [1, 2]) { uctx.fillRect(x - k, y, 1, 1); uctx.fillRect(x + k, y, 1, 1); uctx.fillRect(x, y - k, 1, 1); uctx.fillRect(x, y + k, 1, 1); }
}

// ---- the view
function drawUniverse(now) {
  if (!universeOn || sector === 0) return;
  uctx.imageSmoothingEnabled = false;
  uctx.drawImage(sectorLayer(sector), 0, 0);
  updateFlare(now);
  drawFlare(now);
}
const sectorsSeen = new Set();
function showSector(i) {
  sector = clamp(i, 0, SECTORS.length - 1);
  const s = SECTORS[sector], inMap = sector === 0;
  sectorsSeen.add(sector);
  if (sectorsSeen.size === SECTORS.length) achieve('cosmic-zoom');
  map.hidden = !inMap; uniCanvas.hidden = inMap;
  hoverLine.hidden = !inMap; mapLegend.hidden = !inMap;
  uniTitle.textContent = `SECTOR ${sector + 1} / ${SECTORS.length} · ${s.name}`;
  uniFacts.textContent = `${s.size}. ${s.facts}`;
  uniPrev.disabled = sector === 0; uniNext.disabled = sector === SECTORS.length - 1;
  uniCanvas.setAttribute('aria-label', `${s.name}, ${s.size}. ${s.facts}`);
  map.closest('.panel').querySelector('h2').textContent = inMap ? 'THE KEPLER FIELD' : 'THE UNIVERSE';
  wake();
}
function setUniverse(on) {
  universeOn = on;
  uniButton.setAttribute('aria-pressed', String(on));
  uniNav.hidden = !on; uniFacts.hidden = !on;
  for (const id of ['zoom-in', 'zoom-out', 'depth', 'ccd']) document.getElementById(id).disabled = on;
  if (on) {
    if (!nextFlare) planFlare(performance.now());
    showSector(1);
    uniCanvas.focus({ preventScroll: true });
  } else {
    map.hidden = false; uniCanvas.hidden = true; hoverLine.hidden = false; mapLegend.hidden = false;
    map.closest('.panel').querySelector('h2').textContent = depth ? 'SIDE VIEW FROM EARTH' : 'THE KEPLER FIELD';
    renderBase();
  }
}
uniButton.addEventListener('click', () => setUniverse(!universeOn));
uniPrev.addEventListener('click', () => showSector(sector - 1));
uniNext.addEventListener('click', () => showSector(sector + 1));
uniCanvas.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowUp: 1, '+': 1, '=': 1, ArrowLeft: -1, ArrowDown: -1, '-': -1, _: -1 }[e.key];
  if (step == null) return;
  e.preventDefault();
  showSector(sector + step);
  if (sector === 0) map.focus({ preventScroll: true });
});
uniCanvas.addEventListener('click', e => {
  if (!flare) return;
  const r = uniCanvas.getBoundingClientRect(), x = (e.clientX - r.left) * UW / r.width, y = (e.clientY - r.top) * UH / r.height;
  if (Math.hypot(x - flare.x, y - flare.y) > 9) return;
  flare = null; caught = performance.now(); planFlare(caught + 30_000);
  toast('egg', 'LOST IN ORBIT', 'That flare was an astronaut, drifting across the universe. Hang on, a ship is on its way.');
  achieve('lost-in-orbit');
  wake();
});
