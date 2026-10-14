# Plan: set badges, pixel icons, progress counters, and the star-life rank

**Status: plan only (local branch).** Builds on docs/STAR_GAZER_MISSION.md and docs/plans/TATOOINE_AND_PROPHET.md.

## 1. Total achievements -> the life of a star (replaces bronze/silver/gold)
One rank for *all* achievements, shown as the header emblem and at the top of the Achievements tab:
STARDUST (0) -> PROTOSTAR (1) -> YOUNG STAR (5) -> RED GIANT (10) -> SUPERGIANT (18) -> SUPERNOVA (28)
-> PULSAR (40) -> BLACK HOLE (TRUE STAR GAZER: every system on the map).
Concept art exists: pixel-art/emblems/ (scripts/starmap/draft_emblems.py). The tab shows
"next: RED GIANT in 3 achievements" and the whole ladder, future stages as silhouettes.

## 2. Set badges (one per group, earned by completing the group)
Badge shelf at the top of the tab; dark silhouettes until earned; 16x16 pixel art.
| Set | Badge |
|---|---|
| Explorer | compass |
| Famous worlds | ringed planet |
| Science | light curve with a transit dip |
| Star Gazer's guesses | crystal ball |
| Map and tools | telescope |
| Easter eggs | golden satellite |
| Secret | eye inside a "?" (purple set) |
| *Two suns* (from the Tatooine plan) | two suns setting |
| *Predictions* (from the PROPHET plan) | hourglass |

## 3. Pixel icons per achievement (replace the emoji)
12x12 icon per achievement in the CRAFT_ART row-of-letters format (46-craft-art.js style), drawn in colour
when earned and as a silhouette when locked (same trick as the Galleria). Reuse what exists: spacecraft
sprites for the collections, planet art for famous worlds, the Kepler sprite, the flare/star drawing.

## 4. Progress counters
Mini bar + "23 / 50" on counting achievements: STAR HOPPER, GALACTIC CENSUS, MISSION CONTROL, every
collection (RED PLANET FLEET 4/6 ...), CARTOGRAPHER, CURATOR, HIGHLIGHTER, GRAND TOUR, and the final
mission once revealed (100+ systems).

## 5. Polish
Date on its own line ("earned 14 Oct 2026"); NEW tag until the tab is seen; rarity (common / rare /
legendary, set by us); secret cards purple even when locked.

## 6. What the plan branch (TATOOINE_AND_PROPHET.md) adds
- **TATOOINE** (visit a two-sun planet) and **DOUBLE SUNSET** (all 13) -> a new *Two suns* set and badge,
  plus a binary-star drawing that doubles as its icon. Needs the ~20 missing Kepler systems added first.
- **PROPHET, ORACLE, CASSANDRA, CONTRARIAN, PATIENCE OF A STAR** -> a *Predictions* set (hourglass badge).
  Needs the monthly resolutions file and the predictions tab.
- Both push the total past 50, so the star-life thresholds may move up (e.g. 1, 5, 12, 22, 34, 46).

## Order (each step usable on its own)
1. Concept art: 7 set badges + ~10 sample icons + a mock-up of the tab -> review.
2. Build: badge shelf, icons, counters, polish, rank emblem + ladder in the tab.
3. Header emblem + rank-up pop-up ("YOUR STAR EVOLVED").
4. Later, with the Tatooine and PROPHET work: the two extra sets.

## 7. On the front page, not just in the tab (requirement)
The rank emblem **and** the earned set badges sit in the page header, next to the title and the ⚙ button,
so progress is visible at a glance:
- the star-life emblem (animated a little: the pulsar sweeps, the black hole's disk turns), its stage name,
  and the achievements bar (`11/46`); mock-up: pixel-art/emblems/draft_header.png;
- a row of the earned set badges beside it (only the earned ones, so the row grows);
- hover or tap any of them for its name and how it was earned; clicking opens the Achievements tab;
- on phones: just the emblem and the count, badges in the tab;
- when a stage or badge is earned, it pulses once in the header as well as in the pop-up.
Step 3 of the order above becomes "header emblem + badge row + rank-up pop-up".

## Bug to fix: 🏆 next planets leaves the drawing empty
Seen 2026-10-14: pressing **🏆 next planets** shows the candidates table, but the system drawing above it is
blank and its hint is stale ("True scale: real distances and real sizes."). Cause: `showLeaderboard()`
(web/src/30-info.js) never sets a scene of its own, so the canvas keeps whatever the last view left (here a
true-scale view with nothing in frame) and the scale hint and controls aren't updated.
Fix: give the view its own drawing and reset the hint/controls, e.g.
- a pixel "podium" of the top candidates (mystery silhouettes with their Star Gazer score), or a slow
  preview of the #1 candidate's system, clicking one opens it;
- `setScene({ custom: ... })` so the zoom/scale tools hide and the hint clears (like the ISS card);
- a browser test: open next planets after a true-scale system and check the canvas isn't blank.

## Pixel trophy (concept, requested 2026-10-14)
`pixel-art/icons/draft_trophy.png` (earned) and `draft_trophy_locked.png` (silhouette), 16 x 16; the grid
and colours are in `draft_trophy.txt` in the site's row-of-letters format, ready to become the achievement
icon that replaces the 🏆 emoji (earned: gold cup on a plum base; locked: the same shape in dark blue).

## Trophy colours by difficulty (concept)
`pixel-art/icons/draft_trophy_tiers.png`: COMMON bronze, RARE silver with a blue gem, EPIC gold with a star,
SECRET a cosmic violet cup with galaxy speckles and a small planet on an orbit around it. Each tier also has
its own mark (gem / star / orbit), so the difficulty doesn't rely on colour alone (colour-blind visitors).
Locked: the dark silhouette for all tiers (secret ones stay "???" until earned).
Suggested tiers: COMMON = one action (dice, depth, chips, eco...); RARE = a search or a find (famous worlds,
first egg, collections of 2-3, believer/skeptic); EPIC = long or large (census 50, red planet fleet, grand
tour, cartographer, mission control); SECRET = the six secret ones; TRUE STAR GAZER gets its own (black hole).
The total count still drives the star-life emblem (stardust -> black hole), separately from these colours.
Update: SECRET is now a **galaxy cup** (a two-armed violet spiral galaxy fills the bowl, bright core, a few
stars around it), and locked achievements use a **space lock** instead of the padlock emoji: the shackle is a
planet's ring, the body a small dark planet with the ring crossing it and a star-shaped keyhole
(`draft_lock_space.png`; all five on `draft_trophy_tiers.png`).
