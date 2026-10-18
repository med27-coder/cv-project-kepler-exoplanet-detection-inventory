// ---------------------------------------------------------------- easter egg: the Hubble Space Telescope
// Like the ISS, Hubble is an Earth-orbit exception (45-spaceflight.js): "hubble", "hst" or "hubble (space)
// telescope" opens a pixel Earth with Hubble circling it on its real orbit, about 520 km up and tilted 28.5 degrees
// to the equator, sped up; its sprite (CRAFT_ART.hubble) shows in the corner. The Galleria card uses NASA's photo
// from the 2002 servicing mission.
const HUBBLE_QUERY = /^(the )?(hubble( space)?( telescope)?|hst)$/i;
const HUBBLE_ALT_KM = 520, HUBBLE_ORBIT_S = 95 * 60 / 460;   // a 95-minute orbit, sped up like the ISS's

function drawHubble(seconds) {
  sctx.fillStyle = '#070b1a';
  sctx.fillRect(0, 0, SW, SH);
  for (let k = 0; k < 90; k++) {   // the deep sky Hubble looks into: faint stars and a few smudges of galaxies
    sctx.fillStyle = k % 9 === 0 ? '#8a6aa8' : k % 5 === 0 ? '#4a5590' : '#1e2550';
    sctx.fillRect(Math.floor(hash('hb' + k) * SW), Math.floor(hash('hy' + k) * SH), k % 9 === 0 ? 2 : 1, 1);
  }
  const t = REDUCED_MOTION ? 0 : seconds, cx = CX, cy = Math.round(SH / 2);
  const R = EARTH_R_PX * (EARTH_KM + HUBBLE_ALT_KM) / EARTH_KM;
  const tilt = 0.5, turn = 0.25;   // seen from a little above, the orbit's plane tipped 28.5 degrees
  const at = th => {
    const x = R * Math.cos(th), y = R * tilt * Math.sin(th);
    return [cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn), Math.sin(th) < 0];
  };
  const orbit = behind => {
    sctx.fillStyle = '#4a3a78';
    for (let k = 0; k < 120; k += 2) {
      const [x, y, back] = at((k / 120) * 2 * Math.PI);
      if (back === behind && (!back || Math.hypot(x - cx, y - cy) > EARTH_R_PX + 0.5)) sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };
  const [hx, hy, behind] = at((t / HUBBLE_ORBIT_S) * 2 * Math.PI);
  const hidden = behind && Math.hypot(hx - cx, hy - cy) <= EARTH_R_PX + 1;
  const scope = (x, y) => {   // a tiny Hubble on its orbit: the silver tube between two blue wings
    sctx.fillStyle = '#2f4fae'; sctx.fillRect(Math.round(x) - 4, Math.round(y) - 1, 2, 3); sctx.fillRect(Math.round(x) + 3, Math.round(y) - 1, 2, 3);
    sctx.fillStyle = '#d6dae2'; sctx.fillRect(Math.round(x) - 2, Math.round(y), 5, 2);
    sctx.fillStyle = '#151a2c'; sctx.fillRect(Math.round(x) + 2, Math.round(y), 1, 2);
  };
  orbit(true);
  if (behind && !hidden) scope(hx, hy);
  solarPlanet(sctx, cx, cy, { art: 'earth', size: EARTH_R_PX, seed: 'hst', noMoon: true }, -0.9, -0.3, t * 0.4);
  orbit(false);
  if (!behind) scope(hx, hy);
  if (!hidden) pixelText(sctx, 'HUBBLE', Math.round(hx) + 7, Math.round(hy) - 8, '#ffd34d');
  drawCraftInset([{ name: 'Hubble', key: 'hubble', label: 'HUBBLE' }], 'Hubble', seconds);
  pixelText(sctx, 'ORBIT 95 MIN', 4, SH - 9, '#5a6a8a');
}

function showHubble(updateHash = true) {
  selected = null;
  ++selectToken;
  title.textContent = 'HUBBLE SPACE TELESCOPE';
  info.innerHTML = `
    <p class="big">★ THE EYE ABOVE THE AIR ★</p>
    <p>NASA and ESA's Hubble Space Telescope, on its orbit about ${HUBBLE_ALT_KM} km above the ground, above the
       blurring air. The animation is sped up about 460 times.</p>
    <ul class="facts">
      <li>Launched on <b>24 April 1990</b> aboard Space Shuttle Discovery.</li>
      <li>Its 2.4-metre mirror was made slightly the wrong shape; astronauts fitted corrective optics in <b>1993</b>.
        Five shuttle servicing missions kept it going, the last in <b>2009</b>.</li>
      <li>Circles Earth about every <b>95 minutes</b>, at about 7.5 km per second.</li>
      <li>Its observations helped show that the universe's expansion is <b>speeding up</b>, and pinned down its age:
        about <b>13.8 billion years</b>.</li>
      <li>It sees visible and ultraviolet light; Webb, its successor, sees infrared.</li>
    </ul>
    <p>${['https://science.nasa.gov/mission/hubble/|NASA: the Hubble mission',
          'https://hubblesite.org/|HubbleSite: Hubble\'s pictures']
      .map(s => s.split('|')).map(([u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`).join(' · ')}</p>
    <p class="note">Sources: NASA's Hubble facts · the orbit shown is illustrative, not the live position · you found an
      easter egg!</p>`;
  setScene({ custom: drawHubble });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#hubble');
}
