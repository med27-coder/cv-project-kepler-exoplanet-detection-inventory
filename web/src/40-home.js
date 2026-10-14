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
    ['Pluto', 0.186, 0.0022, 90560, 39.48, 0.249, 1930, 2],   // a dwarf planet since 2006
  ].map(([name, radius, mass, period, sma, ecc, year, sprite]) => ({
    name, koi: 'Sol ' + name, status: 'confirmed', radius, mass, mass_kind: 'measured', period, sma, ecc,
    teq: Math.round(255 / Math.sqrt(sma)), insol: 1 / sma ** 2, year, sprite,
    art: name.toLowerCase(),
    url: `${NASA_SCIENCE}${name === 'Pluto' ? 'dwarf-planets/' : ''}${name.toLowerCase()}/`,
    note: name === 'Earth' ? 'home ★' : name === 'Pluto' ? 'dwarf planet' : 'planet',
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
  earth: (dx, dy, r, spin) => earthSurface(dx, dy, r, spin),
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
  pluto: (dx, dy, r, spin) => {   // the bright "heart" (Tombaugh Regio) next to dark Cthulhu
    const P = 4 * r + 2, u = (((dx + spin + P / 2) % P) + P) % P - P / 2;   // longitude, turning with the planet
    const h = r * 0.42, x = Math.abs(u) / h, y = dy / h - 0.15;      // heart: two lobes and a point
    if ((x - 0.45) ** 2 + (y + 0.25) ** 2 < 0.36 || (y >= -0.25 && x + y * 0.75 < 0.8)) return '#f2ece2';
    if (((u + h * 2.4) / (h * 1.2)) ** 2 + ((dy - r * 0.15) / (r * 0.3)) ** 2 < 1) return '#6e4f3c';   // Cthulhu
    return hash(`pl${Math.floor((dx + spin) / 2)},${dy}`) < 0.2 ? '#bb9d78' : '#d1b48e';
  },
  neptune: (dx, dy, r) => {
    if (Math.abs(dx + Math.round(r * 0.3)) <= 1 && dy === -Math.round(r * 0.3)) return '#1c357a';   // dark spot
    return dy % 2 === 0 ? '#3b6bd6' : '#335fc4';
  },
};

// Earth: NASA's Blue Marble as a 128 x 64 pixel map (data/earth.js, scripts/starmap/make_earth_map.py)
// wrapped onto a globe tipped by its 23.4° axial tilt, turning west to east, with a few drifting
// clouds. `spin` is in pixels, so the surface moves at the same speed as on the other planets.
const EARTH_MAP = window.STARMAP_EARTH || null;
const EARTH_TILT = 23.4 * Math.PI / 180, EARTH_LON0 = 0.3;   // start over Africa and Europe
function earthSurface(dx, dy, r, spin) {
  if (!EARTH_MAP) return '#2a5fbf';
  const R = r + 0.5, c = Math.cos(EARTH_TILT), s = Math.sin(EARTH_TILT);
  const x = (dx * c + dy * s) / R, y = (dy * c - dx * s) / R;   // undo the tilt
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  const lat = Math.asin(clamp(-y, -1, 1)), turn = Math.atan2(x, z);
  const lon = turn + EARTH_LON0 - spin / R;
  const { width: W, height: H, rows, colors } = EARTH_MAP;
  const row = clamp(Math.floor((0.5 - lat / Math.PI) * H), 0, H - 1);
  const cloudLon = lon + spin / R * 0.35;   // weather drifts a little against the ground
  const cell = Math.floor(((cloudLon / (2 * Math.PI)) % 1 + 1) % 1 * 48);
  if (hash(`cl${cell >> 1},${row >> 2}`) < 0.14 && hash(`cm${cell},${row >> 1}`) < 0.55) return '#f4f8ff';
  const col = Math.floor((((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1 * W);
  return colors[rows[row][col]] || '#2a5fbf';
}

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
      const f = r < 8 ? (lit > 0.3 ? 1.15 : lit < -0.35 ? 0.45 : 0.9)   // small: three clear steps
        : lit > 0.45 ? 1.12 : lit > 0.1 ? 1 : lit > -0.2 ? 0.85 : lit > -0.45 ? 0.62 : 0.42;   // big: a softer terminator
      ctx.fillStyle = shade(art(dx, dy, r, spin).toLowerCase(), f);
      ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }
  if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], true);
  if (!p.noMoon) solarMoons(ctx, x0, y0, r, p.art, t);
}

// The best-known moons, nearest first: [name, orbital period (days), colour]. A negative period
// orbits backwards (Triton). Drawn as 1-pixel dots, evenly spaced outside the planet (and its
// rings), turning at a compressed speed like the planets; Uranus's moons circle its sideways
// equator. Distances are not to scale.
const MOONS = {
  earth: [['Moon', 27.32, '#c9c6c0']],
  mars: [['Phobos', 0.319, '#8a7d70'], ['Deimos', 1.263, '#a39484']],
  jupiter: [['Io', 1.769, '#e8d36a'], ['Europa', 3.551, '#efe6d2'], ['Ganymede', 7.155, '#a89e90'],
            ['Callisto', 16.69, '#6f665c']],
  saturn: [['Enceladus', 1.370, '#ffffff'], ['Rhea', 4.518, '#cfcac2'], ['Titan', 15.95, '#e0a84a'],
           ['Iapetus', 79.33, '#9a8f80']],
  uranus: [['Miranda', 1.413, '#b8b4ae'], ['Ariel', 2.520, '#c8c4bd'], ['Umbriel', 4.144, '#86827c'],
           ['Titania', 8.706, '#bdb3a8'], ['Oberon', 13.46, '#a89c90']],
  neptune: [['Triton', -5.877, '#e4c8c0']],
  pluto: [['Charon', 6.387, '#9c958e']],
};
function solarMoons(ctx, x0, y0, r, art, t) {
  const moons = MOONS[art];
  if (!moons) return;
  const start = art === 'saturn' ? Math.ceil(r * 2.2) + 1 : r + 2;   // Saturn's start outside the rings
  const time = REDUCED_MOTION ? 1 : t;
  moons.forEach(([name, period, color], k) => {
    const d = start + 2 * k + (art === 'earth' ? 1 : 0);
    const a = Math.sign(period) * time * (2 * Math.PI) / (1.5 * Math.sqrt(Math.abs(period))) * 4 + hash(name) * 6.3;
    const [x, y] = art === 'uranus'
      ? [x0 + d * 0.3 * Math.cos(a), y0 + d * Math.sin(a)]
      : [x0 + d * Math.cos(a), y0 + d * TILT * Math.sin(a)];
    const behind = (art === 'uranus' ? Math.cos(a) : Math.sin(a)) < 0;
    if (behind && Math.hypot(x - x0, y - y0) < r + 0.5) return;   // hidden behind the planet
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  });
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
    <h3 class="facts-title">MOONS</h3>
    <p>The coloured dots around the planets are their best-known moons (distances not to scale):</p>
    <ul class="facts">
      <li><b>Earth</b>: the Moon. <b>Mars</b>: Phobos and Deimos, small and potato-shaped.</li>
      <li><b>Jupiter</b> (95+ moons): the four Galilean moons found by Galileo in 1610: volcanic <b>Io</b>,
        <b>Europa</b> with an ocean under its ice, <b>Ganymede</b>, the largest moon in the Solar System, and
        <b>Callisto</b>.</li>
      <li><b>Saturn</b> (the most, 274): <b>Titan</b>, with a thick orange atmosphere and lakes of methane;
        <b>Enceladus</b>, spraying water from its south pole; <b>Rhea</b>; and two-toned <b>Iapetus</b>.</li>
      <li><b>Uranus</b> (29): <b>Miranda, Ariel, Umbriel, Titania and Oberon</b>, named after characters from
        Shakespeare and Pope; they circle its sideways-tipped equator.</li>
      <li><b>Neptune</b> (16): <b>Triton</b> orbits backwards, probably a captured Kuiper Belt object.</li>
      <li><b>Pluto</b> (5): <b>Charon</b>, plus tiny Nix, Hydra, Kerberos and Styx.</li>
      <li>Moon counts as listed by NASA in 2025; new small moons keep being found.
        Mercury and Venus have none.</li>
    </ul>
    <h3 class="facts-title">BEYOND THE PLANETS</h3>
    <ul class="facts">
      <li><b>Asteroid belt</b> (grey dots): between Mars and Jupiter. All asteroids together weigh less than
        our Moon; the largest asteroid, Vesta, is about 530 km across.</li>
      <li><b>Dwarf planets</b>: Ceres (in the asteroid belt, the only one in the inner Solar System), Pluto,
        Haumea, Makemake and Eris.</li>
      <li><b>Pluto</b> (drawn, with its moon Charon): found by Clyde Tombaugh in 1930 and counted as the ninth
        planet until 2006, when the IAU defined "planet" and Pluto became a dwarf planet: it hasn't cleared
        its orbit of other Kuiper Belt objects. Smaller than our Moon, with a nitrogen-ice "heart" that
        New Horizons photographed in July 2015. Charon is half Pluto's size, so the two circle a point
        between them.</li>
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
      link(`${NASA_SCIENCE}solar-system/moons/`, 'NASA: moons'),
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

let selectToken = 0;   // a slow chunk load must not overwrite a newer selection
function select(s, updateHash = true) {
  selected = s;
  const token = ++selectToken;
  withDetail(s, detail => {
    if (token !== selectToken) return;
    if (s[COL.drawn]) showSystem(s, detail); else showUnconfirmed(s, detail);
  }, () => { if (token === selectToken) showSoon(s); });
  if (token === selectToken && !DETAILS.has(s[COL.name])) {   // still loading
    title.textContent = s[COL.name].toUpperCase();
    info.innerHTML = '<p class="status">Loading…</p>';
  }
  keepInView(s);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', String(c.dataset.name === s[COL.name])));
  if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(s[COL.name]));
}

function lookup(query, updateHash = true) {
  query = String(query).slice(0, MAX_QUERY);
  if (!query.trim()) return;
  if (HOME_QUERY.test(query.trim())) { showHome(updateHash); return; }
  if (ISS_QUERY.test(query.trim())) { showISS(updateHash); return; }
  if (KEPLER_QUERY.test(query.trim())) { showKepler(updateHash); return; }
  if (CRAFT_QUERY.test(query.trim())) { showSpacecraft(updateHash, query.trim()); return; }
  const s = find(query);
  if (s) select(s, updateHash); else showUnknown(query);
}
