# Pixel art

The star map's sprites (`web/`), enlarged so you can see every pixel, the official images they were
drawn from, and room for new drafts.

| Folder | What's in it |
|---|---|
| [`solar-system/`](solar-system/) | The eight planets and Pluto. `<body>.png` is the planet drawn large; `<body>_scene.png` is its real size on the map with its moons (one pixel each); `sheet.png` shows them all side by side. Earth is NASA's Blue Marble wrapped on a tilted globe |
| [`spacecraft/`](spacecraft/) | One sprite per spacecraft and rover in the easter eggs (`jwst.png`, `voyager.png`, `curiosity.png`, ...), `sheet.png` with all of them labelled, `kepler.png` (the telescope in the map's corner), `iss.png` and `iss_orbit.png` (the space station, big and on its orbit), `marker.png` (the cross that marks spacecraft) |
| [`emblems/`](emblems/) | Concept drafts of the rank emblems (a star's life, stardust to black hole) and the header mock-up: see [docs/star-map/STAR_GAZER_MISSION.md](../docs/star-map/STAR_GAZER_MISSION.md) |
| [`archive/`](archive/) | Pixel art we replaced or scrapped (old link previews, the rock loading screen, first drafts, earlier sprites), each with why: see [`archive/README.md`](archive/README.md). Anything replaced from now on is copied here first |
| [`references/`](references/) | Official images the sprites were drawn from: NASA Image and Video Library pictures of the spacecraft, natural-colour photos of the Sun, every planet, the Moon and Pluto, Voyager's Pale Blue Dot, the stages of a star's life for the emblems (`stars/`), and the Blue Marble map behind the pixel Earth. Small copies are shown in the star map's Galleria. Sources and credits: [`references/SOURCES.md`](references/SOURCES.md) |

Nothing here is loaded by the website: the site draws everything in code, a few pixels at a time
(`web/src/40-home.js`, `45-spaceflight.js`, `46-craft-art.js`, `47-kepler.js`) plus the Earth map in
`web/data/earth.js`.

## Regenerate

```powershell
.venv\Scripts\python scripts\starmap\export_pixel_art.py   # the PNGs, drawn by the site's own code
.venv\Scripts\python scripts\starmap\fetch_references.py   # the reference images and SOURCES.md
.venv\Scripts\python scripts\starmap\make_earth_map.py     # web/data/earth.js from the Blue Marble
```

## Drafts

Put new ideas next to the generated files as `draft_<name>.png` (for example
`spacecraft/draft_hubble.png`). The export script never overwrites `draft_*` files. Keep drafts on the
site's grid: one draft pixel per screen pixel, the dark background `#070b1a`, and the colours in
`CRAFT_INK` (`web/src/46-craft-art.js`). When a draft is approved, it becomes a new row-of-letters
sprite in `CRAFT_ART`.
