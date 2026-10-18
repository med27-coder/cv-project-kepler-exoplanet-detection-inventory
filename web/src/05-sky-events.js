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
