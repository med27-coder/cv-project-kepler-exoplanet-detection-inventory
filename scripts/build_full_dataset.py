"""Build AstroNet / ExoMiner-style views (global, local, odd/even, secondary, centroid)
from ALL Kepler quarters for every labelled KOI (CONFIRMED + FALSE POSITIVE) in the
NASA cumulative catalog.

    .venv\\Scripts\\python scripts\\build_full_dataset.py                # all ~6,600 stars
    .venv\\Scripts\\python scripts\\build_full_dataset.py --limit 20     # quick test
    .venv\\Scripts\\python scripts\\build_full_dataset.py --workers 4

Resumable: KOIs that already have a current-version view in data/interim/views/ are
skipped. Stars that could not be downloaded are listed in _failed.txt and KOIs that could
not be folded in _skipped.txt (both in data/interim/views/; --retry-failed retries them).
Raw FITS files are deleted after each star, so disk use stays small (~200 MB of views).
Expect several hours for the full catalog; please keep --workers modest (Terms §3).
Workers run at below-normal CPU priority so the PC stays usable.
"""

import argparse
import concurrent.futures
import sys
import time
from pathlib import Path

import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from kepler_cnn import config as C
from kepler_cnn import terms, views
from kepler_cnn.runtime import low_priority

FULL_CATALOG = C.RAW_DIR / 'koi_cumulative_full.csv'
FULL_CATALOG_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+*+from+cumulative&format=csv'


def load_full_catalog():
    if not FULL_CATALOG.exists():
        print('Downloading the full KOI cumulative table (all columns)...')
        FULL_CATALOG.parent.mkdir(parents=True, exist_ok=True)
        pd.read_csv(FULL_CATALOG_URL).to_csv(FULL_CATALOG, index=False)
    return pd.read_csv(FULL_CATALOG)


def _read_log(path):
    if not path.exists():
        return []
    return [line.split(maxsplit=1) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def _append_log(path, lines):
    if lines:
        with open(path, 'a', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--limit', type=int, default=None, help='only process this many stars')
    parser.add_argument('--retry-failed', action='store_true',
                        help='retry stars in _failed.txt and KOIs in _skipped.txt')
    args = parser.parse_args()

    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))

    low_priority()
    cat = load_full_catalog()
    labelled = cat[cat.koi_disposition.isin(['CONFIRMED', 'FALSE POSITIVE'])]
    if args.retry_failed:
        for log in (views.VIEWS_FAILED, views.VIEWS_SKIPPED):
            log.unlink(missing_ok=True)
    failed = {int(w[0]) for w in _read_log(views.VIEWS_FAILED)}
    skipped = {w[0] for w in _read_log(views.VIEWS_SKIPPED)}
    todo = labelled[[n not in skipped and not views.is_current(n) for n in labelled.kepoi_name]]
    stars = [k for k in todo.kepid.unique() if k not in failed]
    if args.limit:
        stars = stars[:args.limit]
    print(f'{labelled.kepoi_name.nunique()} labelled KOIs on {labelled.kepid.nunique()} stars; '
          f'{len(labelled) - len(todo) - len(skipped)} already done; {len(stars)} stars to process '
          f'({len(failed)} stars failed and {len(skipped)} KOIs were skipped before; '
          '--retry-failed retries them)', flush=True)
    if not stars:
        return

    by_star = {k: g for k, g in cat.groupby('kepid')}   # every KOI on the star, for transit masking
    views.VIEWS_DIR.mkdir(parents=True, exist_ok=True)
    tmp_root = C.DATA_DIR / 'interim' / '_tmp_fits'
    tmp_root.mkdir(parents=True, exist_ok=True)

    start, done, n_views, n_skipped, n_failed = time.time(), 0, 0, 0, 0
    # Live bar in a terminal; periodic text lines when output is redirected to a log file.
    interactive = sys.stderr.isatty()
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers, initializer=low_priority) as pool:
        futures = []
        for k in stars:
            g = by_star[k]
            kois = [(r.kepoi_name, r.koi_period, r.koi_time0bk, r.koi_duration)
                    for r in g[g.kepoi_name.isin(todo.kepoi_name)].itertuples()]
            known = g.dropna(subset=['koi_period', 'koi_time0bk', 'koi_duration'])
            transits = [(float(r.koi_period), float(r.koi_time0bk), float(r.koi_duration))
                        for r in known.itertuples()]
            futures.append(pool.submit(views.process_star, int(k), kois, transits, str(tmp_root)))
        bar = tqdm(total=len(stars), unit='star', desc='Building views', disable=not interactive)
        for fut in concurrent.futures.as_completed(futures):
            kepid, result, skipped_kois, err = fut.result()
            done += 1
            if err:
                n_failed += 1
                _append_log(views.VIEWS_FAILED, [f'{kepid} {err}'])
            else:
                views.save_views(result)
                n_views += len(result)
                n_skipped += len(skipped_kois)
                _append_log(views.VIEWS_SKIPPED, [f'{n} {why}' for n, why in skipped_kois.items()])
            bar.update()
            bar.set_postfix(views=n_views, skipped=n_skipped, failed=n_failed, refresh=False)
            if not interactive and (done % 25 == 0 or done == len(stars)):
                rate = done / (time.time() - start)
                eta = (len(stars) - done) / rate / 3600
                print(f'[{done}/{len(stars)} stars] {n_views} views saved, {n_skipped} KOIs skipped, '
                      f'{n_failed} stars failed | {rate * 60:.1f} stars/min | ETA {eta:.1f} h', flush=True)
        bar.close()
    print(f'Done: {n_views} views saved, {n_skipped} KOIs skipped, {n_failed} stars failed'
          + (' (see _skipped.txt / _failed.txt; retry with --retry-failed)' if n_failed or n_skipped else ''))


if __name__ == '__main__':
    main()
