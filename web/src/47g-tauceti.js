// ---------------------------------------------------------------- Tau Ceti, and a nod to Project Hail Mary
// Tau Ceti is outside Kepler's field, so it isn't on the map, but "tau ceti" opens it: a Sun-like star 11.9 light-
// years away with four planet candidates (Feng et al. 2017, radial velocities; not confirmed, so drawn dashed). In
// Andy Weir's 2021 novel and its 2026 film, the ship Hail Mary travels here. Until it is found, it is a glowing dot
// beside the third candidate, like the spacecraft hidden as flashing lights; "hail mary" reveals it (an easter egg).
// The story's planet, Adrian, is fiction; the candidates are real.
const TAUCETI_QUERY = /^(the )?(tau ceti|tau cet|52 ceti|hd 10700)( system)?$/i;
const HAILMARY_QUERY = /^(the )?((project )?hail mary|astrophage)$/i;
const TAU_CETI = [   // name, period (days), semi-major axis (AU), minimum mass (Earths): Feng et al. 2017
  ['G', 20.0, 0.133, 1.75], ['H', 49.4, 0.243, 1.83], ['E', 162.9, 0.538, 3.93], ['F', 636.1, 1.334, 3.93],
];

function drawTauCeti(seconds) {
  const t = REDUCED_MOTION ? 0 : seconds, cx = CX, cy = Math.round((SH - 10) / 2), found = Boolean(progress.eggs.hailmary);
  sctx.fillStyle = '#070b1a';
  sctx.fillRect(0, 0, SW, SH);
  for (let k = 0; k < 80; k++) {
    sctx.fillStyle = k % 6 === 0 ? '#4a5590' : '#1e2550';
    sctx.fillRect(Math.floor(hash('tc' + k) * SW), Math.floor(hash('ty' + k) * SH), 1, 1);
  }
  for (let r = 1; r <= 12; r++) {   // a faint debris disk, much dustier than our Kuiper Belt
    const a = 108 + r * 2;
    for (let k = 0; k < 40; k++) {
      const th = hash(`dd${r}${k}`) * 2 * Math.PI;
      sctx.fillStyle = '#2a2a48';
      sctx.fillRect(Math.round(cx + a * Math.cos(th)), Math.round(cy + a * 0.4 * Math.sin(th)), 1, 1);
    }
  }
  const scale = 88 / 1.334;   // F's orbit fills the view
  let shipAt = null;
  TAU_CETI.forEach(([name, period, sma], k) => {
    const a = sma * scale, b = a * 0.4;
    sctx.fillStyle = '#3a4888';
    for (let s = 0; s < 120; s += 4) {   // dashed: candidates, not confirmed planets
      const th = (s / 120) * 2 * Math.PI;
      sctx.fillRect(Math.round(cx + a * Math.cos(th)), Math.round(cy + b * Math.sin(th)), 1, 1);
    }
    const th = (t / (period / 20)) + k * 1.9;   // faster for the inner ones, as in life
    const px = cx + a * Math.cos(th), py = cy + b * Math.sin(th);
    solarPlanet(sctx, px, py, { art: k === 2 ? 'earth' : k === 3 ? 'neptune' : 'mercury', size: k > 1 ? 2 : 1, noMoon: true },
                -Math.cos(th), -Math.sin(th), t);
    pixelText(sctx, name, Math.round(px) + 4, Math.round(py) - 7, '#7f8fc0');
    if (name === 'E') shipAt = [px + 5, py + 3];
  });
  for (let r = 6; r >= 1; r--) {   // Tau Ceti: a little smaller, cooler and more golden than the Sun
    sctx.fillStyle = r > 4 ? '#5a4520' : r > 2 ? '#e8b64a' : '#fff1c0';
    sctx.beginPath(); sctx.arc(cx, cy, r, 0, 2 * Math.PI); sctx.fill();
  }
  const [sx, sy] = shipAt;
  if (found) {   // the Hail Mary: a long ship, its Astrophage engines glowing infrared-red at the back
    sctx.fillStyle = '#ff6a3a'; sctx.fillRect(Math.round(sx) - 5, Math.round(sy), 2, 1);
    sctx.fillStyle = '#d6dae2'; sctx.fillRect(Math.round(sx) - 3, Math.round(sy), 8, 1);
    sctx.fillStyle = '#9aa6b8'; sctx.fillRect(Math.round(sx) + 1, Math.round(sy) - 1, 1, 3);
    pixelText(sctx, 'HAIL MARY', Math.round(sx) + 8, Math.round(sy) - 2, '#ffd34d');
  } else {   // still a mystery: a glint that pulses
    const on = REDUCED_MOTION || Math.sin(t * 4) > -0.2;
    sctx.fillStyle = on ? '#fff1b0' : '#6a5a3a';
    sctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
    if (on && Math.sin(t * 4) > 0.6) { sctx.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); sctx.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3); }
  }
  pixelText(sctx, 'TAU CETI  11.9 LY', 4, SH - 9, '#5a6a8a');
  pixelText(sctx, 'CANDIDATES', SW - textWidth('CANDIDATES') - 4, SH - 9, '#5a6a8a');
}

function showTauCeti(updateHash = true) {
  selected = null;
  ++selectToken;
  const found = Boolean(progress.eggs.hailmary);
  title.textContent = 'TAU CETI';
  info.innerHTML = `
    <p class="big">★ ${found ? 'THE HAIL MARY AT TAU CETI' : 'A STAR NEXT DOOR'} ★</p>
    <p>Tau Ceti, a Sun-like star 11.9 light-years away in the constellation Cetus, is far outside Kepler's field, but
       one of our nearest neighbours. Four planets may circle it, found in 2017 from the star's tiny wobble; none is
       confirmed yet, so their orbits are dashed. ${found ? '' : 'Something small glints near the third one.'}</p>
    <ul class="facts">
      <li>A little smaller and cooler than the Sun, and older: about 0.8 solar masses.</li>
      <li>The candidates (minimum masses): g 1.75 and h 1.83 Earths, close in; e and f about 3.9 Earths, near the inner
        and outer edges of the habitable zone.</li>
      <li>It is wrapped in a dust disk about ten times as massive as our Kuiper Belt, so comets and asteroids may
        strike its planets far more often than ours.</li>
      ${found ? `<li>In Andy Weir's 2021 novel <i>Project Hail Mary</i> (filmed in 2026), the ship Hail Mary travels here
        to learn why Tau Ceti is the one nearby star not dimming. The story's planet, Adrian, is fiction; the drawing
        puts the ship by candidate e.</li>` : ''}
    </ul>
    <p><a href="https://exoplanetarchive.ipac.caltech.edu/overview/tau%20Cet" target="_blank" rel="noopener noreferrer">Tau Ceti in NASA's Exoplanet Archive ↗</a></p>
    <p class="note">Planet candidates from Feng et al. 2017; sizes and the ship are illustrative${found ? ' · you found an easter egg!' : ''}.</p>`;
  setScene({ custom: drawTauCeti });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#tau-ceti');
}
