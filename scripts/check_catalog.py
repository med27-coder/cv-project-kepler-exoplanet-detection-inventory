"""Sanity report on the NASA KOI catalog before building views or training.

    .venv\\Scripts\\python scripts\\check_catalog.py            # print the report
    .venv\\Scripts\\python scripts\\check_catalog.py --strict   # exit 1 if a blocking problem is found

Finds catalog rows the pipeline can't use, or should treat with care, before they surface as a
crash or a silently skipped KOI (K06549.01, with a 13.9 h transit on a 13 h orbit, was found
that way). Writes data/interim/catalog_report.json. Uses only the local catalog copy.
"""

import argparse
import json
import sys

import numpy as np
import pandas as pd

from kepler_cnn import config as C

CATALOG = C.RAW_DIR / 'koi_cumulative_full.csv'
REPORT = C.DATA_DIR / 'interim' / 'catalog_report.json'
USED = ['CONFIRMED', 'FALSE POSITIVE', 'CANDIDATE']
REQUIRED = ['kepid', 'kepoi_name', 'koi_disposition', 'koi_period', 'koi_time0bk', 'koi_duration', 'ra', 'dec']


def checks(cat):
    """{check name: (severity, rows)}. 'block' rows can't be built; 'warn' rows are built with care."""
    kois = cat[cat['koi_disposition'].isin(USED)]
    period, dur_days = kois['koi_period'], kois['koi_duration'] / 24
    found = {
        'missing period, epoch or duration': ('block', kois[kois[['koi_period', 'koi_time0bk', 'koi_duration']]
                                                            .isna().any(axis=1)]),
        'non-positive period or duration': ('block', kois[(period <= 0) | (kois['koi_duration'] <= 0)]),
        'transit longer than the orbit': ('warn', kois[dur_days >= period]),
        'transit mask covers > half the orbit': ('warn', kois[(1.5 * dur_days / period > 0.5) & (dur_days < period)]),
        'ultra-short period (< 0.3 d)': ('warn', kois[period < 0.3]),
        'missing sky position': ('block', kois[kois[['ra', 'dec']].isna().any(axis=1)]),
        'duplicate KOI name': ('block', kois[kois['kepoi_name'].duplicated(keep=False)]),
        'radius > 30 Earths (usually an eclipsing binary)': ('warn', kois[kois['koi_prad'] > 30]),
        'missing stellar temperature or radius': ('warn', kois[kois[['koi_steff', 'koi_srad']].isna().any(axis=1)]),
    }
    return {name: (sev, rows) for name, (sev, rows) in found.items()}


def report(cat):
    missing_cols = [c for c in REQUIRED if c not in cat.columns]
    if missing_cols:
        return {'blocking': True, 'error': f'catalog is missing columns: {missing_cols}'}
    out = {'n_kois': int(cat['koi_disposition'].isin(USED).sum()), 'checks': {}, 'blocking': False}
    for name, (sev, rows) in checks(cat).items():
        by_disp = rows['koi_disposition'].value_counts().to_dict()
        out['checks'][name] = {'severity': sev, 'count': len(rows), 'by_disposition': by_disp,
                               'examples': rows['kepoi_name'].head(5).tolist()}
        if sev == 'block' and len(rows):
            out['blocking'] = True
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--strict', action='store_true', help='exit 1 on a blocking problem')
    args = parser.parse_args()
    if not CATALOG.exists():
        sys.exit(f'{C.rel(CATALOG)} not found; run scripts/build_full_dataset.py first.')
    cat = pd.read_csv(CATALOG, low_memory=False).replace([np.inf, -np.inf], np.nan)
    rep = report(cat)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(rep, indent=2), encoding='utf-8')
    if 'error' in rep:
        sys.exit(rep['error'])
    print(f'{rep["n_kois"]} KOIs checked')
    for name, r in rep['checks'].items():
        if r['count']:
            mark = '✖' if r['severity'] == 'block' else '!'
            print(f'  {mark} {name}: {r["count"]} {r["by_disposition"]}  e.g. {", ".join(r["examples"][:3])}')
    print(f'Report: {C.rel(REPORT)}')
    if args.strict and rep['blocking']:
        sys.exit('Blocking catalog problems found (✖).')


if __name__ == '__main__':
    main()
