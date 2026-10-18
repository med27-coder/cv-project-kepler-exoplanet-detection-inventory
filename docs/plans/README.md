# Planner: what's next for the star map

Plans waiting to be built, in the suggested order. Each file has the details, concept art and the decisions
still open. (Merged into `main` in October 2026.)

| # | Plan | Status | Next step |
|---|---|---|---|
| - | [BACKGROUND.md](BACKGROUND.md): pixel night-sky page background | **done** (October 2026, `web/src/55-backdrop.js`) | - |
| 1 | [WORLDS_MOONS_AND_SCREENS.md](WORLDS_MOONS_AND_SCREENS.md): hidden spacecraft until named, "lost in orbit" empty screen, a loading screen (a rock with moons), dwarf planets + their moons, exomoon candidates, water worlds from published studies | planned, concept art done | 3 decisions, then build |
| 2 | [HIGHLIGHTS.md](HIGHLIGHTS.md): accurate, explained highlights (Kopparapu habitable zone, facts vs predictions, radius errors), 9 new filters, combined filters with a results list | planned, numbers measured | the user answers its 4 decisions; data first, then an independent data audit |
| 3 | [ACHIEVEMENTS_V2.md](ACHIEVEMENTS_V2.md): 13 chapters as real constellations, 35 new achievements, planets up close, Project Hail Mary (Tau Ceti, secret Erid), "What the alien doing", comets/asteroids/UFO sky events, rewards and titles | planned, concept art done | the user answers its 5 decisions, then build in its 5 steps |
| 4 | [CONSTELLATIONS.md](CONSTELLATIONS.md): the constellation data (d3-celestial, BSD) and how figures draw | data checked; pairing superseded by #2 | built as part of #2 |
| 5 | [TROPHIES_AND_DATA.md](TROPHIES_AND_DATA.md): **version updates** (semantic versions, changelog, GitHub Releases, "what's new in vX"), Gaia-based planet sizes, star types and life stages, brown dwarfs, the trophy ladder (new **nebula** tier, the **universe cup** for secrets), unique trophies, levelled achievements (DWARF KING, DWARF STAR) | planned, references fetched | 4 decisions; version updates can go first |
| 6 | [UNIVERSE_SECTORS.md](UNIVERSE_SECTORS.md): the observable universe in sectors, ◀ ▶ / ↑ ↓ to move: a zoom-out ladder (Kepler's field → neighbourhood → Milky Way → Local Group → Laniakea → the observable universe), then the whole sky in 12 sectors with every known exoplanet | **ladder built** (October 2026, `56-universe.js`) | the whole sky in 12 sectors |
| 7 | [FLEET_CLOSEUPS.md](FLEET_CLOSEUPS.md): spacecraft hidden as flashing lights until named, animated close-ups (probes in space, robots on Mars, the Moon, Venus, Titan, a comet, an asteroid; active or mission ended), new robot easter eggs, special trophies (STILL ROLLING, HONOUR ROLL, FIRST FLIGHT, WORLDS TOUCHED) | planned; replaces section 6 of #1 | 3 decisions; user's reference images welcome |
| 8 | [STAR_GAZER_V4.md](STAR_GAZER_V4.md): **Colossus**, a giant-planet specialist beside V3 (which keeps the small planets); fixes giants and deep transits (stellar density check, transit shape, Gaia RUWE, difference images), explicit missing values, calibrated "not sure" band, optional TESS (V4.1); pre-registered, with a prospective test on NASA's future rulings | **tested 17 Oct 2026: primary endpoint failed** (72% vs V3\'s 81% giant recall; `docs/V4_RESULTS.md`) | a new pre-registered attempt: physics features inside V3, or a view-reading giant specialist |
| - | [BADGES_AND_ICONS.md](BADGES_AND_ICONS.md) | done (October 2026) | - |
| - | [TATOOINE_AND_PROPHET.md](TATOOINE_AND_PROPHET.md) | done (October 2026) | - |

Concept art: `pixel-art/concepts/` (`scripts/starmap/draft_concepts.py`), references in `pixel-art/references/`.

Housekeeping still open (user): back up `.secrets/star_gazer.key`; GitHub Dependabot security updates and 2FA.
