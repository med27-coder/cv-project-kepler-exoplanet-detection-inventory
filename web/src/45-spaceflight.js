// ---------------------------------------------------------------- easter eggs: spacecraft and the ISS
// "spacecraft" / "JWST" / "Voyager" / "rovers"...: the Solar System frozen on one real date, with
// the planets and humanity's spacecraft beyond Earth orbit where NASA JPL Horizons puts them
// (scripts/fetch_spacecraft.py -> data/spacecraft.js, loaded only here). Earth-orbit satellites
// are left out on purpose; "ISS" / "space station" opens the International Space Station instead.
const CRAFT_QUERY = /^(spacecraft|space ?craft|probes?|space ?probes?|robots|missions|jwst|james webb( space telescope)?|webb|voyager( ?[12])?|new horizons|parker( solar probe)?|juno|europa clipper|rovers?|mars rovers?|curiosity|perseverance)$/i;
const ISS_QUERY = /^(the )?(iss|international space station|space station)$/i;
const CRAFT_SPOT = '#e8f4ff', CRAFT_LABEL = '#9fd8ff';

let craftLoad = null;
function loadCraft() {
  if (!craftLoad) {
    craftLoad = loadScript('data/spacecraft.js').then(() => window.STARMAP_SPACECRAFT);
    craftLoad.catch(() => { craftLoad = null; });
  }
  return craftLoad;
}

// Radius on screen for a distance from the Sun, matching the planets in either view mode.
function screenRadius(sc, au) {
  return sview.mode === 'true' ? au * sc.pxPerAU * sview.zoom : sc.logR(au) * sview.zoom;
}

// Spacecraft as blinking crosses with labels that don't overlap (nearer the Sun wins).
function drawCraft(sc, crafts, seconds) {
  const boxes = [];
  const free = (x, y, w) => !boxes.some(b => x < b[0] + b[2] + 2 && x + w + 2 > b[0] && Math.abs(y - b[1]) < 7);
  const marsCrew = crafts.filter(c => c.where === 'orbiting Mars');
  for (const c of crafts) {
    const R = screenRadius(sc, c.r_au), a = c.lon * Math.PI / 180;
    const x = Math.round(sc.cx + R * Math.cos(a)), y = Math.round(sc.cy + R * TILT * Math.sin(a));
    if (x < -2 || x > SW + 2 || y < -2 || y > SH - STRIP) continue;
    const on = REDUCED_MOTION || Math.sin(seconds * 4 + c.lon) > -0.5;
    sctx.fillStyle = on ? CRAFT_SPOT : '#6f86a8';
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sctx.fillRect(x + dx, y + dy, 1, 1);
    const label = c.where === 'orbiting Mars' ? (c === marsCrew[0] ? `${marsCrew.length} ORBITERS` : null) : c.label;
    if (!label) continue;
    const w = textWidth(label), lx = x + 3, ly = y - 7;
    if (lx + w < SW && ly > 0 && free(lx, ly, w)) {
      pixelText(sctx, label, lx, ly, CRAFT_LABEL);
      boxes.push([lx, ly, w]);
    }
  }
}

function craftTable(data) {
  const delay = min => (min < 1 ? `${fmt(min * 60)} s` : min < 120 ? `${fmt(min)} min` : `${fmt(min / 60, 1)} h`);
  const rows = [...data.spacecraft].sort((a, b) => b.r_au - a.r_au).map(c => `
    <tr><td><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a></td>
      <td>${esc(c.where)}</td><td class="num">${fmt(c.r_au, c.r_au < 10 ? 2 : 0)}</td>
      <td class="num">${delay(c.light_min)}</td><td class="num">${esc(c.launched)}</td><td>${esc(c.agency)}</td></tr>`).join('');
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>Spacecraft</th><th>Where</th><th class="num">From the Sun (AU)</th>
        <th class="num">Signal delay</th><th class="num">Launched</th><th>Agency</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function showSpacecraft(updateHash = true) {
  selected = null;
  const token = ++selectToken;
  title.textContent = 'SPACECRAFT';
  info.innerHTML = '<p class="status">Loading positions…</p>';
  if (updateHash) history.replaceState(null, '', '#Spacecraft');
  loadCraft().then(data => {
    if (token !== selectToken) return;
    const rovers = data.rovers.map(r => `<li><b><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></b>
      (${esc(r.agency)}): landed in ${esc(r.site)} on ${esc(r.landed)}${r.note ? `; ${esc(r.note)}` : ''}.</li>`).join('');
    info.innerHTML = `
      <p class="big">★ HUMANITY'S ROBOTS ★</p>
      <p>Where our spacecraft beyond Earth orbit were on <b>${esc(data.date)}</b>, from NASA JPL's Horizons system
         (the planets are frozen at their real positions that day too). White crosses on the drawing; press FIT to
         zoom out to the Voyagers, or TRUE SCALE and zoom into Earth to find the telescopes at L1 and L2.
         Satellites orbiting Earth are left out; try searching <b>ISS</b>.</p>
      ${craftTable(data)}
      <h3 class="facts-title">ON MARS</h3>
      <ul class="facts">${rovers}</ul>
      <p class="note">Signal delay = how long radio (light) takes to travel between Earth and the spacecraft ·
        sources: ${esc(data.source)}, NASA and ESA mission pages · you found an easter egg!</p>`;
    const sc = buildScene({ ...SOLAR, planets: SOLAR.planets.map(p => ({ ...p, ecc: 0 })) });
    sc.planets.forEach((p, i) => {   // real positions on that date: ecliptic longitude, circular orbits
      const lon = data.planets[SOLAR.planets[i].name]?.lon ?? 0;
      Object.assign(p, { phase: lon * Math.PI / 180, cosw: 1, sinw: 0 });
    });
    sc.frozen = true;
    sc.overlay = seconds => drawCraft(sc, data.spacecraft, seconds);
    sc.reach = () => Math.max(...data.spacecraft.map(c => screenRadius(sc, c.r_au)));
    setScene(sc);
  }, () => { if (token === selectToken) info.innerHTML = '<p>Spacecraft positions could not be loaded; check your connection.</p>'; });
}

// The International Space Station: a pixel Earth with the station on a to-scale orbit (sped up).
const EARTH_R_PX = 34, ISS_ALT_KM = 400, EARTH_KM = 6371, ISS_ORBIT_S = 12;   // 92-minute orbit in 12 s
function drawISS(seconds) {
  sctx.fillStyle = '#070b1a';
  sctx.fillRect(0, 0, SW, SH);
  for (let k = 0; k < 70; k++) {
    sctx.fillStyle = k % 7 === 0 ? '#4a5590' : '#1e2550';
    sctx.fillRect(Math.floor(hash('bg' + k) * SW), Math.floor(hash('y' + k) * SH), 1, 1);
  }
  const t = REDUCED_MOTION ? 0 : seconds, cx = CX, cy = Math.round(SH / 2);
  const R = EARTH_R_PX * (EARTH_KM + ISS_ALT_KM) / EARTH_KM;     // the orbit really is this close
  const tiltOrbit = 0.45, turn = -0.35;
  const at = th => {
    const x = R * Math.cos(th), y = R * tiltOrbit * Math.sin(th);
    return [cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn), Math.sin(th) < 0];
  };
  const theta = (t / ISS_ORBIT_S) * 2 * Math.PI;
  const orbit = (behind) => {
    sctx.fillStyle = '#3a4888';
    for (let k = 0; k < 120; k += 2) {
      const [x, y, back] = at((k / 120) * 2 * Math.PI);
      if (back === behind && (!back || Math.hypot(x - cx, y - cy) > EARTH_R_PX + 0.5)) sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };
  const station = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    sctx.fillStyle = '#5d7bd6';                       // solar arrays
    sctx.fillRect(x - 4, y - 1, 3, 3); sctx.fillRect(x + 2, y - 1, 3, 3);
    sctx.fillStyle = '#e6e6e6';                       // truss and modules
    sctx.fillRect(x - 1, y, 3, 1); sctx.fillRect(x, y - 1, 1, 3);
  };
  const [ix, iy, behind] = at(theta);
  const hidden = behind && Math.hypot(ix - cx, iy - cy) <= EARTH_R_PX + 1;
  orbit(true);
  if (behind && !hidden) station(ix, iy);
  solarPlanet(sctx, cx, cy, { art: 'earth', size: EARTH_R_PX, seed: 'iss', noMoon: true }, -0.9, -0.3, t * 0.4);
  orbit(false);
  if (!behind) station(ix, iy);
  if (!hidden) pixelText(sctx, 'ISS', Math.round(ix) + 6, Math.round(iy) - 8, '#ffd34d');
  pixelText(sctx, 'ORBIT 92 MIN', 4, SH - 9, '#5a6a8a');
}

function showISS(updateHash = true) {
  selected = null;
  ++selectToken;
  title.textContent = 'INTERNATIONAL SPACE STATION';
  info.innerHTML = `
    <p class="big">★ PEOPLE LIVE UP HERE ★</p>
    <p>The International Space Station, drawn to scale: its orbit is only about 400 km above the ground, so close it
       almost touches the pixel Earth. The animation is sped up about 460 times.</p>
    <ul class="facts">
      <li>Continuously crewed since <b>November 2000</b>.</li>
      <li>Built and run by <b>five space agencies from 15 countries</b>: NASA, Roscosmos, ESA, JAXA and CSA.</li>
      <li>Circles Earth about every <b>90 minutes</b>, <b>16 times a day</b>, at about five miles (8 km) per second.</li>
      <li><b>109 m</b> end to end (about a football field) and about <b>420 tonnes</b>.</li>
      <li>You can see it with your own eyes: it's the brightest moving "star" after sunset or before dawn.</li>
    </ul>
    <p>${['https://www.nasa.gov/international-space-station/|NASA: the space station',
          'https://spotthestation.nasa.gov/|NASA Spot the Station: when it passes over you']
      .map(s => s.split('|')).map(([u, t]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`).join(' · ')}</p>
    <p class="note">Sources: NASA space station facts and figures · the orbit shown is illustrative, not the
      live position · you found an easter egg!</p>`;
  setScene({ custom: drawISS });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#ISS');
}
