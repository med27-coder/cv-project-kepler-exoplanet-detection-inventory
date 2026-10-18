# Kepler Star Map (web/)

A static pixel-art map of every Kepler star with a planet or planet candidate, published with GitHub Pages
(`.github/workflows/pages.yml` deploys this folder on every push that changes it). There is no server, build
system or framework: the page also works opened straight from disk.

| Path | What it is | Made by |
|---|---|---|
| `index.html`, `style.css` | The page and its styles (strict Content Security Policy: no inline code) | hand-written |
| `src/*.js` | The page's code, in readable parts: data, map, system view, controls, info panel, Solar System, spacecraft/ISS, spacecraft pixel art, the Kepler telescope, the Galleria game, wiring, animation loop | hand-written |
| `starmap.js` | The one script the page loads: `src/*.js` joined in order. **Don't edit it**; run `scripts/starmap/build_web.py` | generated |
| `data/systems.js` | Index of all 3,611 stars, highlight tags and the "next planets" list (loaded up front) | `scripts/starmap/export_starmap.py` |
| `data/details/NN.js` | Star facts and planets per system, in 32 files, loaded when a system is opened | `scripts/starmap/export_starmap.py` |
| `data/spacecraft.js` | Planet and spacecraft positions for the spacecraft easter egg | `scripts/starmap/fetch_spacecraft.py` |
| `data/ccd.js` | Kepler's 21 CCD module outlines | `scripts/starmap/make_ccd_footprint.py` |
| `data/gallery.js`, `gallery/*.jpg` | Credits and small copies (240 px) of the official NASA photos shown in the Galleria | `scripts/starmap/fetch_references.py` |
| `data/earth.js` | Earth's surface as a 128 × 64 pixel map (NASA Blue Marble), wrapped onto the pixel Earth | `scripts/starmap/make_earth_map.py` |
| `sky.png`, `sky/*.jpg` | Milky Way backdrop (ESA Gaia DR3) and sky photos for the 14 featured systems | `scripts/starmap/make_sky_backdrop.py`, `make_sky_thumbs.py` |
| `og.png` | Link preview image (1200×630) | `scripts/starmap/make_readme_media.py` (fallback: `make_og_image.py`) |
| `fonts/` | Press Start 2P and VT323 (SIL Open Font License, self-hosted) | |

The sprites, enlarged, are in [pixel-art/](../pixel-art/) (`scripts/starmap/export_pixel_art.py`).
Every data field is described in [docs/DATA_DICTIONARY.md](../docs/DATA_DICTIONARY.md); the hidden extras are
in [docs/EASTER_EGGS.md](../docs/EASTER_EGGS.md).

## Working on it

```powershell
# after editing web/src/*.js
.venv\Scripts\python scripts\starmap\build_web.py
# try it: open web\index.html in a browser, or serve the folder
.venv\Scripts\python -m http.server 8000 --directory web
# check it
.venv\Scripts\python -m pytest -q tests/test_web_data.py tests/test_browser.py tests/test_palette.py
```

Rules the tests enforce:
- **Content Security Policy:** no inline scripts, styles or event handlers. Anything written into the page goes
  through `esc()` / `fmt()`.
- **Data:** the data files stay under their size budgets.
- **Colours:** colours that carry meaning stay distinguishable for colour-blind readers.
