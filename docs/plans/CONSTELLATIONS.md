# Plan: real constellations for the achievement groups

**Status: plan only (local branch `plan/constellations`).** Today each group's constellation is an
invented loop. This plan draws **real IAU constellations**, with real star positions and brightness, one per
group, so a finished group looks like the actual figure in the night sky.

## Data (checked 14 October 2026)

| Source | What we use | Licence |
|---|---|---|
| d3-celestial `constellations.lines.json` | Stick figures of all 88 IAU constellations (line segments, RA/Dec) | BSD 3-Clause, © Olaf Frohn (credit in the page footer and SOURCES) |
| d3-celestial `stars.6.json` | 5,044 stars to magnitude 6: position, magnitude, colour index | same |
| d3-celestial `starnames.json` | Proper names and Bayer letters by Hipparcos number (Polaris = HIP 11767) | same |

Star counts in the figures (unique stars): Cygnus 9, Lyra 6, Aquila 8, Ursa Minor 7, Corona Borealis 7,
Libra 6, Gemini 12, Canis Minor 2, Sagitta 4, Cassiopeia 5, Orion 23, Ursa Major 20 (its Big Dipper: 7).

## Group -> constellation (one star per achievement)

| Group | Achievements | Constellation | Stars | Change | Why |
|---|---|---|---|---|---|
| EXPLORER | 7 | **Ursa Minor** (Little Dipper) | 7 | none | Polaris, the explorer's guide star |
| MAP AND TOOLS | 7 | **The Big Dipper** (asterism of Ursa Major) | 7 | none | its pointer stars find Polaris: a map tool |
| SCIENCE | 7 | **Corona Borealis** | 7 | none | home of T CrB, the "Blaze Star" nova astronomers wait for |
| FAMOUS WORLDS | 6 | **Cygnus** | 9 | **+3** | Kepler's own field: Kepler-22, -186 and -452 are in Cygnus |
| STAR GAZER'S GUESSES | 3 | **The Summer Triangle** (Vega, Deneb, Altair) | 3 | none | the Kepler field lies inside it |
| EASTER EGGS | 10 | **Gemini** | 12 | **+2** | NASA's Gemini spacecraft program |
| TWO SUNS | 2 | **Canis Minor** | 2 | none | Procyon is itself a double star (with a white dwarf) |
| PREDICTIONS | 6 | **Libra** | 6 | none | the scales of judgement: NASA's ruling |
| SECRET | 6 | **Lyra** | 6 | none | Vega was the pole star 12,000 years ago and will be again |
| DAILY SKY | 2 | **Sagitta** (the Arrow) | 4 | **+2** | one arrow a day |
| THE FINAL MISSION | 1 | **The whole sky** | - | none | earning it links every completed figure into one star chart, at their real places |

**New achievements needed: 7** (so every figure is complete with no spare stars):

| Group | New achievement | How |
|---|---|---|
| Famous worlds | WATER WORLD? | Visit Kepler-22, the first Kepler planet found in a habitable zone (2011) |
| Famous worlds | TWIN HABITATS | Visit Kepler-62, with two planets in its habitable zone |
| Famous worlds | ELDER SYSTEM | Visit Kepler-444, planets about 11 billion years old |
| Easter eggs | HALFWAY THERE | Find 12 of the 24 easter eggs |
| Easter eggs | HOME SYSTEM | Find the Solar System, Pluto, the ISS and Kepler |
| Daily sky | TEN MYSTERIES | Solve 10 daily mysteries |
| Daily sky | MONTH OF MYSTERIES | A 30-day streak |

(Total 57 -> 64. The emblem thresholds can stay; the new ones make Pulsar a little easier to reach.)

## How a constellation shows progress

- **Which star is which achievement:** the brightest star in the figure is the group's hardest achievement,
  the faintest its easiest (e.g. Polaris = the hardest Explorer achievement, Deneb = the hardest famous world).
- **Stars:** sized by real brightness (1 to 3 pixels), coloured by real colour index (blue-white Vega,
  orange Arcturus-like K stars, red M stars). Earned: bright and twinkling. Locked: a dim dot.
- **Lines:** a segment lights when both of its stars are earned; complete the group and the whole figure
  glows, with the constellation's name.
- **Hover a star:** "Polaris (α UMi) · FIRST LIGHT", so the sky teaches its names as you play.
- **Final mission:** a small all-sky chart with every completed figure at its real position.

## Build

1. `scripts/starmap/make_constellations.py`: downloads the three d3-celestial files, picks the 11 figures
   (Big Dipper, Summer Triangle by star name), projects each around its centre (stereographic), and writes
   `web/data/constellations.js` (each figure: stars with name, Bayer letter, magnitude, colour, x/y; line pairs).
   Small, a few KB. Credit added to SOURCES and the footer.
2. `49b-trophies.js`: draw from that file instead of the invented loops; star-to-achievement by brightness
   rank; hover names; the final all-sky chart.
3. The 7 new achievements (ids added to `SHIPPED_IDS`), their trophies, docs, tests (every figure has exactly
   as many stars as its group has achievements).

## Decisions for you

1. Happy with the pairings above (especially Gemini for the spacecraft and Lyra for the secrets)?
2. Add the 7 new achievements, or pick different constellations to avoid adding any?
3. Brightest star = hardest achievement, or follow the figure's lines in order (so it "draws" as you go)?
