// ---------------------------------------------------------------- easter eggs: the rovers on the Moon
// Searching "lunokhod" opens Lunokhod 1 (USSR, 1970), the first rover on another world, rolling down the ramps of its
// Luna 17 lander on Mare Imbrium under a half-lit Earth, and closing its solar lid for the two-week lunar night.
// "yutu 2" opens Yutu-2 (China, 2019), the first rover on the Moon's far side, beside the Chang'e 4 lander in Von
// Karman crater, where Earth never rises and the Queqiao relay satellite carries every word home. They share the
// rover machinery of 47e-rovers.js (ROVER_QUERY sends them here, showRover shows them).

// No air on the Moon: a black sky, a sharp horizon, grey dust with small craters lit from one side.
function moonGround(ctx, w, h, horizon, seed) {
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = '#7d7d7d';
  for (let y = horizon + 3; y < h; y += 7) ctx.fillRect(0, y, w, 1);   // faint bands of dust, closer together far away
  for (let k = 0; k < 14; k++) {   // craters: a shadowed far rim, a bright near rim
    const cx = Math.floor(hash(`${seed}c${k}`) * w), cy = horizon + 5 + Math.floor(hash(`${seed}d${k}`) * (h - horizon - 30));
    const r = 2 + Math.floor(hash(`${seed}e${k}`) * 4) * (cy > horizon + 20 ? 2 : 1);
    ctx.fillStyle = '#6c6c6c'; ctx.fillRect(cx - r, cy, 2 * r, 1); ctx.fillRect(cx - r + 1, cy + 1, 2 * r - 2, 1);
    ctx.fillStyle = '#b4b4b4'; ctx.fillRect(cx - r + 1, cy + 2, 2 * r - 2, 1);
  }
  for (let k = 0; k < 70; k++) {   // pebbles
    ctx.fillStyle = k % 3 ? '#a2a2a2' : '#5e5e5e';
    ctx.fillRect(Math.floor(hash(`${seed}p${k}`) * w), horizon + 2 + Math.floor(hash(`${seed}q${k}`) * (h - horizon - 2)), k % 4 ? 1 : 2, 1);
  }
}
function moonStars(ctx, w, horizon, seed, bright) {
  for (let k = 0; k < (bright ? 60 : 18); k++) {
    ctx.fillStyle = k % 5 ? '#8a90a8' : '#e8ecff';
    ctx.fillRect(Math.floor(hash(`${seed}s${k}`) * w), Math.floor(hash(`${seed}t${k}`) * (horizon - 4)), 1, 1);
  }
}
// Night falls for about 14 Earth days at a time: dim the ground, then the sky and Earth are drawn on top.
const moonNight = (ctx, w, h, a) => { if (a > 0) { ctx.fillStyle = `rgba(4, 6, 16, ${0.72 * a})`; ctx.fillRect(0, 0, w, h); } };
// Where a scene is in its lunar day: 0..1 for night (0 day, 1 deepest night) through dusk and dawn.
function lunarDark(c, dusk, night, dawn) {
  if (c < dusk) return 0;
  if (c < night) return (c - dusk) / (night - dusk);
  if (c < dawn) return 1;
  return Math.max(0, 1 - (c - dawn) / 2);
}

// Lunokhod 1, facing right, wheels on the ground at (x, y): a pressurised "bathtub" on eight wire-mesh wheels, a lid
// with solar cells on its inside (open: 0 closed .. 1 swung up and back), a spike antenna and two TV eyes in front.
function drawLunokhod(ctx, x, y, s, t, moving, open) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  const bob = k => (moving && !REDUCED_MOTION ? Math.round(Math.sin(t * 6 + k * 1.7) * 0.5) : 0);
  for (const [k, wx] of [[0, -10], [1, -5], [2, 0], [3, 5]]) {   // four wheels this side, four behind
    put(wx, -3 + bob(k), 4, 3, '#3a3a40');
    put(wx + 1, -3 + bob(k), 2, 1, '#9aa0aa'); put(wx + 1, -1 + bob(k), 2, 1, '#9aa0aa'); put(wx + 1, -2 + bob(k), 1, 1, '#c8ccd4');
  }
  put(-11, -4, 21, 1, '#8a8f9a');                                       // the frame
  put(-10, -9, 19, 2, '#d8d2bc'); put(-9, -7, 17, 2, '#b0aa92'); put(-8, -5, 15, 1, '#8f8b78');   // the tub, wider at the top
  put(-10, -9, 19, 1, '#ece6d0');
  put(8, -8, 1, 1, '#151a2c'); put(8, -6, 1, 1, '#151a2c');              // the TV cameras
  put(6, -14, 1, 5, '#b8bfcc'); put(6, -15, 1, 1, '#eef2f8');           // the spike antenna
  put(-3, -11, 3, 2, '#c4c8d0'); put(-2, -12, 1, 1, '#eef2f8');          // the cone of the dish antenna
  const th = open * 1.95;                                                 // the lid, hinged at the back of the tub
  for (let k = 0; k < 17; k++) {   // a round panel seen edge-on: three pixels thick, cells on the sunny inside
    const dx = -10 + k * Math.cos(th), dy = -10 - k * Math.sin(th);
    const nx = -Math.sin(th), ny = -Math.cos(th);                         // across the lid, toward its outside
    put(dx, dy, 1, 1, open > 0.15 ? (k % 3 ? '#2f4fae' : '#5d7bd6') : '#c4beb3');
    if (k > 0 && k < 16) { put(dx + nx, dy + ny, 1, 1, open > 0.15 ? '#1e2f6e' : '#a8a490'); put(dx + 2 * nx, dy + 2 * ny, 1, 1, '#c4beb3'); }
  }
}

// Luna 17, the lander that carried it: round fuel tanks on four legs, with a ramp down each side.
function drawLuna17(ctx, x, y, s = 2) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  put(-9, -8, 18, 3, '#8a8f9a'); put(-9, -8, 18, 1, '#b8bfcc');          // the deck the rover sat on
  for (const tx of [-8, -3, 2]) { put(tx, -5, 5, 4, '#c8ccd4'); put(tx, -5, 2, 1, '#eef2f8'); put(tx + 1, -2, 4, 1, '#8a8f9a'); }   // tanks
  for (const lx of [-10, 9]) put(lx, -5, 1, 5, '#7d8596');               // legs
  put(-12, 0, 3, 1, '#7d8596'); put(9, 0, 3, 1, '#7d8596');
  for (let k = 0; k < 8; k++) put(9 + k, -8 + k, 1, 1, '#b8bfcc');       // the ramp it rolled down
}

function drawLunokhodScene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.5);
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
  const c = REDUCED_MOTION ? 8 : t % 32, dark = REDUCED_MOTION ? 0 : lunarDark(c, 20, 23, 29);
  for (let x = 0; x < w; x++) {   // the low far rim of Mare Imbrium
    const top = horizon - 1 - Math.round(2.5 * hash(`imb${x >> 4}`) + Math.sin(x / 13));
    ctx.fillStyle = '#6e6e6e'; ctx.fillRect(x, top, 1, horizon - top);
  }
  moonGround(ctx, w, h, horizon, 'imbrium');
  const ground = h - 26, lx = Math.round(w * 0.2);
  drawLuna17(ctx, lx, ground);
  // down the ramp, a drive across the mare, a stop to look around, then the lid shuts for the night and opens at dawn
  const x0 = lx + 36, x1 = Math.round(w * 0.72);
  const x = c < 14 ? x0 + (x1 - x0) * (c / 14) : x1;
  for (let tx = x0 - 6; tx < x - 22; tx += 3) { ctx.fillStyle = '#6a6a6a'; ctx.fillRect(tx, ground - 1, 2, 1); }   // wheel tracks
  const open = c < 20 ? 1 : c < 22 ? 1 - (c - 20) / 2 : c < 28 ? 0 : Math.min(1, (c - 28) / 2);
  drawLunokhod(ctx, x, ground, 2, t, c < 14, REDUCED_MOTION ? 1 : open);
  moonNight(ctx, w, h, dark);
  moonStars(ctx, w, horizon, 'imb', dark > 0.5);
  // the Earth, half lit, high over the near side (it hangs in the same place in the Moon's sky)
  const ex = Math.round(w * 0.8), ey = Math.round(h * 0.14), er = 9;
  for (let dy = -er; dy <= er; dy++) {
    for (let dx = -er; dx <= er; dx++) {
      if (dx * dx + dy * dy > er * er) continue;
      const lit = dx < 2;
      ctx.fillStyle = !lit ? '#0d1d40' : hash(`ea${dx >> 1}${dy >> 1}`) < 0.32 ? '#f2f4f8' : hash(`eb${dx >> 2}${dy >> 2}`) < 0.3 ? '#5f8f4a' : '#2f6fd6';
      ctx.fillRect(ex + dx, ey + dy, 1, 1);
    }
  }
  pixelText(ctx, 'MARE IMBRIUM', 4, h - 10, '#e8ecff');
  const day = `LUNAR DAY ${1 + (Math.floor((REDUCED_MOTION ? 0 : t) / 32) % 11)}`;
  pixelText(ctx, dark > 0.5 ? 'LUNAR NIGHT' : day, w - textWidth(dark > 0.5 ? 'LUNAR NIGHT' : day) - 4, h - 10, '#e8ecff');
  pixelText(ctx, 'LUNA 17', lx - 13, ground - 30, '#e8ecff');
}

// Yutu-2, facing right: a small gold box on six wheels, one solar wing out to the side, one hinged on top, and a mast
// with its cameras. asleep 0..1 folds the top wing over the body and lowers the mast, as it does every lunar night.
function drawYutu2(ctx, x, y, s, t, moving, asleep) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  const bob = k => (moving && !REDUCED_MOTION ? Math.round(Math.sin(t * 7 + k * 2) * 0.5) : 0);
  for (const [k, wx] of [[0, -7], [1, -2], [2, 3]]) { put(wx, -3 + bob(k), 3, 3, '#2a2a30'); put(wx + 1, -2 + bob(k), 1, 1, '#8a8f9a'); }
  put(-7, -4, 14, 1, '#8a8f9a');                                          // the rocker legs
  put(-6, -8, 12, 4, '#d9a441'); put(-6, -5, 12, 1, '#9c6b22'); put(-6, -8, 12, 1, '#f3d27a');   // the gold-foil body
  put(-13, -8, 7, 1, '#2f4fae'); put(-13, -9, 2, 1, '#5d7bd6');           // the wing out to the side
  const th = 1.1 * (1 - asleep);                                          // the top wing tilts up to the Sun by day
  for (let k = 0; k < 10; k++) put(-5 + k * Math.cos(th), -9 - k * Math.sin(th), 1, 1, k % 3 ? '#2f4fae' : '#5d7bd6');
  const mast = Math.round(7 * (1 - asleep));                              // the mast folds down at night
  put(4, -9 - mast, 1, mast, '#b8bfcc');
  put(2, -11 - mast, 5, 2, '#eef2f8'); put(5, -10 - mast, 1, 1, '#151a2c');
}

// The Chang'e 4 lander: a gold box on four legs with its two solar wings, and the ramp Yutu-2 drove down.
function drawChange4(ctx, x, y, s = 2) {
  const put = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  put(-7, -11, 14, 6, '#d9a441'); put(-7, -6, 14, 1, '#9c6b22'); put(-7, -11, 14, 1, '#f3d27a');
  put(-15, -10, 8, 2, '#2f4fae'); put(7, -10, 8, 2, '#2f4fae'); put(-15, -10, 8, 1, '#5d7bd6'); put(7, -10, 8, 1, '#5d7bd6');
  for (const lx of [-8, 7]) { put(lx, -5, 1, 5, '#b8bfcc'); put(lx - 1, 0, 3, 1, '#8a8f9a'); }
  put(-1, -14, 1, 3, '#b8bfcc'); put(-3, -15, 5, 1, '#eef2f8');           // its antenna
  for (let k = 0; k < 8; k++) put(8 + k, -5 + Math.round(k * 0.6), 2, 1, '#8a8f9a');   // the ramp
}

function drawYutu2Scene(ctx, w, h, t) {
  const horizon = Math.round(h * 0.48);
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
  const c = REDUCED_MOTION ? 8 : t % 30, dark = REDUCED_MOTION ? 0 : lunarDark(c, 18, 21, 27);
  for (let x = 0; x < w; x++) {   // the far wall of Von Karman crater
    const top = horizon - 3 - Math.round(4 * Math.max(0, Math.sin(x / 38 + 0.6)) + 1.5 * hash(`vk${x >> 3}`));
    ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x, top, 1, horizon - top);
  }
  moonGround(ctx, w, h, horizon, 'karman');
  const ground = h - 26, lx = Math.round(w * 0.2);
  drawChange4(ctx, lx, ground);
  const x0 = lx + 40, x1 = Math.round(w * 0.74);
  const x = c < 12 ? x0 + (x1 - x0) * (c / 12) : x1;
  for (let tx = x0 - 4; tx < x - 14; tx += 2) { ctx.fillStyle = '#6a6a6a'; ctx.fillRect(tx, ground - 1, 1, 1); }
  const asleep = REDUCED_MOTION ? 0 : c < 17 ? 0 : c < 19 ? (c - 17) / 2 : c < 26 ? 1 : Math.max(0, 1 - (c - 26) / 2);
  drawYutu2(ctx, x, ground, 2, t, c < 12, asleep);
  moonNight(ctx, w, h, dark);
  moonStars(ctx, w, horizon, 'vk', true);   // no Earth in this sky, ever: the far side always faces away
  // Queqiao, the relay satellite circling beyond the Moon, drifts across and blinks when it passes words along
  const qx = Math.round(((REDUCED_MOTION ? 0.6 : (t % 40) / 40) * (w + 20)) - 10), qy = Math.round(h * 0.16);
  ctx.fillStyle = '#d6dae2'; ctx.fillRect(qx, qy, 2, 1);
  ctx.fillStyle = '#5d7bd6'; ctx.fillRect(qx - 2, qy, 2, 1); ctx.fillRect(qx + 2, qy, 2, 1);
  if (!REDUCED_MOTION && Math.floor(t * 2) % 3 === 0) { ctx.fillStyle = '#9fd8ff'; ctx.fillRect(qx, qy - 1, 1, 1); }
  pixelText(ctx, 'QUEQIAO', Math.min(w - textWidth('QUEQIAO') - 2, Math.max(2, qx - 12)), qy + 4, '#8a90a8');
  pixelText(ctx, 'VON KARMAN CRATER', 4, h - 10, '#e8ecff');
  pixelText(ctx, 'FAR SIDE', 4, 4, '#8a90a8');
  const label = dark > 0.5 ? 'ASLEEP: LUNAR NIGHT' : `LUNAR DAY ${1 + (Math.floor((REDUCED_MOTION ? 0 : t) / 30) % 99)}`;
  pixelText(ctx, label, w - textWidth(label) - 4, h - 10, '#e8ecff');
}

Object.assign(ROVERS, {
  lunokhod: {
    title: 'LUNOKHOD 1', big: '★ LUNOKHOD 1 ON MARE IMBRIUM ★', draw: drawLunokhodScene, hash: 'lunokhod', moon: true,
    intro: 'The first rover on another world, 27 years before Sojourner. The Soviet Luna 17 landed it on the Sea of Rains in November 1970; drivers on Earth steered it by television. Watch it roll off its lander, drive across the mare, and close its lid for the long lunar night.',
    facts: [
      'Luna 17 landed on 17 November 1970 on Mare Imbrium, the Sea of Rains, and Lunokhod 1 drove down one of its two ramps.',
      'A crew of five in the Soviet Union drove it from Earth, watching its TV pictures, which took several seconds to arrive.',
      'At night its lid closed over the body and a heater warmed by radioactive polonium kept it from freezing at about -150 °C; by day the lid opened, and solar cells on its inside charged the batteries.',
      'Planned for three lunar days, it worked for eleven, until September 1971, and drove about 10.5 km.',
      'In 2010 NASA\'s Lunar Reconnaissance Orbiter found it and its lander (the lander is in the Galleria photo), and scientists then bounced a laser off the reflector on its front.',
    ],
    link: 'https://images.nasa.gov/details/PIA12967', linkLabel: "NASA's photo of Luna 17 from lunar orbit",
  },
  yutu2: {
    title: 'YUTU-2', big: '★ YUTU-2 ON THE FAR SIDE ★', draw: drawYutu2Scene, hash: 'yutu-2', moon: true,
    intro: 'The first rover on the far side of the Moon, from China\'s Chang\'e 4 mission. Earth never rises over this side, so a relay satellite, Queqiao, passes its messages home. Watch it drive off from its lander, then fold up and sleep through the lunar night.',
    facts: [
      'Chang\'e 4 landed on 3 January 2019 in Von Karman crater, inside the South Pole-Aitken basin, the biggest and oldest known crater on the Moon.',
      'Its name means Jade Rabbit 2: in Chinese legend, a jade rabbit lives on the Moon with the goddess Chang\'e.',
      'Queqiao, "magpie bridge", circles a point beyond the Moon from where it sees both Yutu-2 and the Earth.',
      'Every lunar night, about 14 Earth days, it folds its mast and a solar wing and sleeps, waking when the Sun returns.',
      'It soon became the longest-working rover on the Moon, passing Lunokhod 1\'s record of eleven lunar days in 2019.',
    ],
    link: 'https://images.nasa.gov/details/01_m1303619844lr_closC5A1C', linkLabel: "NASA's photo of Chang'e 4 and Yutu-2 from lunar orbit",
  },
});
