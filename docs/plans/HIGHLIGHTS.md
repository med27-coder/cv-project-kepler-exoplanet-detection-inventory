# Plan: better highlights (the filter chips under the map)

**Status: plan.** Goal: highlights that are **scientifically accurate**, clearly defined, and more useful to
explore with. Numbers below were measured on the map's data on 17 October 2026.

## 1. What's there now

| Chip | Rule today (`tags()` in `scripts/starmap/export_starmap.py`) | Count | Issue |
|---|---|---|---|
| habitable zone | a planet between 1.1x and 0.36x Earth's sunlight, using the Sun's limits for **every** star | 55 systems | The real limits shift with the star's temperature (Kopparapu et al. 2014). 17 systems change when you account for it |
| Earth-sized | a planet of 0.7-1.5 Earth radii | 962 planets | **308 are unconfirmed candidates**, counted only because Star Gazer predicts them; radius errors are ignored |
| 5+ planets | five or more planets (confirmed + Star Gazer's picks) | 29 | mixes facts and predictions too |
| giant planets | a planet of 6+ Earth radii | 231 | no split between hot Jupiters and cooler giants |
| seen by TESS | a TESS object matches a Kepler planet's period | 98 | fine; could show TESS's own status |
| two suns | NASA's circumbinary flag | 12 | fine |
| next planets / unseen | the leaderboard; the final mission's helper | - | fine |

All "planet" counts today include candidates that Star Gazer calls planets (`counts_as_planet`).

## 2. Accuracy fixes (data first)

1. **Habitable zone, done properly:** Kopparapu et al. (2014) limits as a function of the star's temperature
   (valid 2,600-7,200 K), using NASA's measured insolation where it exists (all but 27 planets):
   - **conservative** (runaway to maximum greenhouse): **52 systems**;
   - **optimistic** (recent Venus to early Mars): **98 systems**.
   Show conservative by default, optimistic as a lighter shade or a toggle.
2. **Facts vs predictions everywhere:** each chip counts **confirmed** planets, and separately "+ N Star Gazer
   picks". A switch "include Star Gazer's predictions" (off by default) applies to every filter.
3. **Radius uncertainty:** export the KOI radius errors (`koi_prad_err1/2`). "Earth-sized" requires the whole
   error bar to sit inside 0.5-1.6 Earth radii, or shows "probably" otherwise.
4. **Definitions on screen:** an ⓘ on every chip explains the rule and cites the source; the same text goes in
   `docs/star-map/DATA_DICTIONARY.md`.
5. **Tests that pin the science:** Kopparapu limits reproduce the published solar values (1.107 / 0.356);
   Kepler-186f and Kepler-452b land in the habitable zone; a hot Jupiter does not.

## 3. New highlights (all from data we already export or can add)

| Highlight | Rule | Why it's interesting |
|---|---|---|
| **Potentially rocky + habitable** | under 1.8 Earth radii in the conservative zone | the real headline list: **16 systems** (Kepler-186, -1652, -1229, -296...) |
| Hot Jupiters | 6+ Earth radii and a year under 10 days | giants hugging their stars, easy for Kepler to find |
| Ultra-short years | orbit under 1 day | lava worlds (Kepler-78b: 8.5 hours) |
| The radius valley | super-Earths (1-1.75) vs mini-Neptunes (2-4) | a real gap Kepler discovered (Fulton et al. 2017) |
| Multi-star systems | NASA's number of stars > 1 | complements "two suns" |
| Nearby / bright | under 1,000 light-years / brightest stars | the best targets to follow up |
| Old stars | Gaia age over 10 billion years (uncertain, labelled so) | Kepler-444 and friends |
| Star Gazer vs NASA | candidates where the two disagree strongly | ties the map to the AI side |
| Newly confirmed | candidates NASA confirmed since your last visit (`resolutions.js`) | ties into predictions |

## 4. A better interface

- **Grouped filters:** Habitability, Planet size, Orbits, Stars, Missions, Star Gazer, in a tidy panel instead of a
  long row.
- **Combine them:** pick several and see systems matching all of them ("habitable + Earth-sized + confirmed:
  7 systems").
- **A results list:** a small sortable table of the matching systems under the map (name, planets, distance,
  the planet that matched), click to open.
- **Counts that update** as filters combine, and the ⓘ definitions.
- **Shareable filter links:** `#filter=hz,earth`.
- **Achievements:** HIGHLIGHTER keeps counting the original five, and a new one could reward finding a
  "potentially rocky + habitable" world.

## 5. Checking it: a fresh agent for the data

Planning stays in this session (it already knows the code). Once the export is updated, an **independent fresh
agent** audits the data, as the V3 audit did: it recomputes each highlight from NASA's tables on its own, checks
the habitable-zone list against an outside catalogue (e.g. NASA's and PHL's habitable-worlds lists), and reports
any disagreement before anything ships.

## 6. Build order

1. Export: Kopparapu zone (conservative + optimistic), confirmed vs predicted counts, radius errors, new tags.
2. Tests pinning the definitions; the independent data audit.
3. Interface: grouped panel, combined filters, counts, ⓘ definitions, results list, shareable links.
4. New highlights and the achievement tie-in.

## 7. Decisions for you

**Answered 18 October 2026:**
1. The conservative (strict) habitable zone.
2. Predictions get a **switch between Star Gazer and Colossus**, so visitors can compare the two models. Colossus is
   shown labelled as experimental (its registered tests: `docs/star-gazer/V4_RESULTS.md`, `V4B_RESULTS.md`), and new
   achievements reward finding each model (searching "star gazer" and "colossus"). Still to confirm: predictions off
   until switched on.
3. The first set: rocky + habitable, hot Jupiters, ultra-short orbits, the radius valley.
4. The grouped panel with a results list.

The questions as first asked:


1. Habitable zone: conservative by default with optimistic as a toggle (recommended), or show both always?
2. Star Gazer's predictions in the highlights: off by default (recommended), or on?
3. Which new highlights: all nine, or a first set (e.g. rocky + habitable, hot Jupiters, ultra-short, radius valley)?
4. Interface: the grouped panel with a results list (recommended), or keep the single row of chips with ⓘ?
