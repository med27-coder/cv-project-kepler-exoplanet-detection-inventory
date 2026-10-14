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
