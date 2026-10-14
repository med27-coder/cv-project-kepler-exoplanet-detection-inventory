"""Draw the star map's background (web/sky.png): the real Milky Way in the Kepler field, pixelated.

    .venv\\Scripts\\python scripts\\starmap\\make_sky_backdrop.py

Source: ESA Gaia DR3 colour flux map, cut out by the CDS hips2fits service. The cutout uses a
plate carrée WCS built from the same projection as web/starmap.js (RA scaled by cos(dec), east
to the left), so image pixels land under the right stars at every zoom. It is drawn as pixel art:
one backdrop pixel per map pixel (the same grid as the stars), a fixed night-sky palette with
ordered (Bayer) dithering, and the field's real bright star clumps as faint specks.
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

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'web' / 'sky.png'
HIPS = 'CDS/P/DM/flux-color-Rp-G-Bp/I/355/gaiadr3'   # ESA/Gaia/DPAC, via CDS
HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits'
RES = 1          # backdrop pixels per map pixel at zoom 1 (same pixel grid as the stars)
OVERSAMPLE = 4   # fetched this much finer, then averaged down (smooths Gaia's star-count noise)
PAD = 6          # same as starmap.js
# Night sky to Milky Way glow; the first colour is the page background (style.css --bg).
RAMP = ['#070b1a', '#0a0f24', '#0e142e', '#141a3a', '#1c1f46', '#262450', '#332a58', '#43325e', '#553c62']
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
DARK_PCT = 15    # this share of the field stays pure night
GAMMA = 1.8      # > 1: only the Milky Way band rises, dust lanes stay dark
SPECKS = 0.012   # share of pixels lit as faint star specks


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


def stylise(img, size):
    """Gaia flux map -> pixel-art sky: brightness steps through RAMP with 4×4 Bayer dithering; pixels
    much brighter than their surroundings (real star clumps) become specks two steps up."""
    small = img.resize((size, size), Image.BOX)
    sharp = np.asarray(small, dtype=float).mean(axis=2)
    lum = np.asarray(small.filter(ImageFilter.GaussianBlur(1.2)), dtype=float).mean(axis=2)
    lo, hi = np.percentile(lum, [DARK_PCT, 99.8])
    top = len(RAMP) - 0.6
    level = np.clip((lum - lo) / (hi - lo), 0, 1) ** GAMMA * top
    threshold = np.tile(BAYER, (size // 4 + 1, size // 4 + 1))[:size, :size]
    idx = np.clip(np.floor(level + threshold), 0, len(RAMP) - 1).astype(int)
    excess = sharp - lum
    specks = excess > np.quantile(excess, 1 - SPECKS)
    idx[specks] = np.minimum(idx[specks] + 2, len(RAMP) - 1)
    palette = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in RAMP], dtype=np.uint8)
    return Image.fromarray(palette[idx]).quantize(colors=len(RAMP), dither=Image.Dither.NONE)


def main():
    data = load(DATA)
    col = {c: i for i, c in enumerate(data['columns'])}
    wcs = map_wcs(data['stars'], col, res=RES * OVERSAMPLE)
    print(f'Fetching the Gaia DR3 sky ({wcs["NAXIS1"]}×{wcs["NAXIS2"]}) from CDS hips2fits...')
    try:
        img = fetch(wcs)
    except OSError as exc:
        sys.exit(f'Could not download the sky image: {exc}')
    stylise(img, MAP_PX * RES).save(OUT, optimize=True)
    print(f'Saved {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
