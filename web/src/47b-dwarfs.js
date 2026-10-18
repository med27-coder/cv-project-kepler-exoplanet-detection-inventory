// ---------------------------------------------------------------- easter eggs: the five dwarf planets
// Pluto, Ceres, Haumea, Makemake and Eris, the five the IAU recognises (docs/plans/WORLDS_MOONS_AND_SCREENS.md).
// Searching one opens a close-up: the world turning, its known moons on (not-to-scale) orbits, and a card of
// facts from NASA. Finding all five earns DWARF KING (48-gallery.js). Moon periods: NASA / JPL; Makemake's
// moon's period is still uncertain.
const DWARFS = {
  pluto: {
    name: 'Pluto', km: 2377, stretch: 1, art: (dx, dy, r, spin) => SOLAR_ART.pluto(dx, dy, r, spin),
    moons: [['CHARON', 6.387, '#9c958e', 2], ['STYX', 20.16, '#8f8a86', 1], ['NIX', 24.85, '#b5b0aa', 1],
            ['KERBEROS', 32.17, '#7f7a76', 1], ['HYDRA', 38.2, '#c2bdb6', 1]],
    url: `${NASA_SCIENCE}dwarf-planets/pluto/`,
    facts: [
      'Found by Clyde Tombaugh at Lowell Observatory in 1930, and counted as the ninth planet until 2006.',
      'About 2,377 km across, smaller than our Moon (3,475 km). It takes 248 years to circle the Sun, 30 to 49 times as far out as Earth.',
      'New Horizons flew past in July 2015 and found a heart-shaped plain of nitrogen ice (Tombaugh Regio) and mountains of water ice.',
      'Five moons. Charon is half Pluto\'s size, so the two circle a point in the space between them.',
    ],
  },
  ceres: {
    name: 'Ceres', km: 939, stretch: 1,
    art: (dx, dy, r, spin) => {   // grey, cratered, with Occator's bright salt spots turning into view
      const P = 4 * r + 2, u = (((dx + spin + P / 2) % P) + P) % P - P / 2;
      if (Math.hypot(u - r * 0.3, dy + r * 0.25) < Math.max(1, r * 0.09)) return '#ffffff';
      return hash(`ce${Math.floor((dx + spin) / 2)},${Math.floor(dy / 2)}`) < 0.22 ? '#6d6a66' : '#8f8b86';
    },
    moons: [],
    url: `${NASA_SCIENCE}dwarf-planets/ceres/`,
    facts: [
      'The first one found: Giuseppe Piazzi spotted it on 1 January 1801. It was called a planet, then an asteroid, and since 2006 a dwarf planet.',
      'About 940 km across, the largest object in the asteroid belt between Mars and Jupiter, and the only dwarf planet in the inner Solar System.',
      'NASA\'s Dawn orbited it from 2015 to 2018. The bright spots in Occator crater are salts (sodium carbonate) left behind by briny water from below.',
      'No known moons.',
    ],
  },
  haumea: {
    name: 'Haumea', km: 2322, stretch: 1.55,
    art: (dx, dy, r, spin) => {   // mottled grey-tan water ice (after NASA's Eyes on the Solar System), with its dark red spot
      const u = dx + spin * 0.7, lon = ((u % (4 * r)) + 4 * r) % (4 * r) - 2 * r;   // half a turn is on the far side
      if (Math.hypot(lon - r * 0.25, dy + r * 0.15) < r * 0.32) return hash(`hs${Math.floor(u)},${dy}`) < 0.3 ? '#8a6a5a' : '#7a5a4c';
      const m = hash(`ha${Math.floor(u / 2)},${Math.floor(dy / 2)}`);
      return m < 0.18 ? '#a39b8e' : m < 0.45 ? '#bdb5a8' : '#d2cbbf';
    },
    ring: '#a9a59c',
    // Hiʻiaka is the larger, farther moon; Namaka's orbit is tipped well away from Hiʻiaka's (the fifth value: tilt)
    moons: [['NAMAKA', 18.3, '#b8b2a8', 1, -0.55], ['HIIAKA', 49.5, '#dedad2', 2, 0.3]],
    url: `${NASA_SCIENCE}dwarf-planets/haumea/`,
    facts: [
      'It spins once every 3.9 hours, one of the fastest-spinning large objects known, which has stretched it into an egg about 2,300 km long and half as wide.',
      'A ring was discovered around it in 2017, when it passed in front of a star: the first ring found around a dwarf planet.',
      'Two moons, Hiʻiaka and Namaka, named after daughters of Haumea, the Hawaiian goddess of childbirth.',
      'Found in 2004 and 2005; credit is shared between teams in the United States and Spain. It takes about 284 years to circle the Sun.',
    ],
  },
  makemake: {
    name: 'Makemake', km: 1430, stretch: 1,
    art: (dx, dy, r, spin) => (hash(`mk${Math.floor((dx + spin) / 2)},${Math.floor(dy / 2)}`) < 0.3 ? '#9a5f45' : '#b97a58'),
    moons: [['MK2', 12.4, '#4a3a33', 1]],
    url: `${NASA_SCIENCE}dwarf-planets/makemake/`,
    facts: [
      'Found in 2005, shortly after Easter, by Mike Brown\'s team at Palomar Observatory, and named after Makemake, the creator god of Rapa Nui (Easter Island).',
      'About 1,430 km across, reddish-brown, with frozen methane on its surface. It takes about 305 years to circle the Sun.',
      'One small, dark moon, nicknamed MK2, spotted by the Hubble Space Telescope in 2016; its orbit is still uncertain (drawn here at about 12 days).',
    ],
  },
  eris: {
    name: 'Eris', km: 2326, stretch: 1,
    art: (dx, dy, r, spin) => (hash(`er${Math.floor((dx + spin) / 2)},${dy}`) < 0.15 ? '#d9d9de' : '#f4f4f6'),
    moons: [['DYSNOMIA', 15.79, '#8d8b88', 1]],
    url: `${NASA_SCIENCE}dwarf-planets/eris/`,
    facts: [
      'Found in 2005 (in pictures taken in 2003) by Mike Brown, Chad Trujillo and David Rabinowitz. A world about Pluto\'s size forced astronomers to define "planet": in 2006 the IAU did, and Pluto became a dwarf planet.',
      'About 2,326 km across, a little smaller than Pluto but about 27% more massive.',
      'One of the most reflective bodies in the Solar System, coated in frozen methane. Its orbit takes about 557 years and reaches more than twice as far out as Pluto\'s.',
      'One moon, Dysnomia, named after Eris\'s daughter in Greek myth, the spirit of lawlessness.',
    ],
  },
};
const DWARF_QUERY = /^(the )?(dwarf planet )?(pluto|ceres|haumea|makemake|eris)$/i;
const dwarfFor = q => { const m = DWARF_QUERY.exec(q); return m ? m[3].toLowerCase() : null; };

// A lit, possibly stretched (Haumea) pixel globe; the ring, if any, is split behind and in front.
function dwarfBody(ctx, x, y, r, d, lx, ly, t) {
  const x0 = Math.round(x), y0 = Math.round(y), sx = d.stretch, spin = REDUCED_MOTION ? 0 : t * 1.5;
  const ring = d.ring ? [r * sx * 1.6, r * 0.55, d.ring] : null;
  if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], false);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8) * sx);
    for (let dx = -w; dx <= w; dx++) {
      const lit = (dx / sx * lx + dy * ly) / (r + 0.5);
      const f = r < 8 ? (lit > 0.3 ? 1.15 : lit < -0.35 ? 0.45 : 0.9)
        : lit > 0.45 ? 1.12 : lit > 0.1 ? 1 : lit > -0.2 ? 0.85 : lit > -0.45 ? 0.62 : 0.42;
      ctx.fillStyle = shade(d.art(Math.round(dx / sx), dy, r, spin).toLowerCase(), f);
      ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }
  if (ring) planetRing(ctx, x0, y0, ring[0], ring[1], ring[2], true);
}

function drawDwarf(key, seconds) {
  const d = DWARFS[key], t = REDUCED_MOTION ? 0 : seconds;
  sctx.fillStyle = '#070b1a';
  sctx.fillRect(0, 0, SW, SH);
  for (let k = 0; k < 70; k++) {
    sctx.fillStyle = k % 7 ? '#1e2550' : '#4a5590';
    sctx.fillRect(Math.floor(hash('dw' + k) * SW), Math.floor(hash('dv' + k) * SH), 1, 1);
  }
  const cx = Math.round(SW / 2), cy = Math.round(SH / 2) - 6, r = 22, FLAT = 0.45;
  const reach = (d.ring ? r * d.stretch * 1.6 : r * d.stretch) + 7;   // moons circle outside the globe (and ring)
  const orbit = k => reach + 12 * k;
  const onGlobe = (x, y, pad = 1) => ((x - cx) / (r * d.stretch + pad)) ** 2 + ((y - cy) / (r + pad)) ** 2 < 1;
  const onOrbit = (k, a) => {   // a point on moon k's orbit; an orbit can be tilted (its fifth value, radians)
    const tilt = d.moons[k][4] || 0, ox = orbit(k) * Math.cos(a), oy = orbit(k) * FLAT * Math.sin(a);
    return [cx + ox * Math.cos(tilt) - oy * Math.sin(tilt), cy + ox * Math.sin(tilt) + oy * Math.cos(tilt)];
  };
  d.moons.forEach((m, k) => {   // dotted orbits, broken where the globe hides them
    sctx.fillStyle = '#26305e';
    for (let a = 0; a < 2 * Math.PI; a += 0.1) {
      const [x, y] = onOrbit(k, a);
      if (!(Math.sin(a) < 0 && onGlobe(x, y))) sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  });
  const placed = d.moons.map(([name, period, colour, size], k) => {
    const a = t * 2 / Math.sqrt(period) + hash(name) * 6.3, [x, y] = onOrbit(k, a);
    return { name, colour, size, x, y, behind: Math.sin(a) < 0 };
  });
  const moon = m => {
    if (m.behind && onGlobe(m.x, m.y)) return;   // hidden behind the world
    sctx.fillStyle = m.colour;
    sctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
    const w = textWidth(m.name), lx = Math.round(Math.min(Math.max(1, m.x + 3), SW - w - 1)), ly = Math.round(m.y - 7);
    if (!onGlobe(lx, ly + 2, 3) && !onGlobe(lx + w, ly + 2, 3)) pixelText(sctx, m.name, lx, ly, '#7f8ab8');   // never over the globe
  };
  placed.filter(m => m.behind).forEach(moon);
  dwarfBody(sctx, cx, cy, r, d, -0.8, -0.5, t);
  placed.filter(m => !m.behind).forEach(moon);
  const label = `${d.name.toUpperCase()} · ${fmt(d.km)} KM`.replace(' · ', ' - ');
  pixelText(sctx, label, 4, SH - 18, '#ffd34d');
  pixelText(sctx, d.moons.length ? 'MOON ORBITS NOT TO SCALE' : 'NO KNOWN MOONS', 4, SH - 10, '#5a6a8a');
}

function showDwarf(key, updateHash = true) {
  const d = DWARFS[key];
  selected = null;
  ++selectToken;
  title.textContent = d.name.toUpperCase();
  const others = Object.keys(DWARFS).filter(k => k !== key)
    .map(k => (progress.eggs[k] ? `<b>${esc(DWARFS[k].name)}</b>` : '???')).join(', ');
  info.innerHTML = `
    <p class="big">★ DWARF PLANET ★</p>
    <ul class="facts">${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p>The other dwarf planets: ${others}. Find all five for <b>DWARF KING</b>.</p>
    <p class="note">Source: <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">NASA: ${esc(d.name)}</a> ·
      the drawing is pixel art, not a photo · you found an easter egg!</p>`;
  setScene({ custom: seconds => drawDwarf(key, seconds) });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#' + d.name);
}
