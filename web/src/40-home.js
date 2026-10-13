// ---------------------------------------------------------------- easter egg: home
// Our own Solar System, drawn by the same engine with hand-made pixel art (we know what these
// planets look like). Not on the map (the map is the view from here) and not in the type-ahead:
// search "Sun", "Solar System", "Earth" or "home" to find it.
// Values: NASA Planetary Fact Sheet. Temperatures are equilibrium temperatures worked out the
// way the Kepler catalog does (Bond albedo 0.3: 255 K / sqrt(AU)), so colours compare fairly.
const HOME_QUERY = /^(the )?(sun|sol|solar system|earth|home|you are here)$/i;
const NASA_SCIENCE = 'https://science.nasa.gov/';
const SOLAR = {
  home: true, teff: 5772, srad: 1, smass: 1, age: 4.6, met: 0, spectype: 'G2 V',
  planets: [
    // name, radius (Earths), mass (Earths), period (d), a (AU), e, found, sprite radius (px)
    ['Mercury', 0.383, 0.0553, 87.97, 0.387, 0.206, 'antiquity', 2],
    ['Venus', 0.949, 0.815, 224.7, 0.723, 0.007, 'antiquity', 2],
    ['Earth', 1, 1, 365.25, 1, 0.017, 'here', 3],
    ['Mars', 0.532, 0.107, 687.0, 1.524, 0.094, 'antiquity', 2],
    ['Jupiter', 11.21, 317.8, 4331, 5.203, 0.049, 'antiquity', 6],
    ['Saturn', 9.45, 95.2, 10747, 9.537, 0.052, 'antiquity', 5],
    ['Uranus', 4.01, 14.5, 30589, 19.19, 0.047, 1781, 4],
    ['Neptune', 3.88, 17.1, 59800, 30.07, 0.010, 1846, 4],
  ].map(([name, radius, mass, period, sma, ecc, year, sprite]) => ({
    name, koi: 'Sol ' + name, status: 'confirmed', radius, mass, mass_kind: 'measured', period, sma, ecc,
    teq: Math.round(255 / Math.sqrt(sma)), insol: 1 / sma ** 2, year, sprite,
    art: name.toLowerCase(), url: `${NASA_SCIENCE}${name.toLowerCase()}/`,
    note: name === 'Earth' ? 'home ★' : 'planet',
  })),
  // drawn as drifting dots; edges are approximate
  belts: [
    { name: 'asteroid belt', a0: 2.2, a1: 3.2, n: 170, color: '#8c8475' },
    { name: 'Kuiper Belt', a0: 30, a1: 50, n: 240, color: '#56708f' },
  ],
};

// Pixel colour of each Solar System planet at (dx, dy) on a disc of radius r; `spin` (pixels)
// scrolls surface features sideways so the planet turns.
const SOLAR_ART = {
  mercury: (dx, dy, r, spin) => (hash(`me${Math.floor(dx + spin)},${dy}`) < 0.25 ? '#6f6a66' : '#9c9792'),
  venus: (dx, dy, r, spin) => (hash(`ve${Math.floor((dx + spin) / 2)},${dy}`) < 0.3 ? '#d4c08a' : '#eadcaf'),
  earth: (dx, dy, r, spin) => {
    if (Math.abs(dy) >= r) return '#eef6ff';                               // ice caps
    const x = Math.floor((dx + spin) / 2), y = Math.floor((dy + r) / 2);
    if (hash(`cl${Math.floor(dx + spin * 1.6)},${dy}`) < 0.1) return '#ffffff';   // clouds
    const land = hash(`la${((x % 9) + 9) % 9},${y}`);
    return land < 0.32 ? '#4f9a46' : land < 0.42 ? '#a98b55' : '#2f6fd0';    // forest, desert, ocean
  },
  mars: (dx, dy, r, spin) => {
    if (dy <= -r) return '#f3ede4';                                         // north polar cap
    return hash(`ma${Math.floor((dx + spin) / 2)},${dy}`) < 0.3 ? '#8e3d22' : '#c45a32';
  },
  jupiter: (dx, dy, r, spin) => {
    const span = 4 * r, spot = ((spin * 0.7) % span + span) % span - 2 * r;   // Great Red Spot drifts across
    if (dy === Math.round(r * 0.4) && Math.abs(dx - spot) <= 1) return '#c4533a';
    return ['#f0e3c4', '#c9a473', '#e6d3a8', '#a8774c', '#efe0bd'][Math.floor((dy + r) / (2 * r + 1) * 5)];
  },
  saturn: (dx, dy, r) => ['#eadcab', '#d3b77c', '#e6d09a', '#c9ab72'][Math.floor((dy + r) / (2 * r + 1) * 4)],
  uranus: (dx, dy, r) => (dy % 3 === 0 ? '#98d6dc' : '#ace6eb'),
  neptune: (dx, dy, r) => {
    if (Math.abs(dx + Math.round(r * 0.3)) <= 1 && dy === -Math.round(r * 0.3)) return '#1c357a';   // dark spot
    return dy % 2 === 0 ? '#3b6bd6' : '#335fc4';
  },
};

// Rings as dotted ellipses around the planet: the far half before the planet, the near half after.
function planetRing(ctx, x, y, rx, ry, color, near) {
  ctx.fillStyle = color;
  const n = Math.round(rx * 7);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    if ((Math.sin(a) > 0) !== near) continue;
    ctx.fillRect(Math.round(x + rx * Math.cos(a)), Math.round(y + ry * Math.sin(a)), 1, 1);
  }
}

function solarPlanet(ctx, x, y, p, lx, ly, t) {
  const r = p.size, x0 = Math.round(x), y0 = Math.round(y), art = SOLAR_ART[p.art];
  const spin = REDUCED_MOTION ? 0 : t * (p.art === 'jupiter' || p.art === 'saturn' ? 3 : 1.5);
  const ring = p.art === 'saturn' ? [r * 2.2, r * 0.75, '#d9c79a'] : p.art === 'uranus' ? [r * 0.5, r * 1.7, '#7fb5ba'] : null;
  if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], false);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    for (let dx = -w; dx <= w; dx++) {
      const lit = (dx * lx + dy * ly) / (r + 0.5);
      ctx.fillStyle = shade(art(dx, dy, r, spin).toLowerCase(), lit > 0.3 ? 1.15 : lit < -0.35 ? 0.45 : 0.9);
      ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }
  if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], true);
  if (p.art === 'earth') {   // the Moon, once every 27.3 days
    const a = (REDUCED_MOTION ? 1 : t) * (2 * Math.PI) / (1.5 * Math.sqrt(27.3)) * 4;
    ctx.fillStyle = '#c9c6c0';
    ctx.fillRect(Math.round(x0 + (r + 3) * Math.cos(a)), Math.round(y0 + (r + 3) * TILT * Math.sin(a)), 1, 1);
  }
}

function homeFacts() {
  const link = (path, text) => `<a href="${esc(path)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
  return `
    <h3 class="facts-title">THE SUN</h3>
    <ul class="facts">
      <li><b>Names:</b> officially just <b>the Sun</b> (the IAU asks for a capital S, like Earth and Moon);
        <b>Sol</b> in Latin, which gives us "solar"; <b>Helios</b>, the Sun god of ancient Greece;
        astronomers' symbol <b>☉</b>.</li>
      <li>A G2 V yellow dwarf, about 4.6 billion years old.</li>
      <li>Holds 99.8% of the Solar System's mass: more than 330,000 Earths.</li>
      <li>About 1.4 million km across; about 5,500 °C at the surface and 15 million °C in the core.</li>
      <li>About 150 million km from Earth: its light takes 8 minutes 20 seconds to reach us.</li>
      <li>Carries us once around the Milky Way every ~230 million years.</li>
    </ul>
    <h3 class="facts-title">BEYOND THE PLANETS</h3>
    <ul class="facts">
      <li><b>Asteroid belt</b> (grey dots): between Mars and Jupiter. All asteroids together weigh less than
        our Moon; the largest asteroid, Vesta, is about 530 km across.</li>
      <li><b>Dwarf planets</b>: Ceres (in the asteroid belt, the only one in the inner Solar System), Pluto,
        Haumea, Makemake and Eris.</li>
      <li><b>Kuiper Belt</b> (blue dots, zoom out or FIT): a doughnut of icy worlds beyond Neptune, home to Pluto
        and most dwarf planets, possibly millions of objects. New Horizons flew past Arrokoth there on
        1 January 2019.</li>
      <li><b>Heliosphere</b>: the bubble blown by the solar wind. Voyager 1 crossed its edge into interstellar
        space in 2012, Voyager 2 in 2018.</li>
      <li><b>Oort Cloud</b>: thought to lie far beyond the Kuiper Belt, the source of long-period comets.
        It has never been imaged directly.</li>
    </ul>
    <p class="note">Official sources: ${[
      link(`${NASA_SCIENCE}solar-system/`, 'NASA: Solar System'),
      link(`${NASA_SCIENCE}sun/facts/`, 'NASA: Sun facts'),
      link('https://nssdc.gsfc.nasa.gov/planetary/factsheet/', 'NASA Planetary Fact Sheet'),
      link(`${NASA_SCIENCE}solar-system/asteroids/`, 'NASA: asteroids'),
      link(`${NASA_SCIENCE}dwarf-planets/`, 'NASA: dwarf planets'),
      link(`${NASA_SCIENCE}solar-system/kuiper-belt/`, 'NASA: Kuiper Belt'),
      link(`${NASA_SCIENCE}solar-system/oort-cloud/`, 'NASA: Oort Cloud'),
      link(`${NASA_SCIENCE}mission/voyager/`, 'NASA: Voyager'),
      link('https://ssd.jpl.nasa.gov/', 'JPL Solar System Dynamics'),
      link('https://iauarchive.eso.org/public/naming/', 'IAU: naming'),
    ].join(' · ')}</p>`;
}

function showHome(updateHash = true) {
  selected = null;
  title.textContent = 'THE SOLAR SYSTEM';
  info.innerHTML = `
    <p class="big">★ YOU ARE HERE ★</p>
    <p>Our own system, about 26,700 light-years from the centre of the Milky Way. It isn't a pixel on
       the map because the map <em>is</em> the view from here: Kepler, trailing Earth around the Sun,
       stared at one patch of Cygnus and Lyra, and every star you can click is hundreds to thousands of
       light-years down that line of sight. Seen from Kepler-90, Earth would dim the Sun by just 0.008%
       for 13 hours once a year, so small that a Kepler looking back at us would most likely miss it.</p>
    ${planetTable(SOLAR)}
    ${homeFacts()}
    <p class="note">Found: known since antiquity, or the year it was discovered by telescope ·
      temperatures as the Kepler catalog would list them (no greenhouse effect: Venus is really
      ~464 °C) · planet sizes on the drawing are exaggerated; try TRUE SCALE to see how empty it
      really is · you found the easter egg!</p>`;
  setScene(buildScene(SOLAR));
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#Sun');
}

function select(s, updateHash = true) {
  selected = s;
  const detail = SYSTEMS[s[COL.name]];
  if (detail) showSystem(s, detail); else showSoon(s);
  keepInView(s);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', String(c.dataset.name === s[COL.name])));
  if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(s[COL.name]));
}

function lookup(query, updateHash = true) {
  query = String(query).slice(0, MAX_QUERY);
  if (!query.trim()) return;
  if (HOME_QUERY.test(query.trim())) { showHome(updateHash); return; }
  const s = find(query);
  if (s) select(s, updateHash); else showUnknown(query);
}
