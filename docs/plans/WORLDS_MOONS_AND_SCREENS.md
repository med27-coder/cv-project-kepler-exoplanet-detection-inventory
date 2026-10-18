# Plan: water worlds, moons, dwarf planets, a loading screen, "lost in orbit", hidden spacecraft

**Status: plan, with concept art (`pixel-art/concepts/draft_loading_rock.gif`, `draft_lost_in_orbit.gif`).**
Ground rule for everything here: **every claim carries its evidence level** (confirmed / likely / candidate)
and a source, so the game never overstates the science. Data checked on 17 October 2026.

## 0. Fixed already (17 October)
Searching an easter egg you had already found opened it silently, which looked like nothing happened. An
"ALREADY FOUND" pop-up was tried, then removed at the user's request (the view opening is answer enough). The first-visit tour could also take the keyboard away from the search box; it no longer
does. (If a name still doesn't work, note exactly what was typed.)

## 1. Water worlds, from published results (not guessed)
- **On the map with real evidence:** **Kepler-138 c and d**, likely water-rich worlds (Piaulet et al. 2022,
  *Nature Astronomy*: densities too low for rock alone). Label: "likely water world".
- **Possible, from models only:** Kepler-22 b, Kepler-62 e and f (ocean worlds in some models). Label:
  "possible ocean world (models)".
- **Why not a density rule:** 58 small planets on the map are too light for pure rock, but water and a thin gas
  envelope look the same in density alone. So the planet table gains a **bulk density** column (where the mass is
  measured) with a plain note ("lighter than rock: water or gas"), and the water label comes only from studies.
- **Achievements:** OCEAN WORLD (visit Kepler-138), and later a WATER WORLDS set if more get confirmed.

## 2. Moons
- **Our Solar System:** the planet close-up cards (ACHIEVEMENTS_V2 §1A) show every named major moon, with NASA's
  current counts per planet and a "moons known as of" date (counts keep rising).
- **Dwarf planets' moons:** Pluto 5 (Charon, Styx, Nix, Kerberos, Hydra), Haumea 2 (Hiʻiaka, Namaka), Makemake 1
  (MK2), Eris 1 (Dysnomia), Ceres none.
- **Beyond the Solar System (candidates):** two exomoon candidates orbit Kepler planets that are on this map:
  **Kepler-1625 b-i** (Teachey & Kipping 2018) and **Kepler-1708 b-i** (Kipping et al. 2022). Both are debated.
  Drawn as a faint dashed moon labelled "candidate moon". Achievement: MOON HUNTER (visit both).

## 3. Dwarf planets
The five the IAU recognises, each an easter egg card (Pluto exists): **Ceres** (the asteroid belt), **Pluto**,
**Haumea** (spins every 4 hours, egg-shaped, has a ring), **Makemake**, **Eris** (the most massive dwarf
planet). Achievement **DWARF KING**: find all five by name. NASA images where they exist (Ceres from Dawn, Pluto
from New Horizons); the others only as artist concepts or dots, labelled so.

## 4. Loading screen: the rock with moons
While the page's data loads (a few hundred KB), show a pixel **asteroid with little moons orbiting**, like Ida and
its moon Dactyl, the first asteroid moon ever found (Galileo, 1993; NASA reference image to fetch), plus
"LOADING 3,631 STARS…" and one rotating space fact.
- Pure HTML and CSS (the page's security policy allows no inline script), shown at once, removed by
  `starmap.js` when ready with a short fade; nothing shows if loading is instant.
- Respects reduced motion (a still frame).

## 5. Empty screens: "LOST IN ORBIT"
The system drawing is blank before you pick a star, and after a search finds nothing. Instead: a little astronaut
tumbling slowly with a loose tether (`draft_lost_in_orbit.gif`), "LOST IN ORBIT · PICK A STAR TO BEGIN", and a
button to jump to a random system. "NO SIGNAL" gets the same astronaut, with the search hint.

## 6. Spacecraft hidden until named

**Superseded by [FLEET_CLOSEUPS.md](FLEET_CLOSEUPS.md)** (17 October 2026): hidden as flashing lights, with close-ups.

The spacecraft view currently shows every spacecraft with its name. To match the game, it shows only the ones
you've found, labelled with their pixel art; the rest are faint "?" marks and table rows reading "??? · find
it by name" (with the Galleria clue). Searching a name reveals it, with the unlock moment. The educational
version (everything shown) stays available after GRAND TOUR, or with a "show all" switch.

## 7. Build order
1. Hidden spacecraft (small, makes the game consistent).
2. "Lost in orbit" and the loading screen.
3. Dwarf planets and their moons (eggs + DWARF KING); planet close-ups come with ACHIEVEMENTS_V2.
4. Water worlds (density column, labels, OCEAN WORLD) and exomoon candidates (MOON HUNTER), with an
   independent data check, as in HIGHLIGHTS.md.

## 8. Decisions for you
1. Spacecraft: answered, see FLEET_CLOSEUPS.md (flashing lights until named).
2. Loading screen: always shown briefly, or only when loading takes more than half a second (recommended)?
3. Exomoon and water-world labels: "candidate" / "likely" wording as above, OK?
