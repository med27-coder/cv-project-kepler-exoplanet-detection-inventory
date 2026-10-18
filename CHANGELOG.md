# Changelog

Notable changes to the Kepler Star Map (`web/`), newest first, in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, with [semantic versions](https://semver.org/):
MAJOR for a redesign or a change in how progress is saved (progress is never lost), MINOR for new features, PATCH
for fixes. The NASA data refresh keeps its own date, shown in the footer. The version lives in
`web/src/00-version.js`; each version also gets a git tag and a GitHub Release. Star Gazer, the model, has its own
history in `docs/star-gazer/`.

## [1.6.0] - 2026-10-18

### Changed
- **New spacecraft and rover pixel art:** all 21 sprites redrawn larger (up to 35 x 17) and shaded, each with its
  signature: Webb's 18 gold hexagons and its secondary mirror, Juno's three solar arms seen from above, Lucy's two
  round arrays, Psyche's blue thruster glow, Mars Express's radar antennas, the TAGSAM arm on OSIRIS-APEX, the
  rovers' rocker-bogie wheels and finned power units, and more. The first set is kept in `pixel-art/archive/`.

### Fixed
- `export_pixel_art.py` stopped working after v1.0.0 (the page now loads `starmap.js?v=...`); it matches again.

## [1.5.0] - 2026-10-18

### Added
- **Fun facts in the Galleria:** every found easter egg's card now lists three fun facts and WHY IT'S HERE, what
  inspired hiding it in the game (`web/src/48c-egg-facts.js`). Hidden until the egg is found, so nothing is spoiled.

## [1.4.0] - 2026-10-18

### Added
- **The Mars rovers at work**, animated like the Martian farm: searching "curiosity" shows Curiosity climbing past
  Mount Sharp in Gale Crater, stopping to drill and look around; "perseverance" (or "percy") shows Perseverance by the
  old river delta in Jezero Crater, leaving sample tubes while Ingenuity takes off, flies and lands. Each scene has
  the real rover's facts and NASA's mission page. "mars rovers" still shows where everything is.
- Rovers you have found roll by far off behind the Martian farm.

## [1.3.1] - 2026-10-18

### Changed
- The Solar System's Galleria photo is now NASA/JPL's montage of the Sun and all eight planets (it was the Pale
  Blue Dot, where the Solar System is hard to see).
- Martian Man's main picture is NASA's art of the first humans on Mars, habitats and all; the crops photo joins the
  reference strip, and a link points to the film's own page (film stills belong to the studio, so they aren't copied).

## [1.3.0] - 2026-10-18

### Added
- **Card arrows in the Galleria:** an open easter-egg card has ◀ ▶ on its edges (they stay in view while you
  scroll), and the left and right arrow keys do the same, stepping through every card and wrapping round, so you
  no longer need BACK between cards. The card's number shows at the top (CARD 13 / 30).

## [1.2.1] - 2026-10-18

### Fixed
- The astronaut's wardrobe: the outfit buttons are small pixel chips again (they used the page's big button style),
  and the count no longer reads "0 of 15" when the dwarf king's crown is owned: it says the crown is a special extra.

## [1.2.0] - 2026-10-18

### Changed
- **Voyager 1 and Voyager 2 are two easter eggs** (30 in all), each with its own clue and story. Searching plain
  "voyager" shows both on the map but finds neither, and a pop-up asks which one. ROAD TO INTERSTELLAR now needs
  both Voyagers and New Horizons. Progress keeps a found "Voyager" as Voyager 1.
- **The unlock fanfare is on by default**; the switch in Settings turns it off, and that choice is remembered.

### Fixed
- The fanfare sometimes stayed silent: browsers keep audio asleep until a click or key press, so an achievement
  earned without one (a timer, a passing comet) was lost. Audio now wakes on the first click or key, and a fanfare
  that arrives while it sleeps waits for it.

## [1.1.0] - 2026-10-18

### Added
- **Sky watch:** every 3 to 6 minutes of use, a comet (a bright head with a curved dust tail and a faint ion tail,
  both pointing away from the Sun) or a tumbling asteroid crosses the Kepler map, and something rarer now and then.
  Click one to catch it: six new achievements (75 in all) in a SKY WATCH constellation, with the SHOOTING STAR badge.
  Off with reduced motion or the animation off; half as often in battery-saver mode.

### Fixed
- A browser test that could fail by chance (the astronaut's wardrobe cooldown); dependency minimums raised past
  known security fixes.

## [1.0.0] - 2026-10-18

The first full release, gathering everything built since the star map went online on 12 October 2026.

### Added
- **The map:** every Kepler star with confirmed planets or candidates (3,600+), zoom and pan, type-ahead search,
  highlights (habitable zone, two suns and more), a side view from Earth (DEPTH), Kepler's camera chips (CCDS),
  real sky photos, shareable view links, and a colour-blind-safe palette.
- **The systems:** planets orbiting in pixel art, KEPLER'S VIEW (edge-on transits), TRUE SCALE, star types, flaring
  red dwarfs, case files for candidates, "next planets", and Star Gazer's predictions beside NASA's rulings.
- **Easter eggs:** our Solar System, Kepler itself, the ISS, the spacecraft beyond Earth orbit (hidden as flashing
  lights until named), the five dwarf planets, and a few secrets.
- **The Galleria:** a collecting game with pixel art beside NASA photos, 69 achievements in constellations,
  trophies by difficulty, badges, your star in the header (stardust to black hole), predictions you can make
  before NASA rules, a daily mystery star, and progress you can back up and restore.
- **The UNIVERSE view:** a zoom-out ladder from Kepler's field to the observable universe, with something lost in it.
- **The page:** a pixel night-sky background (with a pause button), a Delta II loading screen, link previews, a
  first-visit tour, and an antenna on the left edge with a note from the maker (it also announces new versions).
- **Version updates:** this changelog, a version in the footer, and fresh files after each release.

### Changed
- Search counts hyphens, underscores and dots as spaces, knows common nicknames, and says SO CLOSE when nearly right.
- The licence is PolyForm Noncommercial 1.0.0, with Terms of Use v1.1.

### Fixed
- Phones: the toolbar no longer runs off screen; Galleria photos are no longer cropped or soft.
- Easter eggs searched again open their view without an extra pop-up; the UNSEEN highlight updates as you explore.
- Animation trails after the tab was in the background; a timing race in Settings; stacked animation loops.

[1.6.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.6.0
[1.5.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.5.0
[1.4.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.4.0
[1.3.1]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.3.1
[1.3.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.3.0
[1.2.1]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.2.1
[1.2.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.2.0
[1.1.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.1.0
[1.0.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.0.0
