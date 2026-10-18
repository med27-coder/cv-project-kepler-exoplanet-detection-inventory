# Plan: more accurate stars and planets, a trophy ladder with the universe cup, unique trophies, version updates

**Status: plan.** References fetched to `pixel-art/references/trophies/` (sources in
`pixel-art/references/SOURCES.md`). Written 17 October 2026.

## 1. Data accuracy: stars and planets

1. **Planet sizes from Gaia star sizes.** The export already downloads the Gaia-Kepler star table (Berger et al.
   2020), but it uses it only for star mass, age, metals, gravity and distance. Planet radii still come from the
   KOI table (`koi_prad`), and so do star radii (`koi_srad`), both measured before Gaia. A planet's size is
   (planet-to-star size ratio, `koi_ror`) × (star radius), so we recompute it with the Gaia star radius, use the
   Gaia radius for the star's brightness too, and carry the error bars. For confirmed planets, NASA's own
   planet table (`pscomppars`) stays the first source. This moves the Earth-sized list and the habitable zone,
   so it ships together with HIGHLIGHTS.md.
2. **Star types and life stages.** Each star gets a label:
   - its type from its temperature (red dwarf M, orange dwarf K, yellow dwarf G, like the Sun; F and hotter);
   - its life stage from Gaia's surface gravity (main sequence, subgiant, giant).
   The star card says it in words ("an orange dwarf, a little cooler than the Sun"). A few Kepler planets circle
   red giants (e.g. Kepler-56, Kepler-91), which ties into the rank emblems (a star's life).
3. **Brown dwarfs labelled as such.** Kepler-39 b is about 20 Jupiter masses: a brown dwarf, not a planet. To
   do: list every object above about 13 Jupiter masses from NASA's table and label them.
4. **Fresh data, shown.** The monthly refresh workflow already pulls NASA's updates. The page shows the data's
   date next to the version (section 5), and WHAT'S NEW lists newly confirmed planets, rejected candidates and
   renamed stars (`resolutions.js` already records rulings).
5. **An independent check** (a fresh agent, as for HIGHLIGHTS.md): it recomputes radii, types and stages from
   NASA's and Gaia's tables on its own, and reports anything that disagrees before it ships. Tests pin known
   cases: the Sun's numbers give a yellow dwarf, Kepler-56 is a giant, Kepler-39 b a brown dwarf.

## 2. The trophy ladder

**Bronze → Silver → Gold → Nebula (new) → Black hole.** The universe cup stands apart, as the secrets' track.

| Trophy | For | Look |
|---|---|---|
| Bronze, silver, gold | common, rare, epic (as now) | metal cups, gold with a sparkle |
| **Nebula** (new) | the hardest sets and maxed levels (section 4) | a cup glowing pink, teal and violet that slowly shift, like the Eagle Nebula (`nebula-eagle.jpg`); dust drifts off the rim |
| **Universe cup** (replaces the galaxy cup) | every secret achievement | see below |
| **Black hole** | TRUE STAR GAZER only | as now |

Secrets are a separate track, not a level above nebula: some are easy (NIGHT SHIFT, SO CLOSE). In the trophy case
they get their own row after nebula. Names already used by the rank stages (supernova, pulsar) stay off the
trophies, so the two systems don't blur.

**The universe cup.** The bowl is the history of the universe. NASA's WMAP "timeline of the universe" diagram
is famously cup-shaped: a cone flaring out from the Big Bang. So:
- the stem is a single bright dot, the Big Bang;
- the bowl flares upward through a mottled band of the oldest light (the cosmic microwave background:
  `universe-cmb`, linked only), then a dark band, the "dark ages";
- the first stars light up, then galaxies along the rim: tiny spirals and smudges like the Hubble deep field
  (`universe-deep-field`, linked only; `universe-baby-galaxies.jpg`), with the Milky Way and Andromeda as the two
  biggest (`universe-milky-way.jpg`, `universe-andromeda.jpg`);
- the bowl slowly fills with twinkling galaxies.

Concept art first (`draft_trophy_universe.gif`, 16 × 16 and a 48 × 48 hologram version).

## 3. Unique trophies: ideas

The harder achievements already get a symbol on their cup (`SYMBOLS` in `49-ranks.js`). New and missing ones:

| Achievement | Trophy symbol | Reference |
|---|---|---|
| **DWARF KING** (all five dwarf planets) | a tiny crown over five dots in a row, the middle one with Pluto's heart | `dwarf-ceres.jpg`, `dwarf-eris.jpg`, Pluto |
| **DWARF STAR** (visit a red, an orange and a yellow dwarf) | three small suns in red, orange and yellow | `red-dwarf-flare.jpg`, `red-dwarf-trappist.jpg` |
| **FAILED STAR** (secret: find Kepler-39 b, the brown dwarf) | a dim banded brown ball | `brown-dwarf.jpg` |
| **GIANT'S COMPANION** (a planet around a red giant) | a huge red star with a speck beside it | `stars/4-red-giant.jpg` |
| **MOON HUNTER** (both exomoon candidates) | a planet with a dashed moon (a candidate) | `moon-ida-dactyl.jpg` |
| **OCEAN WORLD** (Kepler-138) | a blue planet with a wave | - |
| **TATOOINE** / **DOUBLE SUNSET** | two suns setting over a horizon (DOUBLE SUNSET has it; TATOOINE gets a smaller one) | `two-suns-kepler-16.jpg` |
| **SO CLOSE** | a dart just off the bullseye | done |
| **MISSION CONTROL** levels | the satellite gains solar panels per level | - |

## 4. Achievements with levels

As GALACTIC CENSUS does (50 / 500 / 1,000 systems): stars appear on the trophy's base for each level, and the
last level upgrades the cup to **nebula**.
- **DWARF KING:** 1 → 3 → all 5 dwarf planets → all 5 plus their 9 known moons.
- **DWARF STAR:** one type → all three dwarf types → a planet in the habitable zone of each.
- **MISSION CONTROL:** 5 → 10 → every spacecraft.
- **ORACLE** (right calls): 5 → 15 → 30.

A level-up gets its own pop-up ("DWARF KING II"). Ids never change; levels are worked out from saved progress,
so nobody loses what they've earned.

## 5. Version updates, as other websites do

- **A version number** (semantic versioning, `MAJOR.MINOR.PATCH`):
  - MAJOR: a big redesign, or a change in how progress is saved (never loses progress);
  - MINOR: new features (eggs, achievements, filters);
  - PATCH: fixes.
  The data refresh keeps its own date, shown beside the version: `v1.4.0 · NASA data 17 Oct 2026`.
- **`CHANGELOG.md`** (the "Keep a Changelog" format: Added / Changed / Fixed per version), backfilled from the git
  history since 12 October 2026, and a **GitHub Release** with a git tag for each version
  (`gh release create v1.4.0 --notes-file ...`).
- **On the page:** the version in the footer, linking to the changelog. A **"What's new in v1.4"** pop-up once
  per new version: 2 or 3 highlights in plain words, merged with today's data WHAT'S NEW.
- **Fresh files after an update:** `build_web.py` stamps the version on the script and stylesheet links
  (`starmap.js?v=1.4.0`), so browsers don't keep an old cached copy after a release.
- **One source of truth:** the version lives in one file (`web/src/00-version.js`, generated or checked by
  `build_web.py`). A test checks the footer, the changelog's top entry and the link stamps agree.
- **Where it starts:** call today's site **v1.0.0** (the first full release), with the changelog grouping what came
  before.

## 6. Build order

1. Version updates (small, and every later feature then lands as a release).
2. Data: Gaia radii, star types and stages, brown dwarfs; then the independent check (with HIGHLIGHTS.md).
3. Trophy ladder: nebula tier and the universe cup (concept art first).
4. New achievements (DWARF KING etc., as their features land) and levels.

## 7. Decisions for you

1. The new tier's name: **Nebula** (recommended), or something else?
2. Should levelled achievements upgrade to the nebula cup at their last level?
3. Version numbering: start today at v1.0.0, and publish GitHub Releases (recommended)?
4. The universe cup design (the Big Bang cone): OK for concept art?
