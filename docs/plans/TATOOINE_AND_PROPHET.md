# Plan: TATOOINE (Kepler's worlds outside the KOI list) and PROPHET (your own predictions)

**Status: Part A (Tatooine) built in October 2026: 20 Kepler systems added, 12 of them with two suns. Part B (PROPHET) in progress.** Numbers below were checked against the NASA
Exoplanet Archive on 14 October 2026.

---

## Part A: TATOOINE, and every Kepler world the map is missing

### Why Kepler-16 isn't on the map

The star map is built from NASA's **KOI table** (Kepler Objects of Interest): signals Kepler's pipeline
flagged as possible transits. Some planets Kepler found never went through that list: they were spotted
another way, in **eclipsing binary** light curves, from **eclipse or transit timing** wobbles, or from a
star's **brightness changing along a planet's orbit**. Kepler-16 b, the real "Tatooine" orbiting two suns,
is one of them: it was found in Kepler's eclipsing-binary catalog.

### What NASA's archive has (checked)

From the confirmed-planets table (`pscomppars`, the same official source the map already uses for its
"◆ more from NASA's planet list" rows), filtered on `disc_facility = 'Kepler'`:

| | |
|---|---|
| Planets found by Kepler | 2,787 |
| ... whose host isn't on the map by position | 33 planets around 22 stars |
| ... after allowing for name aliases and fast-moving stars (Kepler-444, Kepler-42 are already on the map) | about 17–20 new stars |
| How they were found | transits 22, orbital brightness modulation 8, eclipse timing 2, pulsar timing 1 |
| **Circumbinary ("Tatooine") planets** | **14 around 13 stars**: Kepler-16, -34, -35, -38, -47 (three planets), -413, -453, -1647, -1660, -1661, PH1 (found by Planet Hunters volunteers) and 2MASS J19383260+4603591 |

Every one of them has a position inside the Kepler field, so they drop straight onto the map.

### How to build it

1. **Export** (`scripts/starmap/export_starmap.py`): query `pscomppars` for `disc_facility = 'Kepler'`, match
   each host to the map's stars by position (within ~15″, to allow for fast-moving stars) and by alias, and
   add the rest as new map stars with a flag `extra` ("found by Kepler outside the KOI list"). Their planets
   use the existing `other` status (◆) with the discovery method spelled out.
2. **New data fields:** `cb` (circumbinary, from the archive's `cb_flag`) and the number of stars (`sy_snum`).
   Star facts come from the same table (`st_teff`, `st_rad`, `st_mass`, distance).
3. **Drawing a binary:** for `cb` systems the centre becomes two stars orbiting each other (sizes and colours
   from the archive where known), with the planets orbiting the pair. The light-curve strip then shows the
   stars eclipsing each other *and* the planet's transits, which is exactly how these were found.
4. **Map:** a highlight chip **"two suns (13)"**.
5. **Fun:**
   - easter egg: searching **`tatooine`** jumps to Kepler-16 ("Yes, it's real");
   - achievements: **TATOOINE** (visit a planet with two suns) and **DOUBLE SUNSET** (visit all 13);
   - Galleria card for Kepler-16 with NASA's artist concept as the real-thing picture.
6. **Tests:** every added star is inside the field, no star is added twice, size budgets still hold.

Effort: about a day. Risk: low. It only adds data, from the same official source.

### Can these help V4's training data?

Mostly not as **planets**: the model learns the shape of a single, regular transit, and circumbinary transits
change depth and timing from one orbit to the next. They would confuse it more than teach it. Better V4 data,
all public and official:

| Source | What it adds to training | Where |
|---|---|---|
| **Kepler Eclipsing Binary Catalog** (~2,900 eclipsing binaries) | Labelled *hard negatives*: eclipsing binaries are the most common false positive, so more of them should sharpen the "not a planet" side | Villanova / MAST |
| **DR25 simulated data** (injected transits, inverted and scrambled light curves) | Planet-like signals with known answers, and noise that only looks like planets: the same tests NASA used to measure its own pipeline | NASA Exoplanet Archive, Kepler DR25 |
| **TESS TOIs** | A different telescope, for checking that the model generalises (already tried in V3, `docs/EXPERIMENTS_V3.md`) | NASA Exoplanet Archive |
| **Circumbinary planets** | A small *held-out* test of unusual planets, to see how the model reacts, not for training | `pscomppars`, `cb_flag = 1` |

(All from NASA and its partners. These are open science archives; nothing here needs an account.)

---

## Part B: PROPHET and a predictions section

### The idea

Visitors play the same game as Star Gazer: look at a **candidate** and call it, **PLANET** or **NOT A PLANET**.
When NASA later rules on that candidate, the call is scored. It's a slow, long game, and that's the fun:
your prediction is waiting for the universe (and astronomers) to answer.

### Making a call

- On every unconfirmed candidate's card: two buttons, *"Your call: PLANET / NOT A PLANET"*, optionally
  a confidence (50 / 75 / 95%). Star Gazer's own call is hidden until you've made yours, so it can't sway you.
- A new Galleria tab, **MY PREDICTIONS**: your calls, Star Gazer's calls on the same candidates, which ones
  NASA has ruled on, and your record. Also "You vs Star Gazer".
- **Saved on your own device:** in the browser (local storage), with the date of each call. Buttons to
  **export** them to a small file on your PC and **import** it again (backup, or moving to another computer).
  No account, no server, nothing uploaded.

### How we know when NASA rules (no server needed)

The site already refreshes its data from NASA every month (`.github/workflows/data-refresh.yml`). Add one file
to that refresh:

- **`web/data/resolutions.js`**: every KOI that changed from *candidate* to *confirmed* or *false positive*,
  with the date it changed. The date comes from:
  1. our own refresh log: the refresh compares NASA's table with last month's and stamps each change with the
     day it was first seen (reliable, and exactly what we need);
  2. NASA's own dates as a cross-check: the confirmed-planets table's publication month (`disc_pubdate`)
     and the KOI table's vetting date (`koi_vet_date`).
- **In the browser:** a call made on date *P* about candidate *k* is scored only if NASA ruled on *k* **after**
  *P*. If NASA had already ruled before you called it, it doesn't count (you could have looked it up).

### Scoring and achievements

| Achievement | How |
|---|---|
| **PROPHET** | Your first call proven right by NASA |
| ORACLE | 5 right calls |
| CASSANDRA | Correctly call a false positive that Star Gazer believed in |
| CONTRARIAN | Be right when Star Gazer was wrong, 3 times |
| PATIENCE OF A STAR | Have a call resolved a year or more after you made it |

### Honest limits

- **It's slow.** Most Kepler candidates have been candidates for years, and NASA resolves a few at a time.
  Expect a handful of results per month, sometimes none.
- **It's on your device, so it's for you.** Anyone can edit their own browser storage, so there's no public
  leaderboard; a fair one would need accounts and a server (a much bigger and less private project).
- **Star Gazer's record** against the same rulings is already tracked by `scripts/pipeline/scoreboard.py`;
  the predictions tab would reuse that.

### Effort

About two to three days: the monthly resolutions file and its test, the call buttons, the predictions tab,
export/import, the achievements.

---

## Suggested order

1. **TATOOINE first** (small, fun, and it fixes a real gap: Kepler planets missing from a Kepler map).
2. **Resolutions file** in the monthly refresh. It starts collecting history now, so PROPHET has data to
   score against later.
3. **Predictions tab and PROPHET** whenever you want them.
4. **V4 training data:** the eclipsing-binary hard negatives and the DR25 simulated sets.

## Decisions for you

1. Add all ~20 missing Kepler systems, or only the 13 two-sun ones?
2. Should the "Tatooine" search show a playful line ("Yes, it's real") or stay factual?
3. Predictions: plain PLANET / NOT A PLANET, or with confidence levels?
4. Should we start recording NASA's monthly rulings now, even before the predictions tab exists?
