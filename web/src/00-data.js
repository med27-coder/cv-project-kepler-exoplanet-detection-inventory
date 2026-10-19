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
  let m, s;
  if ((m = q.match(/^kepler[\s-]*(\d+)(?:\s*[a-z])?$/)) && (s = byName.get('kepler-' + Number(m[1])) || byName.get(`kepler-${Number(m[1])} ab`))) return s;
  if ((m = q.match(/^koi[\s-]*(\d+)(?:\.\d+)?$/)) && (s = byKoi.get(Number(m[1])))) return s;
  if ((m = q.match(/^k0*(\d+)\.\d{2}$/))) return byKoi.get(Number(m[1]));
  if ((m = q.match(/^(?:kic|kepid)?[\s-]*(\d{5,9})$/))) return byKepid.get(Number(m[1]));
  return byName.get(q) || byName.get((DATA.aliases || {})[q]?.toLowerCase());   // NASA's other names (export_starmap.py)
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
