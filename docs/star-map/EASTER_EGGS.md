# Easter eggs (spoilers!)

The Kepler Star Map hides a few things that aren't Kepler systems. The README only hints at them. Here's the
full list for anyone maintaining the site. Search is case-insensitive.

| Easter egg | What you get | Type any of these in the search box | Direct link |
|---|---|---|---|
| 🌍 **Our Solar System** | "★ YOU ARE HERE ★": the Sun, all eight planets and Pluto in hand-made pixel art (Earth spinning, Jupiter's Great Red Spot, Saturn's and Uranus' rings, Pluto's heart), 18 named moons circling their planets (Triton backwards, Uranus's on their side), the asteroid and Kuiper belts, the planet table, and a fact sheet about the Sun's names, the moons, Pluto, dwarf planets, the heliosphere and the Oort Cloud, linked to NASA, JPL and IAU pages | `sun`, `sol`, `solar system`, `earth`, `home`, `you are here`, `pluto` (also with "the": `the sun`) | `#Sun` |
| 🛰️ **Our spacecraft** | "★ HUMANITY'S ROBOTS ★": the Solar System frozen on one real date with 19 spacecraft beyond Earth orbit at their real positions (NASA JPL Horizons), each with its pixel art, signal delay and mission page, plus the Mars rovers. The corner of the drawing shows each spacecraft's pixel art in turn | `spacecraft`, `space craft`, `probe(s)`, `space probe(s)`, `robots`, `missions`, `rover(s)`, `mars rover(s)` | `#Spacecraft` |
| 🎯 **One spacecraft** | The same view with that spacecraft in yellow, its table row highlighted and its pixel art in the corner | `jwst`, `webb`, `james webb (space telescope)`, `voyager 1` / `voyager i`, `voyager 2` / `voyager ii` (plain `voyager` shows both but finds neither: a pop-up asks which), `new horizons`, `parker (solar probe)`, `juno`, `europa clipper`, `soho`, `euclid`, `solar orbiter`, `bepicolombo`, `juice`, `lucy`, `psyche`, `osiris-apex` / `osiris-rex`, `mro` / `mars reconnaissance orbiter`, `(mars) odyssey`, `mars express`, `tgo` / `exomars` / `trace gas orbiter`, `curiosity`, `perseverance` (these two open their own animated scene on Mars: Curiosity drilling by Mount Sharp, Perseverance and Ingenuity in Jezero; found rovers also roll by behind the Martian farm), `sojourner` / `pathfinder` / `mars pathfinder` (the first rover, 1997, rolling from its lander to the rock Yogi; Pathfinder also sits outside the Martian farm's Hab) | `#jwst`, `#lucy`, ... |
| 🔭 **The Kepler telescope** | "★ THE PLANET HUNTER ★": the mission replayed on Kepler's Earth-trailing orbit (2009 → "Goodnight Kepler" in 2018), a big pixel Kepler, its story and NASA links. **Or click the little telescope in the map's top-left corner** (zoom 1, not in DEPTH) | `kepler`, `kepler space telescope`, `kepler telescope`, `kepler spacecraft`, `kepler mission`, `space telescope`, `telescope`, `goodnight kepler` (also with "the") | `#Kepler` |
| ☀☀ **Tatooine** | Kepler-16, a real planet with two suns: a "YES, IT'S REAL" pop-up, both stars drawn orbiting each other (they eclipse in KEPLER'S VIEW), and the TATOOINE achievement | `tatooine` (also "the tatooine") | `#Tatooine` |
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

31 eggs: the Solar System, Martian Man (a farm on Mars, a nod to The Martian), the five dwarf planets (Pluto, Ceres, Haumea, Makemake, Eris), Kepler, the ISS, Voyager 1, Voyager 2, New Horizons, Webb, Euclid, SOHO, Parker Solar
Probe, Solar Orbiter, BepiColombo, Juno, Europa Clipper, JUICE, Lucy, Psyche, OSIRIS-APEX, MRO, Mars
Odyssey, Mars Express, ExoMars, Curiosity, Perseverance and Sojourner (clues and stories: `EGGS` in
`web/src/48-gallery.js`).

Names ignore capitals, a leading "the", and hyphens, underscores or dots in place of spaces
("new-horizons", "OSIRIS_REx"), and know common nicknames ("Voyager I", "Curiosity rover", "Percy",
"ExoMars TGO"). Extra or missing spaces don't count, on purpose. A search a letter or two off a hidden name says
**SO CLOSE!** without giving it away; once that egg is found, it asks "did you mean…" and names it.

### Achievements (75, in groups), trophies, badges and your star

Each achievement's trophy shows how hard it is: **bronze** (common), **silver with a gem** (rare), **gold with a
star** (epic), a **galaxy cup** (secret); locked ones show a **space lock**. Completing a group earns its **badge**
(The Compass, The Ringed World, The Light Curve, The Crystal Ball, The Telescope, The Golden Satellite, The
All-Seeing Eye). Your total grows **your star** in the page header: stardust → protostar (1) → young star (5) → red
giant (10) → supergiant (18) → supernova (28) → pulsar (40) → **black hole** for the final mission, **TRUE STAR
GAZER**: open every one of the map's 3,611 systems. Its card reveals itself after 100 systems (with an UNSEEN
highlight under the map); earning it flashes the whole map violet. Afterwards Settings can show a white dwarf
instead, and resetting starts you over as a **white hole**. Design: [STAR_GAZER_MISSION.md](STAR_GAZER_MISSION.md).


| Group | Achievement | How |
|---|---|---|
| Explorer | FIRST LIGHT / STAR HOPPER / GALACTIC CENSUS | Open 1 / 10 / 50 different star systems |
| | ROLL OF THE DICE | Use 🎲 |
| | GHOST HUNTER | Visit a system with only unconfirmed planets |
| | FORTUNE TELLER | Open 🏆 next planets |
| | SIGNAL RECEIVED | Open a shared view link (`#Kepler-90?view=true`) |
| Famous worlds | FIRST ROCK | Visit Kepler-10 (Kepler's first rocky planet) |
| | EIGHT WORLDS | Visit Kepler-90 (eight planets, like ours) |
| | EARTH'S COUSIN | Visit Kepler-452 |
| | FIRST EDEN | Visit Kepler-186 (first Earth-size planet in a habitable zone) |
| | SUPER PUFF | Visit Kepler-51 (planets as dense as cotton candy) |
| | TINY WORLD | Visit Kepler-37 (a planet smaller than Mercury) |
| Science | GOLDILOCKS | Highlight the habitable-zone systems |
| | DOUBLE TROUBLE | Visit a system with more than one star |
| | LAVA WORLD | Visit a planet hotter than 1,500 K |
| | ANCIENT LIGHT | Open a star more than 4,600 light-years away (its light left before the Great Pyramid was built) |
| | FLARE WATCHER | Catch a red dwarf flaring (Kepler-186 is a good place to wait) |
| | TRANSIT WITNESS / MIND THE GAP | Turn on KEPLER'S VIEW / TRUE SCALE |
| Star Gazer's guesses | BELIEVER / SKEPTIC / COIN FLIP | Open a candidate Star Gazer rates ≥ 90% / ≤ 10% / 40–60% |
| Map and tools | DEPTH PERCEPTION / CHIP CHECK / EAGLE EYE | DEPTH on / toggle CCDS / zoom the map to 8× |
| | CARTOGRAPHER | Hop 25 stars in a row with the arrow keys (a click resets the count) |
| | HIGHLIGHTER | Try all five highlight filters in one visit |
| | SKY PHOTOGRAPHER | Open a star's real sky photo |
| | SPACE FARMER | Search "martian man" and watch the farm bring in a whole crop (a minute) |
| | ECO MODE | Set the animation to battery saver |
| | COSMIC ZOOM | Step through every sector of the UNIVERSE view |
| Easter eggs | CURIOUS MIND / MISSION CONTROL / DWARF KING / GRAND TOUR | Find 1 easter egg / 5 spacecraft / all five dwarf planets / all 31 |
| | RED PLANET FLEET | MRO, Odyssey, Mars Express, ExoMars, Curiosity, Perseverance |
| | JUPITER'S ENTOURAGE | Juno, Europa Clipper, JUICE, Lucy |
| | SUN CHASERS | Parker Solar Probe, SOHO, Solar Orbiter |
| | L2 NEIGHBOURS | Webb, Euclid |
| | ROAD TO INTERSTELLAR | Voyager 1, Voyager 2, New Horizons |
| | PHOTO FINISH | Slide a Galleria photo all the way to pixel art |
| | CURATOR | Open ten found Galleria cards in one visit |
| Sky watch | COMET CATCHER / TAIL CHASER | Click a comet passing over the map / catch five (one crosses every 3 to 6 minutes of use, comets and asteroids alike) |
| | ROCK HOUND / ASTEROID CATCHER | Click a tumbling asteroid / catch ten |
| | UFO SPOTTER | Click the flying saucer (after 10 minutes of use, about once an hour) |
| | WHAT WAS THAT? (secret) | See the asteroid that follows the saucer, 2 times in 5 |
| Two suns | TATOOINE / DOUBLE SUNSET | Visit a planet with two suns / all 12 two-sun systems (the "two suns" highlight finds them) |
| Predictions | FIRST CALL / PROPHET / ORACLE | Call a candidate (PLANET or NOT A PLANET in its case file) / be proven right by NASA once / five times |
| | CASSANDRA / CONTRARIAN | Rightly call a false positive Star Gazer believed in / be right three times when Star Gazer was wrong |
| | PATIENCE OF A STAR | Have a call settled a year or more after you made it |
| Daily sky | MYSTERY SOLVED / WEEK OF WONDERS | Solve the daily mystery star (clues on the Galleria's first tab) / seven days in a row |
| Secret | PATIENT OBSERVER | Watch one system for two minutes |
| | NIGHT SHIFT | Open a system between midnight and 4 a.m. |
| | NO SIGNAL | Search for five things that aren't there in one visit |
| | SO CLOSE | Search a hidden name with a letter or two wrong |
| | LOST IN ORBIT | Catch the flare drifting across the universe view: it's an astronaut |

| | WARP SPEED | Find three new easter eggs within a minute |
| | GOODNIGHT KEPLER | Visit on 15 November (Kepler was switched off on 15 November 2018) |
| | LAUNCH DAY | Visit on 7 March (Kepler launched on 7 March 2009) |

**Predictions** (⚙ → PREDICTIONS): every candidate's case file has YOUR CALL buttons. NASA's rulings are recorded
by the monthly data refresh in `web/data/resolutions.js` (since 14 October 2026, dated when first seen); a call
counts only if NASA ruled after it was made. Calls live in the browser with the rest of the progress.

Progress is kept only in the visitor's browser (localStorage, key `starmap.progress.v1`), so refreshes and site
updates keep it; it's lost only if the site's data is cleared, in a private window, or on another browser or device.
⚙ → SETTINGS says whether it's being saved, downloads it as a backup file and loads it back (merging), turns the
pop-ups off, or resets everything. The key and every shipped id never change (`test_progress_ids_are_stable`).

## Expanding ideas (brainstorm)

The endgame (TRUE STAR GAZER, rank emblems, achievements bar) has its own design: [STAR_GAZER_MISSION.md](STAR_GAZER_MISSION.md).

Not built yet; roughly from easiest to biggest.

**Make the game deeper**
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

### Around the trophies

- **Holograms:** click any trophy in the Achievements tab: a projector beams it up with an ARTIFACT SCAN readout
  (and a fact for each hard one). Pin up to three to your header with **SHOW ON MY HEADER**.
- **Constellations:** each group's achievements are the stars of a constellation; complete the group and the
  figure draws itself.
- **Unique trophies:** epic and secret achievements carry a symbol (Mars, Jupiter, the Golden Record, a rocket...).
  GALACTIC CENSUS has levels (★ 50, ★★ 500, ★★★ 1,000 systems). Secrets show a riddle after ten achievements.
- **Daily mystery star:** a new riddle every day; **DOWNLOAD MY STAR CARD** saves your emblem and stats as a
  picture; an 8-bit fanfare plays when you earn something (on by default; switch it off in Settings).

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
- **The antenna** (a little dish on the left edge of the page): opens INCOMING TRANSMISSION, a thank-you note from
  the maker, with a P.S. hint to search the solar system. After a new release it glows, and the note opens with
  WHAT'S NEW IN VX (once per version; the version and changelog link are in the footer).

## Adding a new easter egg

Search words are regular expressions near the top of `web/src/40-home.js` (`HOME_QUERY`) and
`web/src/45-spaceflight.js` (`CRAFT_QUERY`, `ISS_QUERY`) and `web/src/47-kepler.js` (`KEPLER_QUERY`). They are checked in `lookup()` before the Kepler
catalog. Keep them out of the type-ahead so they stay hidden, add a browser test in `tests/test_browser.py`,
add a row to this page, and rebuild with `scripts/starmap/build_web.py`. New sprites: re-run
`scripts/starmap/export_pixel_art.py` so [pixel-art/](../../pixel-art) shows them.

## The lost astronaut's wardrobe

After LOST IN ORBIT (catch the flare in the UNIVERSE view), searching "astronaut" visits them. The 1st visit brings no
outfit, the 2nd always a common one; after that each visit (at most one every 15 minutes) has a 50% chance of an
outfit: common 60%, rare 28%, epic 9%, legendary 3% (so the cowboy hat is about 1.5% a visit). Six visits in a row with
nothing new guarantees something new (never the legendary). Owned outfits can be worn from the card.

| Tier | Outfits |
|---|---|
| Common | party hat, NASA cap, chef's hat, headphones, knit beanie |
| Rare | top hat, pirate hat, propeller beanie, graduation cap, flower crown |
| Epic | wizard hat, Viking helmet, Santa hat, halo |
| Legendary | Texas cowboy hat (HOUSTON, WE HAVE A PROBLEM) |
| Special | the dwarf king's crown, given with DWARF KING |

WARDROBE achievements (their own constellation): DRESS-UP DAY, VISITING HOURS (3 days), RARE THREADS, STAR OF THE
RUNWAY, WALK-IN CLOSET (7 outfits), SPACE WARDROBE (all 15), HOUSTON, WE HAVE A PROBLEM (secret).
