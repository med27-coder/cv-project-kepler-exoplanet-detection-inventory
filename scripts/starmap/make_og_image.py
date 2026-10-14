"""Draw the star map's social preview image (web/og.png, 1200×630) from web/data/systems.js.

    .venv\\Scripts\\python scripts\\starmap\\make_og_image.py

Run it after export_starmap.py. Uses the same projection and colours as web/starmap.js, so the
preview shows the real map: every star is a pixel, spotlight systems in gold.
"""

import json
import math
import sys
from pathlib import Path

import matplotlib
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'web' / 'data' / 'systems.js'
OUT = ROOT / 'web' / 'og.png'
W, H = 1200, 630
BG, INK, INK2, GOLD = (7, 11, 26), (230, 236, 255), (154, 166, 214), (255, 211, 77)
MAP_PX, CELL = 192, 3          # the page's 192×192 map, each map pixel drawn as 3×3


def load(path=DATA):
    text = path.read_text(encoding='utf-8')
    return json.loads(text[text.index('{'):text.rindex('}') + 1])


def project(stars, col, size=MAP_PX, pad=6):
    """Same projection as starmap.js: RA scaled by cos(dec), east to the left."""
    ras = [s[col['ra']] for s in stars]
    decs = [s[col['dec']] for s in stars]
    cosd = math.cos(math.radians((min(decs) + max(decs)) / 2))
    xs, ys = [-r * cosd for r in ras], [-d for d in decs]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    scale = (size - 2 * pad) / span
    ox = (size - (max(xs) - min(xs)) * scale) / 2
    oy = (size - (max(ys) - min(ys)) * scale) / 2
    return [(round(ox + (x - min(xs)) * scale), round(oy + (y - min(ys)) * scale)) for x, y in zip(xs, ys)]


def star_color(star, col):
    mag = star[col['kepmag']] if star[col['kepmag']] is not None else 15
    light = round(255 - min(max(mag - 9, 0), 8) * 14)
    if star[col['drawn']]:
        return (light - 30, light - 15, light)
    return (int(light * 0.35), int(light * 0.4), int(light * 0.55))


def font(size, bold=False):
    name = 'DejaVuSansMono-Bold.ttf' if bold else 'DejaVuSansMono.ttf'
    return ImageFont.truetype(str(Path(matplotlib.get_data_path()) / 'fonts' / 'ttf' / name), size)


def draw(data):
    col = {c: i for i, c in enumerate(data['columns'])}
    stars = data['stars']
    pos = project(stars, col)
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)

    x0, y0 = 40, (H - MAP_PX * CELL) // 2
    side = MAP_PX * CELL
    d.rectangle([x0 - 6, y0 - 6, x0 + side + 5, y0 + side + 5], outline=(42, 53, 102), width=3)
    for star, (x, y) in sorted(zip(stars, pos), key=lambda t: t[0][col['spot']]):   # spotlight on top
        px, py = x0 + x * CELL, y0 + y * CELL
        if star[col['spot']]:
            d.rectangle([px - CELL, py - CELL, px + CELL * 2 - 1, py + CELL * 2 - 1], fill=GOLD)
        else:
            d.rectangle([px, py, px + CELL - 1, py + CELL - 1], fill=star_color(star, col))

    tx = x0 + MAP_PX * CELL + 60
    d.text((tx, 120), 'KEPLER', font=font(78, bold=True), fill=GOLD)
    d.text((tx, 205), 'STAR MAP', font=font(78, bold=True), fill=GOLD)
    n_drawn = sum(1 for s in stars if s[col['drawn']])
    lines = [(f'{len(stars):,} Kepler stars', INK), (f'{n_drawn:,} systems in pixels', INK),
             ('Search a star,', INK2), ('watch its planets orbit.', INK2)]   # ≤ 26 chars: fits at 26 px
    for i, (line, color) in enumerate(lines):
        d.text((tx, 320 + i * 42), line, font=font(26), fill=color)
    d.text((tx, 525), 'Data: NASA Exoplanet Archive', font=font(20), fill=INK2)
    return img


def main():
    if not DATA.exists():
        sys.exit('web/data/systems.js not found; run scripts/starmap/export_starmap.py first.')
    img = draw(load())
    img.save(OUT, optimize=True)
    print(f'Saved {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
