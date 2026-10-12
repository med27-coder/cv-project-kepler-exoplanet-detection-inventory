// Kepler Star Map: pixel map of the Kepler field + pixel-art star systems.
// Data comes from data/systems.js (scripts/export_starmap.py). Everything is drawn
// procedurally on two small canvases, so a system costs a few numbers, not an image.
(function () {
  'use strict';

  const DATA = window.STARMAP;
  const COL = Object.fromEntries(DATA.columns.map((c, i) => [c, i]));
  const STARS = DATA.stars;
  const SYSTEMS = DATA.systems;
  const SPOTLIGHT = [...DATA.spotlight].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const SG_THRESHOLD = DATA.sg_threshold ?? 0.5;
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LY_PER_PC = 3.26156;

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

  const PLANET_BANDS = [   // equilibrium temperature (K) -> colour
    [1500, '#ff5a36'],     // molten
    [700, '#ffa64d'],      // scorching
    [350, '#e8d27a'],      // hot
    [180, '#4fd17a'],      // temperate
    [-Infinity, '#8fd3ff'],// icy
  ];
  function planetColor(teq) {
    if (teq == null) return '#c0c6e0';
    return PLANET_BANDS.find(([t]) => teq >= t)[1];
  }
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

  // RA scaled by cos(dec), east to the left as on the sky.
  const ras = STARS.map(s => s[COL.ra]), decs = STARS.map(s => s[COL.dec]);
  const dec0 = (Math.min(...decs) + Math.max(...decs)) / 2;
  const cosd = Math.cos(dec0 * Math.PI / 180);
  const xs = ras.map(r => -r * cosd), ys = decs.map(d => -d);
  const xMin = Math.min(...xs), yMin = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - xMin, Math.max(...ys) - yMin);
  const scale = (Math.min(MW, MH) - 2 * PAD) / span;
  const offX = (MW - (Math.max(...xs) - xMin) * scale) / 2;
  const offY = (MH - (Math.max(...ys) - yMin) * scale) / 2;
  const pos = STARS.map((s, i) => [Math.round(offX + (xs[i] - xMin) * scale),
                                   Math.round(offY + (ys[i] - yMin) * scale)]);
  const starIndex = new Map(STARS.map((s, i) => [s, i]));

  // Static layer drawn once: drawn systems bright, "soon" systems dim, scored candidates by verdict.
  const base = document.createElement('canvas');
  base.width = MW; base.height = MH;
  (function drawBase() {
    const b = base.getContext('2d');
    b.fillStyle = '#070b1a';
    b.fillRect(0, 0, MW, MH);
    STARS.forEach((s, i) => {
      const mag = s[COL.kepmag] ?? 15;
      const light = Math.round(255 - Math.min(Math.max(mag - 9, 0), 8) * 14);   // brighter = lower mag
      const hasConfirmed = SYSTEMS[s[COL.name]]?.planets.some(p => p.status === 'confirmed');
      if (s[COL.sg] != null && !hasConfirmed) {
        b.fillStyle = s[COL.sg] >= SG_THRESHOLD ? MAP_COLORS.likely : MAP_COLORS.unlikely;
      } else if (s[COL.drawn]) {
        b.fillStyle = `rgb(${light - 30},${light - 15},${light})`;
      } else {
        b.fillStyle = `rgb(${light * 0.35 | 0},${light * 0.4 | 0},${light * 0.55 | 0})`;
      }
      b.fillRect(pos[i][0], pos[i][1], 1, 1);
    });
  })();
  const spotIdx = STARS.map((s, i) => (s[COL.spot] ? i : -1)).filter(i => i >= 0);

  let selected = null, hovered = null;

  function drawMap(t) {
    mctx.drawImage(base, 0, 0);
    spotIdx.forEach((i, k) => {
      const on = REDUCED_MOTION || Math.sin(t / 400 + k * 1.7) > -0.6;
      mctx.fillStyle = on ? MAP_COLORS.spot : MAP_COLORS.spotDim;
      mctx.fillRect(pos[i][0] - 1, pos[i][1] - 1, 2, 2);
    });
    for (const [s, color] of [[hovered, '#9aa6d6'], [selected, '#ffd34d']]) {
      if (!s) continue;
      const [x, y] = pos[starIndex.get(s)];
      mctx.fillStyle = color;
      for (const [dx, dy] of [[-4, 0], [-3, 0], [3, 0], [4, 0], [0, -4], [0, -3], [0, 3], [0, 4]]) {
        mctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
  }

  function starAt(evt) {
    const r = map.getBoundingClientRect();
    const x = (evt.clientX - r.left) * MW / r.width, y = (evt.clientY - r.top) * MH / r.height;
    let best = null, bestD = 4.5 * 4.5;   // pick radius in map pixels
    STARS.forEach((s, i) => {
      // Spotlight, then drawn systems win ties so they're easy to hit.
      const d = (pos[i][0] - x) ** 2 + (pos[i][1] - y) ** 2 - (s[COL.spot] ? 6 : s[COL.drawn] ? 2 : 0);
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }

  // Arrow keys: jump to the nearest star in that direction.
  function neighbour(from, dx, dy) {
    const [x0, y0] = from ? pos[starIndex.get(from)] : [MW / 2, MH / 2];
    let best = null, bestCost = Infinity;
    STARS.forEach((s, i) => {
      if (s === from) return;
      const vx = pos[i][0] - x0, vy = pos[i][1] - y0;
      const along = vx * dx + vy * dy;
      if (along <= 0) return;
      const across = Math.abs(vx * dy - vy * dx);
      const cost = along + 2 * across;
      if (cost < bestCost) { bestCost = cost; best = s; }
    });
    return best;
  }

  const hoverLine = document.getElementById('hover');
  const HOVER_HINT = hoverLine.textContent;
  map.addEventListener('mousemove', e => {
    hovered = starAt(e);
    hoverLine.textContent = hovered ? `▸ ${label(hovered)}` : HOVER_HINT;
  });
  map.addEventListener('mouseleave', () => { hovered = null; hoverLine.textContent = HOVER_HINT; });
  map.addEventListener('click', e => { const s = starAt(e); if (s) select(s); });
  map.addEventListener('keydown', e => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const s = neighbour(selected, ...dir);
    if (s) { select(s); hoverLine.textContent = `▸ ${label(s)}`; }
  });

  function label(s) {
    const koi = s[COL.koi] != null && !s[COL.name].startsWith('KOI') ? ` · KOI-${s[COL.koi]}` : '';
    const state = s[COL.drawn] ? '' : ' · soon';
    return `${s[COL.name]}${koi} · ${s[COL.kois]} KOI${s[COL.kois] > 1 ? 's' : ''}${s[COL.spot] ? ' ★' : ''}${state}`;
  }

  // ---------------------------------------------------------------- system view
  const sys = document.getElementById('system');
  const sctx = sys.getContext('2d');
  const SW = sys.width, SH = sys.height, CX = SW / 2, CY = SH / 2, TILT = 0.42;
  let scene = null;

  // Deterministic "random" so a system always starts in the same pose.
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    // Final mix, so names that differ only in the last character ("K00351.01"/".02") spread out.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // Approximate habitable zone (AU) from the star's luminosity: L = R² (T / 5772 K)⁴,
  // edges where the planet gets 1.1× and 0.36× Earth's sunlight (roughly Kopparapu et al. 2013).
  function habitableZone(detail) {
    if (detail.teff == null || detail.srad == null) return null;
    const lum = detail.srad ** 2 * (detail.teff / 5772) ** 4;
    return [Math.sqrt(lum / 1.1), Math.sqrt(lum / 0.36)];
  }

  function buildScene(detail) {
    const starR = Math.max(3, Math.min(12, Math.round(3 + (detail.srad ?? 1) * 4)));
    const rMin = starR + 7, rMax = CX - 8;
    const logA = detail.planets.map(p => Math.log(p.sma));
    let lo = Math.min(...logA), hi = Math.max(...logA);
    const minSpan = 1.6;   // single planets / tight systems: don't stretch tiny ratios across the canvas
    if (hi - lo < minSpan) { const mid = (lo + hi) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const toR = a => rMin + (Math.log(a) - lo) / (hi - lo) * (rMax - rMin);
    let radii = detail.planets.map(p => toR(p.sma));
    for (let i = 1; i < radii.length; i++) radii[i] = Math.max(radii[i], radii[i - 1] + 5);   // keep orbits apart
    const squeeze = radii.length ? Math.min(1, (rMax - rMin) / (radii[radii.length - 1] - rMin || 1)) : 1;
    radii = radii.map(r => rMin + (r - rMin) * squeeze);
    const hz = habitableZone(detail);
    return {
      starR,
      starColor: starColor(detail.teff),
      hz: hz && hz.map(a => rMin + (toR(a) - rMin) * squeeze),
      planets: detail.planets.map((p, i) => ({
        rx: radii[i],
        size: planetSize(p.radius),
        color: planetColor(p.teq),
        kind: p.status,
        speed: (2 * Math.PI) / (1.5 * Math.sqrt(p.period ?? 10)),   // radians per second
        phase: hash(p.koi) * 2 * Math.PI,
      })),
    };
  }

  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
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

  function ring(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    const n = Math.max(12, Math.round(r * 6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      ctx.fillRect(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), 1, 1);
    }
  }

  function ellipse(rx, color, step) {
    sctx.fillStyle = color;
    const n = Math.round(rx * 2.2);
    for (let k = 0; k < n; k += step) {
      const a = (k / n) * 2 * Math.PI;
      sctx.fillRect(Math.round(CX + rx * Math.cos(a)), Math.round(CY + rx * TILT * Math.sin(a)), 1, 1);
    }
  }

  function drawSystem(seconds) {
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    sctx.fillStyle = '#28305a';   // fixed background speckle
    for (let k = 0; k < 40; k++) sctx.fillRect(Math.floor(hash('bg' + k) * SW), Math.floor(hash('y' + k) * SH), 1, 1);
    if (!scene) return;
    if (scene.mystery) {   // not drawn yet: a dim star behind a slowly turning dashed ring
      disc(sctx, CX, CY, 6, '#3a4366');
      const a0 = REDUCED_MOTION ? 0 : seconds * 0.6;
      sctx.fillStyle = '#ffd34d';
      for (let k = 0; k < 24; k += 2) {
        const a = a0 + (k / 24) * 2 * Math.PI;
        sctx.fillRect(Math.round(CX + 30 * Math.cos(a)), Math.round(CY + 30 * TILT * Math.sin(a)), 1, 1);
      }
      return;
    }

    // Habitable zone: two faint green ellipses (only the parts that land on the canvas show).
    if (scene.hz && scene.hz[1] > 0) for (const r of scene.hz) if (r > scene.starR) ellipse(r, '#1f5a3a', 3);
    // Orbits: dotted pixel ellipses, sparser for candidates and planets found by other methods.
    for (const p of scene.planets) ellipse(p.rx, p.kind === 'confirmed' ? '#3a4888' : '#2c3770', p.kind === 'confirmed' ? 2 : 3);

    const t = REDUCED_MOTION ? 0 : seconds;
    const bodies = scene.planets.map(p => {
      const a = p.phase + p.speed * t;
      return { p, x: CX + p.rx * Math.cos(a), y: CY + p.rx * TILT * Math.sin(a), behind: Math.sin(a) < 0 };
    });
    const drawPlanet = b => {
      if (b.p.kind === 'candidate') ring(sctx, b.x, b.y, b.p.size + 0.5, b.p.color);
      else if (b.p.kind === 'other') diamond(sctx, b.x, b.y, b.p.size, b.p.color);
      else disc(sctx, b.x, b.y, b.p.size, b.p.color);
    };
    bodies.filter(b => b.behind).forEach(drawPlanet);
    disc(sctx, CX, CY, scene.starR + 2, scene.starColor + '33');   // glow
    disc(sctx, CX, CY, scene.starR, scene.starColor);
    bodies.filter(b => !b.behind).forEach(drawPlanet);
  }

  // ---------------------------------------------------------------- info panel
  const title = document.getElementById('sys-title');
  const info = document.getElementById('info');

  function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmt = (v, d = 0) => (v == null ? '-' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function skyLink(ra, dec) {
    const url = 'https://aladin.cds.unistra.fr/AladinLite/?target=' + encodeURIComponent(`${ra} ${dec}`) +
                '&fov=0.08&survey=' + encodeURIComponent('CDS/P/DSS2/color');
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">See the real sky here ↗</a>`;
  }

  // A real photo of the sky around the star (Digitized Sky Survey, via CDS hips2fits), fetched on
  // demand at 32×32 and shown pixelated: about 1 KB, nothing stored with the page.
  function skyThumb(ra, dec) {
    const url = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=' +
                encodeURIComponent('CDS/P/DSS2/color') +
                `&width=32&height=32&fov=0.04&projection=TAN&coordsys=icrs&ra=${ra}&dec=${dec}&format=jpg`;
    return `<figure class="sky"><img src="${esc(url)}" width="32" height="32" loading="lazy"
              alt="Real sky photo (DSS2) around the star" onerror="this.closest('figure').hidden = true">
            <figcaption>real sky</figcaption></figure>`;
  }

  function statusText(p) {
    if (p.status === 'other') return esc(p.method);
    if (p.status === 'candidate' && p.sg != null) {
      return `candidate · Star Gazer ${Math.round(p.sg * 100)}% ${p.sg_planet ? 'planet' : '(likely false positive)'}`;
    }
    return p.status;
  }

  function showSystem(s, detail) {
    title.textContent = s[COL.name].toUpperCase();
    const count = k => detail.planets.filter(p => p.status === k).length;
    const parts = count('confirmed') ? [plural(count('confirmed'), 'confirmed planet')] : [];
    if (count('candidate')) parts.push(`${plural(count('candidate'), 'candidate')} (hollow)`);
    if (count('other')) parts.push(`${count('other')} more from NASA's planet list (◆)`);
    const rows = detail.planets.map(p => {
      const c = planetColor(p.teq);
      const mass = p.mass == null ? '-' : (p.mass_kind === 'estimated' ? '~' : '') + fmt(p.mass, 1);
      return `
      <tr>
        <td><span class="dot ${p.status}" style="background:${c};color:${c}"></span>${esc(p.name)}</td>
        <td class="num">${fmt(p.radius, 1)}</td>
        <td class="num">${mass}</td>
        <td class="num">${fmt(p.period, 1)}</td>
        <td class="num">${fmt(p.teq)}</td>
        <td>${statusText(p)}</td>
        <td class="num">${p.year ?? '-'}</td>
      </tr>`;
    }).join('');
    const dist = detail.dist_pc != null ? ` · ${fmt(detail.dist_pc * LY_PER_PC)} light-years away` : '';
    info.innerHTML = `
      <div class="head">${skyThumb(detail.ra, detail.dec)}<div>
        <p>Star: ${fmt(detail.teff)} K · ${fmt(detail.srad, 2)} × Sun's radius${dist}</p>
        <p>${parts.join(' + ')} · ${skyLink(detail.ra, detail.dec)}</p>
      </div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Planet</th><th class="num">Size (Earths)</th><th class="num">Mass (Earths)</th>
          <th class="num">Year (days)</th><th class="num">Temp (K)</th><th>Status</th><th class="num">Found</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="note">~ mass estimated from size · green ring = habitable zone (approx.) · Kepler ID ${detail.kepid}</p>`;
    scene = buildScene(detail);
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
    scene = { mystery: true };
  }

  function showUnknown(query) {
    title.textContent = 'NO SIGNAL';
    info.innerHTML = `
      <p class="big alert">✖ NO SIGNAL</p>
      <p>Nothing called “${esc(query)}” in the Kepler field.</p>
      <p>Try <b>Kepler-90</b>, <b>KOI-351</b>, a KOI like <b>K00351.01</b> or a Kepler ID like <b>11442793</b>.</p>`;
    scene = null;
    selected = null;
  }

  function select(s, updateHash = true) {
    selected = s;
    const detail = SYSTEMS[s[COL.name]];
    if (detail) showSystem(s, detail); else showSoon(s);
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', String(c.dataset.name === s[COL.name])));
    if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(s[COL.name]));
  }

  function lookup(query, updateHash = true) {
    if (!query.trim()) return;
    const s = find(query);
    if (s) select(s, updateHash); else showUnknown(query);
  }

  // ---------------------------------------------------------------- wiring
  const input = document.getElementById('query');
  document.getElementById('search').addEventListener('submit', e => { e.preventDefault(); lookup(input.value); });

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
    const q = decodeURIComponent(location.hash.slice(1));
    if (q) { input.value = q; lookup(q, false); }
  }
  window.addEventListener('hashchange', fromHash);
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
