"""Gaia DR3 RUWE for every KOI star (data/raw/gaia_dr3_ruwe.csv), for Star Gazer V4's giant-planet specialist.

    .venv\\Scripts\\python scripts\\data\\fetch_gaia_ruwe.py

RUWE (renormalised unit weight error) says how well a single-star model fits Gaia's astrometry: values above
about 1.4 often mean an unresolved companion, the kind of binary that mimics a giant planet's transit. Each KOI
star is matched by position (2 arcseconds, nearest Gaia source) against Gaia DR3 (VizieR I/355/gaiadr3) with the
CDS xMatch service, in chunks. Also kept: the number of Gaia sources within 2" (a crowding hint) and G magnitude.
Gaia data: ESA/Gaia/DPAC; cross-match: CDS, Strasbourg.
"""

import sys

import astropy.units as u
import pandas as pd
from astropy.table import Table

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S

OUT = C.RAW_DIR / 'gaia_dr3_ruwe.csv'
RADIUS = 2.0 * u.arcsec
CHUNK = 2000


def main():
    from astroquery.xmatch import XMatch
    cat = S.load_catalog()
    stars = cat.groupby('kepid', as_index=False)[['ra', 'dec']].first().dropna()
    print(f'{len(stars)} KOI stars; cross-matching with Gaia DR3 in chunks of {CHUNK}...')
    parts = []
    for start in range(0, len(stars), CHUNK):
        chunk = Table.from_pandas(stars.iloc[start:start + CHUNK])
        r = XMatch.query(cat1=chunk, cat2='vizier:I/355/gaiadr3', max_distance=RADIUS, colRA1='ra', colDec1='dec')
        parts.append(r['kepid', 'angDist', 'Source', 'RUWE', 'Gmag'].to_pandas())
        print(f'  {min(start + CHUNK, len(stars))} / {len(stars)}')
    found = pd.concat(parts, ignore_index=True).rename(columns={
        'angDist': 'sep_arcsec', 'Source': 'gaia_source_id', 'RUWE': 'ruwe', 'Gmag': 'gaia_gmag'})
    best = found.sort_values('sep_arcsec').groupby('kepid', as_index=False).first()   # nearest Gaia source
    best['n_gaia_within_2as'] = found.groupby('kepid').size().reindex(best.kepid).to_numpy()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    best.to_csv(OUT, index=False)
    print(f'Saved {C.rel(OUT)}: {len(best)} of {len(stars)} stars matched '
          f'({(best.ruwe > 1.4).mean():.1%} with RUWE > 1.4)')


if __name__ == '__main__':
    sys.exit(main())
