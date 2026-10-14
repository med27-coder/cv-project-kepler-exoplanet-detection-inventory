# Easter eggs (spoilers!)

The Kepler Star Map hides a few things that aren't Kepler systems. The README only hints at them. Here's the
full list for anyone maintaining the site. Search is case-insensitive.

| Easter egg | What you get | Type any of these in the search box | Direct link |
|---|---|---|---|
| 🌍 **Our Solar System** | "★ YOU ARE HERE ★": the Sun, all eight planets and Pluto in hand-made pixel art (Earth spinning, Jupiter's Great Red Spot, Saturn's and Uranus' rings, Pluto's heart), 18 named moons circling their planets (Triton backwards, Uranus's on their side), the asteroid and Kuiper belts, the planet table, and a fact sheet about the Sun's names, the moons, Pluto, dwarf planets, the heliosphere and the Oort Cloud, linked to NASA, JPL and IAU pages | `sun`, `sol`, `solar system`, `earth`, `home`, `you are here`, `pluto` (also with "the": `the sun`) | `#Sun` |
| 🛰️ **Our spacecraft** | "★ HUMANITY'S ROBOTS ★": the Solar System frozen on one real date with 19 spacecraft beyond Earth orbit at their real positions (NASA JPL Horizons), each with its pixel art, signal delay and mission page, plus the Mars rovers. The corner of the drawing shows each spacecraft's pixel art in turn | `spacecraft`, `space craft`, `probe(s)`, `space probe(s)`, `robots`, `missions`, `rover(s)`, `mars rover(s)` | `#Spacecraft` |
| 🎯 **One spacecraft** | The same view with that spacecraft in yellow, its table row highlighted and its pixel art in the corner | `jwst`, `webb`, `james webb (space telescope)`, `voyager` / `voyager 1`, `voyager 2`, `new horizons`, `parker (solar probe)`, `juno`, `europa clipper`, `soho`, `euclid`, `solar orbiter`, `bepicolombo`, `juice`, `lucy`, `psyche`, `osiris-apex` / `osiris-rex`, `mro` / `mars reconnaissance orbiter`, `(mars) odyssey`, `mars express`, `tgo` / `exomars` / `trace gas orbiter`, `curiosity`, `perseverance` | `#jwst`, `#lucy`, ... |
| 🔭 **The Kepler telescope** | "★ THE PLANET HUNTER ★": the mission replayed on Kepler's Earth-trailing orbit (2009 → "Goodnight Kepler" in 2018), a big pixel Kepler, its story and NASA links. **Or click the little telescope in the map's top-left corner** (zoom 1, not in DEPTH) | `kepler`, `kepler space telescope`, `kepler telescope`, `kepler spacecraft`, `kepler mission`, `space telescope`, `telescope`, `goodnight kepler` (also with "the") | `#Kepler` |
| 🏠 **The International Space Station** | "★ PEOPLE LIVE UP HERE ★": the real continents (NASA's Blue Marble) on a turning, tilted pixel Earth with the ISS on a to-scale orbit and its pixel art in the corner (sped up ~460×), NASA's facts and a link to Spot the Station | `iss`, `space station`, `international space station` (also with "the") | `#ISS` |

Earth-orbit satellites are left out on purpose; the ISS is the only exception.

## The Galleria (⚙ button, top right)

A collecting game built on the easter eggs. Every egg starts as a dark silhouette with a **?**, its name
blanked out (`_ _ _ _`) and a clue: a riddle or something it achieved. Typing the right name in the search
bar finds it:

- the drawing **glows**, and a pop-up appears in the corner with a title of its own: *HOME SWEET HOME*,
  *DWARF PLANET DISCOVERED*, *PLANET HUNTER AWAKENED*, *CREW ABOARD*, *INTERSTELLAR SIGNAL*, *PARKED AT L2*,
  *TOUCHED THE SUN*, *TROJAN TOUR*, *WHEELS ON MARS*, *LIFTOFF ON MARS*...
- its card in the Galleria lights up. Opening it shows the **pixel art, animated, next to the real thing**
  (an official NASA photo, credited; ESA-credited pictures are linked instead) and a short history.
  The Solar System's card adds a strip of real photos of the Sun, every planet and the Moon.

24 eggs: the Solar System, Pluto, Kepler, the ISS, Voyager, New Horizons, Webb, Euclid, SOHO, Parker Solar
Probe, Solar Orbiter, BepiColombo, Juno, Europa Clipper, JUICE, Lucy, Psyche, OSIRIS-APEX, MRO, Mars
Odyssey, Mars Express, ExoMars, Curiosity and Perseverance (clues and stories: `EGGS` in
`web/src/48-gallery.js`).

### Achievements (18)

| Achievement | How |
|---|---|
| FIRST LIGHT / STAR HOPPER / GALACTIC CENSUS | Open 1 / 10 / 50 different star systems |
| ROLL OF THE DICE | Use 🎲 |
| GHOST HUNTER | Visit a system with only unconfirmed planets |
| FORTUNE TELLER | Open 🏆 next planets |
| GOLDILOCKS | Highlight the habitable-zone systems |
| DEPTH PERCEPTION | Turn on DEPTH |
| CHIP CHECK | Toggle CCDS |
| EAGLE EYE | Zoom the map to 8× |
| TRANSIT WITNESS | Turn on KEPLER'S VIEW |
| MIND THE GAP | Turn on TRUE SCALE |
| SIGNAL RECEIVED | Open a shared view link (`#Kepler-90?view=true`) |
| CURIOUS MIND / MISSION CONTROL / GRAND TOUR | Find 1 easter egg / 5 spacecraft / all 24 |
| PATIENT OBSERVER *(secret)* | Watch one system for two minutes |
| NIGHT SHIFT *(secret)* | Open a system between midnight and 4 a.m. |

Progress is kept only in the visitor's browser (localStorage, key `starmap.progress.v1`); ⚙ → SETTINGS turns
the pop-ups off or resets everything.

## Expanding ideas (brainstorm)

The endgame (TRUE STAR GAZER, rank emblems, achievements bar) has its own design: [STAR_GAZER_MISSION.md](STAR_GAZER_MISSION.md).

Not built yet; roughly from easiest to biggest.

**Make the game deeper**
- **Hot / cold guesses:** when a search almost matches a hidden name (one or two letters off), say
  "So close!" instead of "not found".
- **Hints that unlock over time:** after a few minutes on a card, reveal one letter, then the first word.
- **Ranks:** Cadet → Observer → Astronomer → Flight Director → Mission Legend, from eggs + achievements, shown
  as a small badge on the ⚙ button.
- **Daily mystery star:** one clue a day about a real Kepler system ("a star with eight planets, like ours"
  → Kepler-90), picked from the date, so no server is needed. Streaks become achievements.
- **Exoplanet collection:** a second Galleria page of famous Kepler worlds to "catch" by visiting them:
  Kepler-452b (Earth's older cousin), Kepler-16b (a real Tatooine with two suns), Kepler-186f (first
  Earth-size world in a habitable zone), Kepler-10b (first rocky one), Kepler-90 (eight planets).

**Make the reward better**
- ✅ **Pixelation slider** (built): on a found card, drag from the real photo to the pixel art; the photo
  pixelates step by step into the sprite.
- **Mission timeline** on each spacecraft card (launch → flybys → today), with where it is right now from
  `data/spacecraft.js`.
- **Shareable trophy card:** download your Galleria as one pixel PNG (drawn on a canvas, nothing uploaded).
- **Chiptune unlock sound:** a short jingle with Web Audio, off by default.

**More things to find**
- **Hall of retired missions:** silhouettes of spacecraft that have ended (Cassini's Grand Finale, Rosetta,
  Dawn, Spitzer, Opportunity, Ingenuity), with how each mission ended.
- **The Golden Record:** search "golden record" to see Voyager's record in pixels, with its cover
  diagram explained.
- **Hubble** as a second Earth-orbit exception (like the ISS), and **Apollo 11's landing site** on a pixel Moon.
- **Anniversary eggs:** a special pop-up on 7 March (Kepler's launch) and 15 November ("Goodnight Kepler").
- **Classic secret:** the Konami code (↑↑↓↓←→←→BA) switches the map to a green-screen retro palette.
- **Constellations:** unlocking every egg draws the Cygnus and Lyra star patterns over the map.

**Keep it fair and kind**
- Every clue also works for screen readers (they're real text), and the game is playable by keyboard.
- No accounts, no server, no tracking: progress stays in the browser, so it never syncs between devices.
  That's on purpose.

## Hidden in plain sight

Not secret, but easy to miss:

- **🎲 button:** opens a random drawn system.
- **🏆 next planets** (under the map): the candidates most likely to be real planets, plus a habitable-zone list.
- **DEPTH** (map): the field seen from the side, with Earth on the left and every star at its real distance.
- **CCDS** (map): outlines of Kepler's 21 camera chips, which explain why the stars sit in squares.
- **KEPLER'S VIEW** (system): tilts a system edge-on, so planets visibly cross the star as the light-curve strip dips.
- **TRUE SCALE + zoom** (system): keep zooming into a star until it fills the box at its real size.
- **Shareable views:** the address bar remembers zoom, true scale and Kepler's view, e.g. `#Kepler-90?view=true&zoom=4&edge=1`.
- **Red dwarfs flare:** watch a cool star (e.g. Kepler-186) for a while.
- **Animation menu** (below the system): smooth, normal, battery saver or off.

## Adding a new easter egg

Search words are regular expressions near the top of `web/src/40-home.js` (`HOME_QUERY`) and
`web/src/45-spaceflight.js` (`CRAFT_QUERY`, `ISS_QUERY`) and `web/src/47-kepler.js` (`KEPLER_QUERY`). They are checked in `lookup()` before the Kepler
catalog. Keep them out of the type-ahead so they stay hidden, add a browser test in `tests/test_browser.py`,
add a row to this page, and rebuild with `scripts/starmap/build_web.py`. New sprites: re-run
`scripts/starmap/export_pixel_art.py` so [pixel-art/](../pixel-art/) shows them.
