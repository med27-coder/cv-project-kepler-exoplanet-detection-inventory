# Plan: the observable universe, in sectors (a zoom-out ladder, then the whole sky)

**Status: the ladder is built** (`web/src/56-universe.js`, 17 October 2026); the whole sky (section 3) is next.
Decisions: the UNIVERSE button swaps the map; 12 sky sectors; the secret is a flare that turns out to be the
"lost in orbit" astronaut (LOST IN ORBIT). The user chose both: **the zoom-out ladder first**, then **the whole sky in
sectors** as one of its steps. Ground rule, as everywhere: every number has a source, and illustrations are
labelled as illustrations.

## 1. How it works

A **UNIVERSE** button in the map's header (next to DEPTH) swaps the map for the sector view. The current map is
step 1, so nothing is lost.

- **◀ ▶ buttons and the arrow keys.** Left and right move to the next sector. In the whole-sky step they move
  around the sky.
- **↑ ↓ (and + −) zoom out and in** along the ladder: up is outward, toward the edge of the universe.
- A header shows where you are: `◀ SECTOR 3 / 6 · THE MILKY WAY ▶`, with the scale bar ("100,000 light-years
  across") and two or three plain facts.
- **"You are here"**: every step marks the Sun (or our galaxy) and, where it makes sense, where Kepler looked, so
  each step ties back to the map.
- Pixel art throughout, drawn by the one animation loop (it stops when idle), at the map's size, with a still
  version for reduced motion.

## 2. The ladder (six sectors)

| # | Sector | Size | What's drawn | Data |
|---|---|---|---|---|
| 1 | **Kepler's field** | the stars out to about 3,000+ light-years | the map as it is now | (as now) |
| 2 | **Our neighbourhood, the whole sky** | out to about 100 light-years, then the whole sky | the nearest stars (Proxima Centauri 4.2 ly, Barnard's Star 6 ly, Sirius 8.6 ly...) and every known planet's star, in sky sectors (section 3) | NASA `pscomppars` (positions, distances); Gaia |
| 3 | **The Milky Way** | about 100,000 light-years across | our galaxy from above: the bar, the arms, the Sun about 26,000 ly from the centre in the Orion Spur, and Kepler's narrow cone pointing along it toward Cygnus | published values (cited); reference `trophies/universe-milky-way.jpg` (NASA artist concept, labelled as one) |
| 4 | **The Local Group** | about 10 million light-years | the Milky Way, Andromeda (2.5 million ly), Triangulum, the Magellanic Clouds and the dwarf galaxies, at their real distances | McConnachie (2012) catalogue of nearby galaxies (VizieR) |
| 5 | **Our supercluster, Laniakea** | about 500 million light-years | the Virgo Cluster and the galaxy flows that define Laniakea, with the Local Group as a dot | Tully et al. (2014), *Nature*; drawn as a labelled illustration |
| 6 | **The observable universe** | about 93 billion light-years across | the cosmic web, then the oldest light (the cosmic microwave background) at the edge; the universe is 13.8 billion years old | Planck (2018) values; ties into the universe cup |

Accuracy notes: distances to galaxies and supercluster sizes carry real uncertainty (the plan quotes rounded,
sourced values: "about"). The 93-billion-light-year width is because space has expanded while light travelled;
the sector says so in one line.

## 3. The whole sky in sectors (step 2)

- The sky split into **12 sectors**: 6 slices around the sky (4 hours of right ascension each), north and south.
  Each is named after its best-known constellations ("CYGNUS & LYRA" holds Kepler's field).
- In each sector: **every star with a known planet** from NASA's table (6,451 planets around 4,847
  stars (NASA, 17 October 2026), from every mission: Kepler, K2, TESS, ground surveys). Colour by how it was found (transit, wobble,
  imaging, microlensing), with a legend. Kepler's own field is outlined.
- Click a star for a small card (name, distance, planets, how they were found, discovery year). Kepler systems
  open in the main view as now.
- Data: a new export step writes `web/data/allsky.js` (positions, distance, planet count, method, year),
  loaded only when the universe view opens; within the site's size budget.

## 4. Achievements and easter eggs

- **COSMIC ZOOM**: visit all six sectors of the ladder.
- **ALL-SKY SURVEY**: visit all 12 sky sectors.
- **NEIGHBOURS**: open Proxima Centauri b, the nearest known exoplanet.
- **EDGE OF EVERYTHING** (secret, universe cup): zoom past the observable universe's edge and find... a joke to
  pick together (e.g. "LOST IN ORBIT" floats by, or the map loops back to Kepler).
- New ids are added to `SHIPPED_IDS`.

## 5. Checks

- Tests: the ladder's buttons and keys move one sector at a time; the whole-sky export contains Kepler-90,
  Proxima Centauri and TRAPPIST-1 at the right positions; every sector has a source line.
- An independent data check (a fresh agent), as for HIGHLIGHTS.md: it recomputes the sky export from NASA's table
  and checks every quoted number against its source.

## 6. Build order

1. The sector viewer (button, ◀ ▶ ↑ ↓, header, scale bar) with sectors 1, 3 and 6 (art and cited facts).
2. Sectors 4 and 5 (Local Group from McConnachie's catalogue; Laniakea illustration).
3. The whole sky (export, 12 sky sectors, cards).
4. Achievements, tests, the data check; concept art first for the Milky Way, the Local Group and the edge.

## 7. Decisions (answered 17 October 2026)

1. The UNIVERSE button swaps the map.
2. 12 sky sectors.
3. The secret: a flare drifts across the universe view now and then; catch it and it's the "lost in orbit"
   astronaut (LOST IN ORBIT, a secret achievement). Concept: `pixel-art/concepts/draft_universe_lost_in_orbit.png`.
