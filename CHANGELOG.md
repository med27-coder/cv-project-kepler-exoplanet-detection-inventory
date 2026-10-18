# Changelog

Notable changes to the Kepler Star Map (`web/`), newest first, in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, with [semantic versions](https://semver.org/):
MAJOR for a redesign or a change in how progress is saved (progress is never lost), MINOR for new features, PATCH
for fixes. The NASA data refresh keeps its own date, shown in the footer. The version lives in
`web/src/00-version.js`; each version also gets a git tag and a GitHub Release. Star Gazer, the model, has its own
history in `docs/star-gazer/`.

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

[1.0.0]: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory/releases/tag/v1.0.0
