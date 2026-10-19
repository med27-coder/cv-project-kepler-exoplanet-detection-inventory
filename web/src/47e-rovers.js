// ---------------------------------------------------------------- easter eggs: the Mars rovers at work
// Searching "curiosity" or "perseverance" (or "percy") opens the rover at work on Mars, animated like the Martian
// farm (47d-martian.js): Curiosity climbing past Mount Sharp in Gale Crater, stopping to drill and to look around;
// Perseverance by the old river delta in Jezero Crater, leaving sample tubes on the ground while the Ingenuity
// helicopter takes off, flies and lands; "sojourner" or "pathfinder" the very first rover, rolling off its lander in
// Ares Vallis in 1997. Rovers you have found also roll by behind the Martian farm, where Pathfinder sits outside the Hab.
// The Moon's rovers (Lunokhod 1, Yutu-2) live in 47h-moon.js and use the same page.
// "rovers" / "mars rovers" still shows where everything is in the Solar System (45-spaceflight.js).
const ROVER_QUERY = /^(the )?(curiosity|perseverance|percy|sojourner|mars pathfinder|pathfinder|spirit|opportunity|oppy|zhurong|tianwen 1|tianwen|lunokhod 1|lunokhod|luna 17|yutu 2|yutu2|jade rabbit 2)( rover)?$/i;
const ROVER_OF = { curiosity: 'curiosity', perseverance: 'perseverance', percy: 'perseverance', sojourner: 'sojourner',
                   'mars pathfinder': 'sojourner', pathfinder: 'sojourner', spirit: 'spirit', opportunity: 'opportunity', oppy: 'opportunity',
                   zhurong: 'zhurong', 'tianwen 1': 'zhurong', tianwen: 'zhurong',
                   'lunokhod 1': 'lunokhod', lunokhod: 'lunokhod', 'luna 17': 'lunokhod',   // the Moon (47h-moon.js)
                   'yutu 2': 'yutu2', yutu2: 'yutu2', 'jade rabbit 2': 'yutu2' };
const roverFor = q => { const m = ROVER_QUERY.exec(q); return m ? ROVER_OF[m[2].toLowerCase()] : null; };
const ROVER_INK = { body: '#ece8e0', shade: '#c4beb3', dark: '#2a2a30', hub: '#6f6a62', metal: '#8a8f9a', rtg: '#6f7d96', eye: '#151a2c', gold: '#d9b45a' };

// A rover side-on, facing right, its wheels on the ground at (x, y); s: pixels per rover pixel.
// pose: { drill: 0..1 (the arm reaching down to the rock), look: -1..1 (the mast head turning), moving }
function drawRover(ctx, x, y, s, t, pose = {}) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  const bob = k => (pose.moving && !REDUCED_MOTION ? Math.round(Math.sin(t * 6 + k * 2) * 0.6) : 0);   // rocker-bogie: each wheel rides its own bump
  for (const [k, wx] of [[0, -8], [1, -1], [2, 6]]) {   // three of the six wheels, with the rocker-bogie arms
    put(wx, -3 + bob(k), 3, 3, ROVER_INK.dark);
    put(wx + 1, -2 + bob(k), 1, 1, ROVER_INK.hub);
  }
  put(-7, -5, 15, 1, ROVER_INK.metal);   // the rocker and bogie arms
  put(-5, -4, 1, 1, ROVER_INK.metal); put(3, -4, 1, 1, ROVER_INK.metal);
  put(-8, -9, 16, 3, ROVER_INK.body);    // the body, with its shadowed underside
  put(-8, -6, 16, 1, ROVER_INK.shade);
  put(-12, -10, 4, 4, ROVER_INK.rtg);    // the nuclear power unit at the back, with its fins
  put(-13, -9, 1, 2, ROVER_INK.metal); put(-11, -11, 1, 1, ROVER_INK.metal);
  put(-4, -11, 4, 1, ROVER_INK.shade);   // the high-gain antenna, a flat disc
  put(-2, -10, 1, 1, ROVER_INK.metal);
  put(5, -18, 1, 9, ROVER_INK.metal);    // the mast
  const look = Math.round(pose.look || 0);
  put(3 + look, -21, 6, 3, ROVER_INK.body);   // the camera head, turning
  put(look < 0 ? 3 + look : 6 + look, -20, 2, 1, ROVER_INK.eye);
  const reach = pose.drill || 0;   // the arm: folded at the front, or reaching down to drill
  if (reach > 0) {
    put(8, -7, 3, 1, ROVER_INK.metal);
    put(11, -7, 1, Math.round(1 + reach * 5), ROVER_INK.metal);
    put(10, Math.round(-6 + reach * 5), 3, 2, ROVER_INK.gold);   // the turret with the drill
  } else {
    put(8, -8, 2, 1, ROVER_INK.metal); put(9, -10, 2, 2, ROVER_INK.gold);
  }
}

// A far-off rover, a few pixels long, for the Martian farm's horizon.
function drawRoverTiny(ctx, x, y) {
  ctx.fillStyle = ROVER_INK.body; ctx.fillRect(x, y - 3, 6, 2);
  ctx.fillStyle = ROVER_INK.metal; ctx.fillRect(x + 4, y - 5, 1, 2);
  ctx.fillStyle = ROVER_INK.dark; ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); ctx.fillRect(x + 5, y - 1, 1, 1);
}
// From 47d-martian.js: rovers already found drive along the far plain, one behind the other.
function drawFarRovers(ctx, w, horizon, t) {
  const found = ['sojourner', 'spirit', 'opportunity', 'curiosity', 'perseverance', 'zhurong'].filter(id => progress.eggs[id]);
  found.forEach((id, k) => {
    const x = Math.round(((t * 3 + k * (w + 40) / 2) % (w + 40)) - 20);
    drawRoverTiny(ctx, x, horizon + 3 + (k % 3));
  });
}

// Mars Pathfinder after landing, centred on (x, y) at ground level: three solar petals opened flat, the deflated
// airbags bunched round them, the camera mast (IMP) in the middle and a ramp down to the ground.
function drawPathfinder(ctx, x, y, s = 1) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  put(-11, -2, 22, 2, '#c4beb3');                  // deflated airbags, bunched under the petals
  put(-12, -1, 2, 1, '#9a948a'); put(10, -1, 2, 1, '#9a948a');
  put(-10, -3, 7, 1, '#2f4fae'); put(3, -3, 7, 1, '#2f4fae');   // the two side petals, solar cells up
  put(-10, -3, 1, 1, '#5d7bd6'); put(9, -3, 1, 1, '#5d7bd6');
  put(-3, -4, 6, 2, '#d9a441');                    // the base petal and the gold body
  put(-2, -5, 4, 1, '#9c6b22');
  put(0, -11, 1, 6, '#8a8f9a');                    // the camera mast
  put(-1, -12, 3, 1, '#eef2f8'); put(-1, -12, 1, 1, '#151a2c');
  put(3, -6, 1, 1, '#eef2f8'); put(4, -7, 2, 1, '#d6dae2');      // the low-gain antenna and the dish
  put(10, -2, 4, 1, '#7d8596');                    // the ramp down to the ground
}
// Sojourner: a microwave-oven-sized rover, six small wheels, a flat solar panel on top, its antenna whip.
function drawSojourner(ctx, x, y, s, t, moving) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  const bob = k => (moving && !REDUCED_MOTION ? Math.round(Math.sin(t * 7 + k * 2) * 0.5) : 0);
  for (const [k, wx] of [[0, -4], [1, -1], [2, 2]]) { put(wx, -2 + bob(k), 2, 2, '#2a2a30'); put(wx, -1 + bob(k), 1, 1, '#8a8f9a'); }
  put(-4, -4, 8, 2, '#d6dae2');                    // the body (the "warm electronics box")
  put(-4, -3, 8, 1, '#b8bfcc');
  put(-5, -5, 10, 1, '#2f4fae');                   // the solar panel on top
  put(-5, -5, 2, 1, '#5d7bd6');
  put(-4, -9, 1, 4, '#8a8f9a');                    // the antenna
  put(4, -4, 1, 2, '#d9a441');                     // the APXS on its little arm at the back
}

function drawSojournerScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.55);
  marsSky(ctx, w, horizon);
  for (let x = 0; x < w; x++) {   // Twin Peaks, two small hills on the horizon, and the far plain of Ares Vallis
    const peak = Math.max(0, 1 - Math.abs(x - w * 0.62) / 18) * 14 + Math.max(0, 1 - Math.abs(x - w * 0.76) / 16) * 12;
    const top = horizon - 2 - Math.round(peak) - Math.round(1.5 * hash(`tp${x >> 3}`));
    ctx.fillStyle = peak > 0 ? '#a8643e' : '#9a5634';
    ctx.fillRect(x, top, 1, horizon - top);
  }
  marsGround(ctx, w, h, horizon, 'ares');
  for (let k = 0; k < 24; k++) {   // the flood plain is strewn with rocks
    const rx = Math.floor(hash(`ar${k}`) * w), ry = horizon + 6 + Math.floor(hash(`ay${k}`) * (h - horizon - 16));
    ctx.fillStyle = '#7d3b20'; ctx.fillRect(rx, ry, 2 + (k % 3), 2);
    ctx.fillStyle = '#c27c52'; ctx.fillRect(rx, ry, 1, 1);
  }
  const ground = h - 30, lx = Math.round(w * 0.3);
  drawPathfinder(ctx, lx, ground, 2);
  const yogi = Math.round(w * 0.78);   // the rock Yogi, its first big target
  ctx.fillStyle = '#7d3b20'; ctx.fillRect(yogi, ground - 9, 16, 9);
  ctx.fillStyle = '#9a5634'; ctx.fillRect(yogi + 2, ground - 11, 11, 2); ctx.fillRect(yogi, ground - 9, 3, 5);
  // Sojourner: down the ramp, across to Yogi, a pause to measure it with its APXS, then a slow way back
  const c = REDUCED_MOTION ? 0 : t % 28, x0 = lx + 28, x1 = yogi - 12;
  const f = c < 10 ? c / 10 : c < 18 ? 1 : 1 - (c - 18) / 10;
  const sx = Math.round(x0 + (x1 - x0) * f);
  for (let x = x0; x < sx - 8; x += 2) { ctx.fillStyle = '#9a4f2c'; ctx.fillRect(x, ground - 1, 1, 1); }   // its tracks
  drawSojourner(ctx, sx, ground, 2, t, c < 10 || c >= 18);
  pixelText(ctx, 'ARES VALLIS', 4, h - 10, '#fff1d6');
  pixelText(ctx, 'TWIN PEAKS', Math.round(w * 0.69) - 20, 4, '#5a2a14');
  pixelText(ctx, 'YOGI', yogi, ground - 20, '#fff1d6');
  const sol = `SOL ${Math.min(83, 1 + Math.floor((REDUCED_MOTION ? 0 : t) / 3))}`;
  pixelText(ctx, sol, w - textWidth(sol) - 4, h - 10, '#fff1d6');
}

// A Mars Exploration Rover (Spirit or Opportunity), facing right, wheels on the ground at (x, y): the wide, flat
// solar deck, the mast with its panoramic camera, six wheels. dust 0..1 browns the solar cells; drag: a stuck front
// wheel (Spirit, from 2006).
function drawMER(ctx, x, y, s, t, { moving = false, dust = 0, drag = false } = {}) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  const bob = k => (moving && !REDUCED_MOTION && !(drag && k === 2) ? Math.round(Math.sin(t * 6 + k * 2) * 0.5) : 0);
  for (const [k, wx] of [[0, -7], [1, -1], [2, 5]]) { put(wx, -3 + bob(k), 3, 3, '#2a2a30'); put(wx + 1, -2 + bob(k), 1, 1, '#8a8f9a'); }
  put(-6, -5, 13, 1, '#8a8f9a');                  // rocker-bogie
  put(-5, -8, 10, 3, '#ece8e0'); put(-5, -6, 10, 1, '#c4beb3');   // the body
  const cell = dust > 0.5 ? '#9a7a5a' : dust > 0.2 ? '#5d6a8a' : '#2f4fae';
  put(-11, -9, 22, 1, cell);                      // the wide solar deck ("wings")
  put(-11, -9, 3, 1, dust > 0.5 ? '#b08a62' : '#5d7bd6');
  put(4, -16, 1, 7, '#8a8f9a');                   // the mast and its camera head
  put(2, -18, 5, 2, '#ece8e0'); put(5, -17, 1, 1, '#151a2c'); put(3, -17, 1, 1, '#151a2c');
  put(-3, -12, 1, 3, '#8a8f9a');                  // the low-gain antenna
  put(-7, -11, 3, 1, '#d6dae2'); put(-6, -10, 1, 1, '#8a8f9a');   // the high-gain dish
}

function drawSpiritScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.55);
  marsSky(ctx, w, horizon);
  for (let x = 0; x < w; x++) {   // the Columbia Hills, Husband Hill highest, inside Gusev Crater
    const hill = Math.max(0, 1 - Math.abs(x - w * 0.35) / (w * 0.22)) * 22 + Math.max(0, 1 - Math.abs(x - w * 0.62) / (w * 0.12)) * 10;
    const top = horizon - 2 - Math.round(hill) - Math.round(1.5 * hash(`gh${x >> 3}`));
    ctx.fillStyle = hill > 0 ? '#a8643e' : '#9a5634';
    ctx.fillRect(x, top, 1, horizon - top);
  }
  marsGround(ctx, w, h, horizon, 'gusev');
  if (!REDUCED_MOTION) {   // a dust devil wandering across the plain: a spinning, widening column of dust
    const dx = ((t * 6) % (w + 60)) - 30, base = horizon + 8;
    for (let k = 0; k < 26; k++) {
      const y = base - k, half = 1 + k * 0.25, a = t * 9 + k * 0.7;
      ctx.fillStyle = k % 3 ? 'rgba(230, 194, 154, 0.55)' : 'rgba(201, 154, 112, 0.6)';
      ctx.fillRect(Math.round(dx + Math.sin(a) * half), y, 1, 1);
      ctx.fillRect(Math.round(dx + Math.sin(a + Math.PI) * half), y, 1, 1);
    }
  }
  const ground = h - 30, c = REDUCED_MOTION ? 10 : t % 26;
  const x = Math.round(w + 30 - ((c / 26) * (w + 60)));   // driving backwards, to the left, dragging the stuck wheel
  for (let tx = x + 10; tx < w; tx += 2) {
    ctx.fillStyle = '#9a4f2c'; ctx.fillRect(tx, ground - 1, 1, 1);
    ctx.fillStyle = hash(`si${tx}`) < 0.6 ? '#f4f0e6' : '#d8d0c0'; ctx.fillRect(tx + 1, ground, 1, 1);   // the bright silica it dug up
  }
  drawMER(ctx, x, ground, 2, t, { moving: true, dust: 0.3, drag: true });
  pixelText(ctx, 'GUSEV CRATER', 4, h - 10, '#fff1d6');
  pixelText(ctx, 'HUSBAND HILL', Math.round(w * 0.35) - 24, 4, '#5a2a14');
  const sol = `SOL ${Math.min(2210, 1 + Math.floor((REDUCED_MOTION ? 0 : t) * 10))}`;
  pixelText(ctx, sol, w - textWidth(sol) - 4, h - 10, '#fff1d6');
}

function drawOpportunityScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.55);
  marsSky(ctx, w, horizon);
  for (let x = 0; x < w; x++) {   // the far rim of Endeavour Crater, a low ridge across Meridiani Planum
    const top = horizon - 3 - Math.round(4 * Math.max(0, Math.sin(x / 30 + 1)) + 1.5 * hash(`er${x >> 3}`));
    ctx.fillStyle = '#9a5634'; ctx.fillRect(x, top, 1, horizon - top);
  }
  marsGround(ctx, w, h, horizon, 'meridiani');
  for (let k = 0; k < 70; k++) {   // "blueberries": little grey-blue balls of hematite, formed in water
    ctx.fillStyle = k % 4 ? '#5d6878' : '#7d8596';
    ctx.fillRect(Math.floor(hash(`bb${k}`) * w), horizon + 8 + Math.floor(hash(`bc${k}`) * (h - horizon - 12)), 1, 1);
  }
  const ground = h - 30, c = REDUCED_MOTION ? 14 : t % 28;
  const x = Math.round(-30 + (c / 28) * (w + 60));
  const gust = c > 12 && c < 16;   // a gust of wind sweeps the dust off its solar panels
  if (gust && !REDUCED_MOTION) {
    ctx.fillStyle = 'rgba(230, 194, 154, 0.7)';
    for (let k = 0; k < 18; k++) ctx.fillRect(Math.round(((t * 80 + k * 37) % w)), ground - 30 + (k * 7) % 26, 4, 1);
  }
  drawMER(ctx, x, ground, 2, t, { moving: true, dust: c < 14 ? 0.8 : 0 });
  pixelText(ctx, 'MERIDIANI PLANUM', 4, h - 10, '#fff1d6');
  pixelText(ctx, 'ENDEAVOUR CRATER', w - textWidth('ENDEAVOUR CRATER') - 4, 4, '#5a2a14');
  const sol = `SOL ${Math.min(5111, 1 + Math.floor((REDUCED_MOTION ? 0 : t) * 20))}`;
  pixelText(ctx, sol, w - textWidth(sol) - 4, h - 10, '#fff1d6');
}

// Zhurong (China, 2021): a blue rover with four butterfly-wing solar panels and a tall mast, facing right.
function drawZhurong(ctx, x, y, s, t, moving, dust = 0) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  const bob = k => (moving && !REDUCED_MOTION ? Math.round(Math.sin(t * 6 + k * 2) * 0.5) : 0);
  for (const [k, wx] of [[0, -7], [1, -1], [2, 5]]) { put(wx, -3 + bob(k), 3, 3, '#2a2a30'); put(wx + 1, -2 + bob(k), 1, 1, '#8a8f9a'); }
  put(-6, -5, 13, 1, '#8a8f9a');
  put(-5, -8, 10, 3, '#d6dae2'); put(-5, -6, 10, 1, '#b8bfcc');            // the body
  const cell = dust > 0.5 ? '#8a7a6a' : '#2f4fae', edge = dust > 0.5 ? '#a08a72' : '#5d7bd6';
  put(-12, -10, 6, 1, cell); put(-13, -11, 3, 1, edge);                     // two wings back, two forward,
  put(6, -10, 6, 1, cell); put(10, -11, 3, 1, edge);                        // spread like a butterfly's
  put(-5, -9, 4, 1, cell); put(1, -9, 4, 1, cell);
  put(4, -17, 1, 8, '#8a8f9a'); put(2, -19, 5, 2, '#eef2f8'); put(5, -18, 1, 1, '#151a2c');   // the mast and cameras
}

function drawZhurongScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.55);
  marsSky(ctx, w, horizon);
  for (let x = 0; x < w; x++) {   // Utopia Planitia: a wide, flat plain, low far ridges
    const top = horizon - 2 - Math.round(2 * hash(`up${x >> 4}`) + Math.sin(x / 20));
    ctx.fillStyle = '#9a5634'; ctx.fillRect(x, top, 1, horizon - top);
  }
  marsGround(ctx, w, h, horizon, 'utopia');
  const ground = h - 30, lx = Math.round(w * 0.22), c = REDUCED_MOTION ? 16 : t % 26;
  // the Tianwen-1 lander with its ramp
  ctx.fillStyle = '#c4beb3'; ctx.fillRect(lx - 14, ground - 8, 28, 6);
  ctx.fillStyle = '#d9a441'; ctx.fillRect(lx - 10, ground - 11, 20, 3);
  ctx.fillStyle = '#8a8f9a'; ctx.fillRect(lx - 14, ground - 2, 2, 2); ctx.fillRect(lx + 12, ground - 2, 2, 2); ctx.fillRect(lx + 14, ground - 4, 10, 1);
  // the little camera Zhurong set down on the ground, then drove away from, to photograph itself with the lander
  const camX = Math.round(w * 0.48);
  if (c > 8) { ctx.fillStyle = '#eef2f8'; ctx.fillRect(camX, ground - 3, 2, 2); ctx.fillStyle = '#151a2c'; ctx.fillRect(camX + 1, ground - 3, 1, 1); }
  const x = c < 8 ? lx + 30 + (camX - lx - 18) * (c / 8) : c < 10 ? camX + 12 : c < 18 ? camX + 12 + (w * 0.3) * ((c - 10) / 8) : camX + 12 + w * 0.3;
  for (let tx = lx + 30; tx < x - 10; tx += 2) { ctx.fillStyle = '#9a4f2c'; ctx.fillRect(tx, ground - 1, 1, 1); }
  drawZhurong(ctx, x, ground, 2, t, c < 8 || (c >= 10 && c < 18), c >= 18 ? Math.min(1, (c - 18) / 6) : 0);
  if (c > 10 && c < 12 && !REDUCED_MOTION) {   // the selfie: a flash at the camera
    ctx.fillStyle = '#fff1b0'; ctx.fillRect(camX - 1, ground - 5, 4, 1); ctx.fillRect(camX + 1, ground - 7, 1, 5);
  }
  pixelText(ctx, 'UTOPIA PLANITIA', 4, h - 10, '#fff1d6');
  if (c >= 18) pixelText(ctx, 'ASLEEP SINCE 2022', w - textWidth('ASLEEP SINCE 2022') - 4, h - 10, '#fff1d6');
}

// The Mars sky and plain, shared by every Mars scene (these rovers and the Martian farm, 47d-martian.js).
function marsSky(ctx, w, horizon) {   // butterscotch, paler near the ground
  for (let y = 0; y < horizon; y++) {
    const f = y / horizon;
    ctx.fillStyle = f < 0.35 ? '#c99a70' : f < 0.7 ? '#d8ac80' : '#e6c29a';
    ctx.fillRect(0, y, w, 1);
  }
}
// The rusty plain and its rocks; `seed` places the rocks, `beforeRocks` draws anything that belongs behind them.
function marsGround(ctx, w, h, horizon, seed, rocks = 110, beforeRocks = null) {
  ctx.fillStyle = '#b5623a';
  ctx.fillRect(0, horizon, w, h - horizon);
  if (beforeRocks) beforeRocks();
  for (let k = 0; k < rocks; k++) {
    ctx.fillStyle = k % 3 ? '#9a4f2c' : '#7d3b20';
    ctx.fillRect(Math.floor(hash(`${seed}r${k}`) * w), horizon + 2 + Math.floor(hash(`${seed}s${k}`) * (h - horizon - 2)), k % 5 ? 1 : 2, 1);
  }
}
// Where the rover is in its loop: driving in, stopped at a rock, driving out. Returns { x, phase, f }.
function roverRoute(w, t, cycle, stopAt, stopFor) {
  const c = REDUCED_MOTION ? cycle * 0.5 : t % cycle, drive = cycle - stopFor;
  const before = stopAt * drive, x0 = -30, x1 = w + 30, xs = x0 + (x1 - x0) * stopAt;
  if (c < before) return { x: x0 + (xs - x0) * (c / before), phase: 'drive', f: c / before };
  if (c < before + stopFor) return { x: xs, phase: 'stop', f: (c - before) / stopFor };
  return { x: xs + (x1 - xs) * ((c - before - stopFor) / (drive - before)), phase: 'drive', f: 0 };
}

function drawCuriosityScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.55);
  marsSky(ctx, w, horizon);
  for (let x = 0; x < w; x++) {   // Mount Sharp (Aeolis Mons): layered rock rising in the middle of Gale Crater
    const peak = Math.max(0, 1 - Math.abs(x - w * 0.62) / (w * 0.42));
    const top = horizon - Math.round(peak ** 1.4 * h * 0.36) - Math.round(2 * hash(`ms${x >> 2}`));
    for (let y = top; y < horizon; y++) {
      const band = Math.floor((y - top + (x >> 4)) / 4) % 3;
      ctx.fillStyle = ['#a8643e', '#c27c52', '#94532f'][band];
      ctx.fillRect(x, y, 1, 1);
    }
    const rim = horizon - 2 - Math.round(2 * hash(`gr${x >> 3}`));   // the crater rim, far behind
    if (peak === 0) { ctx.fillStyle = '#9a5634'; ctx.fillRect(x, rim, 1, horizon - rim); }
  }
  marsGround(ctx, w, h, horizon, 'gale');
  const ground = h - 30, at = roverRoute(w, t, 26, 0.48, 7);
  ctx.fillStyle = '#9a4f2c';   // wheel tracks behind the rover
  for (let x = -30; x < at.x - 12; x += 2) ctx.fillRect(x, ground - 1, 1, 1);
  const rock = Math.round(w * 0.48 + 30 * 0.48);   // the rock it stops at
  ctx.fillStyle = '#7d3b20'; ctx.fillRect(rock - 12, ground - 3, 9, 3);
  ctx.fillStyle = '#9a5634'; ctx.fillRect(rock - 11, ground - 4, 6, 1);
  const drilling = at.phase === 'stop' && at.f > 0.2 && at.f < 0.8;
  drawRover(ctx, at.x - 30, ground, 2, t, {
    moving: at.phase === 'drive', drill: at.phase === 'stop' ? Math.min(1, Math.sin(at.f * Math.PI) * 1.6) : 0,
    look: at.phase === 'stop' ? Math.sin(at.f * Math.PI * 2) : 0,
  });
  if (drilling && !REDUCED_MOTION) {   // a puff of grey rock powder at the drill
    ctx.fillStyle = '#d9c8b4';
    for (let k = 0; k < 6; k++) ctx.fillRect(rock - 8 + Math.round(Math.sin(t * 9 + k) * 4), ground - 4 - Math.round(hash(`dp${k}${Math.floor(t * 4)}`) * 5), 1, 1);
  }
  pixelText(ctx, 'GALE CRATER', 4, h - 10, '#fff1d6');
  pixelText(ctx, 'MOUNT SHARP', Math.round(w * 0.62) - 22, 4, '#5a2a14');
}

function drawPerseveranceScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.55);
  marsSky(ctx, w, horizon);
  for (let x = 0; x < w; x++) {   // Jezero's crater rim far off, and the old river delta: a layered fan on the left
    const rim = horizon - 3 - Math.round(3 * hash(`jr${x >> 3}`) + 2 * Math.sin(x / 13));
    ctx.fillStyle = '#9a5634'; ctx.fillRect(x, rim, 1, horizon - rim);
    const fan = Math.max(0, 1 - x / (w * 0.45));
    const top = horizon - Math.round(fan * h * 0.16);
    for (let y = top; y < horizon; y++) { ctx.fillStyle = (y - top) % 3 ? '#c8935f' : '#a87048'; ctx.fillRect(x, y, 1, 1); }
  }
  marsGround(ctx, w, h, horizon, 'jezero');
  const ground = h - 30, at = roverRoute(w, t, 30, 0.35, 6);
  const tubes = Math.min(10, 1 + Math.floor((REDUCED_MOTION ? 0 : t) / 30));   // the sample depot: ten tubes, like Three Forks
  for (let k = 0; k < tubes; k++) {
    const tx = Math.round(w * 0.35 + 30 * 0.35) - 34 - k * 4;
    ctx.fillStyle = '#f4f0e6'; ctx.fillRect(tx, ground - 2, 2, 1);
    ctx.fillStyle = '#c4beb3'; ctx.fillRect(tx + 2, ground - 2, 1, 1);
  }
  drawRover(ctx, at.x - 30, ground, 2, t, { moving: at.phase === 'drive', drill: at.phase === 'stop' ? Math.sin(at.f * Math.PI) : 0, look: at.phase === 'stop' ? -Math.sin(at.f * Math.PI) : 0 });
  // Ingenuity: rests, spins up, rises, flies across, lands; its shadow follows on the ground
  const c = REDUCED_MOTION ? 0 : t % 18, hx0 = Math.round(w * 0.72), hx1 = Math.round(w * 0.86);
  const lift = c < 4 ? 0 : c < 6 ? (c - 4) / 2 : c < 12 ? 1 : c < 14 ? 1 - (c - 12) / 2 : 0;   // up, across and back, down
  const px = Math.round(c < 6 || c >= 12 ? hx0 : c < 9 ? hx0 + (hx1 - hx0) * (c - 6) / 3 : hx1 + (hx0 - hx1) * (c - 9) / 3);
  const hy = ground - 4 - Math.round(lift * 34);
  ctx.fillStyle = 'rgba(60, 25, 10, 0.5)'; ctx.fillRect(px - 2, ground - 1, 5, 1);   // shadow
  ctx.fillStyle = '#6f7d96'; ctx.fillRect(px - 1, hy, 3, 2);                        // body
  ctx.fillStyle = '#d6dae2'; ctx.fillRect(px, hy - 2, 1, 2);                        // mast
  const spin = c >= 3.5 && c < 14.5 && !REDUCED_MOTION;
  ctx.fillStyle = '#e6ecff';                                                         // two rotors, blurring when they spin
  if (spin) { ctx.fillRect(px - 4 + (Math.floor(t * 20) % 2), hy - 3, 8, 1); ctx.fillRect(px - 3 - (Math.floor(t * 20) % 2), hy - 2, 7, 1); }
  else { ctx.fillRect(px - 3, hy - 3, 7, 1); }
  ctx.fillStyle = '#8a8f9a'; ctx.fillRect(px - 2, hy + 2, 1, 2); ctx.fillRect(px + 2, hy + 2, 1, 2);   // legs
  pixelText(ctx, 'JEZERO CRATER', 4, h - 10, '#fff1d6');
  pixelText(ctx, 'RIVER DELTA', 4, 4, '#5a2a14');
  const flight = `FLIGHT ${1 + (Math.floor((REDUCED_MOTION ? 0 : t) / 18) % 72)}`;
  pixelText(ctx, flight, w - textWidth(flight) - 4, h - 10, '#fff1d6');
}

const ROVERS = {
  curiosity: {
    title: 'CURIOSITY', big: '★ CURIOSITY IN GALE CRATER ★', draw: drawCuriosityScene, hash: 'curiosity',
    intro: 'NASA\'s car-sized rover has been climbing Mount Sharp, a 5-kilometre mountain of layered rock in the middle of Gale Crater, since 2012. Watch it drive, stop at a rock, drill and look around.',
    facts: [
      'Landed on 6 August 2012, lowered on cables by a rocket-powered "sky crane".',
      'It found that Gale Crater once held a lake, with the chemistry microbes could have lived on.',
      'Its holey wheels leave a pattern in the sand: Morse code for JPL, the lab that built it.',
      'A nuclear power unit at the back (the box with fins) keeps it running day and night.',
      'Its ChemCam laser zaps rocks from up to 7 metres away to read what they are made of.',
    ],
    link: 'https://science.nasa.gov/mission/msl-curiosity/',
  },
  sojourner: {
    title: 'SOJOURNER', big: '★ SOJOURNER IN ARES VALLIS ★', draw: drawSojournerScene, hash: 'sojourner',
    intro: 'The first rover on another planet. Mars Pathfinder bounced down on airbags on 4 July 1997, opened like a flower, and Sojourner, about the size of a microwave oven, rolled down a ramp to study the rocks around it. Watch it drive to the rock Yogi and measure it.',
    facts: [
      'Pathfinder landed on 4 July 1997 in Ares Vallis, an ancient flood channel, cushioned by giant airbags that bounced about 15 times.',
      'Sojourner weighed 10.6 kg and drove at about 1 cm a second; it never went more than about 12 metres from its lander.',
      'It was planned for 7 sols and worked for 83; the lander for nearly three months.',
      'Its instrument, the APXS, read what rocks are made of; the team named the rocks after cartoon characters, like Yogi and Barnacle Bill.',
      'It is named after Sojourner Truth, the American abolitionist, picked in a schools essay contest.',
    ],
    link: 'https://science.nasa.gov/mission/mars-pathfinder/',
  },
  spirit: {
    title: 'SPIRIT', big: '★ SPIRIT IN GUSEV CRATER ★', draw: drawSpiritScene, hash: 'spirit',
    intro: 'One of NASA\'s twin Mars Exploration Rovers. Planned for 90 sols, Spirit worked for more than six years, climbing the Columbia Hills. Watch it drive backwards, dragging its stuck front wheel, while a dust devil wanders past.',
    facts: [
      'Landed on 4 January 2004 in Gusev Crater, bouncing in on airbags like Pathfinder.',
      'It climbed Husband Hill, reaching the summit in August 2005 after more than a year of driving.',
      'From 2006 its right front wheel stopped turning, so it drove backwards, dragging it; in 2007 the dragged wheel scraped up almost pure silica, a sign of ancient hot springs.',
      'Gusts of wind sometimes swept the dust off its solar panels, giving it new power; it also filmed dust devils.',
      'It got stuck in soft sand at a place called Troy in 2009, kept working as a fixed station, and last called home in March 2010.',
    ],
    link: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
  },
  opportunity: {
    title: 'OPPORTUNITY', big: '★ OPPORTUNITY ON MERIDIANI PLANUM ★', draw: drawOpportunityScene, hash: 'opportunity',
    intro: 'Spirit\'s twin, on the other side of Mars. Planned for 90 sols, "Oppy" drove for more than 14 years and over a marathon\'s distance. Watch a gust of wind sweep the dust off its solar panels.',
    facts: [
      'Landed on 25 January 2004, three weeks after Spirit, rolling into a small crater: an "interplanetary hole in one".',
      'It found "blueberries", little balls of the mineral hematite that formed in water, proof that Meridiani was once wet.',
      'In 2015 it became the first vehicle to drive a marathon\'s distance on another world; it covered 45.16 km in all.',
      'A planet-wide dust storm in June 2018 blocked its sunlight; NASA tried more than a thousand times to wake it before ending the mission in February 2019.',
      'It worked for 5,111 sols, more than 55 times the 90 it was built for.',
    ],
    link: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
  },
  zhurong: {
    title: 'ZHURONG', big: '★ ZHURONG IN UTOPIA PLANITIA ★', draw: drawZhurongScene, hash: 'zhurong',
    intro: 'China\'s first Mars rover, from the Tianwen-1 mission. Watch it roll off its lander, set a small camera on the ground, drive away and take a picture of itself with the lander, then settle in for a long sleep.',
    facts: [
      'Landed on 14 May 2021 in Utopia Planitia, a huge plain in Mars\'s northern lowlands, making China the second country to drive a rover on Mars.',
      'It is named after Zhurong, a god of fire in Chinese mythology; in Chinese, Mars is called the "fire star".',
      'It drove about 1.9 km and studied the ground with radar, finding layers that may be the shores of an ancient ocean.',
      'It went to sleep for the Martian winter in May 2022; dust on its solar panels is thought to have kept it from waking.',
      'NASA\'s Mars Reconnaissance Orbiter photographed it from orbit, beside its lander (the photo in the Galleria).',
    ],
    link: 'https://images.nasa.gov/details/PIA24914', linkLabel: "NASA's photo of Zhurong from Mars orbit",
  },
  perseverance: {
    title: 'PERSEVERANCE', big: '★ PERSEVERANCE IN JEZERO CRATER ★', draw: drawPerseveranceScene, hash: 'perseverance',
    intro: 'NASA\'s newest rover explores Jezero Crater, an old lake with a river delta on its rim, sealing rock samples in tubes for a future trip to Earth. Its little helicopter, Ingenuity, flies nearby.',
    facts: [
      'Landed on 18 February 2021, beside the delta of a river that flowed into Jezero about 3.5 billion years ago.',
      'It left ten sample tubes on the ground at a depot called Three Forks, a backup for the trip home.',
      'Ingenuity was the first aircraft to fly on another planet: 72 flights from April 2021 to January 2024, five were planned.',
      'Mars\'s air is about 1% as thick as Earth\'s, so Ingenuity\'s rotors spun at about 2,500 turns a minute.',
      'Its microphones recorded the first sounds from the surface of Mars.',
    ],
    link: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
};

function showRover(id, updateHash = true) {
  const r = ROVERS[id];
  selected = null;
  ++selectToken;
  title.textContent = r.title;
  info.innerHTML = `
    <p class="big">${esc(r.big)}</p>
    <p>${esc(r.intro)}</p>
    <h3 class="facts-title">THE REAL ROVER</h3>
    <ul class="facts">${r.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p><a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.linkLabel || `NASA: the ${r.title.toLowerCase()} mission`)} ↗</a>${r.moon ? '' : ` ·
       <a href="#mars-rovers">where the rovers are on Mars and in the Solar System</a>`}</p>
    <p class="note">The drawing is pixel art, sped up; the scenery follows ${r.moon ? 'photos from the mission' : "NASA's photos"} · you found an easter egg!</p>`;
  setScene({ custom: seconds => {
    sctx.imageSmoothingEnabled = false;
    r.draw(sctx, SW, SH, REDUCED_MOTION ? 0 : seconds);
  } });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', `#${r.hash}`);
}
