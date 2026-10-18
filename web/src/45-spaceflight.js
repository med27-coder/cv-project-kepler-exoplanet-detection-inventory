// ---------------------------------------------------------------- easter eggs: spacecraft and the ISS
// "spacecraft" / "JWST" / "Voyager" / "rovers"...: the Solar System frozen on one real date, with
// the planets and humanity's spacecraft beyond Earth orbit where NASA JPL Horizons puts them
// (scripts/starmap/fetch_spacecraft.py -> data/spacecraft.js, loaded only here). Earth-orbit satellites
// are left out on purpose; "ISS" / "space station" opens the International Space Station instead.
const CRAFT_GENERAL = /^(spacecraft|space ?craft|probes?|space ?probes?|robots|missions|rovers?|mars rovers?)$/i;
// Search words for one spacecraft -> its name in data/spacecraft.js (or a rover's): the view then
// highlights it and shows its pixel art.
// ("the" in front is always allowed; lookup() has already turned hyphens, underscores and dots into spaces.)
const CRAFT_ALIASES = [
  [/^(jwst|(james )?webb( space)?( telescope)?)$/i, 'James Webb Space Telescope'],
  [/^voyager( ?(1|i|one))?$/i, 'Voyager 1'], [/^voyager ?(2|ii|two)$/i, 'Voyager 2'],
  [/^new horizons( probe| spacecraft)?$/i, 'New Horizons'],
  [/^parker( solar)?( probe)?$/i, 'Parker Solar Probe'], [/^juno( probe)?$/i, 'Juno'], [/^(europa )?clipper$/i, 'Europa Clipper'],
  [/^(soho|solar and heliospheric observatory)$/i, 'SOHO'], [/^euclid( telescope)?$/i, 'Euclid'],
  [/^(solar orbiter|solo)$/i, 'Solar Orbiter'], [/^bepi ?colombo$/i, 'BepiColombo'],
  [/^(juice|jupiter icy moons explorer)$/i, 'JUICE'], [/^lucy( probe)?$/i, 'Lucy'], [/^psyche( probe)?$/i, 'Psyche'],
  [/^osiris ?(apex|rex)$/i, 'OSIRIS-APEX'], [/^(mro|mars reconnaissance orbiter)$/i, 'Mars Reconnaissance Orbiter'],
  [/^(2001 )?(mars )?odyssey$/i, 'Mars Odyssey'], [/^(mars express|mex)$/i, 'Mars Express'],
  [/^(tgo|exomars( tgo| trace gas orbiter)?|trace gas orbiter)$/i, 'ExoMars Trace Gas Orbiter'],
  [/^curiosity( rover)?$/i, 'Curiosity'], [/^(perseverance|percy)( rover)?$/i, 'Perseverance'],
];
const craftFocus = q => { const t = q.replace(/^the /i, ''); return CRAFT_ALIASES.find(([re]) => re.test(t))?.[1] ?? null; };
const CRAFT_QUERY = { test: q => CRAFT_GENERAL.test(q) || craftFocus(q) != null };
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

// Spacecraft as blinking crosses with labels that don't overlap (nearer the Sun wins; a searched-for
// spacecraft, `focus`, comes first and is drawn in yellow).
function drawCraft(sc, crafts, seconds, focus) {
  const boxes = [];
  const free = (x, y, w) => !boxes.some(b => x < b[0] + b[2] + 2 && x + w + 2 > b[0] && Math.abs(y - b[1]) < 7);
  const marsCrew = crafts.filter(c => c.where === 'orbiting Mars');
  const order = [...crafts.filter(c => c.name === focus), ...crafts.filter(c => c.name !== focus)];
  for (const c of order) {
    const mine = c.name === focus;
    const R = screenRadius(sc, c.r_au), a = c.lon * Math.PI / 180;
    const x = Math.round(sc.cx + R * Math.cos(a)), y = Math.round(sc.cy + R * TILT * Math.sin(a));
    if (x < -2 || x > SW + 2 || y < -2 || y > SH - STRIP) continue;
    const on = REDUCED_MOTION || Math.sin(seconds * 4 + c.lon) > -0.5;
    sctx.fillStyle = mine ? '#ffd34d' : on ? CRAFT_SPOT : '#6f86a8';
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sctx.fillRect(x + dx, y + dy, 1, 1);
    const label = mine ? c.label
      : c.where === 'orbiting Mars' ? (c === marsCrew[0] ? `${marsCrew.length} ORBITERS` : null) : c.label;
    if (!label) continue;
    const w = textWidth(label), lx = x + 3, ly = y - 7;
    if (lx + w < SW && ly > 0 && free(lx, ly, w)) {
      pixelText(sctx, label, lx, ly, mine ? '#ffd34d' : CRAFT_LABEL);
      boxes.push([lx, ly, w]);
    }
  }
}

// Top-left panel: the searched-for spacecraft's pixel art, or every spacecraft in turn (3 s each).
function drawCraftInset(gallery, focus, seconds) {
  if (!gallery.length) return;
  const pick = focus ? gallery.find(g => g.name === focus)
    : gallery[REDUCED_MOTION ? 0 : Math.floor(seconds / 3) % gallery.length];
  if (!pick) return;
  const [w, h] = spriteSize(pick.key);
  const px = Math.max(1, Math.min(3, Math.floor(58 / w), Math.floor(30 / h)));
  const bw = Math.max(w * px, textWidth(pick.label)) + 6, bh = h * px + 13;
  sctx.fillStyle = '#0b1024';
  sctx.fillRect(2, 2, bw, bh);
  sctx.fillStyle = '#2b3566';
  sctx.fillRect(2, 2, bw, 1); sctx.fillRect(2, 2 + bh, bw, 1); sctx.fillRect(2, 2, 1, bh); sctx.fillRect(1 + bw, 2, 1, bh);
  craftSprite(sctx, pick.key, 2 + Math.floor((bw - w * px) / 2), 5, px);
  pixelText(sctx, pick.label, 5, 7 + h * px, focus ? '#ffd34d' : CRAFT_LABEL);
}

function craftTable(data, focus) {
  const delay = min => (min < 1 ? `${fmt(min * 60)} s` : min < 120 ? `${fmt(min)} min` : `${fmt(min / 60, 1)} h`);
  const rows = [...data.spacecraft].sort((a, b) => b.r_au - a.r_au).map(c => `
    <tr${c.name === focus ? ' class="focus"' : ''}><td>${spriteIcon(CRAFT_SPRITE[c.name])}</td>
      <td><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a></td>
      <td>${esc(c.where)}</td><td class="num">${fmt(c.r_au, c.r_au < 10 ? 2 : 0)}</td>
      <td class="num">${delay(c.light_min)}</td><td class="num">${esc(c.launched)}</td><td>${esc(c.agency)}</td></tr>`).join('');
  return `
    <div class="table-wrap"><table>
      <thead><tr><th><span class="visually-hidden">Picture</span></th><th>Spacecraft</th><th>Where</th><th class="num">From the Sun (AU)</th>
        <th class="num">Signal delay</th><th class="num">Launched</th><th>Agency</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function showSpacecraft(updateHash = true, query = '') {
  selected = null;
  const token = ++selectToken, focus = craftFocus(query);
  title.textContent = focus ? focus.toUpperCase() : 'SPACECRAFT';
  info.innerHTML = '<p class="status">Loading positions…</p>';
  if (updateHash) history.replaceState(null, '', focus ? '#' + encodeURIComponent(query) : '#Spacecraft');
  loadCraft().then(data => {
    if (token !== selectToken) return;
    const rovers = data.rovers.map(r => `<li${r.name === focus ? ' class="focus"' : ''}>${spriteIcon(CRAFT_SPRITE[r.name])} <b><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></b>
      (${esc(r.agency)}): landed in ${esc(r.site)} on ${esc(r.landed)}${r.note ? `; ${esc(r.note)}` : ''}.</li>`).join('');
    info.innerHTML = `
      <p class="big">★ HUMANITY'S ROBOTS ★</p>
      <p>Where our spacecraft beyond Earth orbit were on <b>${esc(data.date)}</b>, from NASA JPL's Horizons system
         (the planets are frozen at their real positions that day too). White crosses on the drawing; press FIT to
         zoom out to the Voyagers, or TRUE SCALE and zoom into Earth to find the telescopes at L1 and L2.
         Satellites orbiting Earth are left out; try searching <b>ISS</b>.</p>
      ${focus ? `<p>Found <b>${esc(focus)}</b>: it's the yellow cross${
        data.rovers.some(r => r.name === focus) ? ' on Mars' : ''}, highlighted in the table, with its pixel art
        in the corner of the drawing.</p>` : ''}
      ${craftTable(data, focus)}
      <h3 class="facts-title">ON MARS</h3>
      <ul class="facts">${rovers}</ul>
      <p class="note">Signal delay = how long radio (light) takes to travel between Earth and the spacecraft ·
        sources: ${esc(data.source)}, NASA and ESA mission pages · pixel art drawn from official NASA images
        (and ESA's designs for JUICE and BepiColombo) · you found an easter egg!</p>`;
    paintSpriteIcons(info);
    const sc = buildScene({ ...SOLAR, planets: SOLAR.planets.map(p => ({ ...p, ecc: 0 })) });
    sc.planets.forEach((p, i) => {   // real positions on that date: ecliptic longitude, circular orbits
      const lon = data.planets[SOLAR.planets[i].name]?.lon ?? 0;
      Object.assign(p, { phase: lon * Math.PI / 180, cosw: 1, sinw: 0 });
    });
    sc.frozen = true;
    const gallery = [...data.spacecraft, ...data.rovers]
      .filter((c, i, all) => CRAFT_SPRITE[c.name] && all.findIndex(o => CRAFT_SPRITE[o.name] === CRAFT_SPRITE[c.name]) === i)
      .map(c => ({ name: c.name, key: CRAFT_SPRITE[c.name], label: c.name === 'Voyager 1' ? 'VOYAGER 1 AND 2' : c.name.toUpperCase() }));
    if (focus) {   // the second Voyager shares the first's sprite
      const own = gallery.find(g => g.name === focus) || { name: focus, key: CRAFT_SPRITE[focus] };
      Object.assign(own, { label: focus.toUpperCase() });
      if (!gallery.includes(own)) gallery.push(own);
    }
    sc.overlay = seconds => { drawCraft(sc, data.spacecraft, seconds, focus); drawCraftInset(gallery, focus, seconds); };
    sc.reach = () => Math.max(...data.spacecraft.map(c => screenRadius(sc, c.r_au)));
    setScene(sc);
  }, () => { if (token === selectToken) info.innerHTML = '<p>Spacecraft positions could not be loaded; check your connection.</p>'; });
}

// The station on its orbit, 11 x 5 pixels centred on (x, y): copper solar wings on the truss, modules
// in the middle (the full-size sprite is CRAFT_ART.iss, shown in the card's corner).
const ISS_SMALL = ['c.c.....c.c', 'C.C.....C.C', 'mmmmmmmmmmm', 'c.c.lwl.c.c', 'C.C.....C.C'];
function issSprite(ctx, x, y) {
  x = Math.round(x) - 5; y = Math.round(y) - 2;
  ISS_SMALL.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    ctx.fillStyle = CRAFT_INK[ch];
    ctx.fillRect(x + i, y + j, 1, 1);
  }));
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
  const station = (x, y) => issSprite(sctx, x, y);
  const [ix, iy, behind] = at(theta);
  const hidden = behind && Math.hypot(ix - cx, iy - cy) <= EARTH_R_PX + 1;
  orbit(true);
  if (behind && !hidden) station(ix, iy);
  solarPlanet(sctx, cx, cy, { art: 'earth', size: EARTH_R_PX, seed: 'iss', noMoon: true }, -0.9, -0.3, t * 0.4);
  orbit(false);
  if (!behind) station(ix, iy);
  if (!hidden) pixelText(sctx, 'ISS', Math.round(ix) + 7, Math.round(iy) - 8, '#ffd34d');
  drawCraftInset([{ name: 'ISS', key: 'iss', label: 'THE STATION' }], 'ISS', seconds);
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
