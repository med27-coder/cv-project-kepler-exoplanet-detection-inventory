"""Draw the star map's background (web/sky.png): the real Milky Way in the Kepler field, pixelated.

    .venv\\Scripts\\python scripts\\make_sky_backdrop.py

Source: ESA Gaia DR3 colour flux map, cut out by the CDS hips2fits service. The cutout uses a
plate carrée WCS built from the same projection as web/starmap.js (RA scaled by cos(dec), east
to the left), so image pixels land under the right stars at every zoom. The image is blurred into
a glow, darkened and reduced to a few colours, so it stays a backdrop and the file stays small.
Run it after export_starmap.py (the projection depends on the exported stars).
"""

import io
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from make_og_image import DATA, MAP_PX, load
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web' / 'sky.png'
HIPS = 'CDS/P/DM/flux-color-Rp-G-Bp/I/355/gaiadr3'   # ESA/Gaia/DPAC, via CDS
HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits'
RES = 2          # backdrop pixels per map pixel at zoom 1
PAD = 6          # same as starmap.js
COLOURS = 10     # palette size after reduction
DIM = 0.38       # brightest glow, as a fraction of full brightness (the stars stay on top)
NIGHT = (7, 11, 26)   # the page background (style.css --bg)


def map_wcs(stars, col, size=MAP_PX, res=RES, pad=PAD):
    """FITS WCS (CAR, CRVAL2=0: a plain RA/Dec grid) whose pixels match the page's map pixels.

    Mirrors starmap.js: x = -ra*cos(dec0), y = -dec, scaled to fit `size` with `pad`, centred."""
    ras = [s[col['ra']] for s in stars]
    decs = [s[col['dec']] for s in stars]
    cosd = math.cos(math.radians((min(decs) + max(decs)) / 2))
    xs, ys = [-r * cosd for r in ras], [-d for d in decs]
    x_min, y_min = min(xs), min(ys)
    span = max(max(xs) - x_min, max(ys) - y_min)
    scale = (size - 2 * pad) / span
    off_x = (size - (max(xs) - x_min) * scale) / 2
    off_y = (size - (max(ys) - y_min) * scale) / 2
    n = size * res

    # image column c (0-based) is map x u = (c + 0.5)/res; FITS pixel i = c + 1
    def ra_at(c):
        return -(x_min + ((c + 0.5) / res - off_x) / scale) / cosd

    # image row r (0 = top) is map y v = (r + 0.5)/res; FITS pixel j = n - r counts upward
    def dec_at(j):
        return -(y_min + ((n - j + 0.5) / res - off_y) / scale)

    cdelt2 = dec_at(2) - dec_at(1)
    return {'NAXIS': 2, 'NAXIS1': n, 'NAXIS2': n, 'CTYPE1': 'RA---CAR', 'CTYPE2': 'DEC--CAR',
            'CRVAL1': ra_at(0), 'CRPIX1': 1, 'CDELT1': ra_at(1) - ra_at(0), 'CUNIT1': 'deg',
            'CRVAL2': 0.0, 'CRPIX2': 1 - dec_at(1) / cdelt2, 'CDELT2': cdelt2, 'CUNIT2': 'deg',
            'RADESYS': 'ICRS'}


def fetch(wcs):
    query = urllib.parse.urlencode({'hips': HIPS, 'wcs': json.dumps(wcs), 'format': 'png'})
    with urllib.request.urlopen(f'{HIPS2FITS}?{query}', timeout=120) as resp:   # fixed https host
        return Image.open(io.BytesIO(resp.read())).convert('RGB')


def stylise(img):
    """Star field -> soft pixel glow over the page's night blue, reduced to a small palette."""
    glow = np.asarray(img.filter(ImageFilter.GaussianBlur(1.6)), dtype=float)
    lum = glow.mean(axis=2)
    lo, hi = np.percentile(lum, [2, 99.5])
    level = np.clip((lum - lo) / (hi - lo), 0, 1) ** 1.3          # contrast stretch: dust lanes show
    hue = glow / np.maximum(glow.max(axis=2, keepdims=True), 1)    # keep Gaia's colour, not its brightness
    out = np.array(NIGHT) + level[..., None] * hue * 255 * DIM
    pic = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    return pic.quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def main():
    data = load(DATA)
    col = {c: i for i, c in enumerate(data['columns'])}
    wcs = map_wcs(data['stars'], col)
    print(f'Fetching the Gaia DR3 sky ({wcs["NAXIS1"]}×{wcs["NAXIS2"]}) from CDS hips2fits...')
    try:
        img = fetch(wcs)
    except OSError as exc:
        sys.exit(f'Could not download the sky image: {exc}')
    stylise(img).save(OUT, optimize=True)
    print(f'Saved {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
