"""Pre-made sky photos for the star map's spotlight systems (web/sky/*.jpg).

    .venv\\Scripts\\python scripts\\make_sky_thumbs.py

The page shows a 40x40 photo of the sky around each system, fetched live from the CDS hips2fits
service. For the spotlight systems (the quick-pick buttons, where most visits start) the same
images are stored with the site, so those visits make no third-party request at all. Same
surveys, size and field as the live ones (DSS2 / Pan-STARRS1 / 2MASS; credited in the footer).
"""

import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from make_og_image import DATA, load

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web' / 'sky'
HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits'
SURVEYS = {'dss2': 'CDS/P/DSS2/color', 'ps1': 'CDS/P/PanSTARRS/DR1/color-z-zg-g', '2mass': 'CDS/P/2MASS/color'}


def slug(name):
    """'Kepler-90' -> 'kepler-90' (the page builds the same file names)."""
    return re.sub(r'[^a-z0-9-]', '_', name.lower())


def main():
    data = load(DATA)
    col = {c: i for i, c in enumerate(data['columns'])}
    stars = {s[col['name']]: s for s in data['stars']}
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for name in data['spotlight']:
        s = stars[name]
        for key, hips in SURVEYS.items():
            query = urllib.parse.urlencode({'hips': hips, 'width': 40, 'height': 40, 'fov': 0.04,
                                            'projection': 'TAN', 'coordsys': 'icrs',
                                            'ra': s[col['ra']], 'dec': s[col['dec']], 'format': 'jpg'})
            try:
                with urllib.request.urlopen(f'{HIPS2FITS}?{query}', timeout=60) as r:   # fixed https host
                    (OUT / f'{slug(name)}_{key}.jpg').write_bytes(r.read())
                n += 1
            except OSError as e:
                print(f'  {name} {key}: {e}', file=sys.stderr)
    size = sum(f.stat().st_size for f in OUT.glob('*.jpg'))
    print(f'Saved {n} images for {len(data["spotlight"])} spotlight systems to {OUT.relative_to(ROOT)} ({size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
