# Easter eggs (spoilers!)

The Kepler Star Map hides a few things that aren't Kepler systems. The README only hints at them. Here's the
full list for anyone maintaining the site. Search is case-insensitive.

| Easter egg | What you get | Type any of these in the search box | Direct link |
|---|---|---|---|
| 🌍 **Our Solar System** | "★ YOU ARE HERE ★": the Sun and all eight planets in hand-made pixel art (Earth spinning with the Moon, Jupiter's Great Red Spot, Saturn's and Uranus' rings), the asteroid and Kuiper belts, the planet table, and a fact sheet about the Sun's names, dwarf planets, the heliosphere and the Oort Cloud, linked to NASA, JPL and IAU pages | `sun`, `sol`, `solar system`, `earth`, `home`, `you are here` (also with "the": `the sun`) | `#Sun` |
| 🛰️ **Our spacecraft** | "★ HUMANITY'S ROBOTS ★": the Solar System frozen on one real date with 19 spacecraft beyond Earth orbit at their real positions (NASA JPL Horizons), each with its signal delay and mission page, plus the Mars rovers' landing sites | `spacecraft`, `space craft`, `probe(s)`, `space probe(s)`, `robots`, `missions`, `jwst`, `webb`, `james webb (space telescope)`, `voyager`, `voyager 1`, `voyager 2`, `new horizons`, `parker (solar probe)`, `juno`, `europa clipper`, `rover(s)`, `mars rover(s)`, `curiosity`, `perseverance` | `#Spacecraft` |
| 🏠 **The International Space Station** | "★ PEOPLE LIVE UP HERE ★": a pixel Earth with the ISS on a to-scale orbit (sped up ~460×), NASA's facts and a link to Spot the Station | `iss`, `space station`, `international space station` (also with "the") | `#ISS` |

Earth-orbit satellites are left out on purpose; the ISS is the only exception.

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
`web/src/45-spaceflight.js` (`CRAFT_QUERY`, `ISS_QUERY`). They are checked in `lookup()` before the Kepler
catalog. Keep them out of the type-ahead so they stay hidden, add a browser test in `tests/test_browser.py`,
add a row to this page, and rebuild with `scripts/starmap/build_web.py`.
