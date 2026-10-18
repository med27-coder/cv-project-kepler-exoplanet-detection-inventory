// Kepler Star Map: pixel map of the Kepler field + pixel-art star systems.
// Data comes from data/systems.js (scripts/starmap/export_starmap.py). Everything is drawn
// procedurally on two small canvases, so a system costs a few numbers, not an image.
// Built by scripts/starmap/build_web.py from web/src/*.js: edit those, not this file.
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
    [1500, '#e8402a', 't-molten'],
    [700, '#ff9a3c', 't-scorching'],
    [350, '#f7e7a1', 't-hot'],
    [180, '#3a8f5c', 't-temperate'],
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

  const MAP_COLORS = { spot: '#ffd34d', spotDim: '#8a6d1f', likely: '#6cb4ff', unlikely: '#ff8c42' };   // blue / orange: safe for colour blindness (tests/test_palette.py)

  // ---------------------------------------------------------------- the site's version
  // One source of truth (docs/plans/TROPHIES_AND_DATA.md section 5): build_web.py stamps it on the page's script and
  // stylesheet links, and tests check it matches the top of CHANGELOG.md. Semantic versions: MAJOR for a redesign or
  // a change in how progress is saved, MINOR for new features, PATCH for fixes. RELEASE_NOTES are what the antenna
  // announces (2 or 3 plain-words highlights per version, no spoilers).
  const VERSION = '1.3.0';
  const RELEASE_NOTES = [
    'Galleria cards now have arrows on their edges (and the arrow keys work too): step from card to card without going back.',
    'Voyager 1 and Voyager 2 are now two easter eggs, each with its own story. Already found "Voyager"? That was Voyager 1.',
    'The 8-bit fanfare is on from the start and plays reliably (switch it off in Settings if you prefer quiet).',
  ];

  // ---------------------------------------------------------------- sky events: comets, asteroids, the odd UFO
  // Every 3 to 6 minutes of use, something crosses the Kepler field map: a comet (a bright head, a curved dust
  // tail and a faint blue ion tail, both pointing away from the Sun, off to the left) or a dark tumbling asteroid.
  // Rarely, after a while, a flying saucer zooms past, and 2 times in 5 an asteroid tumbles by behind it (WHAT WAS
  // THAT?). Click one while it's on screen to catch it (SKY WATCH achievements). Designs and science:
  // docs/plans/SKY_EVENTS_DRAFTS.md, concept art pixel-art/concepts/draft_{comet_v3,asteroid_v2,ufo_space_*}.gif.
  // Drawn on the map's own frames (~8 fps, 10-map.js calls drawSkyEvent), so it stops when the page is idle or
  // hidden; never with reduced motion or the animation off; half as often in battery-saver mode.
  const SKY_MIN_S = 180, SKY_MAX_S = 360, UFO_AFTER_S = 600, UFO_CHANCE = 0.08, UFO_ROCK_CHANCE = 0.4;
  const SKY_DURATION = { comet: 16, asteroid: 10, ufo: 5 };   // seconds on screen
  let skyEvent = null, skyClock = 0, skyNext = SKY_MIN_S + Math.random() * (SKY_MAX_S - SKY_MIN_S), skyLastT = 0, skyBurst = null;

  // Sprites are gathered first, then drawn with a one-pixel ring of dark sky around them, so they stand out from
  // the crowded star field behind.
  const skyPixels = new Map();
  function skyPut(x, y, col, ring = true) { skyPixels.set(`${Math.round(x)},${Math.round(y)}`, [col, ring]); }   // ring: false for glows
  function flushSky() {
    mctx.fillStyle = '#070b1a';
    for (const [key, [, ring]] of skyPixels) {
      if (!ring) continue;
      const [x, y] = key.split(',').map(Number);
      mctx.fillRect(x - 1, y - 1, 3, 3);
    }
    for (const [key, [col]] of skyPixels) {
      const [x, y] = key.split(',').map(Number);
      mctx.fillStyle = col;
      mctx.fillRect(x, y, 1, 1);
    }
    skyPixels.clear();
  }

  function startSkyEvent(kind, withRock = false) {
    const W = 192, H = 192, r = Math.random;
    if (kind === 'comet') {   // drifts slowly towards the Sun (left), tails streaming behind it to the right
      const y0 = 30 + r() * 120;
      skyEvent = { kind, x0: W + 40, y0, x1: -40, y1: y0 + (r() - 0.5) * 60 };
    } else if (kind === 'asteroid') {
      const fromLeft = r() < 0.5, y0 = 20 + r() * 150;
      skyEvent = { kind, x0: fromLeft ? -8 : W + 8, y0, x1: fromLeft ? W + 8 : -8, y1: 20 + r() * 150 };
    } else {
      const y0 = 40 + r() * 100;
      skyEvent = { kind, x0: -16, y0, x1: W + 16, y1: y0 + (r() - 0.5) * 30, withRock };
    }
    Object.assign(skyEvent, { age: 0, spin: r() * 6 });
  }

  function skyPosition(e) {
    const f = e.age / SKY_DURATION[e.kind];
    return [e.x0 + (e.x1 - e.x0) * f, e.y0 + (e.y1 - e.y0) * f];
  }

  // A comet after real photos (Comet Lovejoy from the ISS): tiny bright head, soft coma, dithered dust plume that
  // widens, fades and curves gently; a faint thin ion tail just off it. The Sun is to the left, so both point right.
  function drawComet(hx, hy) {
    const L = 44;
    for (let u = 1; u < L; u++) {
      const half = 0.8 + u * 0.17, bend = (u / L) ** 2 * 6;
      for (let v = -Math.ceil(half); v <= Math.ceil(half); v++) {
        const x = Math.round(hx + u), y = Math.round(hy - u * 0.3 + v + bend);
        const dust = (1 - u / L) ** 1.3 * Math.max(0, 1 - (v / half) ** 2);
        if (dust > (BAYER[y & 3][x & 3] + 0.5) / 16) skyPut(x, y, dust > 0.6 ? '#ffffff' : dust > 0.35 ? '#f4ecd6' : dust > 0.18 ? '#c9bfa4' : '#7a735f', false);
      }
      if (u > 2 && u % 2 === 0 && u < L * 0.9) skyPut(hx + u, hy - u * 0.42 - 1.5, u < 14 ? '#9fc8f0' : '#4a78b8', false);   // ion tail
    }
    for (const [dx, dy] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) skyPut(hx + dx, hy + dy, '#bfe0ff');   // the coma
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) skyPut(hx + dx, hy + dy, '#ffffff');   // the bright head
  }

  // An asteroid: a dark, lumpy rock lit from the left, tumbling; no glow, no tail.
  const ROCK = ['..aab..', '.aabbbc', 'aabbkbc', 'abbbbcc', '.bkbcc.', '..bcc..', '.......'];
  const ROCK_INK = { a: '#d8d0c0', b: '#9a9284', c: '#5e584f', k: '#6e675c' };   // sunlit, with two craters
  function drawAsteroid(x, y, spin) {
    const q = Math.floor(spin) % 4;   // four tumbling poses: the rock turned a quarter each time
    ROCK.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const [px, py] = [[c, r], [6 - r, c], [6 - c, 6 - r], [r, 6 - c]][q];
      skyPut(x - 3 + px, y - 3 + py, ROCK_INK[ch]);
    }));
  }

  // The saucer (after the user's reference): a silver disc, a glass dome with two little green aliens, rim lights
  // chasing round, bobbing as it goes.
  const SAUCER = ['....ddddd....', '...dgdddgd...', '..ssssssssss.', '.sSSSSSSSSSs.', 'sSlSSlSSlSSls', '.sssssssssss.', '...mm...mm...'];
  const SAUCER_INK = { d: '#9fd8ff', g: '#4fd17a', s: '#d6dae2', S: '#9aa6b8', m: '#6f7d96' };
  function drawUfo(x, y, t) {
    const lights = ['#ffd34d', '#ff6ec7', '#7ff0e0'];
    let k = 0;
    SAUCER.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      skyPut(x - 6 + c, y - 3 + r, ch === 'l' ? lights[(k++ + Math.floor(t * 6)) % 3] : SAUCER_INK[ch]);
    }));
  }

  function drawSkyEvent(t) {   // t: milliseconds (the map's frame time)
    const dt = Math.min(0.5, Math.max(0, (t - skyLastT) / 1000));
    skyLastT = t;
    if (REDUCED_MOTION || !t) return;
    if (skyBurst) {   // a little sparkle where something was caught
      skyBurst.age += dt;
      const k = Math.round(skyBurst.age * 10);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) skyPut(skyBurst.x + dx * (1 + k), skyBurst.y + dy * (1 + k), k % 2 ? '#ffd34d' : '#ffffff');
      flushSky();
      if (skyBurst.age > 0.6) skyBurst = null;
    }
    if (!skyEvent) {
      skyClock += dt * (SYSTEM_MS > 1000 / 20 ? 0.5 : 1);   // battery saver: half as often
      if (skyClock < skyNext) return;
      skyNext = skyClock + SKY_MIN_S + Math.random() * (SKY_MAX_S - SKY_MIN_S);
      if (skyClock > UFO_AFTER_S && Math.random() < UFO_CHANCE) startSkyEvent('ufo', Math.random() < UFO_ROCK_CHANCE);
      else startSkyEvent(Math.random() < 0.5 ? 'comet' : 'asteroid');
    }
    const e = skyEvent;
    e.age += dt;
    if (e.age > SKY_DURATION[e.kind]) { skyEvent = null; return; }
    const [x, y] = skyPosition(e), s = t / 1000;
    if (e.kind === 'comet') drawComet(x, y);
    else if (e.kind === 'asteroid') drawAsteroid(x, y, e.spin + s * 2.5);
    else {
      if (e.withRock) {   // behind the saucer, going the other way: WHAT WAS THAT?
        const f = e.age / SKY_DURATION.ufo;
        drawAsteroid(192 * (1 - f) + 10, e.y0 + 12 - f * 20, e.spin + s * 4);
        if (f > 0.3 && f < 0.7) achieve('what-was-that');
      }
      drawUfo(x, y + Math.round(Math.sin(s * 5) * 1.5), s);
    }
    flushSky();
  }

  // The map's pointer handlers (10-map.js) ask here first. A generous target: these are small and moving.
  function skyEventAt(px, py) {
    if (!skyEvent) return false;
    const [x, y] = skyPosition(skyEvent), reach = skyEvent.kind === 'ufo' ? 9 : 7;
    return Math.hypot(px - x, py - y) <= reach;
  }
  function catchSkyEvent(px, py) {
    if (!skyEventAt(px, py)) return false;
    const kind = skyEvent.kind, [x, y] = skyPosition(skyEvent);
    skyEvent = null;
    skyBurst = { x, y, age: 0 };
    const key = { comet: 'comets', asteroid: 'asteroids', ufo: 'ufos' }[kind];
    progress[key] += 1;
    saveProgress();
    const n = progress[key];
    if (kind === 'comet') { achieve('comet-catcher'); if (n >= 5) achieve('tail-chaser'); }
    if (kind === 'asteroid') { achieve('rock-hound'); if (n >= 10) achieve('asteroid-catcher'); }
    if (kind === 'ufo') achieve('ufo-spotter');
    hoverLine.textContent = `▸ Caught ${kind === 'ufo' ? 'the saucer' : `a ${kind}`}! (${n} so far)`;
    return true;
  }
  // Browser tests can summon an event at once (only under automation: no achievements for free).
  if (navigator.webdriver) {
    window.__skyEvent = (kind, rock) => {   // returns where it is, in map pixels
      startSkyEvent(kind, rock);
      skyEvent.age = SKY_DURATION[kind] / 2;
      skyEvent.x0 = skyEvent.x1 = 96; skyEvent.y0 = skyEvent.y1 = 96;   // parked mid-map, so a test can click it
      return skyPosition(skyEvent);
    };
  }

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
    ...(TAGS.twosuns ? { twosuns: ['two suns', TAGS.twosuns] } : {}),   // planets around two stars
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
    if (zoom === ZOOMS[ZOOMS.length - 1]) achieve('eagle');
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
    drawGazeWave(t);
    for (const [s, color] of [[hovered, '#9aa6d6'], [selected, '#ffd34d']]) {
      if (!s) continue;
      const [x, y] = screen[starIndex.get(s)];
      mctx.fillStyle = color;
      for (const [dx, dy] of [[-4, 0], [-3, 0], [3, 0], [4, 0], [0, -4], [0, -3], [0, 3], [0, 4]]) {
        mctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
    drawSkyEvent(t);   // a passing comet, asteroid or saucer (05-sky-events.js)
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
    if (skyEventAt(...canvasPoint(e))) {
      map.classList.add('on-kepler');   // the pointing-hand cursor
      hoverLine.textContent = `▸ ${skyEvent.kind === 'ufo' ? 'What is that?!' : `A ${skyEvent.kind} is passing!`} Click to catch it`;
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
    if (catchSkyEvent(...canvasPoint(e))) return;
    if (overKepler(e)) { input.value = 'Kepler'; lookup('Kepler'); return; }
    const s = starAt(e);
    if (s) { session.hops = 0; select(s); }
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
    if (s) { select(s); arrowHop(); hoverLine.textContent = `▸ ${label(s)}`; }
  });
  document.getElementById('zoom-in').addEventListener('click', () => stepZoom(1));
  const ccdButton = document.getElementById('ccd'), depthButton = document.getElementById('depth');
  ccdButton.addEventListener('click', () => {
    showCcd = !showCcd;
    achieve('chips');
    ccdButton.setAttribute('aria-pressed', String(showCcd));
    renderBase();
  });
  depthButton.addEventListener('click', () => {
    depth = !depth;
    if (depth) achieve('depth');
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
    const kois = s[COL.kois] ? `${s[COL.kois]} KOI${s[COL.kois] > 1 ? 's' : ''}` : 'found outside the KOI list';
    const suns = TAGS.twosuns && s[COL.tags] & TAGS.twosuns ? ' · two suns ☀☀' : '';
    return `${s[COL.name]}${koi} · ${kois}${suns}${s[COL.spot] ? ' ★' : ''}${state}${far}`;
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
    X: '101101010101101', Z: '111001010100111', '?': '111001011000010', '%': '101001010100101', ':': '000010000010000', ',': '000000000010100', '-': '000000111000000', '/': '001001010100100',
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
        name: p.name,   // for the hover label (49c-ui.js)
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

  // Nothing picked yet, or a search found nothing: an astronaut tumbling slowly on a loose tether, LOST IN ORBIT
  // (docs/plans/WORLDS_MOONS_AND_SCREENS.md; the sprite is the UNIVERSE view's, 56-universe.js).
  function drawLostInOrbit(seconds) {
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 60; k++) {
      sctx.fillStyle = k % 6 ? '#1e2550' : '#4a5590';
      sctx.fillRect(Math.floor(hash('lo' + k) * SW), Math.floor(hash('lp' + k) * SH), 1, 1);
    }
    const t = REDUCED_MOTION ? 0 : seconds;
    const cx = SW / 2 + 10 * Math.sin(t * 0.4), cy = SH / 2 - 14 + 5 * Math.cos(t * 0.3);
    sctx.fillStyle = '#4a5590';
    for (let k = 0; k < 24; k++) {   // the loose tether, drifting off
      sctx.fillRect(Math.round(cx + 9 + k * 2), Math.round(cy + 8 + Math.sin(k / 3 + t * 1.5) * 3 + k * 0.4), 1, 1);
    }
    drawAstronaut(sctx, cx, cy, t * 0.5);
    const lost = 'LOST IN ORBIT', hint = title.textContent === 'NO SIGNAL' ? 'NO SIGNAL - TRY ANOTHER NAME' : 'PICK A STAR TO BEGIN';
    pixelText(sctx, lost, Math.round((SW - textWidth(lost)) / 2), SH - 34, '#ff9a3c');
    pixelText(sctx, hint, Math.round((SW - textWidth(hint)) / 2), SH - 24, '#9aa6d6');
  }

  function drawSystem(seconds) {
    if (!scene) return drawLostInOrbit(seconds);
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
    scene.hits = bodies.map(b => ({ x: b.x, y: b.y, r: b.p.size, name: b.p.name, radius: b.p.radius }));
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
    drawHoverLabel();
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
  // Spotlight systems' photos ship with the site (scripts/starmap/make_sky_thumbs.py): no third-party request.
  const LOCAL_SKY = new Set(DATA.spotlight);
  const skySlug = name => name.toLowerCase().replace(/[^a-z0-9-]/g, '_');
  function skyUrl(ra, dec, k, name) {
    if (name && LOCAL_SKY.has(name)) return `sky/${skySlug(name)}_${SURVEYS[k][0].toLowerCase()}.jpg`;
    return 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=' + encodeURIComponent(SURVEYS[k][1]) +
           `&width=40&height=40&fov=0.04&projection=TAN&coordsys=icrs&ra=${Number(ra)}&dec=${Number(dec)}&format=jpg`;
  }
  function skyThumb(ra, dec, name = '') {
    const buttons = SURVEYS.map(([name, , about], k) =>
      `<button type="button" data-k="${k}" title="${esc(about)}" aria-pressed="${k === survey}">${esc(name)}</button>`).join('');
    return `<figure class="sky" data-ra="${Number(ra)}" data-dec="${Number(dec)}" data-name="${esc(name)}">
              <img src="${esc(skyUrl(ra, dec, survey, name))}" width="40" height="40" loading="lazy"
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
        img.src = skyUrl(fig.dataset.ra, fig.dataset.dec, survey, fig.dataset.name);
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
  function caseFiles(detail, system = '') {
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
          flags.length ? `<span class="con">✖ ${flags.map(esc).join(' · ')}</span>` : '<span class="pro">no red flags</span>'}${
          callMarkup(p, system)}</li>`;
    }).join('');
    return `<h3 class="facts-title">CASE FILES</h3><ul class="facts cases">${items}</ul>`;
  }

  function showSystem(s, detail) {
    systemDetailShown(detail);
    title.textContent = s[COL.name].toUpperCase();
    const count = k => detail.planets.filter(p => p.status === k).length;
    const parts = count('confirmed') ? [plural(count('confirmed'), 'confirmed planet')] : [];
    if (count('candidate')) parts.push(`${plural(count('candidate'), 'candidate')} (hollow)`);
    if (count('other')) parts.push(detail.extra ? `${plural(count('other'), 'confirmed planet')} (◆)` : `${count('other')} more from NASA's planet list (◆)`);
    const methods = [...new Set(detail.planets.map(p => p.method).filter(Boolean))].join(', ');
    const origin = detail.cb ? `<p class="callout">☀☀ <b>Two suns.</b> ${detail.planets.length > 1 ? 'These planets circle' : 'This planet circles'}
        both stars of a binary, like Tatooine. Kepler found ${detail.planets.length > 1 ? 'them' : 'it'} outside its usual list of
        candidates (KOIs), in the light of stars that eclipse each other. The second star in the drawing is
        illustrative.</p>`
      : detail.extra ? `<p class="callout">Found by Kepler outside its usual list of candidates (KOIs), by ${esc(methods || 'other means')}.</p>` : '';
    const links = [skyLink(detail.ra, detail.dec), ...(detail.host ? [nasaLink(detail.host)] : [])];
    info.innerHTML = `
      <div class="head">${skyThumb(detail.ra, detail.dec, s[COL.name])}<div>
        <p>Star: ${starLine(detail)}</p>
        <p>${parts.join(' + ')} · ${links.join(' · ')}</p>
      </div></div>
      ${origin}
      ${planetTable(detail)}
      ${caseFiles(detail, s[COL.name])}
      <p class="note">~ mass estimated from size · green band = habitable zone (approx.) · bottom strip = the
        star's brightness as Kepler sees it: it dips when a planet crosses in front (dips exaggerated) ·
        planet looks are a guess from size and temperature · Kepler ID ${esc(detail.kepid)}</p>`;
    wireSkyThumbs();
    wireCalls(info);
    setScene(buildScene(detail));
  }

  // Only unscored candidates orbit this star: drawn as ghosts, with their case files.
  function showUnconfirmed(s, detail) {
    achieve('ghost');
    systemDetailShown(detail);
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
      ${caseFiles(detail, s[COL.name])}
      <p class="note">Candidates are signals that look like transits but haven't been confirmed or ruled out ·
        Kepler ID ${esc(detail.kepid)}</p>`;
    wireSkyThumbs();
    wireCalls(info);
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
    achieve('oracle');
    selected = null;
    title.textContent = 'NEXT PLANETS';
    const pct = v => (v == null ? '-' : `${fmt(Math.round(v * 100))}%`);
    const table = (rows, caption) => !rows.length ? '' : `
      <h3 class="facts-title">${esc(caption)}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Candidate</th><th>System</th><th class="num">Size (Earths)</th>
          <th class="num">NASA vetting</th><th class="num">Star Gazer</th><th>Your call</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${esc(r.planet)}</td>
          <td><button type="button" class="linkish" data-name="${esc(r.system)}">${esc(r.system)}</button></td>
          <td class="num">${fmt(r.radius, 1)}</td><td class="num">${pct(r.nasa)}</td><td class="num">${pct(r.sg)}</td>
          <td>${callCell(r)}</td>
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
    wireCalls(info);   // call them yourself (48b-predictions.js)
    setScene({ custom: drawPodium });   // a podium of the top three, not an empty drawing (49-ranks.js)
  }

  function showUnknown(query) {
    noSignal();
    title.textContent = 'NO SIGNAL';
    info.innerHTML = `
      <p class="big alert">✖ NO SIGNAL</p>
      <p>Nothing called “${esc(query)}” in the Kepler field.</p>
      <p>Try <b>Kepler-90</b>, <b>KOI-351</b>, a KOI like <b>K00351.01</b> or a Kepler ID like <b>11442793</b>.</p>
      <p><button type="button" class="ghost take-me" data-random>TAKE ME SOMEWHERE</button></p>`;
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
      ['Pluto', 0.186, 0.0022, 90560, 39.48, 0.249, 1930, 2],   // a dwarf planet since 2006
    ].map(([name, radius, mass, period, sma, ecc, year, sprite]) => ({
      name, koi: 'Sol ' + name, status: 'confirmed', radius, mass, mass_kind: 'measured', period, sma, ecc,
      teq: Math.round(255 / Math.sqrt(sma)), insol: 1 / sma ** 2, year, sprite,
      art: name.toLowerCase(),
      url: `${NASA_SCIENCE}${name === 'Pluto' ? 'dwarf-planets/' : ''}${name.toLowerCase()}/`,
      note: name === 'Earth' ? 'home ★' : name === 'Pluto' ? 'dwarf planet' : 'planet',
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
    earth: (dx, dy, r, spin) => earthSurface(dx, dy, r, spin),
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
    pluto: (dx, dy, r, spin) => {   // the bright "heart" (Tombaugh Regio) next to dark Cthulhu
      const P = 4 * r + 2, u = (((dx + spin + P / 2) % P) + P) % P - P / 2;   // longitude, turning with the planet
      const h = r * 0.42, x = Math.abs(u) / h, y = dy / h - 0.15;      // heart: two lobes and a point
      if ((x - 0.45) ** 2 + (y + 0.25) ** 2 < 0.36 || (y >= -0.25 && x + y * 0.75 < 0.8)) return '#f2ece2';
      if (((u + h * 2.4) / (h * 1.2)) ** 2 + ((dy - r * 0.15) / (r * 0.3)) ** 2 < 1) return '#6e4f3c';   // Cthulhu
      return hash(`pl${Math.floor((dx + spin) / 2)},${dy}`) < 0.2 ? '#bb9d78' : '#d1b48e';
    },
    neptune: (dx, dy, r) => {
      if (Math.abs(dx + Math.round(r * 0.3)) <= 1 && dy === -Math.round(r * 0.3)) return '#1c357a';   // dark spot
      return dy % 2 === 0 ? '#3b6bd6' : '#335fc4';
    },
  };

  // Earth: NASA's Blue Marble as a 128 x 64 pixel map (data/earth.js, scripts/starmap/make_earth_map.py)
  // wrapped onto a globe tipped by its 23.4° axial tilt, turning west to east, with a few drifting
  // clouds. `spin` is in pixels, so the surface moves at the same speed as on the other planets.
  const EARTH_MAP = window.STARMAP_EARTH || null;
  const EARTH_TILT = 23.4 * Math.PI / 180, EARTH_LON0 = 0.3;   // start over Africa and Europe
  function earthSurface(dx, dy, r, spin) {
    if (!EARTH_MAP) return '#2a5fbf';
    const R = r + 0.5, c = Math.cos(EARTH_TILT), s = Math.sin(EARTH_TILT);
    const x = (dx * c + dy * s) / R, y = (dy * c - dx * s) / R;   // undo the tilt
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const lat = Math.asin(clamp(-y, -1, 1)), turn = Math.atan2(x, z);
    const lon = turn + EARTH_LON0 - spin / R;
    const { width: W, height: H, rows, colors } = EARTH_MAP;
    const row = clamp(Math.floor((0.5 - lat / Math.PI) * H), 0, H - 1);
    const cloudLon = lon + spin / R * 0.35;   // weather drifts a little against the ground
    const cell = Math.floor(((cloudLon / (2 * Math.PI)) % 1 + 1) % 1 * 48);
    if (hash(`cl${cell >> 1},${row >> 2}`) < 0.14 && hash(`cm${cell},${row >> 1}`) < 0.55) return '#f4f8ff';
    const col = Math.floor((((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1 * W);
    return colors[rows[row][col]] || '#2a5fbf';
  }

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
        const f = r < 8 ? (lit > 0.3 ? 1.15 : lit < -0.35 ? 0.45 : 0.9)   // small: three clear steps
          : lit > 0.45 ? 1.12 : lit > 0.1 ? 1 : lit > -0.2 ? 0.85 : lit > -0.45 ? 0.62 : 0.42;   // big: a softer terminator
        ctx.fillStyle = shade(art(dx, dy, r, spin).toLowerCase(), f);
        ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
      }
    }
    if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], true);
    if (!p.noMoon) solarMoons(ctx, x0, y0, r, p.art, t);
  }

  // The best-known moons, nearest first: [name, orbital period (days), colour]. A negative period
  // orbits backwards (Triton). Drawn as 1-pixel dots, evenly spaced outside the planet (and its
  // rings), turning at a compressed speed like the planets; Uranus's moons circle its sideways
  // equator. Distances are not to scale.
  const MOONS = {
    earth: [['Moon', 27.32, '#c9c6c0']],
    mars: [['Phobos', 0.319, '#8a7d70'], ['Deimos', 1.263, '#a39484']],
    jupiter: [['Io', 1.769, '#e8d36a'], ['Europa', 3.551, '#efe6d2'], ['Ganymede', 7.155, '#a89e90'],
              ['Callisto', 16.69, '#6f665c']],
    saturn: [['Enceladus', 1.370, '#ffffff'], ['Rhea', 4.518, '#cfcac2'], ['Titan', 15.95, '#e0a84a'],
             ['Iapetus', 79.33, '#9a8f80']],
    uranus: [['Miranda', 1.413, '#b8b4ae'], ['Ariel', 2.520, '#c8c4bd'], ['Umbriel', 4.144, '#86827c'],
             ['Titania', 8.706, '#bdb3a8'], ['Oberon', 13.46, '#a89c90']],
    neptune: [['Triton', -5.877, '#e4c8c0']],
    pluto: [['Charon', 6.387, '#9c958e']],
  };
  function solarMoons(ctx, x0, y0, r, art, t) {
    const moons = MOONS[art];
    if (!moons) return;
    const start = art === 'saturn' ? Math.ceil(r * 2.2) + 1 : r + 2;   // Saturn's start outside the rings
    const time = REDUCED_MOTION ? 1 : t;
    moons.forEach(([name, period, color], k) => {
      const d = start + 2 * k + (art === 'earth' ? 1 : 0);
      const a = Math.sign(period) * time * (2 * Math.PI) / (1.5 * Math.sqrt(Math.abs(period))) * 4 + hash(name) * 6.3;
      const [x, y] = art === 'uranus'
        ? [x0 + d * 0.3 * Math.cos(a), y0 + d * Math.sin(a)]
        : [x0 + d * Math.cos(a), y0 + d * TILT * Math.sin(a)];
      const behind = (art === 'uranus' ? Math.cos(a) : Math.sin(a)) < 0;
      if (behind && Math.hypot(x - x0, y - y0) < r + 0.5) return;   // hidden behind the planet
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    });
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
      <h3 class="facts-title">MOONS</h3>
      <p>The coloured dots around the planets are their best-known moons (distances not to scale):</p>
      <ul class="facts">
        <li><b>Earth</b>: the Moon. <b>Mars</b>: Phobos and Deimos, small and potato-shaped.</li>
        <li><b>Jupiter</b> (95+ moons): the four Galilean moons found by Galileo in 1610: volcanic <b>Io</b>,
          <b>Europa</b> with an ocean under its ice, <b>Ganymede</b>, the largest moon in the Solar System, and
          <b>Callisto</b>.</li>
        <li><b>Saturn</b> (the most, 274): <b>Titan</b>, with a thick orange atmosphere and lakes of methane;
          <b>Enceladus</b>, spraying water from its south pole; <b>Rhea</b>; and two-toned <b>Iapetus</b>.</li>
        <li><b>Uranus</b> (29): <b>Miranda, Ariel, Umbriel, Titania and Oberon</b>, named after characters from
          Shakespeare and Pope; they circle its sideways-tipped equator.</li>
        <li><b>Neptune</b> (16): <b>Triton</b> orbits backwards, probably a captured Kuiper Belt object.</li>
        <li><b>Pluto</b> (5): <b>Charon</b>, plus tiny Nix, Hydra, Kerberos and Styx.</li>
        <li>Moon counts as listed by NASA in 2025; new small moons keep being found.
          Mercury and Venus have none.</li>
      </ul>
      <h3 class="facts-title">BEYOND THE PLANETS</h3>
      <ul class="facts">
        <li><b>Asteroid belt</b> (grey dots): between Mars and Jupiter. All asteroids together weigh less than
          our Moon; the largest asteroid, Vesta, is about 530 km across.</li>
        <li><b>Dwarf planets</b>: Ceres (in the asteroid belt, the only one in the inner Solar System), Pluto,
          Haumea, Makemake and Eris.</li>
        <li><b>Pluto</b> (drawn, with its moon Charon): found by Clyde Tombaugh in 1930 and counted as the ninth
          planet until 2006, when the IAU defined "planet" and Pluto became a dwarf planet: it hasn't cleared
          its orbit of other Kuiper Belt objects. Smaller than our Moon, with a nitrogen-ice "heart" that
          New Horizons photographed in July 2015. Charon is half Pluto's size, so the two circle a point
          between them.</li>
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
        link(`${NASA_SCIENCE}solar-system/moons/`, 'NASA: moons'),
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
    systemOpened(s);
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
    // Easter eggs first; finding one unlocks it in the Galleria (48-gallery.js). Hyphens, underscores and dots
    // count as spaces ("new-horizons", "OSIRIS_REx"); extra or missing spaces don't, on purpose.
    const q = query.trim().replace(/[-_.]/g, ' ');
    if (ASTRO_QUERY.test(q) && progress.ach['lost-in-orbit']) { showAstronaut(updateHash); return; }   // 47c-astronaut.js
    if (MARTIAN_QUERY.test(q)) { showMartian(updateHash); unlockEgg('martian'); return; }   // 47d-martian.js
    const dwarf = dwarfFor(q);   // Pluto, Ceres, Haumea, Makemake, Eris (47b-dwarfs.js)
    if (dwarf) { showDwarf(dwarf, updateHash); unlockEgg(dwarf); return; }
    if (HOME_QUERY.test(q)) { showHome(updateHash); unlockEgg(eggForQuery(q)); return; }
    if (ISS_QUERY.test(q)) { showISS(updateHash); unlockEgg('iss'); return; }
    if (KEPLER_QUERY.test(q)) { showKepler(updateHash); unlockEgg('kepler'); return; }
    if (CRAFT_QUERY.test(q)) {
      showSpacecraft(updateHash, q);
      unlockEgg(eggForQuery(q));
      if (VOYAGERS_QUERY.test(q)) toast('egg', 'TWO VOYAGERS', 'Twin probes, launched in 1977 on different paths. Search VOYAGER 1 or VOYAGER 2 to find each one.');
      return;
    }
    if (/^(the )?tatooine$/i.test(q)) { const k16 = find('Kepler-16'); if (k16) { select(k16, updateHash); tatooineFound(); return; } }
    const s = find(query);
    if (s) select(s, updateHash); else { showUnknown(query); nearMiss(q); }
  }

  // ---------------------------------------------------------------- easter eggs: spacecraft and the ISS
  // "spacecraft" / "JWST" / "Voyager" / "rovers"...: the Solar System frozen on one real date, with
  // the planets and humanity's spacecraft beyond Earth orbit where NASA JPL Horizons puts them
  // (scripts/starmap/fetch_spacecraft.py -> data/spacecraft.js, loaded only here). Earth-orbit satellites
  // are left out on purpose; "ISS" / "space station" opens the International Space Station instead.
  const CRAFT_GENERAL = /^(spacecraft|space ?craft|probes?|space ?probes?|robots|missions|rovers?|mars rovers?|voyagers?)$/i;
  const VOYAGERS_QUERY = /^(the )?voyagers?$/i;   // which one? Voyager 1 and Voyager 2 are found separately
  // Search words for one spacecraft -> its name in data/spacecraft.js (or a rover's): the view then
  // highlights it and shows its pixel art.
  // ("the" in front is always allowed; lookup() has already turned hyphens, underscores and dots into spaces.)
  const CRAFT_ALIASES = [
    [/^(jwst|(james )?webb( space)?( telescope)?)$/i, 'James Webb Space Telescope'],
    [/^voyager ?(1|i|one)$/i, 'Voyager 1'], [/^voyager ?(2|ii|two)$/i, 'Voyager 2'],
    [/^new horizons( probe| spacecraft)?$/i, 'New Horizons'],
    [/^parker( solar)?( probe)?$/i, 'Parker Solar Probe'], [/^juno( probe)?$/i, 'Juno'], [/^(europa )?clipper$/i, 'Europa Clipper'],
    [/^(soho|solar and heliospheric observatory)$/i, 'SOHO'], [/^euclid( telescope)?$/i, 'Euclid'],
    [/^(solar orbiter|solo)$/i, 'Solar Orbiter'], [/^bepi ?colombo$/i, 'BepiColombo'],
    [/^(juice|jupiter icy moons explorer)$/i, 'JUICE'], [/^lucy( probe)?$/i, 'Lucy'], [/^psyche( probe)?$/i, 'Psyche'],
    [/^osiris ?(apex|rex)$/i, 'OSIRIS-APEX'], [/^(mro|mars reconnaissance orbiter)$/i, 'Mars Reconnaissance Orbiter'],
    [/^(2001 )?(mars )?odyssey$/i, 'Mars Odyssey'], [/^(mars express|mex)$/i, 'Mars Express'],
    [/^(tgo|exomars( tgo| trace gas orbiter)?|trace gas orbiter)$/i, 'ExoMars Trace Gas Orbiter'],
    [/^curiosity( rover)?$/i, 'Curiosity'], [/^(perseverance|percy)( rover)?$/i, 'Perseverance'],
  ];
  const craftFocus = q => { const t = q.replace(/^the /i, ''); return CRAFT_ALIASES.find(([re]) => re.test(t))?.[1] ?? null; };
  const CRAFT_QUERY = { test: q => CRAFT_GENERAL.test(q) || craftFocus(q) != null };
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

  // Spacecraft you haven't found yet are nameless flashing lights; searching a name reveals one for good
  // (docs/plans/FLEET_CLOSEUPS.md). Everything shows once GRAND TOUR is earned.
  const CRAFT_EGG = { 'Voyager 2': 'voyager2' };   // the twins share a sprite but are two easter eggs
  const craftEggId = name => CRAFT_EGG[name] || CRAFT_SPRITE[name];
  const craftEgg = c => craftEggId(c.name);
  const craftFound = c => Boolean(progress.ach['grand-tour'] || progress.eggs[craftEgg(c)]);
  const craftFoundByName = name => craftFound({ name });
  // "Where" for a spacecraft still hidden, with any word of its name blanked ("asteroid Psyche" gives Psyche away).
  const COMMON_WORDS = new Set(['mars', 'space', 'telescope', 'solar', 'probe', 'orbiter', 'trace', 'gas']);   // not giveaways
  const hiddenWhere = c => c.name.split(/[\s-]+/).filter(w => w.length >= 4 && !COMMON_WORDS.has(w.toLowerCase()))
    .reduce((text, w) => text.replace(new RegExp(`\\b${w.replace(/[^A-Za-z0-9]/g, '')}\\b`, 'gi'), '???'), c.where);

  // Found spacecraft as blinking crosses with labels that don't overlap (nearer the Sun wins; a searched-for
  // spacecraft, `focus`, comes first and is drawn in yellow); the rest as flashing lights, no name.
  function drawCraft(sc, crafts, seconds, focus) {
    const boxes = [];
    const free = (x, y, w) => !boxes.some(b => x < b[0] + b[2] + 2 && x + w + 2 > b[0] && Math.abs(y - b[1]) < 7);
    const marsCrew = crafts.filter(c => c.where === 'orbiting Mars' && craftFound(c));
    const order = [...crafts.filter(c => c.name === focus), ...crafts.filter(c => c.name !== focus)];
    for (const c of order) {
      const mine = c.name === focus;
      const R = screenRadius(sc, c.r_au), a = c.lon * Math.PI / 180;
      const x = Math.round(sc.cx + R * Math.cos(a)), y = Math.round(sc.cy + R * TILT * Math.sin(a));
      if (x < -2 || x > SW + 2 || y < -2 || y > SH - STRIP) continue;
      if (!mine && !craftFound(c)) {   // a flashing light: a bright pulse with rays, never a name
        const pulse = REDUCED_MOTION ? 1 : (Math.sin(seconds * 6 + c.lon * 3) + 1) / 2;
        sctx.fillStyle = pulse > 0.5 ? '#ffffff' : '#9fd8ff';
        sctx.fillRect(x, y, 1, 1);
        if (pulse > 0.35) {
          sctx.fillStyle = pulse > 0.75 ? '#9fd8ff' : '#3a5a8a';
          for (const k of pulse > 0.75 ? [1, 2] : [1]) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) sctx.fillRect(x + dx, y + dy, 1, 1);
        }
        continue;
      }
      const on = REDUCED_MOTION || Math.sin(seconds * 4 + c.lon) > -0.5;
      sctx.fillStyle = mine ? '#ffd34d' : on ? CRAFT_SPOT : '#6f86a8';
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sctx.fillRect(x + dx, y + dy, 1, 1);
      const label = mine ? c.label
        : c.where === 'orbiting Mars' ? (c === marsCrew[0] ? `${marsCrew.length} ORBITERS` : null) : c.label;
      if (!label) continue;
      const w = textWidth(label), lx = x + 3, ly = y - 7;
      if (lx + w < SW && ly > 0 && free(lx, ly, w)) {
        pixelText(sctx, label, lx, ly, mine ? '#ffd34d' : CRAFT_LABEL);
        boxes.push([lx, ly, w]);
      }
    }
  }

  // Top-left panel: the searched-for spacecraft's pixel art, or every spacecraft in turn (3 s each).
  function drawCraftInset(gallery, focus, seconds) {
    if (!gallery.length) return;
    const pick = focus ? gallery.find(g => g.name === focus)
      : gallery[REDUCED_MOTION ? 0 : Math.floor(seconds / 3) % gallery.length];
    if (!pick) return;
    const [w, h] = spriteSize(pick.key);
    const px = Math.max(1, Math.min(3, Math.floor(58 / w), Math.floor(30 / h)));
    const bw = Math.max(w * px, textWidth(pick.label)) + 6, bh = h * px + 13;
    sctx.fillStyle = '#0b1024';
    sctx.fillRect(2, 2, bw, bh);
    sctx.fillStyle = '#2b3566';
    sctx.fillRect(2, 2, bw, 1); sctx.fillRect(2, 2 + bh, bw, 1); sctx.fillRect(2, 2, 1, bh); sctx.fillRect(1 + bw, 2, 1, bh);
    craftSprite(sctx, pick.key, 2 + Math.floor((bw - w * px) / 2), 5, px);
    pixelText(sctx, pick.label, 5, 7 + h * px, focus ? '#ffd34d' : CRAFT_LABEL);
  }

  function craftTable(data, focus) {
    const delay = min => (min < 1 ? `${fmt(min * 60)} s` : min < 120 ? `${fmt(min)} min` : `${fmt(min / 60, 1)} h`);
    const rows = [...data.spacecraft].sort((a, b) => b.r_au - a.r_au).map(c => !craftFound(c) && c.name !== focus ? `
      <tr class="unfound"><td aria-hidden="true">?</td><td>??? · find it by name</td>
        <td>${esc(hiddenWhere(c))}</td><td class="num">${fmt(c.r_au, c.r_au < 10 ? 2 : 0)}</td>
        <td class="num">${delay(c.light_min)}</td><td colspan="2" class="clue">${esc(EGG.get(craftEgg(c))?.clue || '')}</td></tr>` : `
      <tr${c.name === focus ? ' class="focus"' : ''}><td>${spriteIcon(CRAFT_SPRITE[c.name])}</td>
        <td><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a></td>
        <td>${esc(c.where)}</td><td class="num">${fmt(c.r_au, c.r_au < 10 ? 2 : 0)}</td>
        <td class="num">${delay(c.light_min)}</td><td class="num">${esc(c.launched)}</td><td>${esc(c.agency)}</td></tr>`).join('');
    return `
      <div class="table-wrap"><table>
        <thead><tr><th><span class="visually-hidden">Picture</span></th><th>Spacecraft</th><th>Where</th><th class="num">From the Sun (AU)</th>
          <th class="num">Signal delay</th><th class="num">Launched</th><th>Agency</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  function showSpacecraft(updateHash = true, query = '') {
    selected = null;
    const token = ++selectToken, focus = craftFocus(query);
    title.textContent = focus ? focus.toUpperCase() : 'SPACECRAFT';
    info.innerHTML = '<p class="status">Loading positions…</p>';
    if (updateHash) history.replaceState(null, '', focus ? '#' + encodeURIComponent(query) : '#Spacecraft');
    loadCraft().then(data => {
      if (token !== selectToken) return;
      const rovers = data.rovers.map(r => !craftFound(r) && r.name !== focus
        ? `<li class="unfound">??? · a rover on Mars, still to be found by name. ${esc(EGG.get(craftEgg(r))?.clue || '')}</li>`
        : `<li${r.name === focus ? ' class="focus"' : ''}>${spriteIcon(CRAFT_SPRITE[r.name])} <b><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></b>
        (${esc(r.agency)}): landed in ${esc(r.site)} on ${esc(r.landed)}${r.note ? `; ${esc(r.note)}` : ''}.</li>`).join('');
      info.innerHTML = `
        <p class="big">★ HUMANITY'S ROBOTS ★</p>
        <p>Where our spacecraft beyond Earth orbit were on <b>${esc(data.date)}</b>, from NASA JPL's Horizons system
           (the planets are frozen at their real positions that day too). Spacecraft you've found are white crosses
           with their names; the <b>flashing lights</b> are the ones still to find: search a name to reveal one
           (${fmt(data.spacecraft.filter(craftFound).length)} of ${fmt(data.spacecraft.length)} found). Press FIT to zoom
           out to the Voyagers, or TRUE SCALE and zoom into Earth to find the telescopes at L1 and L2. Satellites
           orbiting Earth are left out; try searching <b>ISS</b>.</p>
        ${focus ? `<p>Found <b>${esc(focus)}</b>: it's the yellow cross${
          data.rovers.some(r => r.name === focus) ? ' on Mars' : ''}, highlighted in the table, with its pixel art
          in the corner of the drawing.</p>` : ''}
        ${craftTable(data, focus)}
        <h3 class="facts-title">ON MARS</h3>
        <ul class="facts">${rovers}</ul>
        <p class="note">Signal delay = how long radio (light) takes to travel between Earth and the spacecraft ·
          sources: ${esc(data.source)}, NASA and ESA mission pages · pixel art drawn from official NASA images
          (and ESA's designs for JUICE and BepiColombo) · you found an easter egg!</p>`;
      paintSpriteIcons(info);
      const sc = buildScene({ ...SOLAR, planets: SOLAR.planets.map(p => ({ ...p, ecc: 0 })) });
      sc.planets.forEach((p, i) => {   // real positions on that date: ecliptic longitude, circular orbits
        const lon = data.planets[SOLAR.planets[i].name]?.lon ?? 0;
        Object.assign(p, { phase: lon * Math.PI / 180, cosw: 1, sinw: 0 });
      });
      sc.frozen = true;
      const gallery = [...data.spacecraft, ...data.rovers]
        .filter(c => CRAFT_SPRITE[c.name] && craftFound(c))
        .filter((c, i, found) => found.findIndex(o => CRAFT_SPRITE[o.name] === CRAFT_SPRITE[c.name]) === i)   // one per sprite
        .map(c => ({ name: c.name, key: CRAFT_SPRITE[c.name],
                     label: c.name.startsWith('Voyager') && craftFoundByName('Voyager 1') && craftFoundByName('Voyager 2') ? 'VOYAGER 1 AND 2' : c.name.toUpperCase() }));
      if (focus) {   // the second Voyager shares the first's sprite
        const own = gallery.find(g => g.name === focus) || { name: focus, key: CRAFT_SPRITE[focus] };
        Object.assign(own, { label: focus.toUpperCase() });
        if (!gallery.includes(own)) gallery.push(own);
      }
      sc.overlay = seconds => { drawCraft(sc, data.spacecraft, seconds, focus); drawCraftInset(gallery, focus, seconds); };
      sc.reach = () => Math.max(...data.spacecraft.map(c => screenRadius(sc, c.r_au)));
      setScene(sc);
    }, () => { if (token === selectToken) info.innerHTML = '<p>Spacecraft positions could not be loaded; check your connection.</p>'; });
  }

  // The station on its orbit, 11 x 5 pixels centred on (x, y): copper solar wings on the truss, modules
  // in the middle (the full-size sprite is CRAFT_ART.iss, shown in the card's corner).
  const ISS_SMALL = ['c.c.....c.c', 'C.C.....C.C', 'mmmmmmmmmmm', 'c.c.lwl.c.c', 'C.C.....C.C'];
  function issSprite(ctx, x, y) {
    x = Math.round(x) - 5; y = Math.round(y) - 2;
    ISS_SMALL.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = CRAFT_INK[ch];
      ctx.fillRect(x + i, y + j, 1, 1);
    }));
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
    const station = (x, y) => issSprite(sctx, x, y);
    const [ix, iy, behind] = at(theta);
    const hidden = behind && Math.hypot(ix - cx, iy - cy) <= EARTH_R_PX + 1;
    orbit(true);
    if (behind && !hidden) station(ix, iy);
    solarPlanet(sctx, cx, cy, { art: 'earth', size: EARTH_R_PX, seed: 'iss', noMoon: true }, -0.9, -0.3, t * 0.4);
    orbit(false);
    if (!behind) station(ix, iy);
    if (!hidden) pixelText(sctx, 'ISS', Math.round(ix) + 7, Math.round(iy) - 8, '#ffd34d');
    drawCraftInset([{ name: 'ISS', key: 'iss', label: 'THE STATION' }], 'ISS', seconds);
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

  // ---------------------------------------------------------------- spacecraft pixel art
  // One small sprite per spacecraft in the easter eggs, hand-drawn from official NASA images
  // (pixel-art/references/, sources in pixel-art/references/SOURCES.md) and, for JUICE and
  // BepiColombo, ESA's published designs. Each row is one line of pixels; letters are colours.
  const CRAFT_INK = {
    w: '#eef2f8', s: '#d6dae2', l: '#b8bfcc', m: '#7d8596', d: '#454b5e', k: '#151a2c',   // white -> black
    g: '#d9a441', G: '#9c6b22', y: '#f3d27a',                                           // gold foil
    p: '#2f4fae', P: '#5d7bd6',                                                         // blue solar cells
    n: '#3a4366', N: '#66729c',                                                         // dark solar arrays
    c: '#b8864a', C: '#6e4e2c',                                                         // the ISS's copper arrays
    q: '#d5c3e0', Q: '#8f7aa8',                                                         // Webb's sunshield
    r: '#b0663a',                                                                       // Martian dust
  };

  const CRAFT_ART = {
    jwst: [   // gold hexagon mirror over the five-layer sunshield
      '.......ygy.......',
      '.....ygggggy.....',
      '....ggyggggyg....',
      '....gggGkGggg....',
      '....ggyggggyg....',
      '.....GggggggG....',
      '.......GGG.......',
      '........d........',
      '...qqqqqqqqqqq...',
      'qqqqqqqqqqqqqqqqq',
      '..QQQQQQQQQQQQQ..',
    ],
    voyager: [   // big white dish, ten-sided bus, science boom one way, power (RTG) boom the other
      '...wwwwwwwww.....',
      '..wllllllllw.....',
      '...wwwwwwwww.....',
      '......dgd........',
      '.mmmmmdgdmmmmmmmk',
      '.d....ddd........',
      '......m..........',
      '.....m...........',
      '....m............',
    ],
    newHorizons: [   // triangular body, dish on top, the black RTG sticking out
      '...wwwwwww...',
      '..wllllllw...',
      '...wwwwwww...',
      '.....ggg.....',
      '....gyggg....',
      '...ggggGgg...',
      '..ggggggGgg..',
      'kkkk.........',
    ],
    parker: [   // white heat shield in front, two small cooled wings, body behind
      '.wwwwwwwwwww.',
      'wsssssssssssw',
      '.mmmmmmmmmmm.',
      '......l......',
      '.p...dld...p.',
      '..p..dgd..p..',
      '...pplllpp...',
      '.....ddd.....',
    ],
    juno: [   // three long blue arrays in a Y around a dish and body
      'pp...........pp',
      '.Pp.........pP.',
      '..pp.......pp..',
      '...pP.www.Pp...',
      '....pwlllwp....',
      '.....dgggd.....',
      '......pp.......',
      '......Pp.......',
      '......pp.......',
      '......pm.......',
    ],
    clipper: [   // the largest planetary spacecraft: two huge dark arrays, dish, body
      '...........www...........',
      'nNnNnNnNnNwlllwnNnNnNnNnN',
      'nnnnnnnnnnndgdnnnnnnnnnnn',
      '...........ddd...........',
    ],
    soho: [   // gold box, two solar wings, dish
      'ppp.ggggg.ppp',
      'PpPmgGyGgmPpP',
      'ppp.ggggg.ppp',
      '.....lwl.....',
    ],
    euclid: [   // telescope tube behind a solar-panel sunshield, service module below
      'nnnnnnn...',
      'nNnNnNnww.',
      'nnnnnnnlw.',
      'nNnNnNnlw.',
      'nnnnnnnww.',
      '..dmmmmd..',
      '..dgggGd..',
    ],
    solarOrbiter: [   // dark heat shield, box body, two long arrays, boom
      'kkkkk..........',
      'kdddkggg.......',
      'kdddkgyGpppppp.',
      'kdddkgggPpPpPp.',
      'kkkkk.m........',
      '......mmmmmm...',
    ],
    bepi: [   // stacked: Mercury orbiter with its long array, Japan's orbiter, transfer module
      'pPpPpPpPp.....',
      'ppppppppplll..',
      '.........lwl..',
      '.........ggg..',
      '.........gGg..',
      'nNnNnNnNnddd..',
      'nnnnnnnnnddd..',
    ],
    juice: [   // a big cross of ten solar panels, dish, long radar antenna
      '......ppp......',
      '......pPp......',
      '......ppp......',
      'pppppplwlpppppp',
      'pPpPpPgwgpPpPpP',
      'ppppppgGgpppppp',
      '......ppp......',
      '......pPp.mmmmm',
      '......ppp......',
    ],
    lucy: [   // two enormous round solar arrays
      '.ppp.......ppp.',
      'ppPpp.....ppPpp',
      'pPPPpmgggmpPPPp',
      'ppPpp.gGg.ppPpp',
      '.ppp..lwl..ppp.',
    ],
    psyche: [   // two cross-shaped five-panel arrays, box body, dish
      '..pp.......pp..',
      'pppppmlwlmppppp',
      'pPpPpdgggdpPpPp',
      'pppppdgGgdppppp',
      '..pp.......pp..',
    ],
    apex: [   // OSIRIS-APEX: box, two wings, dish on top, sample arm
      '.....www.....',
      '....wlllw....',
      'ppp.ggggg.ppp',
      'PpPmgGyGgmPpP',
      'ppp.ggggg.ppp',
      '......m......',
      '.......m.....',
    ],
    mro: [   // Mars Reconnaissance Orbiter: the big 3 m dish over a gold body and two wings
      '...wwwwwww...',
      '..wlllllllw..',
      '...wwwwwww...',
      '......d......',
      'nnnn.ggg.nnnn',
      'NnNnmgGgmNnNn',
      'nnnn.ggg.nnnn',
    ],
    odyssey: [   // gold box, one solar wing, the long gamma-ray boom
      '.....g.......',
      '....ggg.nnnnn',
      'mmmmgGgmNnNnN',
      '....ggg.nnnnn',
      '.....w.......',
    ],
    mex: [   // Mars Express: gold cube, two wings, dish
      '....lww....',
      'ppp.ggg.ppp',
      'PpPmgGgmPpP',
      'ppp.ggg.ppp',
    ],
    tgo: [   // ExoMars Trace Gas Orbiter: big box, two long arrays, dish
      '.....lww......',
      'pppp.gggg.pppp',
      'PpPpmgyGgmPpPp',
      'pppp.gggg.pppp',
      '.....GGGG.....',
    ],
    curiosity: [   // six wheels, white body, mast with the camera head, power unit at the back
      '..........ddd',
      '...........m.',
      '...........m.',
      'kk.........m.',
      'kdwwwwwwwwwwr',
      '.dllllllllll.',
      '..dmmmmmmmmd.',
      '.kk..kk..kk..',
      '.kk..kk..kk..',
    ],
    perseverance: [   // like Curiosity, with the Ingenuity helicopter nearby
      '..........ddd.....',
      '...........m......',
      '...........m...ll.',
      'kk.........m....m.',
      'kdwwwwwwwwwwr..mdm',
      '.dllllllllll...m.m',
      '..dmmmmmmmmd......',
      '.kk..kk..kk.......',
      '.kk..kk..kk.......',
    ],
    iss: [   // eight copper solar wings on the long truss, modules in the middle
      'cc.cc.........cc.cc',
      'Cc.Cc.........cC.cC',
      'cc.cc.........cc.cc',
      'mmmmmmmmmmmmmmmmmmm',
      'cc.cc..lwwwl..cc.cc',
      'Cc.Cc...lwl...cC.cC',
      'cc.cc....l....cc.cc',
    ],
  };

  // Spacecraft name (data/spacecraft.js, rovers) -> sprite.
  const CRAFT_SPRITE = {
    'Voyager 1': 'voyager', 'Voyager 2': 'voyager', 'New Horizons': 'newHorizons',
    'James Webb Space Telescope': 'jwst', Euclid: 'euclid', SOHO: 'soho', 'Parker Solar Probe': 'parker',
    'Solar Orbiter': 'solarOrbiter', BepiColombo: 'bepi', Juno: 'juno', 'Europa Clipper': 'clipper',
    JUICE: 'juice', Lucy: 'lucy', Psyche: 'psyche', 'OSIRIS-APEX': 'apex',
    'Mars Reconnaissance Orbiter': 'mro', 'Mars Odyssey': 'odyssey', 'Mars Express': 'mex',
    'ExoMars Trace Gas Orbiter': 'tgo', Curiosity: 'curiosity', Perseverance: 'perseverance',
  };

  const spriteSize = key => [CRAFT_ART[key][0].length, CRAFT_ART[key].length];

  // Draw sprite `key` with its top-left at (x, y), `px` canvas pixels per art pixel.
  function craftSprite(ctx, key, x, y, px = 1) {
    const art = CRAFT_ART[key];
    if (!art) return;
    art.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = CRAFT_INK[ch];
      ctx.fillRect(x + i * px, y + j * px, px, px);
    }));
  }

  // Fill every <canvas data-sprite="key"> inside `root` (the info panel's icons), scaled to fit.
  function paintSpriteIcons(root) {
    root.querySelectorAll('canvas[data-sprite]').forEach(c => {
      const key = c.dataset.sprite;
      if (!CRAFT_ART[key]) return;
      const [w, h] = spriteSize(key);
      const px = Math.max(1, Math.min(Math.floor(c.width / w), Math.floor(c.height / h)));
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      craftSprite(ctx, key, Math.floor((c.width - w * px) / 2), Math.floor((c.height - h * px) / 2), px);
    });
  }
  const spriteIcon = key => (CRAFT_ART[key] ? `<canvas class="craft-icon" width="50" height="22" data-sprite="${esc(key)}" aria-hidden="true"></canvas>` : '');

  // ---------------------------------------------------------------- easter egg: the Kepler telescope
  // A tiny pixel Kepler sits in the map's empty top-left corner, looking at its field; click it (or
  // search "Kepler" / "telescope" / "goodnight Kepler") for its story: the mission replayed on its
  // Earth-trailing orbit around the Sun. Hand-drawn, not traced from a photo.
  const KEPLER_QUERY = /^(the )?(kepler( space telescope| telescope| spacecraft| mission)?|space telescope|telescope|goodnight,? kepler)$/i;

  // Side view, aperture to the right: solar array on the sun side (top), photometer tube with its
  // slanted sunshade, gold-foil bus and antenna at the back.
  const KEPLER_ART = [
    '.....PPPPPPPPPPPPP....',
    '.....pgpgpgpgpgpgpp...',
    '..bb.ppppppppppppppp..',
    '.bBBBwwwwwwwwwwwwwwwww',
    '.bBBBwWWWwwwwwwwwwwwwk',
    '.bBBBwwwwwwwwwwwwwwwkk',
    '.bBBBssssssssssssssk..',
    '..bb.sssssssssssssk...',
    '..e...................',
    '.eee..................',
  ];
  const KEPLER_INK = {   // colours from NASA's picture (pixel-art/references/spacecraft/kepler.jpg)
    P: '#5a6488', p: '#262b44', g: '#151a2c',     // dark solar array: lit edge, cells, cell gaps
    w: '#d9a441', W: '#f3d27a', s: '#9c6b22',     // photometer tube in gold foil: lit side, glint, shade
    k: '#141a33',                                 // inside the sunshade
    b: '#c8ccd4', B: '#6c7280', e: '#eef2f8',     // silver bus, its shadow, antenna
  };
  const KEPLER_W = KEPLER_ART[0].length, KEPLER_H = KEPLER_ART.length;
  const KEPLER_SPOT = { x: 5, y: 7 };   // map pixels at zoom 1: the field leaves this corner empty

  // Draw the sprite at (x, y), `px` canvas pixels per art pixel; `glint` (0..1, or null) runs a
  // highlight along the solar array.
  function keplerSprite(ctx, x, y, px, glint) {
    const gx = glint == null ? -9 : 5 + Math.round(glint * 13);
    KEPLER_ART.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = j < 2 && Math.abs(i - gx) < 1 ? '#e8f4ff' : KEPLER_INK[ch];
      ctx.fillRect(x + i * px, y + j * px, px, px);
    }));
  }

  const keplerOnMap = () => view.zoom === 1 && !depth;
  function overKepler(evt) {
    if (!keplerOnMap()) return false;
    const [x, y] = canvasPoint(evt);
    return x >= KEPLER_SPOT.x - 3 && x <= KEPLER_SPOT.x + KEPLER_W + 3 &&
           y >= KEPLER_SPOT.y - 3 && y <= KEPLER_SPOT.y + KEPLER_H + 3;
  }

  // On the map (called from drawMap, ~8 fps): the sprite, a faint dotted view cone toward the
  // field, and a glint across the panels every few seconds.
  function drawKeplerOnMap(t) {
    if (!keplerOnMap()) return;
    const { x, y } = KEPLER_SPOT, ax = x + KEPLER_W, ay = y + 5;
    mctx.fillStyle = '#2b3566';
    for (const turn of [-0.22, 0.22]) {
      const a = Math.atan2(MH / 2 - ay, MW / 2 - ax) + turn;
      for (let d = 3; d <= 15; d += 3) mctx.fillRect(Math.round(ax + d * Math.cos(a)), Math.round(ay + d * Math.sin(a)), 1, 1);
    }
    const cycle = (t / 1000) % 5;   // a 1-second sweep every 5 seconds
    keplerSprite(mctx, x, y, 1, REDUCED_MOTION || cycle > 1 ? null : cycle);
  }

  // The mission on its orbit. Kepler trailed Earth around the Sun and fell slowly behind, about
  // 1 AU away by the end (NASA); the drift here is a steady rate that ends there (illustrative).
  const MISSION = { start: 2009.18, end: 2018.87, wheels: 2013.37, k2: 2014.4 };
  const DRIFT_PER_YEAR = 2 * Math.asin(0.5) / (MISSION.end - MISSION.start);   // chord 1 AU at the end
  const KEPLER_LOOP_S = 22, KEPLER_HOLD_S = 4;   // replay speed, then a pause on the last frame

  function missionYear(seconds) {
    if (REDUCED_MOTION) return MISSION.end;
    const s = seconds % (KEPLER_LOOP_S + KEPLER_HOLD_S);
    return MISSION.start + (MISSION.end - MISSION.start) * Math.min(1, s / KEPLER_LOOP_S);
  }

  function drawKeplerStory(seconds) {
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 60; k++) {
      sctx.fillStyle = k % 7 === 0 ? '#4a5590' : '#1e2550';
      sctx.fillRect(Math.floor(hash('kb' + k) * SW), Math.floor(hash('ky' + k) * SH), 1, 1);
    }
    const year = missionYear(seconds), done = year >= MISSION.end;
    const yrs = year - MISSION.start;

    // Left: the Sun, Earth's orbit, Earth and Kepler (seen from above Earth's north pole).
    const sx = 62, sy = 64, R = 46, squash = 0.62;
    const at = a => [sx + R * Math.cos(a), sy - R * squash * Math.sin(a)];
    sctx.fillStyle = '#3a4888';
    for (let k = 0; k < 96; k += 2) {
      const [x, y] = at((k / 96) * 2 * Math.PI);
      sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    disc(sctx, sx, sy, 5, '#ffd34d');
    const earthA = 2 * Math.PI * (yrs % 1) + 0.6, lag = DRIFT_PER_YEAR * yrs;
    sctx.fillStyle = '#8a6d1f';   // how far behind Earth Kepler has fallen
    for (let a = earthA - lag + 0.06; a < earthA - 0.06; a += 0.05) {
      const [x, y] = at(a);
      sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const [ex, ey] = at(earthA), [kx, ky] = at(earthA - lag);
    disc(sctx, ex, ey, 2, '#2f6fd0');
    sctx.fillStyle = '#4f9a46';
    sctx.fillRect(Math.round(ex), Math.round(ey) - 1, 1, 1);
    sctx.fillStyle = done ? '#6f86a8' : '#e8f4ff';
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sctx.fillRect(Math.round(kx) + dx, Math.round(ky) + dy, 1, 1);
    pixelText(sctx, 'EARTH', Math.round(ex) + 4, Math.round(ey) - 2, '#9fd8ff');
    if (lag > 0.25) pixelText(sctx, 'KEPLER', Math.round(kx) + 4, Math.round(ky) - 2, '#ffd34d');
    pixelText(sctx, 'SUN', sx - 5, sy + 8, '#8a6d1f');

    // Right: the spacecraft itself, big, and what it was doing that year.
    const bx = 146, by = 10;
    keplerSprite(sctx, bx, by, 4, REDUCED_MOTION || done ? null : (seconds % 3) / 3);
    const phase = year < MISSION.wheels ? ['STARING AT', 'CYGNUS AND LYRA']
      : year < MISSION.k2 ? ['2 OF 4 WHEELS', 'FAILED. RETHINK']
      : !done ? ['K2 MISSION', 'ALONG THE ECLIPTIC']
      : ['OUT OF FUEL', 'GOODNIGHT KEPLER'];
    const tx = 140;
    pixelText(sctx, String(Math.floor(year)), tx, 56, '#ffd34d');
    pixelText(sctx, phase[0], tx, 66, '#c8d0ff');
    pixelText(sctx, phase[1], tx, 74, done ? '#ffd34d' : '#c8d0ff');
    pixelText(sctx, `${fmt(2 * Math.sin(lag / 2), 1)} AU FROM EARTH`, tx, 88, '#5a6a8a');

    // Bottom strip: the mission timeline.
    const H = SH - STRIP, x0 = 8, x1 = SW - 8, toX = y => x0 + (y - MISSION.start) / (MISSION.end - MISSION.start) * (x1 - x0);
    sctx.fillStyle = '#3a4888';
    sctx.fillRect(x0, H + 8, x1 - x0, 1);
    sctx.fillStyle = '#ff8c42';   // the second reaction wheel fails
    sctx.fillRect(Math.round(toX(MISSION.wheels)), H + 6, 1, 5);
    sctx.fillStyle = '#ffd34d';
    sctx.fillRect(Math.round(toX(year)) - 1, H + 6, 3, 5);
    pixelText(sctx, '2009', x0, H + 13, '#5a6a8a');
    pixelText(sctx, 'K2', Math.round(toX(MISSION.k2)) - 3, H + 13, '#5a6a8a');
    pixelText(sctx, '2018', x1 - textWidth('2018'), H + 13, '#5a6a8a');
  }

  function showKepler(updateHash = true) {
    selected = null;
    ++selectToken;
    title.textContent = 'THE KEPLER SPACE TELESCOPE';
    const confirmed = STARS.reduce((n, s) => n + (s[COL.nconf] || 0), 0);
    const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`;
    info.innerHTML = `
      <p class="big">★ THE PLANET HUNTER ★</p>
      <p>Every star on this map was watched by one spacecraft. Kepler stared at the same patch of sky in Cygnus
         and Lyra for four years, measuring the brightness of about <b>150,000 stars</b> every 30 minutes, waiting
         for the tiny dips of planets passing in front of them. The drawing replays its mission on its orbit.</p>
      <ul class="facts">
        <li>Launched <b>7 March 2009</b> on a Delta II rocket from Cape Canaveral, Florida.</li>
        <li>Its camera had <b>42 CCDs and 95 megapixels</b> behind a 1.4 m mirror; the squares on the map are
            those chips (press CCDS).</li>
        <li>It didn't orbit Earth: it <b>trailed Earth around the Sun</b>, slowly falling behind, about
            151 million km (1 AU) from Earth by the end.</li>
        <li>In <b>2013</b> the second of its four reaction wheels failed and it could no longer hold still. Engineers
            balanced it against the pressure of sunlight instead: the <b>K2</b> mission (2014–2018) looked at fields
            along the ecliptic.</li>
        <li>Retired on <b>30 October 2018</b>, out of fuel. Its last commands were sent on 15 November 2018,
            the anniversary of Johannes Kepler's death: <b>"Goodnight Kepler"</b>.</li>
        <li>Thousands of planets confirmed from its data, ${fmt(confirmed)} of them around the stars on this map.</li>
      </ul>
      <p>${link(`${NASA_SCIENCE}mission/kepler/`, 'NASA: the Kepler mission')} ·
         ${link('https://exoplanetarchive.ipac.caltech.edu/', 'NASA Exoplanet Archive')} ·
         ${link('https://archive.stsci.edu/missions-and-data/kepler', 'Kepler data at MAST')}</p>
      <p class="note">Sources: NASA Kepler mission pages · the orbit drawing is illustrative (Kepler's drift is
        shown at a steady rate) · you found an easter egg!</p>`;
    setScene({ custom: drawKeplerStory });
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#Kepler');
  }

  // ---------------------------------------------------------------- easter eggs: the five dwarf planets
  // Pluto, Ceres, Haumea, Makemake and Eris, the five the IAU recognises (docs/plans/WORLDS_MOONS_AND_SCREENS.md).
  // Searching one opens a close-up: the world turning, its known moons on (not-to-scale) orbits, and a card of
  // facts from NASA. Finding all five earns DWARF KING (48-gallery.js). Moon periods: NASA / JPL; Makemake's
  // moon's period is still uncertain.
  const DWARFS = {
    pluto: {
      name: 'Pluto', km: 2377, stretch: 1, art: (dx, dy, r, spin) => SOLAR_ART.pluto(dx, dy, r, spin),
      moons: [['CHARON', 6.387, '#9c958e', 2], ['STYX', 20.16, '#8f8a86', 1], ['NIX', 24.85, '#b5b0aa', 1],
              ['KERBEROS', 32.17, '#7f7a76', 1], ['HYDRA', 38.2, '#c2bdb6', 1]],
      url: `${NASA_SCIENCE}dwarf-planets/pluto/`,
      facts: [
        'Found by Clyde Tombaugh at Lowell Observatory in 1930, and counted as the ninth planet until 2006.',
        'About 2,377 km across, smaller than our Moon (3,475 km). It takes 248 years to circle the Sun, 30 to 49 times as far out as Earth.',
        'New Horizons flew past in July 2015 and found a heart-shaped plain of nitrogen ice (Tombaugh Regio) and mountains of water ice.',
        'Five moons. Charon is half Pluto\'s size, so the two circle a point in the space between them.',
      ],
    },
    ceres: {
      name: 'Ceres', km: 939, stretch: 1,
      art: (dx, dy, r, spin) => {   // grey, cratered, with Occator's bright salt spots turning into view
        const P = 4 * r + 2, u = (((dx + spin + P / 2) % P) + P) % P - P / 2;
        if (Math.hypot(u - r * 0.3, dy + r * 0.25) < Math.max(1, r * 0.09)) return '#ffffff';
        return hash(`ce${Math.floor((dx + spin) / 2)},${Math.floor(dy / 2)}`) < 0.22 ? '#6d6a66' : '#8f8b86';
      },
      moons: [],
      url: `${NASA_SCIENCE}dwarf-planets/ceres/`,
      facts: [
        'The first one found: Giuseppe Piazzi spotted it on 1 January 1801. It was called a planet, then an asteroid, and since 2006 a dwarf planet.',
        'About 940 km across, the largest object in the asteroid belt between Mars and Jupiter, and the only dwarf planet in the inner Solar System.',
        'NASA\'s Dawn orbited it from 2015 to 2018. The bright spots in Occator crater are salts (sodium carbonate) left behind by briny water from below.',
        'No known moons.',
      ],
    },
    haumea: {
      name: 'Haumea', km: 2322, stretch: 1.55,
      art: (dx, dy, r) => (hash(`ha${dx},${dy}`) < 0.12 ? '#cfccc6' : '#ecebe7'),   // bright crystalline water ice
      ring: '#a9a59c',
      moons: [['NAMAKA', 18.3, '#c8c4bc', 1], ['HIIAKA', 49.5, '#dedad2', 1]],
      url: `${NASA_SCIENCE}dwarf-planets/haumea/`,
      facts: [
        'It spins once every 3.9 hours, one of the fastest-spinning large objects known, which has stretched it into an egg about 2,300 km long and half as wide.',
        'A ring was discovered around it in 2017, when it passed in front of a star: the first ring found around a dwarf planet.',
        'Two moons, Hiʻiaka and Namaka, named after daughters of Haumea, the Hawaiian goddess of childbirth.',
        'Found in 2004 and 2005; credit is shared between teams in the United States and Spain. It takes about 284 years to circle the Sun.',
      ],
    },
    makemake: {
      name: 'Makemake', km: 1430, stretch: 1,
      art: (dx, dy, r, spin) => (hash(`mk${Math.floor((dx + spin) / 2)},${Math.floor(dy / 2)}`) < 0.3 ? '#9a5f45' : '#b97a58'),
      moons: [['MK2', 12.4, '#4a3a33', 1]],
      url: `${NASA_SCIENCE}dwarf-planets/makemake/`,
      facts: [
        'Found in 2005, shortly after Easter, by Mike Brown\'s team at Palomar Observatory, and named after Makemake, the creator god of Rapa Nui (Easter Island).',
        'About 1,430 km across, reddish-brown, with frozen methane on its surface. It takes about 305 years to circle the Sun.',
        'One small, dark moon, nicknamed MK2, spotted by the Hubble Space Telescope in 2016; its orbit is still uncertain (drawn here at about 12 days).',
      ],
    },
    eris: {
      name: 'Eris', km: 2326, stretch: 1,
      art: (dx, dy, r, spin) => (hash(`er${Math.floor((dx + spin) / 2)},${dy}`) < 0.15 ? '#d9d9de' : '#f4f4f6'),
      moons: [['DYSNOMIA', 15.79, '#8d8b88', 1]],
      url: `${NASA_SCIENCE}dwarf-planets/eris/`,
      facts: [
        'Found in 2005 (in pictures taken in 2003) by Mike Brown, Chad Trujillo and David Rabinowitz. A world about Pluto\'s size forced astronomers to define "planet": in 2006 the IAU did, and Pluto became a dwarf planet.',
        'About 2,326 km across, a little smaller than Pluto but about 27% more massive.',
        'One of the most reflective bodies in the Solar System, coated in frozen methane. Its orbit takes about 557 years and reaches more than twice as far out as Pluto\'s.',
        'One moon, Dysnomia, named after Eris\'s daughter in Greek myth, the spirit of lawlessness.',
      ],
    },
  };
  const DWARF_QUERY = /^(the )?(dwarf planet )?(pluto|ceres|haumea|makemake|eris)$/i;
  const dwarfFor = q => { const m = DWARF_QUERY.exec(q); return m ? m[3].toLowerCase() : null; };

  // A lit, possibly stretched (Haumea) pixel globe; the ring, if any, is split behind and in front.
  function dwarfBody(ctx, x, y, r, d, lx, ly, t) {
    const x0 = Math.round(x), y0 = Math.round(y), sx = d.stretch, spin = REDUCED_MOTION ? 0 : t * 1.5;
    const ring = d.ring ? [r * sx * 1.6, r * 0.55, d.ring] : null;
    if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], false);
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8) * sx);
      for (let dx = -w; dx <= w; dx++) {
        const lit = (dx / sx * lx + dy * ly) / (r + 0.5);
        const f = r < 8 ? (lit > 0.3 ? 1.15 : lit < -0.35 ? 0.45 : 0.9)
          : lit > 0.45 ? 1.12 : lit > 0.1 ? 1 : lit > -0.2 ? 0.85 : lit > -0.45 ? 0.62 : 0.42;
        ctx.fillStyle = shade(d.art(Math.round(dx / sx), dy, r, spin).toLowerCase(), f);
        ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
      }
    }
    if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], true);
  }

  function drawDwarf(key, seconds) {
    const d = DWARFS[key], t = REDUCED_MOTION ? 0 : seconds;
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 70; k++) {
      sctx.fillStyle = k % 7 ? '#1e2550' : '#4a5590';
      sctx.fillRect(Math.floor(hash('dw' + k) * SW), Math.floor(hash('dv' + k) * SH), 1, 1);
    }
    const cx = Math.round(SW / 2), cy = Math.round(SH / 2) - 6, r = 22, FLAT = 0.45;
    const reach = (d.ring ? r * d.stretch * 1.6 : r * d.stretch) + 7;   // moons circle outside the globe (and ring)
    const orbit = k => reach + 12 * k;
    const onGlobe = (x, y, pad = 1) => ((x - cx) / (r * d.stretch + pad)) ** 2 + ((y - cy) / (r + pad)) ** 2 < 1;
    d.moons.forEach((m, k) => {   // dotted orbits, broken where the globe hides them
      sctx.fillStyle = '#26305e';
      for (let a = 0; a < 2 * Math.PI; a += 0.1) {
        const x = cx + orbit(k) * Math.cos(a), y = cy + orbit(k) * FLAT * Math.sin(a);
        if (!(Math.sin(a) < 0 && onGlobe(x, y))) sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    });
    const placed = d.moons.map(([name, period, colour, size], k) => {
      const a = t * 2 / Math.sqrt(period) + hash(name) * 6.3;
      return { name, colour, size, x: cx + orbit(k) * Math.cos(a), y: cy + orbit(k) * FLAT * Math.sin(a), behind: Math.sin(a) < 0 };
    });
    const moon = m => {
      if (m.behind && onGlobe(m.x, m.y)) return;   // hidden behind the world
      sctx.fillStyle = m.colour;
      sctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      const w = textWidth(m.name), lx = Math.round(Math.min(Math.max(1, m.x + 3), SW - w - 1)), ly = Math.round(m.y - 7);
      if (!onGlobe(lx, ly + 2, 3) && !onGlobe(lx + w, ly + 2, 3)) pixelText(sctx, m.name, lx, ly, '#7f8ab8');   // never over the globe
    };
    placed.filter(m => m.behind).forEach(moon);
    dwarfBody(sctx, cx, cy, r, d, -0.8, -0.5, t);
    placed.filter(m => !m.behind).forEach(moon);
    const label = `${d.name.toUpperCase()} · ${fmt(d.km)} KM`.replace(' · ', ' - ');
    pixelText(sctx, label, 4, SH - 18, '#ffd34d');
    pixelText(sctx, d.moons.length ? 'MOON ORBITS NOT TO SCALE' : 'NO KNOWN MOONS', 4, SH - 10, '#5a6a8a');
  }

  function showDwarf(key, updateHash = true) {
    const d = DWARFS[key];
    selected = null;
    ++selectToken;
    title.textContent = d.name.toUpperCase();
    const others = Object.keys(DWARFS).filter(k => k !== key)
      .map(k => (progress.eggs[k] ? `<b>${esc(DWARFS[k].name)}</b>` : '???')).join(', ');
    info.innerHTML = `
      <p class="big">★ DWARF PLANET ★</p>
      <ul class="facts">${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <p>The other dwarf planets: ${others}. Find all five for <b>DWARF KING</b>.</p>
      <p class="note">Source: <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">NASA: ${esc(d.name)}</a> ·
        the drawing is pixel art, not a photo · you found an easter egg!</p>`;
    setScene({ custom: seconds => drawDwarf(key, seconds) });
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#' + d.name);
  }

  // ---------------------------------------------------------------- the lost astronaut and their wardrobe
  // The astronaut of LOST IN ORBIT (the empty system view, the UNIVERSE view's flare). Once caught, searching
  // "astronaut" visits them. The 2nd visit always brings an outfit, so players learn the game; after that each
  // visit rolls for one (at most every 15 minutes): rare finds, with the Texas cowboy hat (HOUSTON, WE HAVE A
  // PROBLEM) the rarest. Outfits you own can be worn from the card; whichever they wear shows everywhere they
  // appear. This part loads before 50-wiring.js, whose search can run while the page is still loading.
  const ASTRONAUT = ['.www.', 'wooow', 'wooow', '.www.', 'wwwww', 'wwwww', '.w.w.', '.w.w.'];
  // Hats: 7 x 4 art pixels over the helmet (the last row sits on the helmet's top).
  const OUTFITS = [
    // common
    { id: 'party', tier: 'common', name: 'party hat', rows: ['...y...', '..ppp..', '..pyp..', '.ppppp.'],
      caption: 'Somewhere in the universe it is always somebody\'s birthday.' },
    { id: 'cap', tier: 'common', name: 'NASA cap', rows: ['.......', '..uuu..', '..uwu..', '.uuuuuu'],
      caption: 'Standard issue, for the off-duty hours.' },
    { id: 'chef', tier: 'common', name: 'chef\'s hat', rows: ['.WWWWW.', '.WWWWW.', '..WWW..', '..mmm..'],
      caption: 'Space food has come a long way since the tubes and cubes of the 1960s.' },
    { id: 'headphones', tier: 'common', name: 'headphones', rows: ['.......', '..kkk..', '.k...k.', '.r...r.'],
      caption: 'Sound needs air to travel; inside the helmet, the music plays just fine.' },
    { id: 'beanie', tier: 'common', name: 'knit beanie', rows: ['...W...', '..rrr..', '.rrrrr.', '.WWWWW.'],
      caption: 'Out in the shade, a spacesuit has to keep its wearer warm.' },
    // rare
    { id: 'tophat', tier: 'rare', name: 'top hat', rows: ['..kkk..', '..kkk..', '..rrr..', '.kkkkk.'],
      caption: 'Dressed for a very formal spacewalk.' },
    { id: 'pirate', tier: 'rare', name: 'pirate hat', rows: ['.......', '..kkk..', '.kkWkk.', 'kkkkkkk'],
      caption: 'No survey has detected a space pirate. Yet.' },
    { id: 'propeller', tier: 'rare', name: 'propeller beanie', rows: ['.rrkuu.', '...k...', '..ryu..', '.rryuu.'],
      caption: 'A propeller does nothing in empty space: Mars\'s helicopter Ingenuity needed the thin Martian air to fly.' },
    { id: 'graduate', tier: 'rare', name: 'graduation cap', rows: ['...y...', 'kkkkkky', '..kkk.y', '......y'],
      caption: 'Graduated in Computer Vision (ITAI 1378), with honours in drifting.' },
    { id: 'flowers', tier: 'rare', name: 'flower crown', rows: ['.......', '.......', '.p.y.r.', 'gpgygrg'],
      caption: 'The first flower grown in space bloomed on the space station in January 2016: a zinnia.' },
    // epic
    { id: 'wizard', tier: 'epic', name: 'wizard hat', rows: ['...v...', '..vvv..', '..vyv..', '.vvvvv.'],
      caption: 'Any sufficiently advanced technology is indistinguishable from magic (Arthur C. Clarke).' },
    { id: 'viking', tier: 'epic', name: 'Viking helmet', rows: ['i.....i', 'i.mmm.i', '.immmi.', '.mmmmm.'],
      caption: 'NASA\'s first Mars landers, in 1976, were called Viking.' },
    { id: 'santa', tier: 'epic', name: 'Santa hat', rows: ['.....rW', '..rrrr.', '.rrrr..', '.WWWWW.'],
      caption: 'On Christmas Eve 1968, Apollo 8 sent home a reading from lunar orbit.' },
    { id: 'halo', tier: 'epic', name: 'halo', rows: ['..yyy..', '.y...y.', '..yyy..', '.......'],
      caption: 'Halos around the Sun and Moon are real: ice crystals in high clouds bend the light.' },
    // legendary
    { id: 'cowboy', tier: 'legendary', name: 'Texas cowboy hat', rows: ['.......', '..bbb..', '..kkk..', 'bbbbbbb'],
      caption: 'Mission Control for NASA\'s crewed flights is in Houston, Texas: the rarest find in the wardrobe.' },
    // special: not dropped, given for DWARF KING
    { id: 'crown', tier: 'special', name: 'dwarf king\'s crown', needs: 'dwarf-king', rows: ['.......', '.y.y.y.', '.yyyyy.', '.yrybg.'],
      caption: 'Crowned by all five dwarf planets: you found them.' },
  ];
  const OUTFIT_INK = { w: '#e6ecff', W: '#ffffff', o: '#ff9a3c', b: '#8a5a2b', k: '#1a1a24', y: '#ffd34d', p: '#ff6ec7',
                       r: '#e04a4a', g: '#4fd17a', u: '#3b8cff', v: '#8a5ad6', i: '#f0e6c8', m: '#9aa6b8' };
  // The drop table (the per-visit odds are shown to players on the card)
  const DROP_CHANCE = 0.5, DROP_COOLDOWN_MS = 15 * 60 * 1000, PITY_AFTER = 6;
  const TIER_WEIGHTS = [['common', 0.60], ['rare', 0.28], ['epic', 0.09], ['legendary', 0.03]];
  const TIER_WORD = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', special: 'SPECIAL' };
  const DROPPABLE = OUTFITS.filter(o => o.tier !== 'special');

  const ASTRO_W = 21, ASTRO_H = 36;   // 7 x 12 art pixels at 3 x 3: hat rows on top of the 5 x 8 astronaut
  const astronautCanvases = new Map();
  function astronautSprite(outfitId = progress.outfit) {
    const outfit = OUTFITS.find(o => o.id === outfitId) || null, key = outfit ? outfit.id : '';
    if (!astronautCanvases.has(key)) {
      astronautCanvases.set(key, layer(ASTRO_W, ASTRO_H, put => {
        const art = (rows, x0, y0) => rows.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === '.') return;
          for (let k = 0; k < 9; k++) put((x0 + c) * 3 + (k % 3), (y0 + r) * 3 + Math.floor(k / 3), OUTFIT_INK[ch]);
        }));
        art(ASTRONAUT, 1, 4);
        if (outfit) art(outfit.rows, 0, 1);
      }));
    }
    return astronautCanvases.get(key);
  }
  function drawAstronaut(ctx, x, y, angle, scale = 1) {   // rotated as one image, so it stays solid at every angle
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.drawImage(astronautSprite(), -ASTRO_W / 2 * scale, -24 * scale, ASTRO_W * scale, ASTRO_H * scale);
    ctx.restore();
  }

  // ---- a visit: maybe a new outfit
  function rollOutfit() {
    const owned = new Set(progress.outfits), unseen = list => list.filter(o => !owned.has(o.id));
    if (progress.astroDry >= PITY_AFTER) {   // bad-luck protection: something new, never the legendary hat
      const pool = unseen(DROPPABLE.filter(o => o.tier !== 'legendary'));
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    }
    if (Math.random() >= DROP_CHANCE) return null;
    let r = Math.random(), tier = TIER_WEIGHTS[0][0];
    for (const [name, weight] of TIER_WEIGHTS) { if (r < weight) { tier = name; break; } r -= weight; }
    const inTier = DROPPABLE.filter(o => o.tier === tier), fresh = unseen(inTier);
    const pool = fresh.length ? fresh : inTier;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function visitAstronaut() {   // what this visit brings: { outfit, isNew, note }
    const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
    progress.astroVisits = (progress.astroVisits || 0) + 1;
    if (!progress.astroDays.includes(day)) progress.astroDays = [...progress.astroDays, day].slice(-30);
    const crown = OUTFITS.find(o => o.id === 'crown');
    if (progress.ach['dwarf-king'] && !progress.outfits.includes('crown')) return { outfit: crown, isNew: true };
    if (progress.astroVisits === 1) return { outfit: null, note: 'first' };
    let outfit = null;
    if (progress.astroVisits === 2) {   // always something on the 2nd visit, so the idea is clear
      const pool = DROPPABLE.filter(o => o.tier === 'common' && !progress.outfits.includes(o.id));
      outfit = pool[Math.floor(Math.random() * pool.length)] || DROPPABLE[0];
    } else if (now - (progress.astroLastRoll || 0) < DROP_COOLDOWN_MS) {
      return { outfit: null, note: 'soon' };
    } else {
      outfit = rollOutfit();
    }
    progress.astroLastRoll = now;
    const isNew = Boolean(outfit && !progress.outfits.includes(outfit.id));
    progress.astroDry = isNew ? 0 : (progress.astroDry || 0) + 1;
    return { outfit, isNew, note: outfit ? '' : 'nothing' };
  }
  function wardrobeAchievements() {
    const owned = OUTFITS.filter(o => progress.outfits.includes(o.id));
    if (owned.length) achieve('first-outfit');
    if (owned.some(o => o.tier === 'rare')) achieve('rare-threads');
    if (owned.some(o => o.tier === 'epic')) achieve('runway');
    if (owned.some(o => o.id === 'cowboy')) achieve('houston');
    if (owned.filter(o => o.tier !== 'special').length >= 7) achieve('walk-in-closet');
    if (DROPPABLE.every(o => progress.outfits.includes(o.id))) achieve('space-wardrobe');
    if (progress.astroDays.length >= 3) achieve('visiting-hours');
  }

  // "astronaut" (after LOST IN ORBIT): a visit.
  const ASTRO_QUERY = /^(the )?(lost )?(astronaut|spaceman|spacewoman|lost in orbit)$/i;
  function showAstronaut(updateHash = true) {
    const visit = visitAstronaut();
    if (visit.outfit) {
      progress.outfit = visit.outfit.id;
      if (!progress.outfits.includes(visit.outfit.id)) progress.outfits.push(visit.outfit.id);
    }
    saveProgress();
    wardrobeAchievements();
    selected = null;
    ++selectToken;
    title.textContent = 'LOST IN ORBIT';
    renderAstronautCard(visit);
    setScene({ custom: seconds => {
      const t = REDUCED_MOTION ? 0 : seconds;
      sctx.fillStyle = '#070b1a';
      sctx.fillRect(0, 0, SW, SH);
      for (let k = 0; k < 70; k++) {
        sctx.fillStyle = k % 6 ? '#1e2550' : '#4a5590';
        sctx.fillRect(Math.floor(hash('as' + k) * SW), Math.floor(hash('at' + k) * SH), 1, 1);
      }
      const cx = SW / 2 + 8 * Math.sin(t * 0.4), cy = SH / 2 + 4 * Math.cos(t * 0.3);
      sctx.fillStyle = '#4a5590';
      for (let k = 0; k < 30; k++) sctx.fillRect(Math.round(cx + 16 + k * 2), Math.round(cy + 14 + Math.sin(k / 3 + t * 1.5) * 3 + k * 0.5), 1, 1);
      drawAstronaut(sctx, cx, cy, t * 0.35, 2);
      const wearing = OUTFITS.find(o => o.id === progress.outfit);
      const label = wearing ? `${TIER_WORD[wearing.tier]}: ${wearing.name.toUpperCase().replace(/'/g, '')}` : 'NO OUTFIT YET';
      pixelText(sctx, label, Math.round((SW - textWidth(label)) / 2), SH - 14, wearing && wearing.tier === 'legendary' ? '#ffd34d' : '#c8d0ff');
    } });
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#astronaut');
  }

  function renderAstronautCard(visit) {
    const wearing = OUTFITS.find(o => o.id === progress.outfit);
    const news = visit.note === 'first'
      ? 'They\'re just glad to see a friendly face. They have been rummaging through the supply crates, though: come back and see what turns up.'
      : visit.note === 'soon'
        ? `Still wearing ${wearing ? `the ${wearing.name}` : 'their plain suit'}. They're busy right now: come back in a little while.`
        : visit.note === 'wear'
          ? `Now wearing ${wearing ? `the <b>${esc(wearing.name)}</b>` : 'their plain suit'}.`
        : visit.note === 'nothing'
          ? `They tried something on, but went back to ${wearing ? `the ${wearing.name}` : 'the plain suit'}. Maybe next time.`
          : visit.isNew ? `New in the wardrobe: <b>${esc(visit.outfit.name)}</b> (${esc(TIER_WORD[visit.outfit.tier].toLowerCase())}). ${esc(visit.outfit.caption)}`
            : `The <b>${esc(visit.outfit.name)}</b> again: a favourite.`;
    const owned = OUTFITS.filter(o => progress.outfits.includes(o.id));
    const buttons = owned.map(o => `<button type="button" class="ghost outfit-pick" data-outfit="${esc(o.id)}"
        aria-pressed="${o.id === progress.outfit}">${esc(o.name)}</button>`).join(' ');
    info.innerHTML = `
      <p class="big">★ MISSION CONTROL, HOUSTON ★</p>
      <p>${news}</p>
      <p>Wardrobe: <b>${owned.filter(o => o.tier !== 'special').length} of ${DROPPABLE.length}</b> found by visiting${
         owned.some(o => o.tier === 'special') ? `, plus ${owned.filter(o => o.tier === 'special').map(o => `the <b>${esc(o.name)}</b>`).join(' and ')} (special)` : ''}.
         ${owned.length ? 'Choose what they wear:' : ''}</p>
      ${owned.length ? `<p class="outfit-picks">${buttons}<button type="button" class="ghost outfit-pick" data-outfit=""
        aria-pressed="${!progress.outfit}">plain suit</button></p>` : ''}
      <p class="note">Visit every so often: each visit (at most one every 15 minutes) has a 50% chance of an outfit.
        Of those: common 60%, rare 28%, epic 9%, legendary 3%. Six visits in a row with nothing new, and the next one
        brings something new. The real line from Apollo 13, on 13 April 1970, was "Houston, we've had a problem".</p>`;
    info.querySelectorAll('[data-outfit]').forEach(b => b.addEventListener('click', () => {
      progress.outfit = b.dataset.outfit;
      saveProgress();
      renderAstronautCard({ outfit: null, note: 'wear' });
    }));
  }

  // ---------------------------------------------------------------- easter egg: The Martian (a fan nod)
  // Andy Weir's 2011 novel and the 2015 film: an astronaut left behind at the Ares 3 base on Acidalia Planitia grows
  // potatoes to survive. Searching "martian man" opens a Mars farm in pixel art: the Hab, a glass biodome where potato
  // rows grow through a whole crop while an astronaut tends them (in whatever outfit they wear, 47c-astronaut.js),
  // solar panels and a rover. Watching a crop all the way to harvest earns SPACE FARMER. The Galleria card shows
  // NASA's real work on farming Mars as references (no film stills: those are the studio's).
  const MARTIAN_QUERY = /^(the )?martian man$/i;   // the only way in: the Galleria clue points to it
  const CROP_MS = 60_000;   // one crop, sprout to harvest, in a minute of watching
  let martianSince = 0, cropDone = false;

  function drawMartianBase(ctx, w, h, t, growth) {
    const horizon = Math.round(h * 0.6);
    for (let y = 0; y < horizon; y++) {   // a butterscotch sky, paler near the ground
      const f = y / horizon;
      ctx.fillStyle = f < 0.35 ? '#c99a70' : f < 0.7 ? '#d8ac80' : '#e6c29a';
      ctx.fillRect(0, y, w, 1);
    }
    ctx.fillStyle = '#f6eedb';   // a small, pale Sun: Mars is half again as far out as Earth
    ctx.fillRect(Math.round(w * 0.82), Math.round(h * 0.12), 3, 3);
    for (let x = 0; x < w; x++) {   // far hills, then the rusty plain with rocks
      const hill = horizon - 3 - Math.round(4 * hash(`mh${x >> 3}`) + 2 * Math.sin(x / 9));
      ctx.fillStyle = '#9a5634';
      ctx.fillRect(x, hill, 1, horizon - hill);
    }
    ctx.fillStyle = '#b5623a';
    ctx.fillRect(0, horizon, w, h - horizon);
    for (let k = 0; k < 90; k++) {
      ctx.fillStyle = k % 3 ? '#9a4f2c' : '#7d3b20';
      ctx.fillRect(Math.floor(hash(`mr${k}`) * w), horizon + 2 + Math.floor(hash(`ms${k}`) * (h - horizon - 2)), k % 5 ? 1 : 2, 1);
    }
    const base = horizon + Math.round(h * 0.12);
    // the Hab: a squat white dome with an airlock and an antenna
    const hx = Math.round(w * 0.16), hw = Math.round(w * 0.2), hh = Math.round(h * 0.13);
    for (let dx = -hw / 2; dx <= hw / 2; dx++) {
      const top = Math.round(hh * Math.sqrt(1 - (2 * dx / hw) ** 2));
      ctx.fillStyle = dx > hw * 0.15 ? '#c4beb3' : '#ece8e0';
      ctx.fillRect(hx + dx, base - top, 1, top);
    }
    ctx.fillStyle = '#d9d4ca'; ctx.fillRect(hx - hw / 2 - 5, base - 7, 6, 7);   // airlock
    ctx.fillStyle = '#5d6878'; ctx.fillRect(hx - hw / 2 - 4, base - 5, 2, 5);
    ctx.fillStyle = '#8a8f9a'; ctx.fillRect(hx + 2, base - hh - 6, 1, 6); ctx.fillRect(hx + 1, base - hh - 6, 3, 1);
    // a pressurised tunnel to the biodome
    const dx0 = Math.round(w * 0.56), dr = Math.round(w * 0.2), dh = Math.round(h * 0.2);
    ctx.fillStyle = '#d9d4ca';
    ctx.fillRect(hx + hw / 2, base - 3, dx0 - dr - hx - hw / 2, 3);
    // the biodome: soil rows and potato plants under glass
    for (let r = 0; r < 3; r++) {
      const y = base - 2 - r * 4;
      const span = Math.round(dr * Math.sqrt(1 - ((r * 4 + 2) / dh) ** 2)) - 3;
      ctx.fillStyle = '#5a3a28';
      ctx.fillRect(dx0 - span, y, 2 * span, 2);
      for (let x = dx0 - span + 2; x < dx0 + span - 1; x += 4) {
        const g = Math.min(1, growth * (0.8 + 0.4 * hash(`pl${r}${x}`)));
        const tall = Math.round(g * 3);
        if (g < 0.08) continue;
        ctx.fillStyle = g < 0.4 ? '#7fd17a' : '#3f9a4a';
        ctx.fillRect(x, y - tall, 1, tall);
        if (g > 0.5) { ctx.fillRect(x - 1, y - tall + 1, 1, 1); ctx.fillRect(x + 1, y - tall + 1, 1, 1); }
        if (g > 0.85 && hash(`fl${r}${x}`) < 0.5) { ctx.fillStyle = '#f4f0ff'; ctx.fillRect(x, y - tall - 1, 1, 1); }   // flowers
      }
    }
    const walk = REDUCED_MOTION ? 0 : Math.sin(t * 0.35);   // the farmer walks the rows, kneeling now and then
    const kneel = !REDUCED_MOTION && Math.abs(Math.cos(t * 0.35)) > 0.97;
    drawAstronaut(ctx, dx0 + walk * (dr - 12), base - (kneel ? 6 : 9), 0, w >= 200 ? 2 / 3 : 1 / 3);   // smaller on the Galleria thumbnail
    for (let a = 0; a <= Math.PI; a += 0.02) {   // the glass: a faint fill and a bright rim with a highlight
      const x = Math.round(dx0 + dr * Math.cos(a)), y = Math.round(base - dh * Math.sin(a));
      ctx.fillStyle = a > 1.9 && a < 2.4 ? '#ffffff' : '#cfe8ff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = 'rgba(207, 232, 255, 0.10)';
    for (let y = base - dh; y < base; y++) {
      const span = Math.round(dr * Math.sqrt(Math.max(0, 1 - ((base - y) / dh) ** 2)));
      ctx.fillRect(dx0 - span, y, 2 * span, 1);
    }
    // solar panels and a rover
    const px = Math.round(w * 0.82);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#2b3a7a'; ctx.fillRect(px + k * 9, base - 6, 7, 3);
      ctx.fillStyle = '#5a6a9a'; ctx.fillRect(px + k * 9, base - 6, 7, 1);
      ctx.fillStyle = '#8a8f9a'; ctx.fillRect(px + k * 9 + 3, base - 3, 1, 3);
    }
    const rx = Math.round(w * 0.36), ry = base + Math.round(h * 0.12);
    ctx.fillStyle = '#ece8e0'; ctx.fillRect(rx, ry - 6, 14, 4);
    ctx.fillStyle = '#9fd8ff'; ctx.fillRect(rx + 10, ry - 5, 3, 2);
    ctx.fillStyle = '#2a2a30'; for (const k of [1, 6, 11]) ctx.fillRect(rx + k, ry - 2, 3, 2);
    return { base, horizon };
  }

  function showMartian(updateHash = true) {
    selected = null;
    ++selectToken;
    martianSince = performance.now();
    cropDone = false;
    title.textContent = 'MARTIAN MAN';
    info.innerHTML = `
      <p class="big">★ A FARM ON MARS ★</p>
      <p>A nod to Andy Weir's 2011 novel and Ridley Scott's 2015 film: an astronaut left behind at the Ares 3 base on
         Acidalia Planitia grows potatoes to stay alive, and calls Earth through the real Pathfinder lander of 1997.
         Watch the farm long enough to bring in a crop.</p>
      <h3 class="facts-title">THE REAL SCIENCE</h3>
      <ul class="facts">
        <li>Martian soil holds perchlorates, salts that are toxic to people, found by NASA's Phoenix lander in 2008: a real
          Mars farm would have to wash them out first.</li>
        <li>In 2016, NASA's Kennedy Space Center and Florida Tech grew crops in simulated Martian soil (the Galleria has
          the photo).</li>
        <li>On the International Space Station, astronauts first ate lettuce grown in space (NASA's Veggie garden) in
          August 2015, two months before the film opened.</li>
        <li>A day on Mars, a sol, lasts 24 hours 39 minutes; the thin air is about 95% carbon dioxide.</li>
        <li>Pathfinder landed in Ares Vallis on 4 July 1997; its Sojourner was the first rover on another planet.</li>
      </ul>
      <p class="note">A fan reference, not affiliated with the book's or the film's makers. The drawing is pixel art; the
        pictures in the Galleria are NASA's · you found an easter egg!</p>`;
    setScene({ custom: seconds => {
      const elapsed = performance.now() - martianSince;
      const growth = (elapsed % CROP_MS) / CROP_MS;
      if (!cropDone && elapsed >= CROP_MS) { cropDone = true; achieve('space-farmer'); }
      sctx.imageSmoothingEnabled = false;
      drawMartianBase(sctx, SW, SH, REDUCED_MOTION ? 0 : seconds, REDUCED_MOTION ? 0.9 : growth);
      pixelText(sctx, 'ACIDALIA PLANITIA', 4, SH - 10, '#fff1d6');
      const sol = `SOL ${1 + Math.floor(elapsed / 3000)}`, crop = `CROP ${Math.round(growth * 100)}%`;
      pixelText(sctx, sol, 4, 4, '#5a2a14');
      pixelText(sctx, crop, SW - textWidth(crop) - 4, SH - 10, '#fff1d6');
    } });
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
    if (updateHash) history.replaceState(null, '', '#martian-man');
  }

  // ---------------------------------------------------------------- Galleria: the easter-egg game
  // The ⚙ button opens the Galleria. Every easter egg starts as a black silhouette with a question mark,
  // its name blanked out and a clue underneath; typing the right name in the search bar finds it: the
  // drawing glows, a pop-up appears in the corner, and its card in the Galleria shows the pixel art next
  // to the real thing (web/gallery/, credits in data/gallery.js) with its story. Achievements reward
  // exploring the rest of the page. Progress lives only in this browser (localStorage).
  const EGGS = [
    { id: 'sun', name: 'Solar System', kind: 'sun', ref: 'pale-blue-dot', query: 'Solar System', toast: 'HOME SWEET HOME',
      clue: 'Eight worlds circle me, and on one of them, someone is reading this.',
      story: 'The Sun and its planets formed about 4.6 billion years ago from a collapsing cloud of gas and dust. It is the only system we know of with life, and the only one Kepler could never see: its view looked away from home.' },
    { id: 'pluto', name: 'Pluto', kind: 'dwarf', ref: 'pluto', query: 'Pluto', toast: 'DWARF PLANET DISCOVERED',
      clue: 'A planet for 76 years, then demoted. I still wear a heart.',
      story: 'Clyde Tombaugh found Pluto in 1930 at Lowell Observatory by comparing photographs night after night. In 2006 the IAU made it a dwarf planet. In July 2015 New Horizons flew past and found mountains of water ice and a heart-shaped plain of nitrogen ice, Tombaugh Regio.' },
    { id: 'ceres', name: 'Ceres', kind: 'dwarf', ref: 'ceres', query: 'Ceres', toast: 'QUEEN OF THE BELT',
      clue: 'Found on New Year\'s Day 1801 and called a planet, then an asteroid, now something in between. I live among the rocks between Mars and Jupiter.',
      story: 'Giuseppe Piazzi found Ceres on 1 January 1801. About 940 km across, it is the largest object in the asteroid belt. NASA\'s Dawn orbited it from 2015 to 2018 and found that the bright spots in Occator crater are salts left by briny water seeping up from below.' },
    { id: 'haumea', name: 'Haumea', kind: 'dwarf', ref: null, query: 'Haumea', toast: 'SPINNING EGG',
      clue: 'I spin so fast that I\'ve been stretched into an egg, and I wear a ring.',
      story: 'Haumea turns once every 3.9 hours, so fast that it has stretched into an egg about 2,300 km long. A ring was found around it in 2017, the first around a dwarf planet. Its two moons are named after daughters of the Hawaiian goddess Haumea.',
      link: 'https://science.nasa.gov/dwarf-planets/haumea/', linkLabel: "see NASA's Haumea page" },
    { id: 'makemake', name: 'Makemake', kind: 'dwarf', ref: null, query: 'Makemake', toast: 'EASTER DISCOVERY',
      clue: 'Found just after Easter, I\'m named after a god of the island famous for its giant stone heads.',
      story: 'Mike Brown\'s team found Makemake in 2005, just after Easter, and named it after the creator god of Rapa Nui (Easter Island). Reddish-brown and coated in frozen methane, it is about 1,430 km across. Hubble spotted a small dark moon around it in 2016.',
      link: 'https://science.nasa.gov/dwarf-planets/makemake/', linkLabel: "see NASA's Makemake page" },
    { id: 'eris', name: 'Eris', kind: 'dwarf', ref: 'eris', query: 'Eris', toast: 'GODDESS OF DISCORD',
      clue: 'When I was found, astronomers had to decide what a planet is, and Pluto lost its title.',
      story: 'Found in 2005, Eris is about Pluto\'s size but more massive. A tenth "planet" forced the question, and in 2006 the IAU defined planets for the first time: Pluto, Eris and Ceres became dwarf planets. Its moon Dysnomia is named after the daughter of Eris, the Greek goddess of strife.' },
    { id: 'martian', name: 'Martian Man', kind: 'martian', ref: 'martian-gardens', query: 'Martian Man', toast: 'BOTANIST OF MARS',
      refs: [['mars-habitat', 'BASE'], ['acidalia', 'ACIDALIA'], ['pathfinder', 'PATHFINDER'], ['veggie', 'SPACE GARDEN']],
      clue: 'Left behind on the red planet, I grew potatoes to stay alive. What do you call a man who lives on Mars?',
      story: 'A nod to Andy Weir\'s 2011 novel and the 2015 film. The real science: Martian soil holds toxic perchlorates that a farm would have to wash out, NASA has grown crops in simulated Martian soil, and astronauts first ate space-grown lettuce on the ISS in August 2015. The pictures are NASA\'s, used as references for the pixel farm.' },
    { id: 'kepler', name: 'Kepler', kind: 'kepler', ref: 'kepler', query: 'Kepler', toast: 'PLANET HUNTER AWAKENED',
      clue: 'I stared at one patch of sky for four years. Every pixel on this map is a star I watched. (I may be hiding on the map.)',
      story: 'Launched in March 2009, Kepler watched about 150,000 stars in Cygnus and Lyra for the tiny dips of passing planets. When two of its four reaction wheels failed, engineers balanced it against sunlight for the K2 mission. It ran out of fuel in 2018; its last command, on 15 November, was a "goodnight".' },
    { id: 'iss', name: 'International Space Station', kind: 'craft', art: 'iss', ref: 'iss', query: 'ISS', toast: 'CREW ABOARD',
      clue: 'Sixteen sunrises a day, and people have lived inside me since the year 2000.',
      story: 'Built in orbit from 1998 by the space agencies of the United States, Russia, Europe, Japan and Canada, piece by piece over dozens of launches. Crews have lived aboard without a break since November 2000, and it is big enough to see from the ground with your own eyes.' },
    { id: 'voyager', name: 'Voyager 1', kind: 'craft', art: 'voyager', ref: 'voyager', query: 'Voyager 1', toast: 'INTERSTELLAR SIGNAL',
      clue: 'The farthest human-made object. I took the Pale Blue Dot, and in 2012 I was first to leave the Sun\'s bubble.',
      story: 'Launched on 5 September 1977, Voyager 1 flew past Jupiter (1979) and Saturn (1980), then headed up out of the planets\' plane. On 14 February 1990 it turned round and took the Pale Blue Dot, Earth from 6 billion km. In August 2012 it became the first spacecraft in interstellar space. It carries a Golden Record of sounds and pictures of Earth, and its signal takes most of a day to reach us.' },
    { id: 'voyager2', name: 'Voyager 2', kind: 'craft', art: 'voyager', ref: 'voyager', query: 'Voyager 2', toast: 'ICE GIANTS VISITED',
      clue: 'Launched first, but numbered second. I\'m still the only visitor Uranus and Neptune have ever had.',
      story: 'Launched on 20 August 1977, two weeks before its twin, Voyager 2 rode a line-up of the outer planets that happens once every 175 years: Jupiter (1979), Saturn (1981), Uranus (1986) and Neptune (1989), the Grand Tour. It found Neptune\'s Great Dark Spot and Triton\'s geysers, and crossed into interstellar space in November 2018. It carries its own Golden Record.' },
    { id: 'newHorizons', name: 'New Horizons', kind: 'craft', art: 'newHorizons', ref: 'new-horizons', query: 'New Horizons', toast: 'KUIPER BELT REACHED',
      clue: 'I flew past a heart in 2015 and a snowman on New Year\'s Day 2019.',
      story: 'Launched in January 2006, the fastest launch of any spacecraft at the time, New Horizons reached Pluto in July 2015 after nine and a half years. On 1 January 2019 it flew past Arrokoth, a two-lobed "snowman" in the Kuiper Belt. It carries some of the ashes of Clyde Tombaugh, who discovered Pluto.' },
    { id: 'jwst', name: 'James Webb Space Telescope', kind: 'craft', art: 'jwst', ref: 'jwst', query: 'JWST', toast: 'PARKED AT L2',
      clue: 'Eighteen golden eyes behind a parasol the size of a tennis court, a million and a half kilometres from home.',
      story: 'Launched on Christmas Day 2021 by NASA, ESA and the Canadian Space Agency, Webb unfolded its 6.5 m mirror of 18 gold-coated hexagons and its five-layer sunshield on the way to Sun-Earth L2. It sees infrared light: the first galaxies, newborn stars and the air of exoplanets.' },
    { id: 'euclid', name: 'Euclid', kind: 'craft', art: 'euclid', ref: 'euclid', query: 'Euclid', toast: 'DARK UNIVERSE MAPPED',
      clue: 'Named after the father of geometry, I measure the shape of the dark universe.',
      story: 'ESA\'s Euclid launched in July 2023 to Sun-Earth L2. It is mapping billions of galaxies across a third of the sky to learn how dark matter and dark energy shaped the universe.' },
    { id: 'soho', name: 'SOHO', kind: 'craft', art: 'soho', ref: 'soho', query: 'SOHO', toast: 'SUN WATCHER ONLINE',
      clue: 'Built to watch the Sun for two years, I\'m still at it, and I have found thousands of comets by accident.',
      story: 'The Solar and Heliospheric Observatory (ESA and NASA) launched in December 1995 to Sun-Earth L1. Planned for two years, it has watched the Sun for decades, and its pictures have revealed more than 5,000 comets, most of them spotted by volunteers.' },
    { id: 'parker', name: 'Parker Solar Probe', kind: 'craft', art: 'parker', ref: 'parker-solar-probe', query: 'Parker Solar Probe', toast: 'TOUCHED THE SUN',
      clue: 'The first spacecraft named after a living person. I fly through the Sun\'s atmosphere.',
      story: 'Launched in 2018 and named after solar physicist Eugene Parker, who came to watch. On 24 December 2024 it passed about 6.1 million km from the Sun\'s surface at around 690,000 km/h, the fastest any human-made object has ever gone, protected by its carbon heat shield.' },
    { id: 'solarOrbiter', name: 'Solar Orbiter', kind: 'craft', art: 'solarOrbiter', ref: 'solar-orbiter', query: 'Solar Orbiter', toast: 'OVER THE POLES',
      clue: 'Venus keeps pushing me higher, so I can see the Sun\'s poles.',
      story: 'ESA and NASA\'s Solar Orbiter launched in 2020. Flybys of Venus tilt its orbit out of the planets\' plane, and in 2025 it sent back the first pictures ever taken of the Sun\'s poles.' },
    { id: 'bepi', name: 'BepiColombo', kind: 'craft', art: 'bepi', ref: null, query: 'BepiColombo', toast: 'MERCURY BOUND',
      clue: 'Two orbiters, one ride, heading for the smallest planet.',
      story: 'ESA and Japan\'s JAXA launched BepiColombo in 2018 with two orbiters stacked together, using flybys of Earth, Venus and Mercury itself to slow down enough to stay at Mercury. It is named after Giuseppe "Bepi" Colombo, who worked out how Mariner 10 could fly past Mercury three times.',
      link: 'https://www.esa.int/Science_Exploration/Space_Science/BepiColombo' },
    { id: 'juno', name: 'Juno', kind: 'craft', art: 'juno', ref: 'juno', query: 'Juno', toast: 'JOVIAN ORBIT',
      clue: 'Named after a goddess who could see through clouds, I circle the king of the planets.',
      story: 'Launched in 2011, Juno reached Jupiter in July 2016 and swoops over its poles, peering under the clouds, mapping giant polar cyclones and, later, the volcanoes of Io. It was the first solar-powered spacecraft to work at Jupiter.' },
    { id: 'clipper', name: 'Europa Clipper', kind: 'craft', art: 'clipper', ref: 'europa-clipper', query: 'Europa Clipper', toast: 'OCEAN WORLD BOUND',
      clue: 'NASA\'s biggest planetary explorer, off to study an ocean hidden under ice.',
      story: 'Launched in October 2024, Europa Clipper spans more than 30 m with its solar arrays, the largest NASA has built for a planetary mission. From 2030 it will fly past Jupiter\'s moon Europa dozens of times to find out whether the ocean under its ice could support life.' },
    { id: 'juice', name: 'JUICE', kind: 'craft', art: 'juice', ref: null, query: 'JUICE', toast: 'ICY MOONS AHEAD',
      clue: 'Three icy moons are on my list, and I plan to settle around the biggest.',
      story: 'ESA\'s Jupiter Icy Moons Explorer launched in April 2023. After reaching Jupiter in 2031 it will study Europa, Callisto and Ganymede, then become the first spacecraft to orbit a moon of another planet: Ganymede.',
      link: 'https://www.esa.int/Science_Exploration/Space_Science/Juice' },
    { id: 'lucy', name: 'Lucy', kind: 'craft', art: 'lucy', ref: 'lucy', query: 'Lucy', toast: 'TROJAN TOUR',
      clue: 'Named after a famous fossil (itself named after a Beatles song), I visit the asteroids that share Jupiter\'s orbit.',
      story: 'Launched in October 2021, Lucy is touring the Trojan asteroids, fossils of planet formation that lead and trail Jupiter around the Sun; that is why it shares its name with the Lucy fossil. Its two round solar arrays are each about 7 m across.' },
    { id: 'psyche', name: 'Psyche', kind: 'craft', art: 'psyche', ref: 'psyche', query: 'Psyche', toast: 'METAL WORLD BOUND',
      clue: 'My engines glow blue, and my destination may be the metal heart of a broken planet.',
      story: 'Launched in October 2023 on a Falcon Heavy, Psyche pushes itself with electric Hall thrusters that glow blue. It is on its way to asteroid 16 Psyche, which may be the exposed metal core of an early planet, arriving in 2029.' },
    { id: 'apex', name: 'OSIRIS-APEX', kind: 'craft', art: 'apex', ref: 'osiris-apex', query: 'OSIRIS-APEX', toast: 'SAMPLE RETURNED',
      clue: 'I brought a piece of an asteroid home, then changed my name and chased another.',
      story: 'As OSIRIS-REx it touched asteroid Bennu in 2020 and dropped its sample in the Utah desert on 24 September 2023. Renamed OSIRIS-APEX, it is heading for asteroid Apophis, arriving in 2029 just after Apophis passes very close to Earth.' },
    { id: 'mro', name: 'Mars Reconnaissance Orbiter', kind: 'craft', art: 'mro', ref: 'mars-reconnaissance-orbiter', query: 'MRO', toast: 'IN MARS ORBIT',
      clue: 'From orbit, I photographed a rover\'s parachute on its way down.',
      story: 'Mars Reconnaissance Orbiter has circled Mars since 2006. Its HiRISE camera sees details the size of a desk; it photographed Curiosity hanging from its parachute in 2012, and it relays much of the rovers\' data to Earth.' },
    { id: 'odyssey', name: 'Mars Odyssey', kind: 'craft', art: 'odyssey', ref: 'mars-odyssey', query: 'Mars Odyssey', toast: 'LONG ODYSSEY',
      clue: 'Named after a science-fiction film, I became the longest-working spacecraft at another planet.',
      story: '2001 Mars Odyssey, named after Arthur C. Clarke\'s "2001: A Space Odyssey", reached Mars in October 2001. It found signs of water ice just under the surface and relayed messages for rovers and landers for over two decades.' },
    { id: 'mex', name: 'Mars Express', kind: 'craft', art: 'mex', ref: 'mars-express', query: 'Mars Express', toast: 'EUROPE AT MARS',
      clue: 'Europe\'s first mission to another planet. I lost my lander, and found it again 11 years later.',
      story: 'ESA\'s Mars Express arrived in December 2003. It has mapped Mars in 3D, and its radar found signs of liquid water under the south polar ice. Its lander, Beagle 2, went silent; in 2015 it was spotted on the surface, almost fully unfolded.' },
    { id: 'tgo', name: 'ExoMars', kind: 'craft', art: 'tgo', ref: 'trace-gas-orbiter', query: 'ExoMars', toast: 'SNIFFING MARS',
      clue: 'I sniff the Martian air for traces of methane.',
      story: 'The ExoMars Trace Gas Orbiter, built by ESA and Roscosmos, arrived in 2016 to measure rare gases such as methane in Mars\'s atmosphere, and relays data from NASA\'s rovers.' },
    { id: 'curiosity', name: 'Curiosity', kind: 'craft', art: 'curiosity', ref: 'curiosity', query: 'Curiosity', toast: 'WHEELS ON MARS',
      clue: 'A car-sized laboratory that played "Happy Birthday" to itself on another planet.',
      story: 'Lowered into Gale Crater by a rocket-powered "sky crane" on 6 August 2012, Curiosity showed that the crater once held a lake that could have supported microbes, and has been climbing Mount Sharp ever since. On its first anniversary it hummed "Happy Birthday" with its sample instrument.' },
    { id: 'perseverance', name: 'Perseverance', kind: 'craft', art: 'perseverance', ref: 'perseverance', query: 'Perseverance', toast: 'LIFTOFF ON MARS',
      clue: 'I collect rock samples in tubes, and I brought a little helicopter along.',
      story: 'Perseverance landed in Jezero Crater, an ancient river delta, on 18 February 2021. It seals rock samples in tubes for a future trip to Earth, and it carried Ingenuity, the first aircraft to fly on another planet: 72 flights instead of the planned five.' },
  ];
  const EGG = new Map(EGGS.map(e => [e.id, e]));
  const CRAFT_EGGS = EGGS.filter(e => e.kind === 'craft' && e.id !== 'iss').length;

  // Achievements, by group (the Achievements tab shows them in this order). Secret ones show "???" until earned.
  const ACHIEVEMENTS = [
    { g: 'EXPLORER', id: 'first-light', title: 'FIRST LIGHT', how: 'Open your first star system.' },
    { g: 'EXPLORER', id: 'star-hopper', title: 'STAR HOPPER', how: 'Open 10 different star systems.' },
    { g: 'EXPLORER', id: 'census', title: 'GALACTIC CENSUS', how: 'Open 50 different star systems.' },
    { g: 'EXPLORER', id: 'dice', title: 'ROLL OF THE DICE', how: 'Let the 🎲 pick a system for you.' },
    { g: 'EXPLORER', id: 'ghost', title: 'GHOST HUNTER', how: 'Visit a system that has only unconfirmed planets.' },
    { g: 'EXPLORER', id: 'oracle', title: 'FORTUNE TELLER', how: 'Open the 🏆 next-planets list.' },
    { g: 'EXPLORER', id: 'link', title: 'SIGNAL RECEIVED', how: 'Open a shared view link.' },
    { g: 'FAMOUS WORLDS', id: 'first-rock', title: 'FIRST ROCK', how: 'Visit Kepler-10, home of the first rocky planet Kepler found.' },
    { g: 'FAMOUS WORLDS', id: 'eight-worlds', title: 'EIGHT WORLDS', how: 'Visit Kepler-90: eight planets, as many as our Solar System.' },
    { g: 'FAMOUS WORLDS', id: 'cousin', title: "EARTH'S COUSIN", how: 'Visit Kepler-452, a Sun-like star with a world on a 385-day orbit.' },
    { g: 'FAMOUS WORLDS', id: 'eden', title: 'FIRST EDEN', how: 'Visit Kepler-186, where the first Earth-size planet in a habitable zone was found.' },
    { g: 'FAMOUS WORLDS', id: 'puff', title: 'SUPER PUFF', how: 'Visit Kepler-51, whose planets are about as dense as cotton candy.' },
    { g: 'FAMOUS WORLDS', id: 'tiny', title: 'TINY WORLD', how: 'Visit Kepler-37, home of a planet smaller than Mercury.' },
    { g: 'SCIENCE', id: 'goldilocks', title: 'GOLDILOCKS', how: 'Light up the habitable-zone systems on the map.' },
    { g: 'SCIENCE', id: 'double', title: 'DOUBLE TROUBLE', how: 'Visit a system with more than one star.' },
    { g: 'SCIENCE', id: 'lava', title: 'LAVA WORLD', how: 'Visit a planet hotter than 1,500 K.' },
    { g: 'SCIENCE', id: 'ancient', title: 'ANCIENT LIGHT', how: 'Open a star so far away its light left before the Great Pyramid was built.' },
    { g: 'SCIENCE', id: 'flare', title: 'FLARE WATCHER', how: 'Catch a red dwarf flaring.' },
    { g: 'SCIENCE', id: 'transit', title: 'TRANSIT WITNESS', how: "Watch a system edge-on with KEPLER'S VIEW." },
    { g: 'SCIENCE', id: 'scale', title: 'MIND THE GAP', how: 'Switch a system to TRUE SCALE.' },
    { g: "STAR GAZER'S GUESSES", id: 'believer', title: 'BELIEVER', how: 'Open a candidate Star Gazer rates 90% likely or more.' },
    { g: "STAR GAZER'S GUESSES", id: 'skeptic', title: 'SKEPTIC', how: 'Open a candidate Star Gazer rates 10% or less.' },
    { g: "STAR GAZER'S GUESSES", id: 'coin', title: 'COIN FLIP', how: "Open a candidate Star Gazer can't decide on (40 to 60%)." },
    { g: 'MAP AND TOOLS', id: 'depth', title: 'DEPTH PERCEPTION', how: 'Turn the map sideways with DEPTH.' },
    { g: 'MAP AND TOOLS', id: 'chips', title: 'CHIP CHECK', how: "Switch Kepler's camera chips (CCDS) off or on." },
    { g: 'MAP AND TOOLS', id: 'eagle', title: 'EAGLE EYE', how: 'Zoom the map all the way in.' },
    { g: 'MAP AND TOOLS', id: 'cartographer', title: 'CARTOGRAPHER', how: 'Hop across 25 stars in a row with the arrow keys.' },
    { g: 'MAP AND TOOLS', id: 'highlighter', title: 'HIGHLIGHTER', how: 'Try every highlight filter under the map in one visit.' },
    { g: 'MAP AND TOOLS', id: 'sky', title: 'SKY PHOTOGRAPHER', how: 'Open the real sky photo of a star.' },
    { g: 'MAP AND TOOLS', id: 'cosmic-zoom', title: 'COSMIC ZOOM', how: 'Step through every sector of the universe, from Kepler\'s field to the oldest light.' },
    { g: 'MAP AND TOOLS', id: 'space-farmer', title: 'SPACE FARMER', how: 'Watch the farm on Mars bring in a whole crop.' },
    { g: 'MAP AND TOOLS', id: 'eco', title: 'ECO MODE', how: 'Switch the animation to battery saver.' },
    { g: 'EASTER EGGS', id: 'curious', title: 'CURIOUS MIND', how: 'Find your first easter egg.' },
    { g: 'EASTER EGGS', id: 'mission-control', title: 'MISSION CONTROL', how: 'Find five spacecraft.' },
    { g: 'EASTER EGGS', id: 'red-fleet', title: 'RED PLANET FLEET', how: 'Find every mission at Mars: four orbiters and two rovers.' },
    { g: 'EASTER EGGS', id: 'jupiter-crew', title: "JUPITER'S ENTOURAGE", how: 'Find Juno, Europa Clipper, JUICE and Lucy.' },
    { g: 'EASTER EGGS', id: 'sun-chasers', title: 'SUN CHASERS', how: 'Find the three spacecraft that study the Sun.' },
    { g: 'EASTER EGGS', id: 'l2', title: 'L2 NEIGHBOURS', how: 'Find both telescopes parked at Sun-Earth L2.' },
    { g: 'EASTER EGGS', id: 'dwarf-king', title: 'DWARF KING', how: 'Find all five dwarf planets.' },
    { g: 'EASTER EGGS', id: 'interstellar', title: 'ROAD TO INTERSTELLAR', how: 'Find Voyager 1, Voyager 2 and New Horizons, heading out of the Solar System.' },
    { g: 'EASTER EGGS', id: 'photo-finish', title: 'PHOTO FINISH', how: 'Slide a Galleria photo all the way into pixel art.' },
    { g: 'EASTER EGGS', id: 'curator', title: 'CURATOR', how: 'Open ten found cards in the Galleria in one visit.' },
    { g: 'EASTER EGGS', id: 'grand-tour', title: 'GRAND TOUR', how: "Find every easter egg, like the Voyagers' tour of the planets." },
    { g: 'WARDROBE', id: 'first-outfit', title: 'DRESS-UP DAY', how: 'Visit the lost astronaut again and see them in their first outfit.' },
    { g: 'WARDROBE', id: 'visiting-hours', title: 'VISITING HOURS', how: 'Visit the lost astronaut on three different days.' },
    { g: 'WARDROBE', id: 'rare-threads', title: 'RARE THREADS', how: 'Find a rare outfit in the astronaut\'s wardrobe.' },
    { g: 'WARDROBE', id: 'runway', title: 'STAR OF THE RUNWAY', how: 'Find an epic outfit in the astronaut\'s wardrobe.' },
    { g: 'WARDROBE', id: 'walk-in-closet', title: 'WALK-IN CLOSET', how: 'Collect seven outfits.' },
    { g: 'WARDROBE', id: 'space-wardrobe', title: 'SPACE WARDROBE', how: 'Collect all fifteen outfits.' },
    { g: 'WARDROBE', id: 'houston', title: 'HOUSTON, WE HAVE A PROBLEM', how: 'Find the legendary Texas cowboy hat, the rarest outfit of all.', secret: true },
    { g: 'SKY WATCH', id: 'comet-catcher', title: 'COMET CATCHER', how: 'Catch a comet passing over the map.' },
    { g: 'SKY WATCH', id: 'rock-hound', title: 'ROCK HOUND', how: 'Catch an asteroid tumbling across the map.' },
    { g: 'SKY WATCH', id: 'tail-chaser', title: 'TAIL CHASER', how: 'Catch five comets.' },
    { g: 'SKY WATCH', id: 'asteroid-catcher', title: 'ASTEROID CATCHER', how: 'Catch ten asteroids.' },
    { g: 'SKY WATCH', id: 'ufo-spotter', title: 'UFO SPOTTER', how: 'Catch the flying saucer. It rarely shows up.' },
    { g: 'SKY WATCH', id: 'what-was-that', title: 'WHAT WAS THAT?', how: 'See the asteroid that sometimes follows the flying saucer.', secret: true },
    { g: 'TWO SUNS', id: 'tatooine', title: 'TATOOINE', how: 'Visit a planet with two suns.' },
    { g: 'TWO SUNS', id: 'double-sunset', title: 'DOUBLE SUNSET', how: 'Visit every system on the map whose planets circle two stars.' },
    { g: 'PREDICTIONS', id: 'first-call', title: 'FIRST CALL', how: 'Make your own call on a candidate: planet or not?' },
    { g: 'PREDICTIONS', id: 'prophet', title: 'PROPHET', how: 'Be proven right by NASA for the first time.' },
    { g: 'PREDICTIONS', id: 'seer', title: 'ORACLE', how: 'Be proven right by NASA five times.' },
    { g: 'PREDICTIONS', id: 'cassandra', title: 'CASSANDRA', how: 'Call a false positive that Star Gazer believed in, and be proven right.' },
    { g: 'PREDICTIONS', id: 'contrarian', title: 'CONTRARIAN', how: 'Be right three times when Star Gazer was wrong.' },
    { g: 'PREDICTIONS', id: 'patience', title: 'PATIENCE OF A STAR', how: 'Have a call settled a year or more after you made it.' },
    { g: 'DAILY SKY', id: 'daily', title: 'MYSTERY SOLVED', how: 'Find the mystery star of the day (in the Galleria).' },
    { g: 'DAILY SKY', id: 'streak', title: 'WEEK OF WONDERS', how: 'Solve the daily mystery seven days in a row.' },
    { g: 'SECRET', id: 'patient', title: 'PATIENT OBSERVER', how: 'Watch one system for two minutes. Kepler watched for four years.', secret: true },
    { g: 'SECRET', id: 'night', title: 'NIGHT SHIFT', how: 'Go stargazing after midnight.', secret: true },
    { g: 'SECRET', id: 'hollow', title: 'NO SIGNAL', how: "Search for things that aren't there five times in one visit.", secret: true },
    { g: 'SECRET', id: 'so-close', title: 'SO CLOSE', how: 'Search a hidden name with a letter or two wrong.', secret: true },
    { g: 'SECRET', id: 'lost-in-orbit', title: 'LOST IN ORBIT', how: 'Catch the flare drifting across the universe.', secret: true },
    { g: 'SECRET', id: 'speedrun', title: 'WARP SPEED', how: 'Find three new easter eggs within one minute.', secret: true },
    { g: 'SECRET', id: 'goodnight', title: 'GOODNIGHT KEPLER', how: 'Visit on 15 November, the day Kepler was switched off in 2018.', secret: true },
    { g: 'SECRET', id: 'launch-day', title: 'LAUNCH DAY', how: 'Visit on 7 March, the day Kepler launched in 2009.', secret: true },
    { g: 'THE FINAL MISSION', id: 'star-gazer', title: 'TRUE STAR GAZER', how: 'Open every star system on the map.', secret: true },
  ];
  // Difficulty, shown by the trophy (49-ranks.js): bronze, silver, gold; secret ones get the galaxy cup.
  const TIER_OF = {
    rare: ['star-hopper', 'first-rock', 'eight-worlds', 'cousin', 'eden', 'puff', 'tiny', 'double', 'lava', 'ancient', 'flare',
           'believer', 'skeptic', 'coin', 'highlighter', 'l2', 'interstellar', 'photo-finish', 'tatooine', 'prophet', 'patience', 'daily', 'cosmic-zoom', 'rare-threads', 'walk-in-closet',
           'tail-chaser', 'ufo-spotter'],
    epic: ['census', 'cartographer', 'dwarf-king', 'asteroid-catcher', 'runway', 'space-wardrobe', 'mission-control', 'red-fleet', 'jupiter-crew', 'sun-chasers', 'curator', 'grand-tour',
           'double-sunset', 'seer', 'cassandra', 'contrarian', 'streak'],
  };
  for (const a of ACHIEVEMENTS) {
    a.tier = a.id === 'star-gazer' ? 'legend' : a.secret ? 'secret' : TIER_OF.rare.includes(a.id) ? 'rare' : TIER_OF.epic.includes(a.id) ? 'epic' : 'common';
  }
  // Visiting these systems earns a famous-world achievement.
  const FAMOUS = { 'Kepler-10': 'first-rock', 'Kepler-90': 'eight-worlds', 'Kepler-452': 'cousin', 'Kepler-186': 'eden',
                   'Kepler-51': 'puff', 'Kepler-37': 'tiny' };
  // Finding every easter egg in a set earns a collection.
  const EGG_SETS = {
    'red-fleet': ['mro', 'odyssey', 'mex', 'tgo', 'curiosity', 'perseverance'],
    'jupiter-crew': ['juno', 'clipper', 'juice', 'lucy'],
    'sun-chasers': ['parker', 'soho', 'solarOrbiter'],
    l2: ['jwst', 'euclid'],
    interstellar: ['voyager', 'voyager2', 'newHorizons'],
    'dwarf-king': ['pluto', 'ceres', 'haumea', 'makemake', 'eris'],
  };
  const PYRAMID_LY = 4600;   // the Great Pyramid of Giza is about 4,600 years old
  const session = { unknown: 0, hops: 0, highlights: new Set(), cards: new Set(), unlocks: [] };   // this visit only
  const ACH = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

  // ---- progress (this browser only; the page works the same without storage)
  // The key and the ids never change between site updates (tests/test_web_data.py checks the ids), so a new
  // version of the page always finds what an older one saved. Ids this version doesn't know are kept, not
  // dropped, so nothing earned is lost if a later version renames or retires something.
  const PROGRESS_KEY = 'starmap.progress.v1';
  const progress = { eggs: {}, ach: {}, systems: [], toasts: true, seen: '', viewed: [], finalEmblem: 'black-hole', whiteHole: false,
                     calls: {}, notified: [],    // predictions (48b-predictions.js)
                     showcase: [], levels: {}, sound: true, soundChoice: false,   // trophies (49b-trophies.js)
                     toured: false,   // first-visit tour (49c-ui.js)
                     daily: { last: '', streak: 0 }, lastExport: '', lastStars: 0,   // 49d-connect.js
                     backdrop: 'animated',   // page background (55-backdrop.js)
                     outfit: '', outfits: [], astroVisits: 0, astroLastRoll: 0, astroDry: 0, astroDays: [],
                     comets: 0, asteroids: 0, ufos: 0 };   // sky events caught (05-sky-events.js)   // the lost astronaut's wardrobe (47c-astronaut.js)
  const ID = /^[\w-]{1,40}$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
  function mergeProgress(saved) {   // from storage or an imported file; keeps the earliest date of each
    if (!saved || typeof saved !== 'object') return false;
    for (const kind of ['eggs', 'ach']) {
      const entries = Object.entries(saved[kind] && typeof saved[kind] === 'object' ? saved[kind] : {}).slice(0, 300);
      for (const [id, date] of entries) {
        if (!ID.test(id) || !DATE.test(String(date))) continue;
        if (!progress[kind][id] || date < progress[kind][id]) progress[kind][id] = String(date);
      }
    }
    if (Array.isArray(saved.systems)) {
      progress.systems = [...new Set([...progress.systems, ...saved.systems.filter(n => typeof n === 'string' && n.length < 60)])].slice(-200);
    }
    if (typeof saved.toasts === 'boolean') progress.toasts = saved.toasts;
    if (typeof saved.seen === 'string' && /^[0-9a-z,]{0,80000}$/.test(saved.seen)) {   // TRUE STAR GAZER: Kepler IDs, base 36
      progress.seen = [...new Set([...progress.seen.split(','), ...saved.seen.split(',')].filter(Boolean))].join(',');
    }
    if (Array.isArray(saved.viewed)) progress.viewed = [...new Set([...progress.viewed, ...saved.viewed.filter(v => ID.test(v))])].slice(0, 300);
    if (saved.finalEmblem === 'white-dwarf' || saved.finalEmblem === 'black-hole') progress.finalEmblem = saved.finalEmblem;
    if (saved.whiteHole === true) progress.whiteHole = true;
    if (typeof saved.outfit === 'string' && ID.test(saved.outfit)) progress.outfit = saved.outfit;
    for (const k of ['astroVisits', 'astroLastRoll', 'astroDry', 'comets', 'asteroids', 'ufos']) {
      if (Number.isFinite(saved[k]) && saved[k] >= 0) progress[k] = Math.max(progress[k], Math.floor(saved[k]));
    }
    if (Array.isArray(saved.astroDays)) progress.astroDays = [...new Set([...progress.astroDays, ...saved.astroDays.filter(d => DATE.test(String(d)))])].slice(-30);
    if (Array.isArray(saved.outfits)) progress.outfits = [...new Set([...progress.outfits, ...saved.outfits.filter(o => typeof o === 'string' && ID.test(o))])].slice(0, 40);
    const calls = saved.calls && typeof saved.calls === 'object' ? Object.entries(saved.calls).slice(0, 2000) : [];
    for (const [koi, c] of calls) {   // [call, date, Star Gazer's call, system]; the earliest call wins
      if (!/^K\d{5}\.\d{2}$/.test(koi) || !Array.isArray(c) || !['planet', 'not'].includes(c[0]) || !DATE.test(String(c[1]))) continue;
      if (progress.calls[koi] && progress.calls[koi][1] <= c[1]) continue;
      progress.calls[koi] = [c[0], c[1], ['planet', 'not'].includes(c[2]) ? c[2] : '', typeof c[3] === 'string' ? c[3].slice(0, 60) : ''];
    }
    if (Array.isArray(saved.showcase)) progress.showcase = saved.showcase.filter(v => typeof v === 'string' && ID.test(v)).slice(-3);
    if (saved.levels && Number.isInteger(saved.levels.census)) progress.levels.census = Math.min(3, Math.max(progress.levels.census || 0, saved.levels.census));
    // The fanfare is on unless the visitor switched it off themselves (an old saved "off" was only the old default).
    if (saved.soundChoice === true && typeof saved.sound === 'boolean') { progress.sound = saved.sound; progress.soundChoice = true; }
    if (saved.toured === true) progress.toured = true;
    if (saved.daily && DATE.test(String(saved.daily.last)) && (!progress.daily.last || saved.daily.last > progress.daily.last)) {
      progress.daily = { last: saved.daily.last, streak: Number.isInteger(saved.daily.streak) ? Math.min(9999, Math.max(0, saved.daily.streak)) : 1 };
    }
    if (DATE.test(String(saved.lastExport))) progress.lastExport = saved.lastExport;
    if (Number.isInteger(saved.lastStars)) progress.lastStars = saved.lastStars;
    if (['animated', 'still', 'plain'].includes(saved.backdrop)) progress.backdrop = saved.backdrop;
    if (Array.isArray(saved.notified)) progress.notified = [...new Set([...progress.notified, ...saved.notified.filter(k => /^K\d{5}\.\d{2}$/.test(k))])];
    return true;
  }
  let storageOK = false;   // false in private windows or with site data blocked: progress lasts for this visit
  try {
    mergeProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'));
    localStorage.setItem('starmap.check', '1');
    localStorage.removeItem('starmap.check');
    storageOK = true;
  } catch { /* see above */ }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* see above */ }
  }
  const today = () => new Date().toISOString().slice(0, 10);

  // ---- pop-ups in the corner (they never cover the drawing's controls and leave by themselves)
  const toastBox = document.getElementById('toasts');
  function toast(kind, title, text, egg, art) {
    if (!progress.toasts) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const size = art === starGazerTrophy ? 24 : 16;
    el.innerHTML = `${egg ? '<canvas width="40" height="26" aria-hidden="true"></canvas>'
      : `<canvas class="toast-art" width="${size}" height="${size}" aria-hidden="true"></canvas>`}
      <div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
    if (egg) drawEggArt(el.querySelector('canvas'), egg, 0, false);
    else if (art) drawArt(el.querySelector('canvas').getContext('2d'), art, 0, 0, 1, 1);
    toastQueue.push([el, kind === 'legend' ? 9000 : 4200]);
    pumpToasts();
  }
  // At most three pop-ups at once; the rest wait their turn (none is dropped, so earning several things at
  // once never hides the important one).
  const toastQueue = [];
  function pumpToasts() {
    while (toastBox.children.length < 3 && toastQueue.length) {
      const [el, ms] = toastQueue.shift();
      toastBox.appendChild(el);
      setTimeout(() => el.classList.add('leaving'), ms);
      setTimeout(() => { el.remove(); pumpToasts(); }, ms + 600);
    }
  }

  function glow() {   // the drawing lights up for a moment
    sys.classList.remove('glow');
    void sys.offsetWidth;   // restart the animation
    sys.classList.add('glow');
    setTimeout(() => sys.classList.remove('glow'), 2400);
  }

  function achieve(id) {
    if (progress.ach[id] || !ACH.has(id)) return;
    const rankBefore = rankIndex(), badgesBefore = earnedBadges();
    progress.ach[id] = today();
    saveProgress();
    const a = ACH.get(id);
    if (id !== 'star-gazer') toast(`ach tier-${a.tier}`, `${TIERS[a.tier].name} ACHIEVEMENT: ${a.title}`, a.how, null, trophyFor(a));
    fanfare(a.tier);
    afterAchievement(rankBefore, badgesBefore);
    refreshGallery();
  }

  function unlockEgg(id) {
    const egg = EGG.get(id);
    if (!egg || progress.eggs[id]) return;   // found before: its view opening is answer enough, no pop-up
    progress.eggs[id] = today();
    saveProgress();
    glow();
    toast('egg', egg.toast, `${egg.name} found! See it in the ⚙ Galleria.`, egg);
    const found = Object.keys(progress.eggs);
    achieve('curious');
    if (found.filter(k => EGG.get(k).kind === 'craft' && k !== 'iss').length >= 5) achieve('mission-control');
    if (found.length === EGGS.length) achieve('grand-tour');
    for (const [set, ids] of Object.entries(EGG_SETS)) if (ids.every(k => progress.eggs[k])) achieve(set);
    const now = Date.now();
    session.unlocks = [...session.unlocks.filter(t => now - t < 60_000), now];
    if (session.unlocks.length >= 3) achieve('speedrun');
    refreshGallery();
  }

  // Which easter egg a search found (called by lookup() after it opened one).
  function eggForQuery(q) {
    if (dwarfFor(q)) return dwarfFor(q);
    if (HOME_QUERY.test(q)) return 'sun';
    if (ISS_QUERY.test(q)) return 'iss';
    if (KEPLER_QUERY.test(q)) return 'kepler';
    const craft = craftFocus(q);
    return craft ? craftEggId(craft) : null;
  }

  function systemOpened(s) {   // from select(): counts systems for the achievements
    const name = s[COL.name];
    starSeen(s);
    if (!progress.systems.includes(name)) {
      progress.systems.push(name);
      if (progress.systems.length > 200) progress.systems.shift();
      saveProgress();
    }
    const n = progress.systems.length;
    achieve('first-light');
    if (n >= 10) achieve('star-hopper');
    if (n >= 50) achieve('census');
    const hour = new Date().getHours();
    if (hour < 4) achieve('night');
    if (FAMOUS[name]) achieve(FAMOUS[name]);
    dailyCheck(s);
    if (TAGS.twosuns && s[COL.tags] & TAGS.twosuns) {
      achieve('tatooine');
      if (twoSunCount() >= TWO_SUN_STARS.length) achieve('double-sunset');
    }
    if (s[COL.dist] != null && s[COL.dist] * LY_PER_PC > PYRAMID_LY) achieve('ancient');
    const sg = s[COL.sg];
    if (sg != null) {
      if (sg >= 0.9) achieve('believer');
      if (sg <= 0.1) achieve('skeptic');
      if (sg >= 0.4 && sg <= 0.6) achieve('coin');
    }
  }

  // How far along a counting achievement is: [done, needed], or null.
  function achProgress(a) {
    const craft = Object.keys(progress.eggs).filter(k => EGG.get(k)?.kind === 'craft' && k !== 'iss').length;
    const counts = {
      'star-hopper': [progress.systems.length, 10], census: [progress.systems.length, 50], 'mission-control': [craft, 5],
      'grand-tour': [EGGS.filter(e => progress.eggs[e.id]).length, EGGS.length], cartographer: [session.hops, 25],
      curator: [session.cards.size, 10], highlighter: [session.highlights.size, Object.keys(HIGHLIGHTS).length],
    };
    if (a.id === 'double-sunset') return [twoSunCount(), TWO_SUN_STARS.length];
    if (EGG_SETS[a.id]) return [EGG_SETS[a.id].filter(k => progress.eggs[k]).length, EGG_SETS[a.id].length];
    return counts[a.id] || null;
  }

  const TWO_SUN_STARS = TAGS.twosuns ? STARS.filter(s => s[COL.tags] & TAGS.twosuns) : [];
  const twoSunCount = () => TWO_SUN_STARS.filter(s => seenStars.has(starKey(s))).length;
  function tatooineFound() {   // searching "tatooine"
    toast('badge', "YES, IT'S REAL", 'Kepler-16 b circles two suns, like Tatooine. Kepler found it in 2011.', null, BADGES['TWO SUNS'].art);
  }

  // Small hooks from the rest of the page.
  function systemDetailShown(detail) {   // showSystem / showUnconfirmed, once the details are loaded
    if ((detail.nstars ?? 1) > 1) achieve('double');
    if (detail.planets.some(p => (p.teq ?? 0) >= 1500)) achieve('lava');
  }
  function noSignal() { if (++session.unknown >= 5) achieve('hollow'); }

  // ---- "so close": a failed search that is a letter or two off an easter egg's name (or Tatooine)
  const NEAR_NAMES = [...EGGS.flatMap(e => [[e.name, e.id], [e.query, e.id]]),
    ['James Webb', 'jwst'], ['Webb', 'jwst'], ['Voyager 1', 'voyager'], ['Voyager 2', 'voyager2'], ['Parker', 'parker'],
    ['Osiris Rex', 'apex'], ['Tatooine', null]];
  const nearForm = s => String(s).toLowerCase().replace(/[-_.]/g, ' ').replace(/^the /, '').trim();
  function editDistance(a, b) {   // Levenshtein, one row at a time
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row;
    }
    return prev[b.length];
  }
  function nearMiss(query) {   // from lookup(), after NO SIGNAL
    const q = nearForm(query);
    if (q.length < 4) return;
    let best = null, bestD = Infinity;
    for (const [name, id] of NEAR_NAMES) {
      const n = nearForm(name);
      if (/\d/.test(q) && !/\d/.test(n)) continue;   // "kepler 1234" is a catalogue number, not a misspelt "kepler"
      const d = editDistance(q, n);
      if (d < bestD) { best = [name, id]; bestD = d; }
    }
    if (!best || bestD > (q.length >= 7 ? 2 : 1)) return;
    const [name, id] = best, found = id ? progress.eggs[id] : progress.ach.tatooine;
    // Already found: name it. Not found yet: only say it's close, so the hunt stays a hunt.
    if (found) toast('egg', 'DID YOU MEAN…', `${id ? EGG.get(id).name : name}? Check the spelling and search again.`, id ? EGG.get(id) : null);
    else toast('egg', 'SO CLOSE!', "That's a letter or two off something hidden here. Check the spelling and try again.");
    achieve('so-close');
  }
  function arrowHop() { if (++session.hops >= 25) achieve('cartographer'); }
  function highlightTried(key) {
    session.highlights.add(key);
    if (session.highlights.size >= Object.keys(HIGHLIGHTS).length) achieve('highlighter');
  }

  // ---- drawing an easter egg on a small canvas, in colour or as a silhouette with a "?"
  function drawEggArt(canvas, egg, t, silhouette) {
    const w = canvas.width, h = canvas.height;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    if (egg.kind === 'sun') {
      const r = Math.max(3, Math.floor(h / 6));
      for (const [k, orbit, art, size] of [[0, r + 6, 'mercury', 1], [1, r + 11, 'earth', 2], [2, r + 18, 'jupiter', 3]]) {
        const a = t * (0.9 - k * 0.3) + k * 2;
        solarPlanet(ctx, cx + orbit * Math.cos(a), cy + orbit * 0.42 * Math.sin(a), { art, size, noMoon: true }, -Math.cos(a), -Math.sin(a), t);
      }
      disc(ctx, cx, cy, r, '#ffd34d');
      disc(ctx, cx - 1, cy - 1, Math.max(1, r - 2), '#fff1b0');
    } else if (egg.kind === 'martian') {
      drawMartianBase(ctx, w, h, t, 0.75);
    } else if (egg.kind === 'dwarf') {
      dwarfBody(ctx, cx, cy, Math.floor(h / 3), DWARFS[egg.id], -0.8, -0.6, t * 2);
    } else if (egg.kind === 'kepler') {
      const px = Math.max(1, Math.min(Math.floor((w - 4) / KEPLER_W), Math.floor((h - 4) / KEPLER_H)));
      keplerSprite(ctx, cx - Math.floor(KEPLER_W * px / 2), cy - Math.floor(KEPLER_H * px / 2), px, silhouette ? null : (t / 3) % 1);
    } else {
      const [sw, sh] = spriteSize(egg.art);
      const px = Math.max(1, Math.min(Math.floor((w - 4) / sw), Math.floor((h - 4) / sh)));
      const bob = REDUCED_MOTION || silhouette ? 0 : Math.round(Math.sin(t * 1.5));
      craftSprite(ctx, egg.art, cx - Math.floor(sw * px / 2), cy - Math.floor(sh * px / 2) + bob, px);
    }
    const out = canvas.getContext('2d');
    out.clearRect(0, 0, w, h);
    if (silhouette) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#1c2245';
      ctx.fillRect(0, 0, w, h);
      out.drawImage(off, 0, 0);
      const q = Math.max(1, Math.floor(h / 14));   // the question mark, scaled
      out.fillStyle = '#ffd34d';
      QUESTION.forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit === '1') out.fillRect(cx - Math.floor(5 * q / 2) + x * q, cy - Math.floor(7 * q / 2) + y * q, q, q);
      }));
    } else {
      out.drawImage(off, 0, 0);
    }
  }

  // ---- the Galleria dialog
  const galleryDialog = document.getElementById('gallery');
  const panes = { eggs: document.getElementById('pane-eggs'), ach: document.getElementById('pane-ach'),
                  pred: document.getElementById('pane-pred'), set: document.getElementById('pane-set') };
  let detailEgg = null, detailFrame = 0;
  const blanks = name => [...name].map(ch => (/[A-Za-z0-9]/.test(ch) ? '_' : ch === ' ' ? ' ' : ch)).join('');

  function renderEggs() {
    const found = EGGS.filter(e => progress.eggs[e.id]).length;
    if (detailEgg) return renderDetail(detailEgg);
    panes.eggs.innerHTML = `
      ${dailyCard()}
      <p class="gallery-progress"><b>${found} / ${EGGS.length}</b> FOUND
        <span class="bar" aria-hidden="true"><span></span></span></p>
      <p class="note">Each silhouette is a hidden easter egg. Read the clue, guess the name, then type it in the
        search bar. Found ones light up: open them to compare the pixel art with the real thing.</p>
      <ul class="egg-grid">${EGGS.map(e => {
        const got = Boolean(progress.eggs[e.id]);
        return `<li><button type="button" class="egg-card${got ? ' found' : ''}" data-egg="${esc(e.id)}"
            aria-label="${got ? esc(e.name) : 'Unknown easter egg'}: ${got ? 'found, open its story' : esc(e.clue)}">
          <canvas width="64" height="40" aria-hidden="true"></canvas>
          <span class="egg-name">${got ? esc(e.name) : esc(blanks(e.name))}</span>
          <span class="egg-clue">${got ? `★ ${esc(e.toast)}` : esc(e.clue)}</span></button></li>`;
      }).join('')}</ul>`;
    panes.eggs.querySelector('.bar span').style.width = `${Math.round(100 * found / EGGS.length)}%`;
    panes.eggs.querySelectorAll('.egg-card').forEach(b => {
      const egg = EGG.get(b.dataset.egg);
      drawEggArt(b.querySelector('canvas'), egg, 1, !progress.eggs[egg.id]);
      b.addEventListener('click', () => openEggCard(egg));
    });
  }

  function openEggCard(egg) {
    detailEgg = egg;
    if (progress.eggs[egg.id]) { session.cards.add(egg.id); if (session.cards.size >= 10) achieve('curator'); }
    renderDetail(egg);
  }
  // ◀ ▶ on the card's edges (and the arrow keys) step through every card, wrapping round, found or not.
  function stepEggCard(dir) {
    if (!detailEgg) return;
    openEggCard(EGGS[(EGGS.indexOf(detailEgg) + dir + EGGS.length) % EGGS.length]);
    panes.eggs.querySelector(dir > 0 ? '.egg-step.next' : '.egg-step.prev')?.focus();
  }

  function renderDetail(egg) {
    const got = Boolean(progress.eggs[egg.id]);
    const credit = egg.ref && window.STARMAP_GALLERY ? window.STARMAP_GALLERY[egg.ref] : null;
    const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`;
    const real = !got ? ''
      : credit?.img ? `<figure class="morph">
          <canvas width="240" height="160" role="img" aria-label="${esc(credit.what)}"></canvas>
          <input type="range" min="0" max="100" value="0" step="1" aria-label="Slide from the real photo to the pixel art">
          <span class="morph-ends" aria-hidden="true"><span>PHOTO</span><span>PIXEL ART</span></span>
          <figcaption>THE REAL THING · ${esc(credit.what)} · ${link(credit.link, `credit: ${credit.credit}`)}</figcaption></figure>`
      : `<figure class="no-photo"><figcaption>THE REAL THING · ${credit
          ? `${esc(credit.what)}: the picture is credited to ESA, so it isn't copied here; ${link(credit.link, `see it (${credit.credit})`)}`
          : `no NASA photo; ${link(egg.link, egg.linkLabel || 'see ESA\'s mission page')}`}</figcaption></figure>`;
    const at = EGGS.indexOf(egg), nameOf = e => (progress.eggs[e.id] ? e.name : 'a hidden egg');
    const prev = EGGS[(at - 1 + EGGS.length) % EGGS.length], next = EGGS[(at + 1) % EGGS.length];
    panes.eggs.innerHTML = `
      <p class="egg-top"><button type="button" class="ghost back">◂ BACK</button>
        <span class="egg-count">CARD ${at + 1} / ${EGGS.length}</span></p>
      <div class="egg-nav">
      <button type="button" class="ghost egg-step prev" aria-label="Previous card: ${esc(nameOf(prev))}" title="Previous card (←)">◀</button>
      <div class="egg-body">
      <div class="egg-detail${got ? ' found' : ''}">
        <figure><canvas width="128" height="80" aria-hidden="true"></canvas>
          <figcaption>${got ? 'PIXEL ART' : 'NOT FOUND YET'}</figcaption></figure>
        ${real}
      </div>
      ${got && egg.id === 'sun' ? planetStrip() : ''}
      ${got && egg.refs ? refStrip(egg) : ''}
      <h3 class="facts-title">${got ? esc(egg.name.toUpperCase()) : esc(blanks(egg.name))}</h3>
      ${got ? `<p class="egg-badge">★ ${esc(egg.toast)} · found ${esc(progress.eggs[egg.id])}</p><p>${esc(egg.story)}</p>
          <button type="button" class="show-me">SHOW ME</button>`
        : `<p class="egg-clue big-clue">${esc(egg.clue)}</p>
          <p>Know it? Type its name in the search bar.</p><button type="button" class="guess">TAKE A GUESS</button>`}
      </div>
      <button type="button" class="ghost egg-step next" aria-label="Next card: ${esc(nameOf(next))}" title="Next card (→)">▶</button>
      </div>`;
    const canvas = panes.eggs.querySelector('.egg-detail canvas');
    cancelAnimationFrame(detailFrame);
    let last = 0;
    const step = now => {   // animate the found egg while its card is open (~15 fps)
      if (!galleryDialog.open || detailEgg !== egg) return;
      if (now - last > 66) { drawEggArt(canvas, egg, now / 1000, !got); last = now; }
      if (got && !REDUCED_MOTION) detailFrame = requestAnimationFrame(step);
    };
    drawEggArt(canvas, egg, 1, !got);
    const morph = panes.eggs.querySelector('.morph');
    if (morph) photoToPixels(morph, credit.img, egg);
    if (got && !REDUCED_MOTION) detailFrame = requestAnimationFrame(step);
    panes.eggs.querySelector('.back').addEventListener('click', () => { detailEgg = null; renderEggs(); });
    panes.eggs.querySelector('.egg-step.prev').addEventListener('click', () => stepEggCard(-1));
    panes.eggs.querySelector('.egg-step.next').addEventListener('click', () => stepEggCard(1));
    panes.eggs.querySelector('.show-me')?.addEventListener('click', () => {
      galleryDialog.close();
      input.value = egg.query;
      lookup(egg.query);
      sys.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    });
    panes.eggs.querySelector('.guess')?.addEventListener('click', () => {
      galleryDialog.close();
      input.value = '';
      input.focus();
    });
  }

  // Pixelation slider: drag from the real photo (0) to the pixel art (100). Up to 80 the photo is drawn
  // at lower and lower resolution (blocks of 1 to 16 pixels) with fewer and fewer colours; from 80 on it
  // fades into the sprite. The photo comes from this site, so the canvas may read its pixels.
  let morphHold = null;   // PHOTO FINISH redraws the Galleria; the card it was earned on keeps its slider at the end
  function photoToPixels(fig, src, egg) {
    const canvas = fig.querySelector('canvas'), slider = fig.querySelector('input');
    const ctx = canvas.getContext('2d'), photo = new Image();
    const small = document.createElement('canvas'), sctx2 = small.getContext('2d', { willReadFrequently: true });
    const sprite = document.createElement('canvas');
    const draw = () => {
      const v = Number(slider.value), W = canvas.width, H = canvas.height, k = W / 240;   // k: canvas pixels per shown pixel
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#070b1a';
      ctx.fillRect(0, 0, W, H);
      if (!photo.complete || !photo.naturalWidth) return;
      const f = Math.min(v, 80) / 80;
      const block = Math.max(1, Math.round((1 + f ** 1.6 * 15) * k));
      if (block === 1) ctx.drawImage(photo, 0, 0, W, H);
      else {
        small.width = Math.ceil(W / block); small.height = Math.ceil(H / block);
        sctx2.imageSmoothingEnabled = true;
        sctx2.drawImage(photo, 0, 0, small.width, small.height);
        const levels = Math.round(256 - f ** 0.7 * 250);   // 256 -> 6 shades per channel
        if (levels < 256) {
          const data = sctx2.getImageData(0, 0, small.width, small.height);
          const step = 255 / (levels - 1);
          for (let i = 0; i < data.data.length; i += 4) {
            for (let c = 0; c < 3; c++) data.data[i + c] = Math.round(Math.round(data.data[i + c] / step) * step);
          }
          sctx2.putImageData(data, 0, 0);
        }
        ctx.drawImage(small, 0, 0, small.width * block, small.height * block);
      }
      if (v > 80) {   // the last stretch: our sprite fades in over the blocks
        const a = (v - 80) / 20;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#070b1a';
        ctx.fillRect(0, 0, W, H);
        sprite.width = Math.floor(W / 3 / k); sprite.height = Math.floor(H / 3 / k);
        drawEggArt(sprite, egg, 1, false);
        ctx.drawImage(sprite, 0, 0, sprite.width * 3 * k, sprite.height * 3 * k);
        ctx.globalAlpha = 1;
      }
    };
    photo.addEventListener('load', () => {
      canvas.width = Math.max(240, photo.naturalWidth);   // the photo's own resolution, shown 240 wide (or less if tall)
      canvas.height = Math.round(canvas.width * photo.naturalHeight / photo.naturalWidth);
      draw();
    });
    photo.src = src;
    if (morphHold === egg.id) slider.value = slider.max;   // redrawn by the achievement below: stay on the pixel art
    slider.addEventListener('input', () => {
      draw();
      if (slider.value === slider.max) { morphHold = egg.id; achieve('photo-finish'); morphHold = null; }
    });
    draw();
  }

  // The Solar System's card: real photos of the Sun, the planets and the Moon (natural colour).
  const PHOTO_STRIP = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  function planetStrip() {
    const credits = window.STARMAP_GALLERY || {};
    const items = PHOTO_STRIP.filter(k => credits[k]?.img).map(k => `
      <li><a href="${esc(credits[k].link)}" target="_blank" rel="noopener noreferrer" title="${esc(credits[k].what)} · ${esc(credits[k].credit)}">
        <img src="${esc(credits[k].img)}" alt="${esc(credits[k].what)}" loading="lazy" width="64" height="64">
        <span>${esc(k.toUpperCase())}</span></a></li>`).join('');
    return items ? `<ul class="planet-strip" aria-label="Real photos of the Sun and planets">${items}</ul>
      <p class="note">Real photos in natural colour (NASA): hover or tap one for its source. Sizes not to scale.</p>` : '';
  }

  // More references for one easter egg (e.g. The Martian): NASA pictures shown as concept work beside the pixel art.
  function refStrip(egg) {
    const credits = window.STARMAP_GALLERY || {};
    const items = egg.refs.filter(([k]) => credits[k]?.img).map(([k, label]) => `
      <li><a href="${esc(credits[k].link)}" target="_blank" rel="noopener noreferrer" title="${esc(credits[k].what)} · ${esc(credits[k].credit)}">
        <img src="${esc(credits[k].img)}" alt="${esc(credits[k].what)}" loading="lazy" width="64" height="64">
        <span>${esc(label)}</span></a></li>`).join('');
    return items ? `<ul class="planet-strip" aria-label="References">${items}</ul>
      <p class="note">References used for the pixel art (NASA): hover or tap one for what it shows and its source.</p>` : '';
  }

  function renderAchievements() {
    const got = ACHIEVEMENTS.filter(a => progress.ach[a.id]).length;
    const i = rankIndex(), next = nextStage(), badges = earnedBadges();
    const groups = [...new Set(ACHIEVEMENTS.map(a => a.g))].filter(g => g !== 'THE FINAL MISSION');
    const isNew = a => progress.ach[a.id] && !progress.viewed.includes(a.id);
    const card = a => {
      const on = progress.ach[a.id], hidden = a.secret && !on, prog = !on && !hidden && achProgress(a);
      return `<li class="${on ? 'on' : ''} tier-${a.tier}" data-ach="${esc(a.id)}" role="button" tabindex="0"
        aria-label="${hidden ? 'Secret achievement' : esc(a.title)}: open its hologram">
        <canvas width="16" height="16" data-trophy="${on ? a.id : 'lock'}" aria-hidden="true"></canvas>
        <div><b>${hidden ? '???' : esc(a.title)}${isNew(a) ? ' <em class="new">NEW</em>' : ''}</b>
          <span>${hidden ? esc(secretHint(a) || 'A secret achievement. Keep exploring.') : esc(a.how)}</span>
          ${prog ? `<span class="ach-bar"><span data-w="${Math.round(100 * Math.min(1, prog[0] / prog[1]))}"></span></span>
            <span class="ach-progress">${fmt(Math.min(prog[0], prog[1]))} / ${fmt(prog[1])}</span>` : ''}
          <span class="ach-meta">${hidden ? '' : TIERS[a.tier].name}${on ? ` · earned ${esc(niceDate(on))}` : ''}${esc(levelText(a))}</span></div></li>`;
    };
    panes.ach.innerHTML = `
      <div class="rank-panel">
        <canvas class="rank-big" width="16" height="16" data-stage="${i}" aria-hidden="true"></canvas>
        <div><b>YOUR STAR: ${esc(rankName(i))}</b><span>${esc(STAGES[i].about)}</span>
          <span class="ach-progress">${got} / ${ACHIEVEMENTS.length} achievements${next ? ` · next: ${esc(next.stage.name)} in ${plural(next.left, 'more')}` : ''}</span>
          <ol class="ladder" aria-label="The life of your star">${STAGES.map((st, k) => `<li title="${esc(st.name)}: ${
            Number.isFinite(st.at) ? `${st.at} achievements` : 'TRUE STAR GAZER'}"><canvas width="16" height="16" data-stage="${k}" data-locked="${k > i ? 1 : 0}"></canvas></li>`).join('')}</ol></div>
      </div>
      <p><button type="button" class="ghost" id="share-card">DOWNLOAD MY STAR CARD</button></p>
      <h3 class="facts-title">BADGES <span class="ach-count">${badges.length} / ${Object.keys(BADGES).length}</span></h3>
      <ul class="badge-shelf">${Object.entries(BADGES).map(([g, b]) => `<li class="${badges.includes(g) ? 'on' : ''}">
        <canvas width="16" height="16" data-badge="${esc(g)}" data-locked="${badges.includes(g) ? 0 : 1}" aria-hidden="true"></canvas>
        <b>${badges.includes(g) ? esc(b.name) : '? ? ?'}</b><span>complete ${esc(g.toLowerCase())}</span></li>`).join('')}</ul>
      ${gazeCard()}
      ${groups.map(g => {
        const list = ACHIEVEMENTS.filter(a => a.g === g);
        return `<h3 class="facts-title">${esc(g)} <span class="ach-count">${list.filter(a => progress.ach[a.id]).length} / ${list.length}</span></h3>
        <canvas class="constellation" width="160" height="46" data-constellation="${esc(g)}" aria-hidden="true"></canvas>
        <ul class="ach-list">${list.map(card).join('')}</ul>`;
      }).join('')}`;
    panes.ach.querySelectorAll('[data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; });
    paintRankArt(panes.ach);
    panes.ach.querySelector('#share-card').addEventListener('click', shareCard);
    panes.ach.querySelectorAll('li[data-ach]').forEach(li => {
      li.addEventListener('click', () => openHologram(li.dataset.ach));
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHologram(li.dataset.ach); } });
    });
    startAchievementsAnimation();
    const earned = ACHIEVEMENTS.filter(a => progress.ach[a.id]).map(a => a.id);
    if (earned.some(id => !progress.viewed.includes(id))) { progress.viewed = earned; saveProgress(); }
  }

  function refreshGallery() {
    if (!galleryDialog.open) return;
    if (!panes.eggs.hidden) renderEggs();
    if (!panes.ach.hidden) renderAchievements();
  }

  // Settings: is progress being kept, and a backup file to download or load.
  const storageNote = document.getElementById('set-storage');
  async function renderSettings() {
    if (!storageOK) {
      storageNote.textContent = '⚠ This browser isn\'t saving your progress (a private window, or site data is ' +
        'blocked). It will be lost when you close the page: download it below to keep it.';
      return;
    }
    document.getElementById('set-final').hidden = !progress.ach['star-gazer'];
    document.getElementById('set-final-emblem').value = progress.finalEmblem;
    const note = kept => `✓ Saved in this browser: updates to the site keep it.${kept} It's only lost if this ` +
      'site\'s data is cleared, in a private window, or on another browser or device: keep a backup file for those.';
    storageNote.textContent = note('');   // right away; the browser's answer below only adds to it
    try { if (await navigator.storage?.persisted?.()) storageNote.textContent = note(' Protected from automatic clean-up.'); } catch { /* older browser */ }
  }
  document.getElementById('set-export').addEventListener('click', () => {
    const file = new Blob([JSON.stringify({ app: 'kepler-star-map', version: 1, saved: today(), ...progress }, null, 1)],
                          { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `kepler-star-map-progress-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    try { navigator.storage?.persist?.(); } catch { /* best effort: ask the browser to keep our data */ }
  });
  const importInput = document.getElementById('set-import-file');
  document.getElementById('set-import').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    let ok = false;
    try { ok = file.size < 200_000 && mergeProgress(JSON.parse(await file.text())); } catch { ok = false; }
    if (ok) { syncSeen(); saveProgress(); renderHeaderRank(); }
    resetNote.textContent = ok ? 'Progress loaded and merged with what you had.' : 'That file isn\'t a star map progress file.';
  });

  function showTab(name) {
    for (const [key, pane] of Object.entries(panes)) {
      const tab = document.getElementById(`tab-${key}`);
      tab.setAttribute('aria-selected', String(key === name));
      tab.tabIndex = key === name ? 0 : -1;
      pane.hidden = key !== name;
    }
    if (name === 'eggs') renderEggs();
    if (name === 'ach') renderAchievements();
    if (name === 'set') renderSettings();
    if (name === 'pred') renderPredictions();
  }
  const tabs = [...document.querySelectorAll('#gallery [role="tab"]')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showTab(tab.id.slice(4)));
    tab.addEventListener('keydown', e => {   // arrow keys move between tabs
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      showTab(next.id.slice(4));
    });
  });
  document.getElementById('open-gallery').addEventListener('click', () => {
    detailEgg = null;
    galleryDialog.showModal();
    showTab('eggs');
  });
  document.getElementById('gallery-close').addEventListener('click', () => galleryDialog.close());
  galleryDialog.addEventListener('click', e => { if (e.target === galleryDialog) galleryDialog.close(); });   // click outside
  galleryDialog.addEventListener('close', () => cancelAnimationFrame(detailFrame));
  galleryDialog.addEventListener('keydown', e => {
    if (!detailEgg || panes.eggs.hidden || !['ArrowLeft', 'ArrowRight'].includes(e.key) || e.target.closest('input, select, textarea, [role="tab"]')) return;
    e.preventDefault();
    stepEggCard(e.key === 'ArrowRight' ? 1 : -1);
  });

  const soundSetting = document.getElementById('set-sound');
  soundSetting.checked = progress.sound;
  soundSetting.addEventListener('change', () => { progress.sound = soundSetting.checked; progress.soundChoice = true; saveProgress(); if (progress.sound) fanfare('rare'); });
  const toastSetting = document.getElementById('set-toasts');
  toastSetting.checked = progress.toasts;
  toastSetting.addEventListener('change', () => { progress.toasts = toastSetting.checked; saveProgress(); });
  const resetButton = document.getElementById('set-reset'), resetNote = document.getElementById('set-reset-note');
  resetButton.addEventListener('click', () => {
    if (resetButton.dataset.armed !== '1') {   // ask twice
      resetButton.dataset.armed = '1';
      resetButton.textContent = 'SURE? CLICK AGAIN';
      resetNote.textContent = 'This forgets every easter egg, achievement and prediction in this browser (download a backup first?).';
      return;
    }
    const finished = Boolean(progress.ach['star-gazer']) || progress.whiteHole;
    Object.assign(progress, { eggs: {}, ach: {}, systems: [], seen: '', viewed: [], whiteHole: finished, calls: {}, notified: [],
                              showcase: [], levels: {}, daily: { last: '', streak: 0 } });
    syncSeen();
    saveProgress();
    renderHeaderRank();
    resetButton.dataset.armed = '';
    resetButton.textContent = 'RESET PROGRESS';
    resetNote.textContent = 'Progress reset. Happy hunting!';
  });

  // Anniversaries: visiting on Kepler's launch day or the day it was switched off (after the page has loaded).
  queueMicrotask(() => {
    const d = new Date();
    if (d.getMonth() === 2 && d.getDate() === 7) achieve('launch-day');
    if (d.getMonth() === 10 && d.getDate() === 15) achieve('goodnight');
  });
  document.getElementById('set-final-emblem').addEventListener('change', e => {
    progress.finalEmblem = e.target.value === 'white-dwarf' ? 'white-dwarf' : 'black-hole';
    saveProgress();
    renderHeaderRank();
  });
  info.addEventListener('click', e => { if (e.target.closest('a[href*="aladin"]')) achieve('sky'); });

  // ---------------------------------------------------------------- predictions: call it before NASA does
  // On any candidate's case file a visitor can call it, PLANET or NOT A PLANET. When NASA later confirms it
  // or rules it a false positive (data/resolutions.js, recorded by each monthly export with the date it was
  // first seen), the call is scored, but only if NASA ruled after the call was made. Calls are kept in this
  // browser with the rest of the progress (and in the backup file). docs/plans/TATOOINE_AND_PROPHET.md
  const RULINGS = window.STARMAP_RESOLUTIONS || { since: null, resolved: {} };
  const KOI_ID = /^K\d{5}\.\d{2}$/;

  function callOutcome(koi) {   // 'waiting' | 'early' (NASA ruled before the call) | 'right' | 'wrong'
    const c = progress.calls[koi], r = RULINGS.resolved[koi];
    if (!c || !r) return { state: 'waiting' };
    const planet = r[0] === 'confirmed';
    if (!(r[1] > c[1])) return { state: 'early', ruling: r[0], date: r[1] };
    return { state: (c[0] === 'planet') === planet ? 'right' : 'wrong', ruling: r[0], date: r[1],
             sgRight: c[2] ? (c[2] === 'planet') === planet : null };
  }

  const CALL_WORD = { planet: 'PLANET', not: 'NOT A PLANET' };
  const OUTCOME_WORD = { waiting: 'waiting for NASA', early: 'NASA had already ruled', right: '✔ NASA agrees!', wrong: '✖ NASA ruled otherwise' };

  // The "YOUR CALL" line on a candidate's case file (30-info.js).
  function callMarkup(p, system) {
    if (p.status !== 'candidate' || !KOI_ID.test(p.koi)) return '';
    const c = progress.calls[p.koi];
    if (c) {
      return `<br><span class="call made">YOUR CALL: <b>${CALL_WORD[c[0]]}</b> · ${esc(niceDate(c[1]))} · ${OUTCOME_WORD[callOutcome(p.koi).state]}</span>`;
    }
    const sg = p.sg_planet === true ? 'planet' : p.sg_planet === false ? 'not' : '';
    return `<br><span class="call" data-koi="${esc(p.koi)}" data-system="${esc(system)}" data-sg="${sg}">YOUR CALL:
      <button type="button" class="ghost" data-call="planet">PLANET</button>
      <button type="button" class="ghost" data-call="not">NOT A PLANET</button></span>`;
  }
  // A compact call cell for the next-planets table (row: export_starmap.py leaderboard).
  function callCell(row) {
    if (!KOI_ID.test(row.planet)) return '';
    const c = progress.calls[row.planet];
    if (c) return `<span class="call made"><b>${CALL_WORD[c[0]]}</b></span>`;
    const sg = row.sg == null ? '' : row.sg >= SG_THRESHOLD ? 'planet' : 'not';
    return `<span class="call" data-koi="${esc(row.planet)}" data-system="${esc(row.system)}" data-sg="${sg}">
      <button type="button" class="ghost" data-call="planet">PLANET</button>
      <button type="button" class="ghost" data-call="not">NOT</button></span>`;
  }

  function wireCalls(root) {
    root.querySelectorAll('.call[data-koi] button[data-call]').forEach(b => b.addEventListener('click', () => {
      const span = b.closest('.call'), koi = span.dataset.koi;
      progress.calls[koi] = [b.dataset.call, today(), span.dataset.sg, span.dataset.system];
      saveProgress();
      span.outerHTML = `<span class="call made">YOUR CALL: <b>${CALL_WORD[b.dataset.call]}</b> · saved · waiting for NASA
        (see ⚙ → PREDICTIONS)</span>`;
      checkPredictions();
    }));
  }

  function predictionStats() {
    const s = { calls: 0, waiting: 0, early: 0, right: 0, wrong: 0, sgRight: 0, sgWrong: 0, cassandra: 0, contrarian: 0, patience: 0 };
    for (const [koi, c] of Object.entries(progress.calls)) {
      s.calls++;
      const o = callOutcome(koi);
      s[o.state]++;
      if (o.state !== 'right' && o.state !== 'wrong') continue;
      if (o.sgRight === true) s.sgRight++;
      if (o.sgRight === false) s.sgWrong++;
      if (o.state === 'right' && o.sgRight === false) s.contrarian++;
      if (o.state === 'right' && c[0] === 'not' && c[2] === 'planet') s.cassandra++;
      if ((Date.parse(o.date) - Date.parse(c[1])) / 86_400_000 >= 365) s.patience++;
    }
    return s;
  }
  function checkPredictions() {   // achievements, and a pop-up for each call NASA has settled since last time
    const s = predictionStats();
    if (s.calls >= 1) achieve('first-call');
    if (s.right >= 1) achieve('prophet');
    if (s.right >= 5) achieve('seer');
    if (s.cassandra >= 1) achieve('cassandra');
    if (s.contrarian >= 3) achieve('contrarian');
    if (s.patience >= 1) achieve('patience');
    for (const koi of Object.keys(progress.calls)) {
      const o = callOutcome(koi);
      if ((o.state === 'right' || o.state === 'wrong') && !progress.notified.includes(koi)) {
        progress.notified.push(koi);
        saveProgress();
        toast('rank', 'NASA RULED', `${koi} is ${o.ruling === 'confirmed' ? 'a planet' : 'not a planet'}: ${
          o.state === 'right' ? 'you called it!' : 'not this time.'}`, null, BADGES.PREDICTIONS.art);
      }
    }
  }

  function renderPredictions() {
    const pane = document.getElementById('pane-pred'), s = predictionStats();
    const rows = Object.entries(progress.calls).sort((a, b) => b[1][1].localeCompare(a[1][1])).map(([koi, c]) => {
      const o = callOutcome(koi), r = RULINGS.resolved[koi];
      return `<tr class="${o.state}"><td>${esc(koi)}</td>
        <td><button type="button" class="linkish" data-name="${esc(c[3])}">${esc(c[3])}</button></td>
        <td>${CALL_WORD[c[0]]}</td><td>${esc(niceDate(c[1]))}</td><td>${c[2] ? CALL_WORD[c[2]] : '-'}</td>
        <td>${r ? `${esc(r[0])} · ${esc(niceDate(r[1]))}` : 'waiting'}</td>
        <td>${o.state === 'right' ? '✔' : o.state === 'wrong' ? '✖' : o.state === 'early' ? '(too late)' : ''}</td></tr>`;
    }).join('');
    const settled = s.right + s.wrong;
    pane.innerHTML = `
      <p>Call a candidate before NASA does: open a system with candidates (try 🏆 next planets) and choose
         <b>PLANET</b> or <b>NOT A PLANET</b> in its case files. When NASA confirms it or rules it a false positive,
         your call is scored here. It's a slow game: NASA settles a few Kepler candidates at a time.</p>
      <p class="gallery-progress"><b>${s.calls}</b> CALLS · <b>${s.right}</b> RIGHT · <b>${s.wrong}</b> WRONG · ${s.waiting} WAITING</p>
      ${settled ? `<p>You vs Star Gazer on the same settled calls: you <b>${s.right}/${settled}</b>, Star Gazer
        <b>${s.sgRight}/${s.sgRight + s.sgWrong}</b>.</p>` : ''}
      ${rows ? `<div class="table-wrap"><table>
        <thead><tr><th>Candidate</th><th>System</th><th>Your call</th><th>Called</th><th>Star Gazer</th><th>NASA</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<p class="status">No calls yet.</p>'}
      <p class="note">NASA's rulings are recorded by the site's monthly data refresh${RULINGS.since ? ` (since ${esc(niceDate(RULINGS.since))})` : ''},
        dated when they were first seen. A call counts only if NASA ruled after you made it. Calls are saved in this
        browser (keep a backup under SETTINGS).</p>`;
    pane.querySelectorAll('button[data-name]').forEach(b => b.addEventListener('click', () => {
      const star = byName.get(b.dataset.name.toLowerCase());
      if (star) { galleryDialog.close(); choose(star); }
    }));
  }

  queueMicrotask(checkPredictions);

  // ---------------------------------------------------------------- ranks: trophies, badges and a star's life
  // Pixel art for the achievements and the rank shown in the page header (docs/star-map/STAR_GAZER_MISSION.md):
  // a trophy per difficulty (bronze, silver, gold, a galaxy cup for secrets), a space lock for locked ones,
  // a badge per completed set, and your rank as the life of a star, from stardust to a black hole. Concept
  // art: pixel-art/icons/, pixel-art/emblems/.
  function pix(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  const noise = (...a) => { const v = Math.sin(a.reduce((s, n, i) => s + (i + 1) * 12.9898 * n, 0) + 78.233) * 43758.5453; return v - Math.floor(v); };

  // Draw a 16 x 16 piece of art (a function of (put, t)) at (x, y), `scale` canvas pixels per art pixel;
  // `silhouette` paints every pixel in one dark colour (locked / not earned yet).
  function drawArt(ctx, art, x, y, scale = 1, t = 0, silhouette = false) {
    const put = (ax, ay, c) => {
      if (ax < 0 || ay < 0 || ax >= 24 || ay >= 24) return;
      ctx.fillStyle = silhouette ? '#1c2245' : c;
      ctx.fillRect(x + ax * scale, y + ay * scale, scale, scale);
    };
    art(put, t);
  }
  function discArt(put, cx, cy, r, colour) {   // colour(dx, dy, f) with f = distance / r
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d <= r) put(x, y, colour(dx, dy, d / r));
      }
    }
  }
  function ringArt(put, cx, cy, rx, ry, colour, keep = () => true, step = 0.05) {
    for (let a = 0; a < 2 * Math.PI; a += step) {
      if (keep(a)) put(Math.round(cx - 0.5 + rx * Math.cos(a)), Math.round(cy - 0.5 + ry * Math.sin(a)), colour);
    }
  }

  // ---- trophies (pixel-art/icons/draft_trophy*.png)
  const TROPHY_ART = [
    '..OyyyyyyyyyyO..', 'oo.yYYyyyyyyo.oo', 'o..yYyyyyyyyo..o', 'o..yYyyyyyyyo..o',
    '.o.yYyyyyyyyo.o.', '..oyyyyyyyyyoo..', '....oyyyyyyo....', '.....oyyyyo.....',
    '......oyyo......', '.......yo.......', '.......yo.......', '.....oyyyyo.....',
    '....pPPPPPPp....', '....pPPPPPPp....', '...dppppppppd...', '...dddddddddd...',
  ];
  const TIERS = {   // highlight, body, edge, dark edge; name shown on the card
    common: { ink: ['#f3c9a0', '#cd7f45', '#a85f2c', '#6e3a18'], name: 'COMMON' },
    rare: { ink: ['#ffffff', '#c9d2de', '#9aa6b8', '#5d6878'], name: 'RARE' },
    epic: { ink: ['#fff1b0', '#ffc93c', '#e89a1c', '#a8620e'], name: 'EPIC' },
    secret: { ink: ['#e9d5ff', '#3a2a7a', '#6a3fb0', '#2a1a55'], name: 'SECRET' },
    legend: { ink: ['#fff1b0', '#ffc93c', '#e89a1c', '#a8620e'], name: 'LEGENDARY' },
  };
  const trophyArt = tier => (put, t) => {
    const [Y, y, o, O] = TIERS[tier].ink, ink = { Y, y, o, O, P: '#a8708f', p: '#7a4a6e', d: '#4a2a44' };
    TROPHY_ART.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') put(c, r, ink[ch]); }));
    if (tier === 'epic') [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => put(8 + dx, 3 + dy, dx || dy ? Y : '#ffffff'));
    if (tier === 'rare') { put(8, 3, '#9fd8ff'); put(7, 3, '#4a7fd6'); put(8, 4, '#4a7fd6'); }
    if (tier === 'secret') {   // a spiral galaxy in the bowl, slowly turning
      TROPHY_ART.slice(0, 9).forEach((row, r) => [...row].forEach((ch, c) => {
        if (!'yYo'.includes(ch)) return;
        const dx = c - 7.5, dy = (r - 2.8) * 1.6, d = Math.hypot(dx, dy);
        const arm = Math.cos(2 * Math.atan2(dy, dx) - d * 1.1 - t * 0.8);
        put(c, r, d < 0.9 ? '#ffffff' : d < 1.8 ? '#e9d5ff' : arm > 0.55 ? '#b56cff' : arm > -0.1 ? '#6a3fb0' : '#2a1e5a');
      }));
      for (const [sx, sy] of [[3, 1], [12, 3], [5, 6]]) put(sx, sy, '#9fd8ff');
    }
  };
  // The harder achievements get their own trophy: the tier's cup with a symbol of what they're for (7 x 6
  // pixels on the bowl). Letters are colours (SYMBOL_INK); '.' leaves the cup showing.
  const SYMBOL_INK = {
    r: '#c45a32', R: '#8e3d22', w: '#ffffff', b: '#9fd8ff', B: '#2f4fae', k: '#151a2c', y: '#ffd34d', o: '#ff9a3c',
    v: '#b56cff', V: '#6a3fb0', g: '#4fd17a', t: '#e6d3a8', T: '#a8774c', s: '#d6dae2', m: '#7d8596',
  };
  const SYMBOLS = {
    census: ['w.....w', '...y...', '.w...b.', '..b.w..', 'y....w.', '...w...'],                   // a sky full of stars
    cartographer: ['...r...', '..rrr..', '.kkwkk.', '..sss..', '...s...', '.......'],          // a compass needle
    'mission-control': ['.......', 'BB.s.BB', 'BBsssBB', 'BB.s.BB', '...m...', '..m.m..'],     // a satellite
    'red-fleet': ['..rrr..', '.rrRrr.', '.rRrrr.', '.rrrRr.', '..rrr..', '.......'],           // Mars
    'jupiter-crew': ['..ttt..', '.TTTTT.', '.ttttt.', '.TrTTT.', '..ttt..', '.......'],        // Jupiter and its spot
    'sun-chasers': ['y..y..y', '.yoooy.', 'yoyyyoy', '.yoooy.', 'y..y..y', '.......'],         // the Sun
    curator: ['TTTTTTT', 'TbbbbbT', 'TbbgbbT', 'TbgggbT', 'TTTTTTT', '.......'],               // a framed picture
    'grand-tour': ['..kkk..', '.kyyyk.', 'kyykyyk', '.kyyyk.', '..kkk..', '.......'],          // the Golden Record
    'double-sunset': ['.yy.oo.', 'yyyyooo', '.yy.oo.', 'TTTTTTT', 'T.TTT.T', '.......'],      // two suns setting
    seer: ['..vvv..', '.vwvvv.', '.vvvvv.', '..vvv..', '.TTTTT.', '.......'],                  // a crystal ball
    cassandra: ['.r...r.', '..r.r..', '...r...', '..r.r..', '.r...r.', '.......'],             // "not a planet"
    contrarian: ['..b....', '.bbb...', '..b..o.', '..b..o.', '....ooo', '.....o.'],            // against the flow
    patient: ['.......', '..www..', '.wwkww.', '..www..', '.......', '.......'],               // an eye that waits
    night: ['..yy...', '.yy....', '.yy....', '.yy..w.', '..yy...', '.......'],                 // a crescent moon
    hollow: ['...m...', '.b.m.b.', 'b..m..b', '.b.m.b.', '..mmm..', '.......'],                // an antenna, no reply
    'so-close': ['.rrrrr.', 'r.www.r', 'r.wrw.r', 'r.www.r', '.rrrrr.', '......y'],          // a dart just off the bullseye
    'cosmic-zoom': ['.vvvv..', 'v....v.', 'v.yy..v', 'v.y...v', '.v...v.', '..vvv..'],         // a spiral, the universe
    'lost-in-orbit': ['..www..', '.woooww', '.woooww', '..www.m', '.wwwwm.', '.w.w...'],      // an astronaut, tether loose
    'dwarf-king': ['y.y.y..', 'yyyyy..', '.......', 'w.b.r.t', '.......', '.......'],      // a crown over five little worlds
    houston: ['..TTT..', '..kkk..', 'TTTTTTT', '..www..', '.wooow.', '..www..'],         // the astronaut's cowboy hat
    'space-wardrobe': ['rrr.kkk', 'rrr.kkk', '.......', 'TTT.yyy', 'TTT.yyy', '.......'],   // four hats on the rack
    runway: ['...y...', '..yyy..', 'yyyyyyy', '..yyy..', '.y...y.', '.......'],         // a star of the runway
    'walk-in-closet': ['TTTTTTT', 'T.T.T.T', 'T.T.T.T', 'T.T.T.T', 'TTTTTTT', '.......'],  // a wardrobe
    'tail-chaser': ['......w', '....tww', '..ttt.b', '.ttt.b.', 'ttt.b..', '.......'],     // a comet's tails
    'ufo-spotter': ['.......', '..bbb..', '.bgbgb.', 'sssssss', '.yssy..', '.......'],     // the saucer
    'asteroid-catcher': ['.......', '..ttm..', '.tmmmk.', '.mmmkk.', '..mkk..', '.......'],   // a lumpy rock
    'what-was-that': ['....bb.', '...sss.', '..sssss', 'mm.....', 'mkm....', '.m.....'],   // a saucer, a rock behind
    'space-farmer': ['..www..', '.w...w.', 'w.g.g.w', 'wgggggw', 'TTTTTTT', '.......'],     // a dome over a potato patch
    speedrun: ['bb.w...', '..bbb.w', 'w.bbbbb', '..bbb.w', 'bb.w...', '.......'],              // warp streaks
    goodnight: ['....www', '.....w.', 'ww..www', '.w.....', 'ww.....', '.......'],             // zZ
    'launch-day': ['...w...', '..wbw..', '..www..', '.rwwwr.', '...o...', '..o.o..'],          // a rocket
    streak: ['rrrrrrr', 'wwwwwww', 'wkwkwkw', 'wwwwwww', 'wkwkwyw', 'wwwwwww'],              // a week on the calendar
  };
  const trophyFor = a => (a.id === 'star-gazer' ? starGazerTrophy : !SYMBOLS[a.id] ? trophyArt(a.tier) : (put, t) => {
    trophyArt(a.tier)(put, t);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {   // a dark plaque on the bowl, so the symbol reads on any cup
      if ((r === 0 || r === 5) && (c === 0 || c === 6)) continue;
      put(4 + c, 1 + r, a.tier === 'secret' ? '#1a1240' : '#1c2245');
    }
    SYMBOLS[a.id].forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const blink = a.tier === 'secret' && (ch === 'w' || ch === 'b') && Math.sin(t * 3 + c + r) < -0.6;   // secret symbols twinkle
      put(4 + c, 1 + r, blink ? '#e9d5ff' : SYMBOL_INK[ch]);
    }));
    trophyMarks(a, put);   // e.g. GALACTIC CENSUS level stars (49b-trophies.js)
  });

  // TRUE STAR GAZER: a black hole rising from a pale-blue cup (24 x 24; pixel-art/icons/draft_trophy_star_gazer.png)
  const starGazerTrophy = (put, t) => {
    const OUT = '#1a1f3a';
    for (let y = 11; y < 15; y++) { put(3, y, '#ffc93c'); put(20, y, '#ffc93c'); }
    for (const x of [4, 5, 18, 19]) { put(x, 10, '#ffc93c'); put(x, 15, '#ffc93c'); }
    for (let y = 10; y < 18; y++) {
      const half = 8 - Math.max(0, y - 13) * 1.5, l = Math.round(11.5 - half), r = Math.round(11.5 + half);
      for (let x = l; x <= r; x++) put(x, y, x === l || x === r || y === 17 ? OUT : x < 9 ? '#d6e8f8' : x > 15 ? '#6a8cba' : '#9fc4e8');
    }
    for (const y of [18, 19]) for (let x = 10; x < 14; x++) put(x, y, x === 10 || x === 13 ? OUT : '#6a8cba');
    for (let x = 8; x < 16; x++) put(x, 20, x === 8 || x === 15 ? OUT : '#4a7fd6');
    for (let x = 7; x < 17; x++) put(x, 21, x === 7 || x === 16 ? OUT : '#3a64b4');
    for (let x = 6; x < 18; x++) put(x, 22, OUT);
    discArt(put, 12, 6, 4.6, (dx, dy, f) => (f > 0.87 ? '#e89a1c' : f > 0.74 ? '#ffd34d' : f > 0.64 ? '#fff1b0' : '#000000'));
    for (let x = 1; x < 23; x++) {   // the accretion disk across the bottom of the shadow, turning
      const off = Math.abs(x + 0.5 - 12) / 10.5;
      if (off > 1) continue;
      const glint = noise(Math.round(x + t * 4) % 23) > 0.75;
      put(x, Math.round(8.6 + (x - 12) * 0.1), glint ? '#ffffff' : off < 0.45 ? '#fff1b0' : off < 0.75 ? '#ffc93c' : '#e8782a');
    }
    discArt(put, 12, 14, 2.3, (dx, dy) => (dx + dy < -1 ? '#ff9678' : '#e0602a'));   // a ringed planet on the cup
    for (let x = 8; x < 17; x++) put(x, Math.round(14.4 - (x - 12) * 0.25), '#d6e8f8');
    for (const [sx, sy, c] of [[2, 2, '#ffffff'], [21, 3, '#9fd8ff'], [1, 12, '#ffffff'], [22, 17, '#ffd34d']]) {
      const on = Math.sin(t * 2 + sx) > -0.3;
      put(sx, sy, on ? c : '#4a5590');
      if (on) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(sx + dx, sy + dy, '#4a5590');
    }
  };
  // Locked: a space lock: the shackle is a planet's ring, the body a dark planet, the keyhole a star.
  const spaceLock = put => {
    ringArt(put, 8, 7, 4.2, 5, '#9aa6d6', a => Math.sin(a) < 0, 0.04);
    discArt(put, 8, 11, 5.4, (dx, dy, f) => (dx + dy < -3 ? '#4a5590' : f < 0.82 ? '#2b3566' : '#1e254b'));
    for (let x = 2; x < 14; x++) put(x, x === 2 || x === 13 ? 11 : 10, '#9aa6d6');
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => put(8 + dx, 12 + dy, dx || dy ? '#e89a1c' : '#ffd34d'));
  };

  // ---- set badges: one per achievement group, earned by completing it
  const BADGES = {
    EXPLORER: { name: 'THE COMPASS', art: put => {
      ringArt(put, 8, 8, 6.5, 6.5, '#ffc93c', () => true, 0.03);
      discArt(put, 8, 8, 5.6, () => '#1e254b');
      for (let k = -4; k <= 4; k++) put(8 + Math.round(k * 0.5), 8 - k, k > 0 ? '#ff6b5a' : '#eef2f8');
      put(7, 7, '#ffc93c'); put(8, 8, '#ffc93c');
      for (const [x, y] of [[8, 1], [1, 8], [14, 8], [8, 14]]) put(x, y, '#fff1b0');
    } },
    'FAMOUS WORLDS': { name: 'THE RINGED WORLD', art: put => {
      ringArt(put, 8, 8, 7.4, 2.4, '#d9c79a', a => Math.sin(a) < 0, 0.03);
      discArt(put, 8, 8, 4.6, (dx, dy) => (Math.round(dy) % 3 === 0 ? '#c9a473' : dx + dy < -3 ? '#f0e3c4' : '#e6d3a8'));
      ringArt(put, 8, 8, 7.4, 2.4, '#efe0bd', a => Math.sin(a) >= 0, 0.03);
    } },
    SCIENCE: { name: 'THE LIGHT CURVE', art: put => {
      for (let x = 1; x < 15; x++) { put(x, 1, '#2b3566'); put(x, 14, '#2b3566'); }
      for (let y = 1; y < 15; y++) { put(1, y, '#2b3566'); put(14, y, '#2b3566'); }
      for (let x = 2; x < 14; x++) put(x, x >= 6 && x <= 9 ? (x === 6 || x === 9 ? 9 : 11) : 6, '#4fd17a');
      discArt(put, 12, 4, 1.4, () => '#ffd34d');
    } },
    "STAR GAZER'S GUESSES": { name: 'THE CRYSTAL BALL', art: (put, t) => {
      discArt(put, 8, 7, 5.6, (dx, dy, f) => (dx + dy < -4 ? '#e9d5ff' : f > 0.85 ? '#6a3fb0' : '#9b6cff'));
      const s = Math.sin(t * 2) > 0 ? '#ffffff' : '#fff1b0';
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => put(9 + dx, 8 + dy, dx || dy ? '#ffd34d' : s));
      for (let x = 4; x < 12; x++) { put(x, 13, '#a8620e'); put(x, 14, '#6e3a18'); }
    } },
    'MAP AND TOOLS': { name: 'THE TELESCOPE', art: put => {
      for (let k = 0; k < 9; k++) { put(3 + k, 9 - Math.round(k * 0.7), '#d6dae2'); put(3 + k, 10 - Math.round(k * 0.7), '#9aa6b8'); }
      put(12, 2, '#9fd8ff'); put(12, 3, '#9fd8ff'); put(2, 9, '#454b5e'); put(2, 10, '#454b5e');
      for (let k = 0; k < 5; k++) { put(7 - k, 9 + k, '#a85f2c'); put(7, 9 + k, '#a85f2c'); put(7 + k, 9 + k, '#a85f2c'); }
      put(14, 1, '#ffffff');
    } },
    'EASTER EGGS': { name: 'THE GOLDEN SATELLITE', art: put => {
      for (let y = 5; y < 11; y++) for (let x = 0; x < 5; x++) { put(x, y, (x + y) % 2 ? '#2f4fae' : '#5d7bd6'); put(11 + x, y, (x + y) % 2 ? '#2f4fae' : '#5d7bd6'); }
      for (let y = 5; y < 11; y++) put(5, y, '#9aa6b8'), put(10, y, '#9aa6b8');
      discArt(put, 8, 8, 2.8, (dx, dy) => (dx + dy < -1 ? '#fff1b0' : '#ffc93c'));
      ringArt(put, 8, 3, 2.5, 1, '#eef2f8', a => Math.sin(a) > -0.5);
      put(8, 4, '#d6dae2');
    } },
    WARDROBE: { name: 'THE COAT HANGER', art: put => {   // a hanger with a little scarf
      put(8, 2, '#d6dae2'); put(9, 2, '#d6dae2'); put(9, 3, '#d6dae2'); put(8, 4, '#d6dae2');
      for (let k = 0; k < 6; k++) { put(8 - k, 5 + k, '#ffc93c'); put(8 + k, 5 + k, '#ffc93c'); }
      for (let x = 2; x <= 14; x++) put(x, 11, '#ffc93c');
      for (let y = 8; y < 14; y++) { put(7, y, '#e04a4a'); put(9, y, '#e04a4a'); }
      put(8, 9, '#ff6ec7'); put(8, 12, '#ff6ec7');
    } },
    'SKY WATCH': { name: 'THE SHOOTING STAR', art: put => {   // a comet streaking across a dark square of sky
      for (let k = 0; k < 11; k++) {
        const x = 13 - k, y = 3 + Math.round(k * 0.8);
        put(x, y, k < 2 ? '#ffffff' : k < 5 ? '#f4ecd6' : k < 8 ? '#c9bfa4' : '#7a735f');
        if (k > 1 && k < 9) put(x, y + 1, k < 5 ? '#c9bfa4' : '#7a735f');
      }
      put(14, 2, '#dfefff'); put(13, 2, '#ffffff'); put(14, 3, '#ffffff');
      for (const [x, y] of [[3, 3], [10, 12], [6, 1], [13, 14]]) put(x, y, '#9fd8ff');
    } },
    'TWO SUNS': { name: 'THE TWIN SUNSET', art: (put, t) => {
      discArt(put, 5, 7.5, 3.4, (dx, dy, f) => (f < 0.55 ? '#fff1b0' : '#ffc93c'));
      discArt(put, 11, 9, 2.4, (dx, dy, f) => (f < 0.55 ? '#ffd9a0' : '#ff9a3c'));
      for (let x = 0; x < 16; x++) for (let y = 11; y < 16; y++) {
        const dune = 11 + Math.round(Math.sin(x * 0.6) * 0.8);
        if (y >= dune) put(x, y, y === dune ? '#e0a060' : (x + y) % 3 ? '#a8622c' : '#8a4e22');
      }
      if (Math.sin(t) > 0) put(2, 2, '#ffffff');
    } },
    PREDICTIONS: { name: 'THE HOURGLASS', art: (put, t) => {
      for (let x = 3; x < 13; x++) { put(x, 1, '#c9a24a'); put(x, 14, '#c9a24a'); }
      for (let y = 2; y < 14; y++) {
        const w = Math.round(Math.abs(y - 7.5) * 0.7) + 1;
        put(7 - w, y, '#9fd8ff'); put(8 + w, y, '#9fd8ff');
        const fall = (t * 2) % 6;
        for (let x = 8 - w; x < 8 + w; x++) {
          if ((y > 9 && y > 13 - fall) || (y < 6 && y > 1 + fall)) put(x, y, '#ffd34d');
        }
      }
      put(7, 8, '#ffd34d'); put(8, 7, '#ffd34d');
    } },
    'DAILY SKY': { name: 'THE STAR CALENDAR', art: (put, t) => {
      for (let y = 2; y < 15; y++) for (let x = 2; x < 14; x++) put(x, y, y < 5 ? '#c43c2a' : (x === 2 || x === 13 || y === 14) ? '#9aa6b8' : '#eef2f8');
      for (const x of [4, 11]) { put(x, 1, '#9aa6b8'); put(x, 2, '#454b5e'); }
      const on = Math.sin(t * 2) > -0.3;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => put(8 + dx, 9 + dy, dx || dy ? '#ffd34d' : on ? '#ffffff' : '#ffd34d'));
    } },
    SECRET: { name: 'THE ALL-SEEING EYE', art: (put, t) => {
      for (let x = 1; x < 15; x++) { const h = Math.round(Math.sqrt(Math.max(0, 1 - ((x - 7.5) / 7) ** 2)) * 4); put(x, 8 - h, '#b56cff'); put(x, 8 + h, '#b56cff'); }
      discArt(put, 8, 8, 3.2, (dx, dy, f) => (f < 0.45 ? '#000000' : '#6a3fb0'));
      put(7, 7, '#ffffff');
      if (Math.sin(t * 1.5) > 0) for (const [x, y] of [[2, 2], [13, 13], [14, 3]]) put(x, y, '#e9d5ff');
    } },
  };

  // ---- the life of a star (pixel-art/emblems/; scripts/starmap/draft_emblems.py)
  const stage = {
    stardust: (put, t) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const n = noise(x >> 1, y >> 1) * 0.6 + noise(x, y) * 0.4 - Math.hypot(x - 7.5, (y - 7.5) * 1.3) / 18;
        if (n > 0.3) put(x, y, n > 0.62 ? '#c87fa0' : n > 0.5 ? '#8a5ea8' : n > 0.4 ? '#4a3f7a' : '#2b2f5e');
      }
      put(3, 4, Math.sin(t * 2) > 0 ? '#ffffff' : '#8a5ea8'); put(12, 11, '#9fd8ff');
    },
    protostar: (put, t) => {
      discArt(put, 8, 8, 3.2, (dx, dy, f) => (f < 0.35 ? '#ffffff' : f < 0.65 ? '#fff1b0' : '#ff9a3c'));
      for (let x = 1; x < 15; x++) put(x, 8, x >= 4 && x <= 11 ? '#7a1f1a' : '#4a3f7a');
      for (const x of [2, 3, 12, 13]) { put(x, 7, '#2b2f5e'); put(x, 9, '#2b2f5e'); }
      const jet = Math.round(Math.sin(t * 3)) + 1;
      for (let k = 0; k < 3 + jet; k++) { put(7, 3 - k, '#4a7fd6'); put(7, 12 + k, '#4a7fd6'); }
    },
    young: (put, t) => {
      discArt(put, 8, 8, 4.5, (dx, dy, f) => (dx < -1 && dy < -1 && f < 0.6 ? '#ffffff' : f < 0.55 ? '#fff1b0' : '#ffd34d'));
      const rays = Math.sin(t * 2) > 0 ? 2 : 1;
      for (let k = 1; k <= rays + 1; k++) for (const [x, y] of [[7, 3 - k], [7, 12 + k], [3 - k, 7], [12 + k, 7]]) put(x, y, '#ffd34d');
    },
    redGiant: (put, t) => {   // a boiling surface: big convection cells drift and change, the star breathes
      const r = 6.3 + 0.3 * Math.sin(t * 1.4), tick = Math.floor(t * 2.5);
      discArt(put, 8, 8, r, (dx, dy, f) => (f > 0.92 ? '#7a1f1a'
        : f > 0.75 || noise(Math.floor(dx / 2), Math.floor(dy / 2), tick % 7) < 0.22 ? '#c43c2a'
        : noise(Math.floor(dx + t * 0.6), Math.floor(dy), tick % 5) < 0.5 ? '#e0602a' : '#ff9a3c'));
    },
    supergiant: (put, t) => {
      const r = 7.4 + 0.4 * Math.sin(t * 2);
      discArt(put, 8, 8, r, (dx, dy, f) => (f > 0.9 ? '#7a1f1a' : noise(Math.floor(dx / 3), Math.floor(dy / 3)) < 0.35 ? '#c43c2a' : '#e0602a'));
      for (let k = 0; k < 10; k++) put(Math.round(7.5 + 7.8 * Math.cos(k * 0.63 + t * 0.3)), Math.round(7.5 + 7.8 * Math.sin(k * 0.63 + t * 0.3)), '#8a5ea8');
    },
    supernova: (put, t) => {
      const p = (t * 0.4) % 1, shell = 3 + 4 * p;
      ringArt(put, 8, 8, shell, shell, p < 0.6 ? '#ff9a3c' : '#c43c2a', a => noise(Math.round(a * 9)) > 0.25, 0.03);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        for (let s = 1; s <= Math.round(2 + 4 * (1 - Math.abs(0.5 - p))); s++) put(Math.round(7.5 + s * Math.cos(a)), Math.round(7.5 + s * Math.sin(a)), s < 3 ? '#fff1b0' : '#ffd34d');
      }
      discArt(put, 8, 8, 1.6, () => '#ffffff');
    },
    pulsar: (put, t) => {
      const a = t * 2.5;
      for (const sign of [1, -1]) for (let s = 2; s < 9; s++) for (const w of [-0.2, -0.1, 0, 0.1, 0.2]) {
        if (Math.abs(w) > 0.05 * s) continue;
        put(Math.round(7.5 + sign * s * Math.cos(a + w)), Math.round(7.5 + sign * s * Math.sin(a + w)), s < 4 ? '#9fd8ff' : s < 6 ? '#b56cff' : '#6a3fb0');
      }
      discArt(put, 8, 8, 1.7, (dx, dy, f) => (f < 0.6 ? '#ffffff' : '#9fd8ff'));
    },
    blackHole: (put, t) => {
      const disk = a => { const n = noise(Math.round((a / (2 * Math.PI) + t * 0.15) * 24) % 24); return n > 0.85 ? '#ffffff' : n > 0.6 ? '#fff1b0' : n > 0.3 ? '#ffd34d' : '#ff9a3c'; };
      for (let a = 0; a < 2 * Math.PI; a += 0.04) if (Math.sin(a) < 0) put(Math.round(7.5 + 7.2 * Math.cos(a)), Math.round(7.5 + 2.2 * Math.sin(a)), disk(a));
      ringArt(put, 8, 8, 5.4, 5.0, '#ff9a3c', a => Math.sin(a) < -0.1, 0.04);
      ringArt(put, 8, 8, 4.4, 4.2, '#e0602a', a => Math.sin(a) > 0.55);
      discArt(put, 8, 8, 3.3, (dx, dy, f) => (f > 0.86 ? '#fff1b0' : '#000000'));
      for (let a = 0; a < 2 * Math.PI; a += 0.04) if (Math.sin(a) >= 0) {
        put(Math.round(7.5 + 7.2 * Math.cos(a)), Math.round(7.5 + 2.2 * Math.sin(a)), disk(a));
        put(Math.round(7.5 + 6.2 * Math.cos(a)), Math.round(7.5 + 1.6 * Math.sin(a)), '#e0602a');
      }
    },
    whiteDwarf: (put, t) => {
      ringArt(put, 8, 8, 6, 6, '#4a7fd6', () => true, 0.09);
      ringArt(put, 8, 8, 5, 5, '#9fd8ff', a => Math.cos(a * 3 + t) > 0, 0.16);
      discArt(put, 8, 8, 1.8, (dx, dy, f) => (f < 0.7 ? '#ffffff' : '#9fd8ff'));
    },
    whiteHole: (put, t) => {
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6 + 0.2, s = 3 + ((t * 3 + k) % 6);
        put(Math.round(7.5 + s * Math.cos(a)), Math.round(7.5 + s * Math.sin(a)), s > 6 ? '#b56cff' : '#9fd8ff');
      }
      ringArt(put, 8, 8, 3.6, 3.6, '#b56cff', () => true, 0.08);
      discArt(put, 8, 8, 2.8, () => '#ffffff');
    },
  };
  const STAGES = [   // reached by the number of achievements (TRUE STAR GAZER excluded)
    { name: 'STARDUST', at: 0, art: stage.stardust, about: 'A cold cloud of gas and dust: every star starts as one.' },
    { name: 'PROTOSTAR', at: 1, art: stage.protostar, about: 'A ball of gas collapsing and heating up inside a dusty disk.' },
    { name: 'YOUNG STAR', at: 5, art: stage.young, about: 'Hydrogen fusion has begun: a star like the Sun.' },
    { name: 'RED GIANT', at: 12, art: stage.redGiant, about: 'Its core runs low on hydrogen and the star swells up.' },
    { name: 'SUPERGIANT', at: 22, art: stage.supergiant, about: 'A heavy star swollen even more, shedding dust.' },
    { name: 'SUPERNOVA', at: 34, art: stage.supernova, about: 'The core collapses and the star explodes.' },
    { name: 'PULSAR', at: 46, art: stage.pulsar, about: 'What is left: a city-sized neutron star, spinning and sweeping beams.' },
    { name: 'BLACK HOLE', at: Infinity, art: stage.blackHole, about: 'Earned only as a TRUE STAR GAZER: not even light escapes.' },
  ];
  const regularCount = () => ACHIEVEMENTS.filter(a => a.id !== 'star-gazer' && progress.ach[a.id]).length;
  function rankIndex() {
    if (progress.ach['star-gazer']) return STAGES.length - 1;
    const n = regularCount();
    let i = 0;
    STAGES.forEach((s, k) => { if (n >= s.at) i = k; });
    return i;
  }
  function rankArt(i = rankIndex()) {   // the final stage can be shown as a white dwarf; a reset after it, as a white hole
    if (i === STAGES.length - 1 && progress.finalEmblem === 'white-dwarf') return stage.whiteDwarf;
    if (i === 0 && progress.whiteHole) return stage.whiteHole;
    return STAGES[i].art;
  }
  const rankName = (i = rankIndex()) => (i === STAGES.length - 1 && progress.finalEmblem === 'white-dwarf' ? 'WHITE DWARF'
    : i === 0 && progress.whiteHole ? 'WHITE HOLE' : STAGES[i].name);
  function nextStage() {
    const i = rankIndex();
    if (i >= STAGES.length - 2) return null;
    return { stage: STAGES[i + 1], left: STAGES[i + 1].at - regularCount() };
  }
  const earnedBadges = () => Object.keys(BADGES).filter(g => ACHIEVEMENTS.filter(a => a.g === g).every(a => progress.ach[a.id]));

  // Paint every <canvas data-trophy|data-badge|data-stage> inside `root`.
  function paintRankArt(root, t = 1) {
    root.querySelectorAll('canvas[data-trophy]').forEach(c => {
      const ctx = c.getContext('2d'), key = c.dataset.trophy;
      ctx.clearRect(0, 0, c.width, c.height);
      const art = key === 'lock' ? spaceLock : key === 'legend' ? starGazerTrophy : ACH.has(key) ? trophyFor(ACH.get(key)) : trophyArt(key);
      drawArt(ctx, art, 0, 0, 1, t);
    });
    root.querySelectorAll('canvas[data-badge]').forEach(c => {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      drawArt(ctx, BADGES[c.dataset.badge].art, 0, 0, 1, t, c.dataset.locked === '1');
    });
    root.querySelectorAll('canvas[data-constellation]').forEach(c => drawConstellation(c, t));
    root.querySelectorAll('canvas[data-stage]').forEach(c => {
      const ctx = c.getContext('2d'), i = Number(c.dataset.stage);
      ctx.clearRect(0, 0, c.width, c.height);
      drawArt(ctx, rankArt(i), 0, 0, 1, t, c.dataset.locked === '1');
    });
  }

  // ---- in the page header: emblem, rank name, bar, and the earned set badges (click: Achievements tab)
  const rankBox = document.getElementById('rank');
  const rankCanvas = document.getElementById('rank-emblem');
  function renderHeaderRank() {
    const i = rankIndex(), n = ACHIEVEMENTS.filter(a => progress.ach[a.id]).length;
    document.getElementById('rank-name').textContent = rankName(i) + (progress.ach['star-gazer'] ? ' · STAR GAZER' : '');
    document.getElementById('rank-count').textContent = `${n}/${ACHIEVEMENTS.length}`;
    document.getElementById('rank-bar').style.width = `${Math.round(100 * n / ACHIEVEMENTS.length)}%`;
    const badges = earnedBadges();
    document.getElementById('rank-badges').innerHTML = badges.map(g =>
      `<canvas width="16" height="16" data-badge="${esc(g)}" title="${esc(BADGES[g].name)}: every ${esc(g.toLowerCase())} achievement"></canvas>`).join('');
    document.getElementById('rank-showcase').innerHTML = progress.showcase.filter(id => progress.ach[id]).map(id =>
      `<canvas width="16" height="16" data-trophy="${esc(id)}" title="${esc(ACH.get(id)?.title || '')}"></canvas>`).join('');
    paintRankArt(document.querySelector('.header-right'));
    const next = nextStage();
    rankBox.title = `Your star: ${rankName(i)}. ${STAGES[i].about}${next ? ` Next: ${next.stage.name} in ${plural(next.left, 'achievement')}.` : ''} Open your achievements.`;
    drawHeaderEmblem(performance.now());
  }
  let lastEmblem = 0;
  function drawHeaderEmblem(now) {   // called by the animation loop (~8 fps with the map)
    if (now - lastEmblem < 110 && now) return;
    lastEmblem = now;
    const ctx = rankCanvas.getContext('2d'), t = REDUCED_MOTION ? 1 : now / 1000;
    ctx.clearRect(0, 0, 16, 16);
    drawArt(ctx, rankArt(), 0, 0, 1, t);
    paintRankArt(document.querySelector('.header-right'), t);   // badges and showcase trophies move too
  }
  // The Achievements tab moves while it's open: emblems, badges and trophies (~8 frames a second).
  let achLast = 0, achLoop = false;   // one loop at a time, however often the tab re-renders
  function animateAchievements(now) {
    if (!galleryDialog.open || panes.ach.hidden || REDUCED_MOTION) { achLoop = false; return; }
    if (now - achLast > 120) { paintRankArt(panes.ach, now / 1000); achLast = now; }
    requestAnimationFrame(animateAchievements);
  }
  const startAchievementsAnimation = () => { if (!achLoop) { achLoop = true; requestAnimationFrame(animateAchievements); } };
  function pulseHeader() {
    rankBox.classList.remove('pulse');
    void rankBox.offsetWidth;
    rankBox.classList.add('pulse');
  }
  rankBox.addEventListener('click', () => { detailEgg = null; galleryDialog.showModal(); showTab('ach'); });

  // Called by achieve() with the rank and badges from before the new achievement.
  function afterAchievement(rankBefore, badgesBefore) {
    const rankAfter = rankIndex();
    if (rankAfter !== rankBefore) {
      toast('rank', 'YOUR STAR EVOLVED', `${rankName(rankBefore)} → ${rankName(rankAfter)}. ${STAGES[rankAfter].about}`, null, rankArt(rankAfter));
      pulseHeader();
    }
    for (const g of earnedBadges()) {
      if (!badgesBefore.includes(g)) { toast('badge', `BADGE: ${BADGES[g].name}`, `Every ${g.toLowerCase()} achievement. It's on your shelf at the top of the page.`, null, BADGES[g].art); pulseHeader(); }
    }
    renderHeaderRank();
  }

  // ---- TRUE STAR GAZER: open every star system on the map
  const seenStars = new Set((progress.seen || '').split(',').filter(Boolean));
  function syncSeen() { seenStars.clear(); for (const k of progress.seen.split(',')) if (k) seenStars.add(k); }
  const starKey = s => Number(s[COL.kepid]).toString(36);   // every star on the map has its own Kepler ID
  const gazeTotal = () => STARS.length;
  const gazeCount = () => STARS.reduce((n, s) => n + (seenStars.has(starKey(s)) ? 1 : 0), 0);
  const GAZE_REVEAL = 100, GAZE_UNSEEN = 3500;
  let gazeWave = 0;
  function starSeen(s) {
    const key = starKey(s);
    if (seenStars.has(key)) return;
    seenStars.add(key);
    progress.seen = [...seenStars].join(',');
    saveProgress();
    if (highlightSets.unseen?.delete(s)) {   // the UNSEEN highlight updates as you go: the star goes dark, the count drops
      const chip = document.querySelector('#highlights [data-key="unseen"]');
      if (chip) chip.textContent = `unseen (${fmt(highlightSets.unseen.size)})`;
      if (highlight === 'unseen') renderBase();
    }
    const n = gazeCount();
    checkLevels();
    if (n >= GAZE_REVEAL) ensureUnseenChip();
    if (n >= gazeTotal()) finale();
  }
  function finale() {
    if (progress.ach['star-gazer']) return;
    achieve('star-gazer');
    gazeWave = performance.now();
    fanfare('legend');
    toast('legend', 'TRUE STAR GAZER', 'Only those who dare look beyond the stars may call themselves true Star Gazers.', null, starGazerTrophy);
    wake();
  }
  function drawGazeWave(t) {   // the whole map flashes violet, from the centre out (from drawMap)
    if (!gazeWave) return;
    const r = (t - gazeWave) / 1000 * 110;
    if (r > MW) { gazeWave = 0; renderBase(); return; }
    mctx.fillStyle = '#b56cff';
    screen.forEach(([x, y]) => { const d = Math.hypot(x - MW / 2, y - MH / 2); if (d < r && d > r - 18) mctx.fillRect(x - 1, y - 1, 2, 2); });
  }
  function ensureUnseenChip() {   // the map's UNSEEN highlight, once the mission has shown itself
    const box = document.getElementById('highlights');
    if (!box || box.querySelector('[data-key="unseen"]') || gazeCount() < GAZE_REVEAL) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip unseen'; b.dataset.key = 'unseen';
    b.setAttribute('aria-pressed', 'false');
    b.textContent = 'unseen';
    b.title = 'Light up the star systems you haven\'t opened yet';
    b.addEventListener('click', () => {
      highlightSets.unseen = new Set(STARS.filter(s => !seenStars.has(starKey(s))));
      highlight = highlight === 'unseen' ? null : 'unseen';
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.key === highlight)));
      b.textContent = `unseen (${fmt(highlightSets.unseen.size)})`;
      renderBase();
    });
    box.appendChild(b);
  }
  function gazeCard() {   // the final mission's card in the Achievements tab, revealed in steps
    const n = gazeCount(), total = gazeTotal(), done = Boolean(progress.ach['star-gazer']);
    const shown = done || n >= GAZE_REVEAL;
    const riddle = n >= total / 2 || done ? 'Only those who look upon every star… and leave none unseen.' : 'Only those who look upon every star…';
    return `<div class="gaze-card${done ? ' on' : ''}">
      <canvas width="24" height="24" data-trophy="${done ? 'legend' : 'lock'}" aria-hidden="true"></canvas>
      <div><b>${done ? 'TRUE STAR GAZER' : shown ? 'THE FINAL MISSION' : '???'}</b>
        <span>${done ? 'Only those who dare look beyond the stars may call themselves true Star Gazers.' : esc(riddle)}</span>
        ${shown ? `<span class="ach-bar"><span data-w="${Math.round(100 * n / total)}"></span></span>
          <span class="ach-progress">${fmt(n)} / ${fmt(total)} star systems${n >= GAZE_UNSEEN && !done ? ' · try the UNSEEN highlight under the map' : ''}</span>` : ''}
        ${done ? `<span class="ach-date">earned ${esc(niceDate(progress.ach['star-gazer']))}</span>` : ''}</div></div>`;
  }
  const niceDate = iso => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return y ? `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}` : '';
  };

  // ---- 🏆 next planets: a podium of the top candidates (instead of an empty drawing)
  function drawPodium(seconds) {
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 50; k++) {
      sctx.fillStyle = k % 6 === 0 ? '#4a5590' : '#1e2550';
      sctx.fillRect(Math.floor(hash('pd' + k) * SW), Math.floor(hash('pe' + k) * SH), 1, 1);
    }
    const top = (DATA.leaderboard?.top || []).slice(0, 3);
    const t = REDUCED_MOTION ? 0 : seconds;
    pixelText(sctx, 'WHICH WILL BE NEXT?', Math.round(CX - textWidth('WHICH WILL BE NEXT?') / 2), 6, '#ffd34d');
    const places = [[CX, 44, '#ffc93c', '1'], [CX - 78, 30, '#c9d2de', '2'], [CX + 78, 20, '#cd7f45', '3']];
    top.forEach((row, i) => {
      const [x, h, colour, label] = places[i], base = SH - 6, topY = base - h;
      sctx.fillStyle = colour;
      sctx.fillRect(Math.round(x - 26), topY, 52, h);
      sctx.fillStyle = shade(colour, 0.6);
      sctx.fillRect(Math.round(x - 26), topY + h - 3, 52, 3);
      pixelText(sctx, label, Math.round(x - 1), topY + 4, '#070b1a');
      const r = Math.min(9, planetSize(row.radius) + 2), py = topY - r - 16 + Math.round(Math.sin(t * 1.5 + i) * 1.5);
      hollow(sctx, x, py, r, '#9fd8ff');   // still a candidate: hollow, like on the map
      if (Math.sin(t * 2 + i * 2) > 0.2) pixelText(sctx, '?', Math.round(x - 1), py - 2, '#ffd34d');
      const name = String(row.system).toUpperCase().slice(0, 12);
      pixelText(sctx, name, Math.round(x - textWidth(name) / 2), py - r - 9, '#c8d0ff');
      const sg = `${Math.round((row.sg ?? 0) * 100)}%`;
      pixelText(sctx, sg, Math.round(x - textWidth(sg) / 2), topY + 12, '#070b1a');
    });
  }

  queueMicrotask(() => { renderHeaderRank(); ensureUnseenChip(); });

  // ---------------------------------------------------------------- trophies: hologram, constellations, showcase
  // Click a trophy and a projector beams it up as a turning hologram, next to an ARTIFACT SCAN readout. Each
  // achievement group is a constellation whose stars light up as you earn them (complete it and the lines
  // draw in). Up to three trophies can be pinned to the page header (the showcase). Unlocking can play a short
  // 8-bit fanfare (off by default). GALACTIC CENSUS has levels; secrets get a riddle once you've earned ten.

  // One line of lore per trophy in the readout (the rest show how they were earned).
  const ARTIFACT_LOG = {
    census: 'Kepler watched about 150,000 stars at once; this map holds every one with a planet or a candidate.',
    cartographer: 'People mapped the stars long before telescopes: star catalogues are more than 2,000 years old.',
    'mission-control': "Nineteen of humanity's spacecraft beyond Earth orbit are on this map.",
    'red-fleet': 'Mars has more working spacecraft around it and on it than any planet except Earth.',
    'jupiter-crew': "Jupiter has 95+ known moons; Europa may hold more water than all of Earth's oceans.",
    'sun-chasers': 'Parker Solar Probe is the fastest object ever built: about 690,000 km/h.',
    curator: 'Every photo in the Galleria is a real NASA image, credited to its mission.',
    'grand-tour': 'The Golden Record carries greetings in 55 languages and music from Bach to Chuck Berry.',
    'double-sunset': 'Kepler-16 b, found in 2011, was the first planet seen transiting two stars.',
    seer: 'Oracles read the sky for omens; astronomers read light curves.',
    cassandra: 'In the myth, Cassandra saw the truth and nobody believed her.',
    contrarian: 'Many discoveries began with someone disagreeing with everyone else.',
    patient: 'Kepler stared at the same patch of sky for four years without looking away.',
    night: 'Most telescopes only work in the dark: astronomy is a night shift.',
    hollow: 'People have listened for signals from the stars since 1960. No reply yet.',
    'so-close': 'Galileo drew Neptune in 1612 and took it for a star: so close, 234 years before its discovery.',
    'cosmic-zoom': 'The observable universe is about 93 billion light-years across; Kepler looked a few thousand into it.',
    'lost-in-orbit': 'Astronauts on spacewalks stay tethered; in 1984 Bruce McCandless flew free, 100 metres from the Shuttle.',
    'dwarf-king': 'The IAU recognises five dwarf planets; dozens more Kuiper Belt worlds may one day join them.',
    houston: 'Apollo 13, 13 April 1970: "Houston, we\'ve had a problem." The crew made it home four days later.',
    'space-wardrobe': 'A real spacesuit, NASA\'s EMU, weighs about 145 kg on Earth and is made to measure.',
    runway: 'Spacesuits are white to reflect sunlight: in direct Sun, a dark suit would overheat.',
    'walk-in-closet': 'Astronauts on the space station can\'t wash clothes; worn clothing is packed away as rubbish.',
    'comet-catcher': 'A comet\'s tails always point away from the Sun, so leaving the Sun, a comet travels tail-first.',
    'rock-hound': 'Asteroid Ida has its own little moon, Dactyl: Galileo spotted it in 1993.',
    'tail-chaser': 'Comets have two tails: a curved, whitish one of dust and a straight, bluish one of charged gas.',
    'asteroid-catcher': 'In 2022 NASA\'s DART spacecraft hit the asteroid moonlet Dimorphos and changed its orbit: a first test of planetary defence.',
    'ufo-spotter': 'UFO means unidentified flying object. NASA set up a study team on such sightings in 2022; nothing alien so far.',
    'what-was-that': 'Most asteroids orbit between Mars and Jupiter, so far apart that spacecraft fly through the belt without trouble.',
    'space-farmer': 'NASA\'s Veggie garden on the ISS gave astronauts their first space-grown salad in August 2015.',
    speedrun: 'Voyager 1 travels about 17 km every second.',
    goodnight: "Kepler's last command was sent on 15 November 2018.",
    'launch-day': 'Kepler launched on a Delta II rocket from Cape Canaveral on 7 March 2009.',
    'star-gazer': 'Every star on the map, seen. Very few ever get here.',
  };
  // Riddles for the secret achievements, shown once ten achievements are earned.
  const SECRET_HINTS = {
    patient: 'Kepler never looked away. Can you hold your gaze on one system?',
    night: 'Some astronomers only work when the Sun is down… far down.',
    hollow: 'Keep calling into the void, even when nothing answers.',
    'so-close': 'A near miss counts too. Search a hidden name, and slip a letter.',
    'lost-in-orbit': 'Not every flare in the dark is a star. Watch the universe long enough.',
    houston: 'The one you found drifting might be glad of a visit.',
    'space-wardrobe': 'Visit the lost one often enough and the wardrobe opens.',
    'what-was-that': 'Keep an eye on the saucer: sometimes it has company.',
    speedrun: 'Some discoveries arrive in a rush, one after another.',
    goodnight: 'A telescope said goodbye on a November night. Visit on that day.',
    'launch-day': 'Return on the day it all began, in March.',
  };
  const secretHint = a => (regularCount() >= 10 && SECRET_HINTS[a.id] ? `Riddle: ${SECRET_HINTS[a.id]}` : '');

  // ---- GALACTIC CENSUS levels: 50, 500, 1,000 systems (stars on the trophy's base)
  const CENSUS_LEVELS = [50, 500, 1000];
  const censusLevel = () => Math.max(progress.ach.census ? 1 : 0, CENSUS_LEVELS.filter(n => gazeCount() >= n).length);
  function trophyMarks(a, put) {   // called by trophyFor (49-ranks.js) after the cup and symbol
    if (a.id !== 'census') return;
    for (let k = 0; k < censusLevel(); k++) put(6 + 2 * k, 13, '#fff1b0');
  }
  const levelText = a => (a.id === 'census' && progress.ach.census
    ? ` · LEVEL ${censusLevel()}/3 ${'★'.repeat(censusLevel())}${'☆'.repeat(3 - censusLevel())}` : '');
  function checkLevels() {
    const level = censusLevel();
    if (!progress.ach.census || level <= (progress.levels.census || 1)) return;
    progress.levels.census = level;
    saveProgress();
    toast(`ach tier-epic`, `GALACTIC CENSUS ${'★'.repeat(level)}`, `Level ${level}: ${fmt(CENSUS_LEVELS[level - 1])} star systems seen.`,
          null, trophyFor(ACH.get('census')));
    fanfare('epic');
  }

  // ---- constellations: one per group, a star per achievement
  function drawConstellation(canvas, t) {
    const g = canvas.dataset.constellation, list = ACHIEVEMENTS.filter(a => a.g === g);
    const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d'), gi = [...new Set(ACHIEVEMENTS.map(a => a.g))].indexOf(g);
    ctx.clearRect(0, 0, W, H);
    // stars on a loose, open loop (each group its own shape), joined in order like a constellation figure
    const cx = W / 2, cy = H / 2, rx = Math.min(W * 0.36, 14 + list.length * 7), ry = H * 0.34, a0 = noise(gi, 9) * Math.PI * 2;
    const pts = list.map((a, k) => {
      const ang = a0 + (k / Math.max(1, list.length)) * Math.PI * 1.7, wob = 0.7 + noise(gi, k) * 0.5;
      return [Math.round(cx + rx * wob * Math.cos(ang) + (noise(k, gi) - 0.5) * 6),
              Math.round(cy + ry * wob * Math.sin(ang) + (noise(gi + 5, k) - 0.5) * 4), Boolean(progress.ach[a.id])];
    });
    const done = pts.every(p => p[2]);
    for (let k = 1; k < pts.length; k++) {   // the lines: bright between two earned stars, faint otherwise
      const [x0, y0, on0] = pts[k - 1], [x1, y1, on1] = pts[k], lit = on0 && on1, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      ctx.fillStyle = done ? '#fff1b0' : lit ? '#ffd34d' : '#1e2550';
      for (let j = 0; j <= n; j += lit || done ? 1 : 3) ctx.fillRect(Math.round(x0 + (x1 - x0) * j / n), Math.round(y0 + (y1 - y0) * j / n), 1, 1);
    }
    pts.forEach(([x, y, on], k) => {
      if (!on) { ctx.fillStyle = '#3a4888'; ctx.fillRect(x, y, 1, 1); return; }
      const twinkle = Math.sin(t * 2 + k * 1.7) > 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = twinkle ? '#fff1b0' : '#ffd34d';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
      if (twinkle && done) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { ctx.fillStyle = '#8a6d1f'; ctx.fillRect(x + dx, y + dy, 1, 1); }
    });
  }

  // ---- the hologram projector
  const holo = document.getElementById('holo'), holoCanvas = document.getElementById('holo-canvas');
  let holoId = null, holoLast = 0;
  function openHologram(id) {
    const a = ACH.get(id);
    if (!a) return;
    holoId = id;
    const on = progress.ach[id], hidden = a.secret && !on;
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    document.getElementById('holo-data').innerHTML = `
      <b class="holo-title">▣ ARTIFACT SCAN</b>
      <dl>${row('DESIGNATION', hidden ? '█████████' : esc(a.title))}
        ${row('CLASS', esc(TIERS[a.tier].name))}
        ${row('STATUS', on ? `ACQUIRED · ${esc(niceDate(on))}` : 'SIGNAL ENCRYPTED')}
        ${row('ORIGIN', hidden ? esc(secretHint(a) || 'Unknown. Keep exploring.') : esc(a.how) + esc(levelText(a)))}
        ${on && ARTIFACT_LOG[id] ? row('LOG', esc(ARTIFACT_LOG[id])) : ''}</dl>
      ${on && id !== 'star-gazer' ? `<button type="button" class="ghost" id="holo-pin">${progress.showcase.includes(id) ? '★ ON MY HEADER' : '☆ SHOW ON MY HEADER'}</button>` : ''}
      <button type="button" class="ghost" id="holo-close">CLOSE</button>`;
    holo.hidden = false;
    document.getElementById('holo-close').addEventListener('click', closeHologram);
    document.getElementById('holo-close').focus();
    document.getElementById('holo-pin')?.addEventListener('click', e => {
      const list = progress.showcase.filter(x => x !== id);
      progress.showcase = progress.showcase.includes(id) ? list : [...list, id].slice(-3);   // up to three, newest stays
      saveProgress();
      e.target.textContent = progress.showcase.includes(id) ? '★ ON MY HEADER' : '☆ SHOW ON MY HEADER';
      renderHeaderRank();
    });
    requestAnimationFrame(drawHologram);
  }
  function closeHologram() { holo.hidden = true; holoId = null; }
  function drawHologram(now) {
    if (!holoId || holo.hidden || !galleryDialog.open) return;
    requestAnimationFrame(drawHologram);
    if (now - holoLast < 50) return;   // ~20 fps
    holoLast = now;
    const t = REDUCED_MOTION ? 1 : now / 1000, a = ACH.get(holoId), on = progress.ach[holoId];
    const ctx = holoCanvas.getContext('2d'), W = holoCanvas.width, H = holoCanvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#03060f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0b1a2a';
    for (let x = 0; x < W; x += 8) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
    const cx = W / 2, baseY = H - 12;
    ctx.fillStyle = 'rgba(80, 200, 255, 0.08)';   // the beam
    for (let y = 14; y < baseY; y++) {
      const half = 10 + (baseY - y) * 0.42;
      ctx.fillRect(Math.round(cx - half * (y - 14) / (baseY - 14) - 8), y, Math.round(2 * half * (y - 14) / (baseY - 14) + 16), 1);
    }
    const size = a.id === 'star-gazer' ? 24 : 16, off = document.createElement('canvas');
    off.width = off.height = size;
    const octx = off.getContext('2d');
    drawArt(octx, on ? trophyFor(a) : spaceLock, 0, 0, 1, t);
    octx.globalCompositeOperation = 'source-atop';   // the hologram's cyan light
    octx.fillStyle = on ? 'rgba(120, 220, 255, 0.35)' : 'rgba(120, 220, 255, 0.6)';
    octx.fillRect(0, 0, size, size);
    const scale = size === 24 ? 3 : 4, turn = REDUCED_MOTION ? 1 : Math.max(0.12, Math.abs(Math.cos(t * 1.2)));
    const w = size * scale * turn, h = size * scale, top = baseY - h - 6 + Math.round(Math.sin(t * 1.6) * 2);
    ctx.globalAlpha = 0.75 + 0.2 * Math.sin(t * 9) * (noise(Math.floor(t * 6)) > 0.8 ? 1 : 0.2);
    ctx.drawImage(off, Math.round(cx - w / 2), top, Math.max(1, Math.round(w)), h);
    if (!REDUCED_MOTION && noise(Math.floor(t * 7)) > 0.9) {   // a glitch: a slice slips sideways
      const gy = top + Math.floor(noise(Math.floor(t * 13)) * h);
      ctx.drawImage(holoCanvas, 0, gy, W, 3, 4, gy, W, 3);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';   // scanlines and a sweeping bright line
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = 'rgba(160, 240, 255, 0.22)';
    ctx.fillRect(0, Math.floor((t * 24) % H), W, 1);
    ctx.fillStyle = '#2b3566';   // the projector
    for (let x = -18; x <= 18; x++) ctx.fillRect(Math.round(cx + x), baseY + Math.round(Math.abs(x) / 9), 1, 4 - Math.round(Math.abs(x) / 9));
    ctx.fillStyle = Math.sin(t * 4) > 0 ? '#9fd8ff' : '#4a7fd6';
    for (let x = -12; x <= 12; x += 3) ctx.fillRect(Math.round(cx + x), baseY, 1, 1);
  }

  // ---- unlock fanfare (Web Audio, generated; on unless switched off in Settings)
  // Browsers keep audio asleep until the visitor clicks or types, and an achievement can arrive without one (a timer,
  // a passing comet). So the audio is woken on the first click or key, and a fanfare that arrives while it sleeps
  // waits for it instead of being lost or played late in a jumble.
  let audio = null;
  function audioContext() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
    return audio;
  }
  function wakeAudio() {
    const ctx = progress.sound && audioContext();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  for (const evt of ['pointerdown', 'keydown', 'touchend']) addEventListener(evt, wakeAudio, { capture: true, passive: true });
  function fanfare(tier) {
    if (!progress.sound) return;
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state !== 'running') { ctx.resume().then(() => playFanfare(tier), () => {}); return; }
    playFanfare(tier);
  }
  function playFanfare(tier) {
    const audio = audioContext();
    try {
      const notes = { common: [523, 659], rare: [523, 659, 784], epic: [523, 659, 784, 1047], secret: [392, 523, 698, 932, 1175],
                      legend: [262, 392, 523, 784, 1047, 1568] }[tier] || [523, 659];
      notes.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime + i * 0.09;
        o.type = 'square';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.06, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        o.connect(g).connect(audio.destination);
        o.start(at);
        o.stop(at + 0.18);
      });
    } catch { /* no audio in this browser */ }
  }

  // ---------------------------------------------------------------- interface: pixel icons, first-visit tour
  // Pixel icons replace the last emoji buttons (dice, gear, trophy). A three-step tour greets first-time
  // visitors (search, the map, the Galleria); it never runs under automated testing (navigator.webdriver)
  // unless the address asks for it (index.html?tour).
  const ICONS = {
    dice: put => {
      for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) {
        const edge = x === 1 || y === 1 || x === 10 || y === 10, corner = (x === 1 || x === 10) && (y === 1 || y === 10);
        if (!corner) put(x, y, edge ? '#9aa6b8' : '#eef2f8');
      }
      for (const [x, y] of [[3, 3], [7, 3], [5, 5], [3, 7], [7, 7]]) { put(x, y, '#151a2c'); put(x + 1, y, '#151a2c'); put(x, y + 1, '#151a2c'); put(x + 1, y + 1, '#151a2c'); }
    },
    gear: put => {
      discArt(put, 6, 6, 4.6, (dx, dy, f) => (f < 0.42 ? null : '#e6ecff'));
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        put(Math.round(5.5 + 5.2 * Math.cos(a)), Math.round(5.5 + 5.2 * Math.sin(a)), '#e6ecff');
      }
    },
    trophy: (put, t) => trophyArt('epic')((x, y, c) => put(x - 2, y - 2, c), t),
    sky: put => skyIcon(put, false),          // the background toggle (55-backdrop.js): a moon and a star
    skyPaused: put => skyIcon(put, true),     // ... dimmed, with pause bars
    antenna: put => {   // the thank-you button (49e-thanks.js): a Deep Space Network dish, as NASA uses to hear its spacecraft
      for (let y = 12; y < 15; y++) { put(5, y, '#9aa6b8'); put(6, y, '#6f7d96'); }   // the pedestal
      for (let x = 2; x < 10; x++) put(x, 15, '#6f7d96');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {   // the dish face: an ellipse tilted to the upper right
        const dx = x + 0.5 - 6, dy = y + 0.5 - 8.5, u = (dx + dy) / Math.SQRT2, v = (dx - dy) / Math.SQRT2;
        const e = (u / 6.2) ** 2 + (v / 3.4) ** 2;
        if (e <= 1) put(x, y, e > 0.62 ? '#6f7d96' : v < -0.6 ? '#9aa6b8' : '#e6ecff');
      }
      put(7, 7, '#c9d2de'); put(8, 6, '#9aa6b8'); put(9, 5, '#9aa6b8'); put(10, 4, '#ffd34d');   // the feed on its strut
    },
    signal: put => {    // its blinking signal: two arcs from the feed
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 10.5, y - 4.5), a = Math.atan2(y - 4.5, x - 10.5) * 180 / Math.PI;
        if (a > -85 && a < -5 && (Math.abs(d - 2.5) < 0.5 || Math.abs(d - 4.4) < 0.5)) put(x, y, '#9fd8ff');
      }
    },
  };
  function skyIcon(put, paused) {
    for (let y = 1; y < 11; y++) for (let x = 0; x < 9; x++) {   // a crescent: a disc minus a smaller one
      if (Math.hypot(x - 4, y - 6) <= 4.3 && Math.hypot(x - 6.2, y - 4.6) > 3.4) put(x, y, paused ? '#8a7f55' : '#ffd34d');
    }
    const star = paused ? '#6f7d96' : '#e6ecff';
    put(9, 2, star); put(8, 2, star); put(10, 2, star); put(9, 1, star); put(9, 3, star);
    if (paused) for (let y = 6; y < 12; y++) { put(7, y, '#e6ecff'); put(8, y, '#e6ecff'); put(10, y, '#e6ecff'); put(11, y, '#e6ecff'); }
  }
  function paintIcons(root = document) {
    root.querySelectorAll('canvas[data-icon]').forEach(c => {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ICONS[c.dataset.icon]((x, y, col) => { if (col && x >= 0 && y >= 0) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } }, 1);
    });
  }
  const iconCanvas = (name, size = 12) => `<canvas class="icon" width="${size}" height="${size}" data-icon="${name}" aria-hidden="true"></canvas>`;

  // ---- first-visit tour
  const TOUR = [
    ['#query', 'SEARCH THE SKY', 'Type a star system (try Kepler-90) and press SCAN, or roll the dice for a surprise.'],
    ['#map', 'EVERY PIXEL IS A STAR', 'Click one, or use the arrow keys: each has planets or planet candidates found by Kepler.'],
    ['#open-gallery', 'YOUR GALLERIA', 'Easter eggs, achievements, predictions and settings live here. Happy hunting!'],
  ];
  let tourBox = null;
  function showTourStep(i) {
    document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
    if (i >= TOUR.length) { endTour(); return; }
    const [sel, head, text] = TOUR[i], target = document.querySelector(sel);
    if (!target) { endTour(); return; }
    target.classList.add('tour-target');
    target.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    tourBox = tourBox || Object.assign(document.createElement('div'), { className: 'tour', role: 'dialog' });
    tourBox.setAttribute('aria-label', 'Quick tour');
    tourBox.innerHTML = `<b>${esc(head)}</b><span>${esc(text)}</span>
      <span class="tour-buttons"><span class="tour-step">${i + 1} / ${TOUR.length}</span>
        <button type="button" class="ghost" data-tour="skip">SKIP</button>
        <button type="button" data-tour="next">${i === TOUR.length - 1 ? 'DONE' : 'NEXT'}</button></span>`;
    document.body.appendChild(tourBox);
    const r = target.getBoundingClientRect(), w = Math.min(300, innerWidth - 16);
    tourBox.style.width = `${w}px`;
    tourBox.style.left = `${Math.round(Math.min(Math.max(8, r.left + scrollX), scrollX + innerWidth - w - 8))}px`;
    tourBox.style.top = `${Math.round(r.bottom + scrollY + 10)}px`;
    tourBox.querySelector('[data-tour="next"]').addEventListener('click', () => showTourStep(i + 1));
    tourBox.querySelector('[data-tour="skip"]').addEventListener('click', endTour);
    if (document.activeElement === document.body) tourBox.querySelector('[data-tour="next"]').focus({ preventScroll: true });   // never steal the search box
  }
  function endTour() {
    document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
    tourBox?.remove();
    tourBox = null;
    progress.toured = true;
    saveProgress();
  }

  // ---- planets: hover labels on the system drawing (name and size)
  function planetAt(evt) {
    if (!scene || !scene.hits) return null;
    const r = sys.getBoundingClientRect(), x = (evt.clientX - r.left) * SW / r.width, y = (evt.clientY - r.top) * SH / r.height;
    let best = null, bestD = Infinity;
    for (const h of scene.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= h.r + 4 && d < bestD) { best = h; bestD = d; }
    }
    return best;
  }
  function drawHoverLabel() {   // from drawSystem, after the planets
    const h = scene && scene.hover && scene.hits && scene.hits.find(p => p.name === scene.hover);
    if (!h) return;
    const text = `${String(h.name).toUpperCase()}${h.radius != null ? ` ${fmt(h.radius, 1)}X EARTH` : ''}`;
    const w = textWidth(text) + 4, x = Math.round(Math.min(Math.max(1, h.x - w / 2), SW - w - 1)), y = Math.round(Math.max(1, h.y - h.r - 10));
    sctx.fillStyle = 'rgba(7, 11, 26, 0.85)';
    sctx.fillRect(x, y, w, 8);
    pixelText(sctx, text, x + 2, y + 2, '#ffd34d');
  }

  queueMicrotask(() => {
    paintIcons();
    const forced = /[?&]tour\b/.test(location.search);
    let busy = false;   // a visitor who starts typing or clicking right away doesn't get interrupted by the tour
    const mark = () => { busy = true; };
    addEventListener('keydown', mark, { once: true, capture: true });
    addEventListener('pointerdown', mark, { once: true, capture: true });
    if ((!progress.toured && !navigator.webdriver) || forced) setTimeout(() => { if (forced || !busy) showTourStep(0); }, forced ? 0 : 900);
  });

  // ---------------------------------------------------------------- connecting the pieces
  // A daily mystery star (a riddle built from a real system's data, the same for everyone on a given day),
  // "what's new" after each monthly data refresh, and a share card: your emblem, badges and stats as one
  // pixel picture to download. (Calls on the next-planets list: callCell, 48b-predictions.js.)
  const pad2 = n => String(n).padStart(2, '0');
  const localDay = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const DAILY_POOL = STARS.filter(s => s[COL.drawn] && s[COL.np] >= 2 && s[COL.kois] > 0);
  const dailyStar = (day = localDay()) => DAILY_POOL[Math.floor(hash('daily' + day) * DAILY_POOL.length)];

  function dailyClues(s) {
    const i = starIndex.get(s), [x, y] = home[i], tags = s[COL.tags];
    const clues = [`${s[COL.np]} worlds orbit this star.`];
    if (s[COL.dist] != null) clues.push(`Its light takes about ${fmt(Math.round(s[COL.dist] * LY_PER_PC / 100) * 100)} years to reach us.`);
    if (tags & TAGS.hz) clues.push('One of its worlds may sit in the habitable zone.');
    else if (tags & TAGS.earth) clues.push('One of its worlds is about the size of Earth.');
    else if (tags & TAGS.giant) clues.push('A giant planet lives here.');
    if (TAGS.twosuns && tags & TAGS.twosuns) clues.push('It has two suns.');
    if (tags & TAGS.tess) clues.push('TESS saw it again, years after Kepler.');
    const v = y < MH / 3 ? 'top' : y > 2 * MH / 3 ? 'bottom' : 'middle', h = x < MW / 3 ? 'left' : x > 2 * MW / 3 ? 'right' : 'centre';
    clues.push(`Look in the ${v === 'middle' && h === 'centre' ? 'middle' : `${v} ${h}`} of the map.`);
    return clues;
  }
  function dailyCard() {
    const s = dailyStar(), solved = progress.daily.last === localDay();
    if (!s) return '';
    return `<div class="daily-card${solved ? ' on' : ''}">
      <b>★ MYSTERY STAR OF THE DAY${progress.daily.streak > 1 ? ` · STREAK ${progress.daily.streak}` : ''}</b>
      ${solved ? `<span>Solved: it was <b>${esc(s[COL.name])}</b>. A new one appears tomorrow.</span>`
        : `<ul>${dailyClues(s).map(c => `<li>${esc(c)}</li>`).join('')}</ul><span>Find it and open it on the map.</span>`}</div>`;
  }
  function dailyCheck(s) {   // from systemOpened
    const today = localDay();
    if (s !== dailyStar(today) || progress.daily.last === today) return;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    progress.daily.streak = progress.daily.last === localDay(d) ? progress.daily.streak + 1 : 1;
    progress.daily.last = today;
    saveProgress();
    toast('rank', 'MYSTERY SOLVED', `${s[COL.name]} was the star of the day.${progress.daily.streak > 1 ? ` Streak: ${progress.daily.streak} days.` : ''}`,
          null, BADGES['DAILY SKY'].art);
    achieve('daily');
    if (progress.daily.streak >= 7) achieve('streak');
  }

  // ---- what's new since your last visit (after a monthly data refresh)
  function whatsNew() {
    const before = progress.lastExport;
    if (before && before !== DATA.exported) {
      const rulings = Object.values(RULINGS.resolved).filter(r => r[1] > before);
      const mine = Object.keys(progress.calls).filter(k => RULINGS.resolved[k] && RULINGS.resolved[k][1] > before).length;
      const added = STARS.length - (progress.lastStars || STARS.length);
      const bits = rulings.length ? [`${plural(rulings.length, 'NASA ruling')} on candidates`] : [];
      if (added > 0) bits.push(`${plural(added, 'new system')} on the map`);
      if (mine) bits.push(`${mine} of your calls settled`);
      toast('badge', "WHAT'S NEW", `Fresh data from NASA (${niceDate(DATA.exported)})${bits.length ? `: ${bits.join(' · ')}` : ''}.`, null, ICONS.trophy);
    }
    if (progress.lastExport !== DATA.exported || progress.lastStars !== STARS.length) {
      progress.lastExport = DATA.exported;
      progress.lastStars = STARS.length;
      saveProgress();
    }
  }

  // ---- share card: a 240 x 135 pixel picture, saved at 4x
  function shareCard() {
    const W = 240, H = 135, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d'), i = rankIndex();
    ctx.fillStyle = '#070b1a';
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) { ctx.fillStyle = k % 7 ? '#1e2550' : '#4a5590'; ctx.fillRect(Math.floor(hash('sc' + k) * W), Math.floor(hash('sd' + k) * H), 1, 1); }
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(0, 0, W, 1); ctx.fillRect(0, H - 1, W, 1); ctx.fillRect(0, 0, 1, H); ctx.fillRect(W - 1, 0, 1, H);
    pixelText(ctx, 'KEPLER STAR MAP', 8, 7, '#ffd34d');
    drawArt(ctx, rankArt(i), 8, 18, 3, 1);   // the emblem, 48 x 48
    const n = ACHIEVEMENTS.filter(a => progress.ach[a.id]).length, s = predictionStats();
    const lines = [[`MY STAR: ${rankName(i)}`, '#ffd34d'], [`${n} / ${ACHIEVEMENTS.length} ACHIEVEMENTS`, '#c8d0ff'],
                   [`${EGGS.filter(e => progress.eggs[e.id]).length} / ${EGGS.length} EASTER EGGS`, '#c8d0ff'],
                   [`${fmt(gazeCount())} / ${fmt(STARS.length)} STAR SYSTEMS SEEN`, '#c8d0ff'],
                   [`${s.right} RIGHT CALLS OF ${s.right + s.wrong} SETTLED`, '#c8d0ff']];
    lines.forEach(([text, col], k) => pixelText(ctx, text, 64, 22 + k * 9, col));
    const badges = earnedBadges();
    badges.forEach((g, k) => drawArt(ctx, BADGES[g].art, 8 + k * 18, 74, 1, 1));
    progress.showcase.filter(id => progress.ach[id]).forEach((id, k) => drawArt(ctx, trophyFor(ACH.get(id)), 8 + k * 18, 96, 1, 1));
    pixelText(ctx, localDay(), W - 8 - textWidth(localDay()), H - 10, '#5a6a8a');
    pixelText(ctx, 'MED27-CODER.GITHUB.IO', 8, H - 10, '#5a6a8a');
    const big = document.createElement('canvas');
    big.width = W * 4; big.height = H * 4;
    const b = big.getContext('2d');
    b.imageSmoothingEnabled = false;
    b.drawImage(c, 0, 0, W * 4, H * 4);
    const a = document.createElement('a');
    a.href = big.toDataURL('image/png');
    a.download = `kepler-star-map-card-${localDay()}.png`;
    a.click();
  }

  queueMicrotask(whatsNew);

  // ---------------------------------------------------------------- the antenna: a thank-you note, and what's new
  // The little dish on the left edge of the page (its pixel art: ICONS.antenna in 49c-ui.js) opens a note from the
  // site's maker. When the site has a version this browser hasn't seen (VERSION, 00-version.js), the dish lights up
  // and the note starts with WHAT'S NEW IN VX: the release notes. Opening it marks the version as seen.
  // Clicking outside the note closes it too.
  const SEEN_VERSION_KEY = 'starmap.seenVersion';
  const thanksDialog = document.getElementById('thanks');
  const thanksButton = document.getElementById('thanks-open');
  document.getElementById('site-version').textContent = `v${VERSION}`;
  function seenVersion() {
    try { return localStorage.getItem(SEEN_VERSION_KEY); } catch { return null; }
  }
  const versionIsNew = seenVersion() !== VERSION;
  if (versionIsNew) {
    thanksButton.classList.add('news');
    thanksButton.title = `New in v${VERSION}: open the transmission`;
    document.getElementById('thanks-news-title').textContent = `WHAT'S NEW IN V${VERSION}`;
    const list = document.getElementById('thanks-news-list');
    for (const note of RELEASE_NOTES) {
      const li = document.createElement('li');
      li.textContent = note;
      list.append(li);
    }
  }
  thanksButton.addEventListener('click', () => {
    document.getElementById('thanks-news').hidden = !versionIsNew;
    thanksDialog.showModal();
    thanksButton.classList.remove('news');
    thanksButton.title = 'Incoming transmission: a note from the maker';
    try { localStorage.setItem(SEEN_VERSION_KEY, VERSION); } catch { /* private window: the dish lights up again next visit */ }
  });
  document.getElementById('thanks-close').addEventListener('click', () => thanksDialog.close());
  thanksDialog.addEventListener('click', e => { if (e.target === thanksDialog) thanksDialog.close(); });

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
    if (q.length < 2) {   // empty box: the systems you viewed last
      const recent = q ? [] : [...progress.systems].reverse().map(n => byName.get(n.toLowerCase())).filter(Boolean).slice(0, 5);
      if (!recent.length) { closeSuggestions(); return; }
      renderSuggestions(recent, 'recently viewed');
      return;
    }
    const starts = [], contains = [];
    for (const item of searchIndex) {
      if (item.keys.some(k => k.startsWith(q))) starts.push(item);
      else if (item.keys.some(k => k.includes(q))) contains.push(item);
    }
    const byRank = (a, b) => a.rank - b.rank ||
      a.s[COL.name].localeCompare(b.s[COL.name], 'en', { numeric: true });
    const eggs = EGGS.filter(e => progress.eggs[e.id] && (e.name.toLowerCase().includes(q) || e.query.toLowerCase().includes(q)))
      .slice(0, 3).map(egg => ({ egg }));   // easter eggs you've found are easy to revisit
    renderSuggestions([...eggs, ...[...starts.sort(byRank), ...contains.sort(byRank)].map(item => item.s)].slice(0, 8));
  }

  function renderSuggestions(list, note) {
    options = list;
    if (!options.length) { closeSuggestions(); return; }
    active = -1;
    suggest.innerHTML = options.map((s, i) => (s.egg ? `
      <li role="option" id="opt-${i}" data-i="${i}">${esc(s.egg.name)}<span>★ easter egg you found</span></li>` : `
      <li role="option" id="opt-${i}" data-i="${i}">${esc(s[COL.name])}
        <span>${note ? esc(note) : `${s[COL.koi] != null && !s[COL.name].startsWith('KOI') ? `KOI-${fmt(s[COL.koi])} · `.replace(/,/g, '') : ''}${
          s[COL.drawn] ? plural(s[COL.np], 'planet') : plural(s[COL.np], 'candidate')}`}</span></li>`)).join('');
    suggest.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function setActive(i) {
    active = (i + options.length) % options.length;
    if (!options[active].egg) prefetch(options[active]);
    suggest.querySelectorAll('li').forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', `opt-${active}`);
  }

  function choose(s) {
    if (s.egg) { input.value = s.egg.query; closeSuggestions(); lookup(s.egg.query); return; }
    input.value = s[COL.name];
    closeSuggestions();
    select(s);
  }

  input.addEventListener('input', showSuggestions);
  input.addEventListener('focus', showSuggestions);
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
    achieve('dice');
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
      if (highlight === 'hz') achieve('goldilocks');
      if (highlight) highlightTried(highlight);
      highlightBox.querySelectorAll('button').forEach(x =>
        x.setAttribute('aria-pressed', String(x.dataset.key === highlight)));
      renderBase();
    });
    highlightBox.appendChild(b);
  }
  const board = document.createElement('button');
  board.type = 'button'; board.className = 'chip';
  board.innerHTML = `${iconCanvas('trophy')} next planets`;   // pixel trophy (49c-ui.js)
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
    if (query) achieve('link');
    if (name) { input.value = name; lookup(name, false); }
  }
  window.addEventListener('hashchange', fromHash);
  renderBase();
  fromHash();

  // ---------------------------------------------------------------- page background: a pixel night sky
  // A fixed canvas behind the whole page (docs/plans/BACKGROUND.md; concept pixel-art/concepts/draft_background.gif):
  // a dithered navy-to-teal sky, twinkling stars, a bright blue star, the odd shooting star, three layers of
  // drifting clouds and a tree line. Drawn small (about 320 pixels wide) and scaled up, so it stays crisp and
  // cheap; the parts that never change are drawn once per window size. It moves with the main animation loop
  // (60-loop.js), so it follows the Animation menu, stops when the page is idle, and is still with reduced motion.
  // Settings: animated, still, or plain (the old flat colour); the moon button in the header pauses and resumes it.
  const backdrop = document.getElementById('backdrop');
  const bctx = backdrop.getContext('2d');
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const SKY_BANDS = ['#070b1a', '#0a1230', '#0d1d40', '#10294f', '#12385e', '#14506e', '#17707f', '#1fa0a8'];
  const STAR_INK = ['#ffffff', '#fff1b0', '#9fd8ff', '#ffd34d', '#ff9a3c', '#7ff0e0'];
  const CLOUD_LAYERS = [   // far to near: base height (fraction of the sky), body, lit rim, how many, drift speed (px/s)
    { y: 0.62, col: '#0e2340', rim: '#24507a', n: 4, speed: 0.6 },
    { y: 0.74, col: '#123a58', rim: '#2f8098', n: 5, speed: 1.1 },
    { y: 0.84, col: '#16566a', rim: '#46b8c0', n: 6, speed: 1.8 },
  ];
  const bnoise = (x, seed) => { const v = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v); };
  let BW = 320, BH = 180, skyLayer = null, treeLayer = null, cloudLayers = [], stars = [], lastBackdrop = 0;
  const backdropMode = () => (['animated', 'still', 'plain'].includes(progress.backdrop) ? progress.backdrop : 'animated');

  function layer(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw((x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }, ctx);
    return c;
  }

  function buildBackdrop() {   // everything that only changes with the window's shape
    BW = Math.round(Math.min(480, Math.max(200, innerWidth / 3)));   // about 3 screen pixels per sky pixel
    BH = Math.max(120, Math.min(420, Math.round(BW * innerHeight / Math.max(1, innerWidth))));
    backdrop.width = BW; backdrop.height = BH;
    const horizon = BH - Math.round(BH * 0.19);
    skyLayer = layer(BW, BH, put => {
      for (let y = 0; y < BH; y++) {
        const pos = Math.min(1, y / horizon) * (SKY_BANDS.length - 1), lo = Math.floor(pos), frac = pos - lo;
        for (let x = 0; x < BW; x++) put(x, y, SKY_BANDS[Math.min(SKY_BANDS.length - 1, lo + (frac * 16 > BAYER[y & 3][x & 3] ? 1 : 0))]);
      }
    });
    const count = Math.round((innerWidth < 600 ? 120 : 260) * BH / 180);
    stars = Array.from({ length: count }, (_, k) => ({
      x: Math.floor(bnoise(k, 1) * BW), y: Math.floor(bnoise(k, 2) ** 1.6 * horizon * 0.95),
      c: STAR_INK[k % STAR_INK.length], cross: k % 17 === 0, rate: 1 + (k % 3), phase: k,
    }));
    cloudLayers = CLOUD_LAYERS.slice(innerWidth < 600 ? 1 : 0).map((L, band) => {
      const base = Math.round(horizon * L.y + BH * 0.08), w = BW + 80;
      return { speed: L.speed, w, c: layer(w, BH, put => {
        for (let n = 0; n < L.n; n++) {
          const cx = bnoise(n, band + 3) * w, size = 7 + band * 2 + bnoise(n, band + 8) * 5;
          for (let j = 0; j < 5; j++) {   // a cloud: five round lumps on a flat base
            const lx = cx + (j - 2) * size * 0.8, ly = base - bnoise(n * 7 + j, band) * size * 0.6, r = size * (0.6 + bnoise(j, n + band) * 0.5);
            for (let y = Math.floor(ly - r); y < base + 4; y++) for (let x = Math.floor(lx - r); x <= lx + r; x++) {
              const d = Math.hypot(x - lx, y - ly);
              if (d > r && !(y >= ly && Math.abs(x - lx) <= r)) continue;
              const rim = d > r - 1.2 && y < ly && x - lx < r * 0.4;
              put(((x % w) + w) % w, y, rim ? L.rim : L.col);
            }
          }
        }
      }) };
    });
    treeLayer = layer(BW, BH, put => {
      for (let x = 0; x < BW; x++) {
        const back = horizon + 6 - 9 * bnoise(x >> 2, 7) - 4 * Math.sin(x / 17), front = horizon + 14 - 7 * bnoise(x >> 1, 9) - 5 * Math.sin(x / 11 + 2);
        for (let y = Math.floor(back); y < BH; y++) put(x, y, y < front ? '#0f2a3f' : '#081626');
      }
    });
    backdrop.hidden = backdropMode() === 'plain';
    drawBackdrop(performance.now(), true);
  }

  function drawBackdrop(now, force = false) {   // from the animation loop (~8 fps)
    if (backdrop.hidden || !skyLayer) return;
    const still = REDUCED_MOTION || backdropMode() === 'still';
    if (!force && (still || now - lastBackdrop < 110)) return;
    lastBackdrop = now;
    const t = still ? 0 : now / 1000;
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(skyLayer, 0, 0);
    for (const s of stars) {   // twinkling: each star dims now and then, at its own pace
      if (Math.sin(t * Math.PI * 2 * s.rate * 0.15 + s.phase) < -0.6) continue;
      bctx.fillStyle = s.c;
      bctx.fillRect(s.x, s.y, 1, 1);
      if (s.cross) { bctx.fillRect(s.x - 1, s.y, 3, 1); bctx.fillRect(s.x, s.y - 1, 1, 3); }
    }
    const bx = Math.round(BW * 0.2), by = Math.round(BH * 0.24), pulse = 1 + Math.round((Math.sin(t * 1.3) + 1) / 2);
    bctx.fillStyle = '#4a8fd6';   // the bright blue star (Deneb: the Kepler field is in Cygnus)
    bctx.fillRect(bx - 2, by - 1, 5, 3); bctx.fillRect(bx - 1, by - 2, 3, 5);
    bctx.fillStyle = '#e8f4ff';
    bctx.fillRect(bx - 1, by, 3, 1); bctx.fillRect(bx, by - 1, 1, 3);
    bctx.fillStyle = '#9fd8ff';
    for (const k of [3 + pulse, -3 - pulse]) { bctx.fillRect(bx + k, by, 1, 1); bctx.fillRect(bx, by + k, 1, 1); }
    const shoot = (t % 9) / 0.9;   // a shooting star for under a second, every nine seconds
    if (!still && shoot < 1) {
      const sx = BW * (0.45 + 0.35 * shoot), sy = BH * (0.08 + 0.2 * shoot);
      for (let k = 0; k < 14; k++) {
        bctx.fillStyle = k < 3 ? '#ffffff' : k < 8 ? '#9fd8ff' : '#2b5a8a';
        bctx.fillRect(Math.round(sx - k), Math.round(sy - k * 0.42), 1, 1);
      }
    }
    for (const L of cloudLayers) {   // clouds drift right, nearer layers faster
      const off = Math.round((t * L.speed) % L.w);
      bctx.drawImage(L.c, off - L.w, 0);
      bctx.drawImage(L.c, off, 0);
    }
    bctx.drawImage(treeLayer, 0, 0);
  }

  let backdropTimer = 0;
  addEventListener('resize', () => { clearTimeout(backdropTimer); backdropTimer = setTimeout(buildBackdrop, 200); });
  const backdropSetting = document.getElementById('set-backdrop');
  backdropSetting.value = backdropMode();
  function setBackdropMode(mode) {
    progress.backdrop = mode;
    saveProgress();
    backdropSetting.value = mode;
    buildBackdrop();
    syncSkyToggle();
  }
  backdropSetting.addEventListener('change', () => setBackdropMode(backdropSetting.value));
  // The header's moon button: one click pauses the night sky (still) or brings it back (animated, also from plain).
  const skyToggle = document.getElementById('sky-toggle');
  function syncSkyToggle() {
    const on = backdropMode() === 'animated';
    skyToggle.setAttribute('aria-pressed', String(on));
    skyToggle.title = on ? 'Background animation: on (click to pause the night sky)' : 'Background animation: off (click to animate the night sky)';
    skyToggle.querySelector('canvas').dataset.icon = on ? 'sky' : 'skyPaused';
    paintIcons(skyToggle);
  }
  skyToggle.addEventListener('click', () => setBackdropMode(backdropMode() === 'animated' ? 'still' : 'animated'));
  buildBackdrop();
  syncSkyToggle();

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
    if (fps === 15) achieve('eco');
    SYSTEM_MS = fps ? 1000 / fps : Infinity;
    wake();
  });
  const onScreen = new Map([[map, true], [sys, true], [uniCanvas, false]]);
  let lastMap = 0, lastSys = 0, lastUniverse = 0, lastActive = performance.now(), running = false;

  function frame(now) {
    const visible = onScreen.get(map) || onScreen.get(sys) || onScreen.get(uniCanvas);
    if (!visible || now - lastActive > IDLE_MS) { running = false; return; }
    if (SYSTEM_MS === Infinity) {   // animation off: draw the current state once, then sleep until something changes
      drawMap(now);
      drawUniverse(now);
      drawSystem(0);
      drawBackdrop(now, true);
      running = false;
      return;
    }
    if (onScreen.get(map) && now - lastMap >= MAP_MS) { drawMap(now); drawHeaderEmblem(now); lastMap = now; }
    if (onScreen.get(uniCanvas) && now - lastUniverse >= MAP_MS) { drawUniverse(now); lastUniverse = now; }   // 56-universe.js
    drawBackdrop(now);   // the night sky behind the page (55-backdrop.js; ~8 fps, still with reduced motion)
    if (onScreen.get(sys) && now - lastSys >= SYSTEM_MS) {
      drawSystem(now / 1000);
      lastSys = now;
      if (scene && !scene.custom && !scene.mystery && now - sceneSince > 120_000) achieve('patient');
    }
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
      if (onScreen.get(map) || onScreen.get(sys) || onScreen.get(uniCanvas)) wake();
    });
    watcher.observe(map);
    watcher.observe(sys);
    watcher.observe(uniCanvas);
  }
  drawMap(0);
  drawSystem(0);
  wake();
  // Ready: the loading screen (index.html) fades out, if it ever showed, and goes.
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.classList.add('done');
    setTimeout(() => loadingScreen.remove(), 350);
  }
  // "TAKE ME SOMEWHERE" buttons (the empty screen, NO SIGNAL): the dice.
  info.addEventListener('click', e => { if (e.target.closest('[data-random]')) document.getElementById('random').click(); });
})();
