# Star map data dictionary

The files the Kepler Star Map loads from `web/data/`. All are generated; never edit them by hand.

## `systems.js`: the index (loaded up front, ~260 KB)

`window.STARMAP = {...}`, written by `scripts/starmap/export_starmap.py`.

| Key | Meaning |
|---|---|
| `source`, `exported` | Data sources and export date (UTC) |
| `scored`, `sg_threshold` | Whether Star Gazer scores were available; its decision threshold (probability) |
| `columns` | Names of the fields in each `stars` row (below) |
| `tags` | Bit values used in the `tags` column: `hz` 1, `earth` 2, `multi` 4, `giant` 8, `tess` 16, `unscored` 32, `twosuns` 64 (planets circling both stars of a binary) |
| `chunks` | Number of details files (32) |
| `spotlight` | Featured systems (quick-pick buttons, twinkling gold pixels) |
| `aliases` | NASA's catalogue names (KIC, 2MASS, KOI numbers) of systems shown by their Kepler names: lower-case name -> shown name |
| `leaderboard` | `top` and `hz`: the "next planets" lists (candidate, system, combined score, NASA and Star Gazer scores, radius) |
| `stars` | One row per star with a CONFIRMED or CANDIDATE KOI |

**`stars` row fields**

| Field | Unit / values | Source |
|---|---|---|
| `name` | System name (`Kepler-90`, else `KOI-351`) | NASA KOI table |
| `kepid` | Kepler Input Catalog ID | KOI table |
| `koi` | KOI host number (351 for K00351.xx) | KOI table |
| `ra`, `dec` | Degrees (J2000) | KOI table |
| `kepmag` | Kepler magnitude | KOI table |
| `spot` | 1 if a spotlight system | export |
| `drawn` | 1 if it has a confirmed planet or a Star Gazer-scored candidate; 0 = unconfirmed only | export |
| `kois` | Number of KOIs on the star | KOI table |
| `sg` | Highest Star Gazer probability among its candidates, or null | `results/v3/candidates.csv` |
| `np`, `nconf` | Planets drawn (all kinds), confirmed planets | export |
| `tags` | Highlight bits (see `tags` above) | export |
| `chunk` | Which `details/NN.js` holds the system | hash of the name |
| `dist` | Distance in parsecs, or null | NASA `pscomppars`, else Gaia (Berger 2020) |

## `details/NN.js`: per-system details (loaded on demand, ~45 KB each)

`window.STARMAP_DETAILS(NN, {name: system, ...})`.

**System**: `kepid`, `teff` (K), `srad` (solar radii), `kepmag`, `ra`, `dec`, `smass` (solar masses),
`age` (Gyr, Gaia isochrones), `met` ([Fe/H]), `logg` (cgs), `dist_pc`, `nstars` (if > 1), `cb` (true: the planets circle both stars, NASA's `cb_flag`), `extra` (true: a system
Kepler found outside the KOI list; its star and planets come only from NASA's confirmed-planet table, and its `kois` is 0),
`spectype`, `host` (NASA's host name, for its overview page), `planets` (list).

**Planet**

| Field | Unit / values |
|---|---|
| `name`, `koi` | Planet name; KOI name (or the planet name for non-KOI planets) |
| `status` | `confirmed`, `candidate`, or `other` (found by another method; `method` says which) |
| `radius` | Earth radii |
| `period` | Days |
| `sma` | Orbit size, AU (catalog, else Kepler's third law) |
| `teq` | Equilibrium temperature, K |
| `insol` | Sunlight received, Earth = 1 |
| `mass`, `mass_kind` | Earth masses; `measured` or `estimated` (mass-radius relation) |
| `year` | Discovery year |
| `ecc`, `w` | Orbital eccentricity; argument of periastron (degrees) |
| `toi` | TESS Object of Interest that re-detected it (period within 1%) |
| `sg`, `sg_planet` | Star Gazer probability; whether it is above the threshold |
| `cg` | Giant candidates only: Colossus 2's probability (EXPERIMENTAL, not adopted; threshold 0.5), blended with Star Gazer between 6 and 10 Earth radii |
| `nasa`, `snr`, `flags` | Candidates only: NASA's vetting score (`koi_score`), signal-to-noise, NASA false-positive flags |

## Other files

| File | Content | Written by |
|---|---|---|
| `spacecraft.js` | `window.STARMAP_SPACECRAFT`: date, planets' and spacecraft's heliocentric ecliptic positions (AU, longitude), distance and light time from Earth, mission facts, Mars rover landing sites | `scripts/starmap/fetch_spacecraft.py` (JPL Horizons) |
| `ccd.js` | `window.STARMAP_CCD`: 21 polygons (RA, Dec corners) of Kepler's CCD modules | `scripts/starmap/make_ccd_footprint.py` (K2fov) |
| `../sky.png` | Map background: Gaia DR3 colour map in the map's projection, 192×192, 9-colour palette | `scripts/starmap/make_sky_backdrop.py` |
| `../sky/*.jpg` | 40×40 DSS2 / Pan-STARRS1 / 2MASS photos for the 14 spotlight systems | `scripts/starmap/make_sky_thumbs.py` |
| `../og.png` | Link preview image (1200×630) | `scripts/starmap/make_readme_media.py` (fallback: `make_og_image.py`) |
