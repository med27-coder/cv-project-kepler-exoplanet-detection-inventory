# 🗺️ Star Map: roadmap

**Goal:** a public web page with a pixelated map of the Kepler field. Visitors type a star system (or click a pixel) and the system pops up as small pixel art: the star, its planets and their orbits. Some systems are fully drawn; the rest show a *"Soon to cross the stars"* message until they are added.

Constraints:

- **Free to run.** Static files only (no server, no subscription). Hosted on GitHub Pages.
- **Light.** No image files per system: every system is drawn on a small canvas from a few numbers (star temperature and radius; planet radius, period, orbit size and temperature). About 1 MB of data for all 3,600 stars (much less over the wire, since Pages compresses it).
- **Real data only.** Everything shown comes from the NASA Exoplanet Archive and Star Gazer's own scores, exported by a script. Nothing is typed in by hand.

Status key: `[x]` done · `[ ]` to do · `[~]` started.

---

## Phase 1: Foundations (static page, real data) ✅

- [x] Roadmap (this file)
- [x] `scripts/export_starmap.py`: NASA tables → `web/data/systems.js`
- [x] `web/index.html` + `web/starmap.js` + `web/style.css`
  - pixel map of the Kepler field (RA/Dec); spotlight systems twinkle
  - search: `Kepler-90`, `KOI-351`, `K00351.01` or a Kepler ID; shareable links (`#Kepler-90`)
  - drawn system → animated pixel system + planet table
  - known but not drawn → *"Soon to cross the stars"*; unknown → "no signal"
- [x] Opens straight from disk (data is a `.js` file, so no local server is needed)
- [x] Tests (`tests/test_export_starmap.py`)

## Phase 2: Backend rework (the model behind the map)

- [x] Fix the 10 code-review findings: stale-model check in the HF Space builder, lazy saliency batches,
      figures closed in the app, mixed-channel ensembles, wrap padding when duration ≥ half the period,
      `--allow-stale` in `score_candidates.py`, shared input/catalog helpers, row counting, test `sys.path` leak
- [~] Rebuild all views with recipe v3 (`build_full_dataset.py`, then `--candidates`), running
- [ ] Full training: `train_star_gazer.py --diagnostics --ensemble 5`
- [ ] Grouped 5-fold CV (`cross_validate.py`) and candidate scoring (`score_candidates.py`)
- [ ] Encrypt the model and detailed results (`secure_artifacts.py`), back up the key
- [ ] Fill in the README's V3 numbers and the version-progress chart

## Phase 3: Connect the model to the map

- [x] Export reads Star Gazer's candidate scores (`results/v3/candidates.csv`) when present; scores only, never the model
- [x] Candidate-only stars on the map coloured by Star Gazer's verdict (likely planet / likely false positive)
- [x] Candidate rows in the system table show Star Gazer's score next to NASA's status
- [ ] Re-run `export_starmap.py` after `score_candidates.py` (Phase 2) so the scores go live
- [ ] Optional: a small light-curve sparkline per planet (the 201-bin local view, ~1 KB)

## Phase 4: Grow the drawn systems ✅

- [x] Every system with a confirmed planet is drawn (1,975), not only a curated list
- [x] Candidate-only systems are drawn once scored; "Soon to cross the stars" only for unscored ones
- [x] Data stays under ~1.5 MB (warning in the export script if it grows past that)

## Phase 5: Publish

- [x] `.github/workflows/pages.yml` deploys `web/` to GitHub Pages on every push to `main` that changes it
- [x] Star map section and link in README.md
- [x] Credits footer: NASA Exoplanet Archive, Kepler mission
- [ ] **One-time (you):** GitHub repo → Settings → Pages → Source: **GitHub Actions**
- [ ] Commit + push, then check <https://med27-coder.github.io/cv-project-kepler-exoplanet-detection-inventory/>

## Phase 6: Polish

- [x] Keyboard navigation on the map (arrow keys jump to the nearest star in that direction)
- [x] Habitable-zone ring in the system view (approximate, from star temperature and radius)
- [x] Planet masses (measured or estimated), distance in light-years, discovery year
- [x] Planets NASA lists that are not KOIs (radial velocity, timing, later transit searches), drawn as ◆
- [x] Real sky: a 32×32 pixelated photo of the sky around each star (DSS2 via CDS hips2fits, fetched
      live, ~1 KB, nothing stored) + a "See the real sky" link to Aladin Lite
- [x] Zoom on the map (see Phase 6b)
- [ ] Retro sound toggle (off by default)

## Phase 6b: Make it easier and more fun to explore ✅

Ordered by value for visitors. Everything runs in the browser from the data already exported.

- [x] **Map zoom and pan**: zoom buttons (1×, 2×, 4×) and mouse wheel; drag to pan; zoom follows the selected star
- [x] **Type-ahead search**: suggestions as you type (names, KOI numbers), arrow keys + Enter to pick
- [x] **Highlights**: toggles that light up matching stars on the map: *habitable zone*, *Earth-sized*,
      *5+ planets*, *giant planets*; each shows how many systems match
- [x] **Surprise me**: jump to a random drawn system
- [x] **Share-ready**: favicon, and a social preview image (`og:image`) generated from the real map data
- [x] **Guardrails**: CI checks the page's JavaScript syntax and validates the committed `systems.js`
      (format, size budget), so a bad export can't break the live site

After the Phase 2 pipeline (needs the rebuilt views and scores):

- [ ] Light-curve sparkline per planet (the folded transit from the local view), lazy-loaded per system
- [ ] Scheduled data refresh: a monthly workflow that re-exports from the NASA archive (dispositions change)

## Phase 7: More data (for a better model)

Each of these adds real training data or better inputs. Do them after the Phase 2 baseline,
one at a time, and keep a change only if grouped CV improves.

- [x] NASA confirmed-planet table (`pscomppars`), used by the map (`data/raw/ps_kepler_planets.csv`)
- [~] **Gaia-based stellar properties** (Berger et al. 2020, VizieR J/AJ/159/280): downloaded by
      `scripts/fetch_extra_data.py` to `data/raw/berger2020_gaia_kepler.csv` (186,301 stars; 92.7% of KOIs
      match). Next: add them as features (radius, mass, density, luminosity) next to the KOI-table
      values and re-run the ablation.
- [ ] **Kepler DR25 simulated light curves** (injected transits, inverted and scrambled light curves,
      from the NASA Exoplanet Archive): extra labelled "planet-like" and "false-alarm" examples, the
      data the Robovetter was tuned on. Large download (tens of GB); fetch only the KOI-matched subset.
- [ ] **TESS** (TOI catalog + 2-minute light curves from MAST): a second mission. Needs new view
      recipes (27-day sectors, different noise), so it's a V4-sized step: first test transfer
      (score TOIs with the Kepler model), then fine-tune.
- [ ] **K2** (the Kepler mission's second phase): same telescope, shorter campaigns; a smaller step than TESS.

## Phase 8: Real sky, richer data, better pixel art ✅ (October 2026)

Everything here is from official, openly usable sources and stays light (no stored star images
except one 18 KB backdrop):

- [x] **Real Milky Way behind the map**: ESA Gaia DR3 colour map of the Kepler field, cut out by CDS
      hips2fits in the map's own projection (`scripts/make_sky_backdrop.py` → `web/sky.png`), blurred and
      reduced to 10 colours. Registration checked against δ Cygni on DSS2 (same pixel).
- [x] **Sky photo switcher**: DSS2 / Pan-STARRS1 / 2MASS-infrared thumbnails per system (40×40,
      fetched on demand from CDS; the CSP already allowed only that host).
- [x] **More official data** in `export_starmap.py`: eccentricity, insolation, number of stars and
      spectral type (NASA `pscomppars`); stellar mass, age, metallicity, gravity, Gaia distance
      (Berger et al. 2020); **TESS re-detections** (NASA TOI table, period match within 1%:
      94 Kepler planets). Link to each system's NASA Exoplanet Archive overview page.
- [x] **Pixel art**: three-tone planets lit from the star's side; banded gas giants, ice caps, lava
      glints; limb-darkened star with a sparkle; companion star in multi-star systems; eccentric
      orbits that obey Kepler's equation; hatched habitable zone; static layer drawn once per system.
- [x] **Live light curve**: a strip under each system showing the star's brightness as Kepler sees
      it, dipping when a planet transits (exaggerated): how the planets were actually found.

- [x] **Explorable systems**: zoom (scroll, +/−, keys) and drag around each system; *Fit* shows every
      orbit and the whole habitable zone; *True scale* switches to real distances (and real star and
      planet sizes when zoomed in far enough), with a scale bar and Earth's orbit for comparison.

- [x] **Easter egg: our Solar System.** Searching *Sun*, *Solar System*, *Earth* or *home* (or the link
      `#Sun`) draws it with the same engine (NASA Planetary Fact Sheet values, temperatures computed the
      Kepler-catalog way so colours compare). Left out of the type-ahead on purpose; the README only hints.
      Hand-made pixel art per planet (Earth's continents and Moon, Jupiter's Great Red Spot, Saturn's and
      Uranus' rings, Neptune's dark spot), asteroid and Kuiper belts, and a fact sheet (the Sun's names,
      dwarf planets, belts, heliosphere, Oort Cloud) linked to NASA, JPL and IAU pages.

- [x] **Power savers**: system view at 30 fps, map at ~8 fps; a canvas scrolled out of sight isn't drawn;
      the loop stops when both are off-screen or after 3 idle minutes and wakes on any interaction.
      Measured: ~0.6% of one CPU core while animating; ~295 KB to download on a first visit.

Next ideas (not started):

- [ ] **Real transit sparklines**: each planet's own folded Kepler light curve (the model's local
      view, 32 points, about 40 KB for all drawn planets) next to the pixel art. Needs the v3 view
      rebuild to finish.
- [ ] **Kepler CCD footprint** outline on the map (the 21 modules), from the mission's field definition.
- [ ] **Monthly data refresh** workflow: re-download the NASA tables, re-export, open a PR if changed.
- [ ] Planet orbit orientation from `pl_orblper` (argument of periastron) instead of a fixed random angle.
