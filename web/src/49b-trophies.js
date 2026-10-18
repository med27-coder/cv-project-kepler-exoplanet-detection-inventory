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

// ---- unlock fanfare (Web Audio, generated; only if turned on in Settings)
let audio = null;
function fanfare(tier) {
  if (!progress.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
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
