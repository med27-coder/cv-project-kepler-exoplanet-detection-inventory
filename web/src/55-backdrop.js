// ---------------------------------------------------------------- page background: a pixel night sky
// A fixed canvas behind the whole page (docs/plans/BACKGROUND.md; concept pixel-art/concepts/draft_background.gif):
// a dithered navy-to-teal sky, twinkling stars, a bright blue star, the odd shooting star, three layers of
// drifting clouds and a tree line. Drawn small (about 320 pixels wide) and scaled up, so it stays crisp and
// cheap; the parts that never change are drawn once per window size. It moves with the main animation loop
// (60-loop.js), so it follows the Animation menu, stops when the page is idle, and is still with reduced motion.
// Settings: animated, still, or plain (the old flat colour).
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
backdropSetting.addEventListener('change', () => {
  progress.backdrop = backdropSetting.value;
  saveProgress();
  buildBackdrop();
});
buildBackdrop();
