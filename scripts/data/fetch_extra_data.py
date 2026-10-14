"""Download extra public datasets for later Star Gazer experiments (roadmap Phase 7).

    .venv\\Scripts\\python scripts\\data\\fetch_extra_data.py            # all sources below
    .venv\\Scripts\\python scripts\\data\\fetch_extra_data.py gaia_stars

gaia_stars: Berger et al. 2020 (AJ 159, 280), stellar properties of ~186,000 Kepler stars
            derived with Gaia DR2 parallaxes: radius, mass, Teff, logg, [Fe/H], density,
            luminosity, age, distance. More accurate than the KOI table's stellar columns.
            VizieR J/AJ/159/280/table2, saved as data/raw/berger2020_gaia_kepler.csv (~15 MB).

Files are only downloaded; nothing is used for training until an experiment opts in.
Already-downloaded files are skipped unless --refresh.
"""

import argparse
import io
import urllib.request

import pandas as pd

from kepler_cnn import config as C

GAIA_COLUMNS = ['KIC', 'Mass', 'Teff', 'logg', '[Fe/H]', 'Rad', 'rho', 'Lum', 'Age', 'Dist']
SOURCES = {
    'gaia_stars': (C.RAW_DIR / 'berger2020_gaia_kepler.csv',
                   'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/AJ/159/280/table2'
                   '&-out.max=unlimited&-out=' + ','.join(GAIA_COLUMNS)),
}


def read_vizier_tsv(text):
    """Parse VizieR asu-tsv output: '#' comments, then a header, a units line and a dashes line."""
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.startswith('#')]
    body = '\n'.join([lines[0]] + lines[3:])
    table = pd.read_csv(io.StringIO(body), sep='\t', skipinitialspace=True)
    table.columns = [c.strip() for c in table.columns]
    return table


def fetch_gaia_stars(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        table = read_vizier_tsv(r.read().decode('utf-8'))
    table = table.rename(columns={'KIC': 'kepid', 'Mass': 'gaia_smass', 'Teff': 'gaia_steff',
                                  'logg': 'gaia_slogg', '[Fe/H]': 'gaia_smet', 'Rad': 'gaia_srad',
                                  'rho': 'gaia_log_srho', 'Lum': 'gaia_log_lum', 'Age': 'gaia_age',
                                  'Dist': 'gaia_dist_pc'})
    return table.apply(pd.to_numeric, errors='coerce').dropna(subset=['kepid']).astype({'kepid': int})


FETCHERS = {'gaia_stars': fetch_gaia_stars}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('sources', nargs='*', metavar='source',
                        help=f'any of {", ".join(SOURCES)} (default: all)')
    parser.add_argument('--refresh', action='store_true', help='download again even if the file exists')
    args = parser.parse_args()
    unknown = set(args.sources) - set(SOURCES)
    if unknown:
        parser.error(f'unknown source(s): {", ".join(sorted(unknown))}; choose from {", ".join(SOURCES)}')
    for name in args.sources or SOURCES:
        path, url = SOURCES[name]
        if path.exists() and not args.refresh:
            print(f'{name}: {C.rel(path)} already there (use --refresh to download again)')
            continue
        print(f'{name}: downloading...', flush=True)
        table = FETCHERS[name](url)
        path.parent.mkdir(parents=True, exist_ok=True)
        table.to_csv(path, index=False)
        print(f'{name}: saved {C.rel(path)} ({len(table):,} rows, {path.stat().st_size / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
