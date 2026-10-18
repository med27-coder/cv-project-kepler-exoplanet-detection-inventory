# Plan: the fleet, hidden as flashing lights, close-ups, and robots on other worlds

**Status: plan** (17 October 2026). Replaces section 6 of WORLDS_MOONS_AND_SCREENS.md ("hidden until named"),
with the user's design. Every status ("active", "mission ended") is checked against the agency's own page when
built, dated, and shown with that date, since statuses change.

## 1. Hidden as flashing lights

- In the spacecraft view, every craft you haven't found is a **flashing light** at its real position (JPL
  Horizons), no name, no table row ("??? · find it by name", with the Galleria clue).
- Searching its name correctly: the light flares, the pixel sprite appears in its place with its name, and it
  stays visible from then on (it's saved like any easter egg).
- The educational "show everything" switch unlocks after GRAND TOUR.

## 2. Close-ups

Searching a found craft, or clicking it, opens a **close-up**: the craft large, animated, in its setting.
- **Orbiters and probes** in space: Juno over Jupiter's clouds, MRO over Mars, Voyager 1 with the Sun as a dot
  behind it, Webb with its sunshield, Parker skimming the Sun's corona.
- **Robots on the ground**, on a strip of their world's surface (pixel terrain from the real colours:
  Mars rust, the Moon's grey, Titan's orange haze, Venus's yellow glare):
  - **active**: wheels turning, mast camera scanning, dust trailing, the occasional "beep" of data sent;
  - **mission ended**: still, dust-covered, panels dimmed, a small plaque with the dates ("MISSION ENDED
    2019"), a quiet memorial; no animation but drifting dust.
- A card beside it: what it did, its dates, its status ("active, as of <date>"), and the NASA photo.

## 3. Robots on other worlds (the new easter eggs)

Status to be re-checked at build; as known in October 2026:

| World | Robot | Status |
|---|---|---|
| Mars | Curiosity, Perseverance (already eggs) | active |
| Mars | Ingenuity, the first powered flight on another world (19 April 2021) | mission ended January 2024, rotor damaged |
| Mars | Opportunity, Spirit | ended 2019 and 2011 |
| Mars | Sojourner (1997), Viking 1 and 2 landers (1976), Phoenix (2008), InSight (2018-2022) | ended |
| Mars | Zhurong (China, 2021) | dormant since May 2022 |
| Moon | Apollo 15, 16 and 17 rovers (1971-72), Lunokhod 1 and 2 (USSR) | left on the Moon |
| Moon | Pragyan (India, 2023), Yutu-2 (China, far side, 2019) | asleep / check status |
| Venus | Venera 13: 127 minutes on the surface (1982) | ended |
| Titan | Huygens (ESA), landed 14 January 2005 | ended; ESA images linked, not copied |
| Comet 67P | Philae (ESA), 2014 | ended; ESA images linked |
| Asteroid Eros | NEAR Shoemaker, the first landing on an asteroid (2001) | ended |

Searching a robot finds it like any easter egg; non-NASA robots use their agencies' public images where the
licence allows, otherwise a link (as for ESA today).

## 4. Special trophies

Each with its own symbol on the cup (as SYMBOLS do today):
- **STILL ROLLING**: find every active rover (a turning wheel);
- **HONOUR ROLL**: visit every robot whose mission ended (a small plaque);
- **FIRST FLIGHT**: find Ingenuity (a rotor);
- **WORLDS TOUCHED**: find a robot on each world (Mars, the Moon, Venus, Titan, a comet, an asteroid): a globe
  ringed by six dots; a **nebula** cup if that tier is built (TROPHIES_AND_DATA.md);
- **LIGHT CATCHER** (secret): find five craft from their flashing lights alone, by clicking a light and then
  naming it.

## 5. Art and references

- NASA references fetched into `pixel-art/references/fleet/` (`fetch_references.py`), ESA ones linked only.
- **The user's own references** are welcome for the close-up style (how big, how detailed, the mood): they go in
  `pixel-art/references/user/`, inspiration only and not committed unless their licence allows.
- Concept art first: `pixel-art/concepts/draft_fleet_*.png` (a flashing light, an active rover, a retired
  rover with its plaque, a probe close-up).

## 6. Build order

1. Flashing lights and reveal (small, makes the game consistent).
2. The close-up viewer with two kinds (space, surface), active vs ended.
3. The robots-on-worlds eggs and their cards (statuses checked and dated).
4. Trophies, tests (each robot found by name, flashing lights hide names), docs.

## 7. Decisions for you

1. Robots from every agency (recommended: the story is humanity's), or NASA only?
2. All the robots in section 3, or a first set (Mars and the Moon)?
3. Your reference images: please share them when convenient (for the close-up style).
