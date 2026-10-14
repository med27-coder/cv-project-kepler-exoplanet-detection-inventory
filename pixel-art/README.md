# Pixel art

The star map's sprites (`web/`), enlarged so you can see every pixel, plus room for new drafts.

| Folder | What's in it |
|---|---|
| [`solar-system/`](solar-system/) | The eight planets and Pluto. `<body>.png` is the planet drawn large; `<body>_scene.png` is its real size on the map with its moons (one pixel each); `sheet.png` shows them all side by side |
| [`spacecraft/`](spacecraft/) | `kepler.png` (the telescope in the map's corner; click it on the site), `iss.png` (the space station easter egg), `marker.png` (how spacecraft are marked in the Solar System view) |

Nothing here is loaded by the website: the site draws everything in code, a few pixels at a time
(`web/src/40-home.js`, `45-spaceflight.js`, `47-kepler.js`).

## Regenerate

The PNGs above are drawn by the site's own code, so they always match it:

```powershell
.venv\Scripts\python scripts\starmap\export_pixel_art.py
```

## Drafts

Put new ideas next to the generated files as `draft_<name>.png` (for example
`solar-system/draft_ceres.png`). The export script never overwrites `draft_*` files. Keep drafts on the
site's grid: one draft pixel per screen pixel, the dark background `#070b1a`, and a small palette.
When a draft is approved, it gets turned into drawing code in `web/src/`.
