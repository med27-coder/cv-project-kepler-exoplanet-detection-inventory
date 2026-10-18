// ---------------------------------------------------------------- ranks: trophies, badges and a star's life
// Pixel art for the achievements and the rank shown in the page header (docs/STAR_GAZER_MISSION.md):
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
