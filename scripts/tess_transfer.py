"""Does Star Gazer still recognise Kepler planets in data from a different telescope? (TESS)

    .venv\\Scripts\\python scripts\\tess_transfer.py [--limit 40] [--sectors 4]
    (add --prefetch to only download the light curves; no model needed)

NASA's TESS satellite re-observed part of the Kepler field. For each Kepler planet that TESS saw
again (TOI disposition KP = known planet, period within 1% of the KOI's), this downloads TESS
light curves from MAST, bins them to Kepler's 29.4-minute cadence, builds the same views with
TESS's own transit times, and scores them with the trained model (the catalog features stay the
Kepler ones). It reports how often the verdict matches the Kepler-based one.
A first step towards a TESS version (V4), not a measured TESS performance. Writes
results/v3/tess_transfer.json and .csv. Network-heavy (a few hundred MB), CPU-light.
"""

import argparse
import json
import sys
import warnings

import numpy as np
import pandas as pd

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S
from kepler_cnn import views

TOI_URL = ('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+toi,tid,ra,dec,pl_orbper,'
           'pl_tranmid,pl_trandurh,tfopwg_disp+from+toi+where+ra+between+279+and+303+and+dec+between+35+and+54'
           "+and+tfopwg_disp='KP'&format=csv")
BJD_TO_BTJD = 2457000.0
CACHE = C.RAW_DIR / 'tess'   # downloaded light curves, kept between runs (git-ignored)
MATCH_ARCSEC, MATCH_PERIOD = 3.0, 0.01


def pairs(catalog, tois):
    """(KOI row, TOI row) for TOIs on a KOI star (within 3") whose period is within 1%."""
    kois = catalog[catalog.koi_disposition.isin(['CONFIRMED', 'FALSE POSITIVE'])]
    out = []
    for _, t in tois.iterrows():
        sep = np.hypot((kois.ra - t.ra) * np.cos(np.radians(t.dec)), kois.dec - t.dec) * 3600
        near = kois[(sep < MATCH_ARCSEC) & (abs(kois.koi_period - t.pl_orbper) <= MATCH_PERIOD * t.pl_orbper)]
        if len(near):
            out.append((near.iloc[0], t))
    return out


def tess_quarters(tid, max_sectors, tmp):
    """Light curves as (time, flux, centroid col, centroid row) per sector, binned to Kepler's cadence."""
    import lightkurve as lk
    found = lk.search_lightcurve(f'TIC {tid}', mission='TESS', author=['SPOC', 'TESS-SPOC'])
    if not len(found):
        return []
    lcs = found[:max_sectors].download_all(download_dir=str(tmp), quality_bitmask='default')
    out = []
    for lc in lcs or []:
        lc = lc.remove_nans().normalize()
        if len(lc) < 50:
            continue
        lc = lc.bin(time_bin_size=views.LONG_CADENCE_DAYS)   # TESS 2-min / 10-min -> Kepler's 29.4 min
        t = np.asarray(lc.time.value, dtype=float)
        f = np.asarray(lc.flux.value, dtype=float)
        nan = np.full(len(t), np.nan)
        col = np.asarray(lc['centroid_col'].value, dtype=float) if 'centroid_col' in lc.colnames else nan
        row = np.asarray(lc['centroid_row'].value, dtype=float) if 'centroid_row' in lc.colnames else nan.copy()
        out.append((t, f, col, row))
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--limit', type=int, default=40, help='at most this many planets')
    parser.add_argument('--sectors', type=int, default=4, help='at most this many TESS sectors per star')
    parser.add_argument('--prefetch', action='store_true', help='only download the light curves, then stop')
    args = parser.parse_args()
    warnings.filterwarnings('ignore')
    catalog = S.load_catalog()
    matched = pairs(catalog, pd.read_csv(TOI_URL))[:args.limit]
    print(f'{len(matched)} Kepler planets re-detected by TESS (KP) to test', flush=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.prefetch:   # download only (no model needed), so the test itself runs from the cache
        for i, (koi, toi) in enumerate(matched, 1):
            try:
                got = f'{len(tess_quarters(int(toi.tid), args.sectors, CACHE))} sectors'
            except Exception as e:   # noqa: BLE001 - keep going; the test run reports it again
                got = f'failed ({type(e).__name__})'
            print(f'  [{i}/{len(matched)}] {koi.kepoi_name}: {got}', flush=True)
        return
    try:
        models, pre, threshold = S.load_trained()
    except (FileNotFoundError, S.StaleModelError) as e:
        sys.exit(f'Needs the trained V3 model: {e}')
    rows = []
    for koi, toi in matched:
        name = koi.kepoi_name
        try:
            quarters = tess_quarters(int(toi.tid), args.sectors, CACHE)
            t0, dur_h = toi.pl_tranmid - BJD_TO_BTJD, toi.pl_trandurh
            lc = views.prepare_lightcurve(quarters, [(toi.pl_orbper, t0, dur_h)]) if quarters else None
            built, skipped = views.views_for_lightcurve(lc, [(name, toi.pl_orbper, t0, dur_h)]) if lc else ({}, {})
        except Exception as e:   # noqa: BLE001 - one target failing (download, odd file) must not stop the test
            print(f'  {name}: {type(e).__name__}: {e}'[:160], flush=True)
            continue
        if name not in built:
            print(f'  {name}: no usable TESS views ({skipped.get(name, "no light curves")})', flush=True)
            continue
        row = catalog[catalog.kepoi_name == name]
        p_tess = S.predict_views(models, pre, row, built[name])
        p_kepler = S.predict_koi(models, pre, catalog, name)[0] if views.is_current(name) else np.nan
        rows.append({'kepoi_name': name, 'toi': f'{toi.toi:.2f}', 'disposition': koi.koi_disposition,
                     'sectors': len(quarters), 'p_tess': round(p_tess, 4), 'p_kepler': round(p_kepler, 4)})
        print(f'  {name} (TOI-{toi.toi:.2f}, {len(quarters)} sectors): Kepler {p_kepler:.2f} -> TESS {p_tess:.2f}',
              flush=True)
    if not rows:
        sys.exit('No TESS views could be built.')
    df = pd.DataFrame(rows)
    preds = S.RESULTS_DIR / 'test_predictions.npz'   # which planets were never seen in training
    if preds.exists():
        with np.load(preds, allow_pickle=False) as z:
            df['in_test_split'] = df.kepoi_name.isin(set(z['names'].astype(str)))
    both = df.dropna(subset=['p_kepler'])
    same = float(((both.p_tess >= threshold) == (both.p_kepler >= threshold)).mean()) if len(both) else float('nan')
    confirmed = df[df.disposition == 'CONFIRMED']
    summary = {'n': len(df), 'threshold': threshold,
               'same_verdict_as_kepler': round(same, 3),
               'confirmed_called_planet_with_tess_data': round(float((confirmed.p_tess >= threshold).mean()), 3) if len(confirmed) else None,
               'mean_abs_difference': round(float((both.p_tess - both.p_kepler).abs().mean()), 3) if len(both) else None,
               'n_in_test_split': int(df['in_test_split'].sum()) if 'in_test_split' in df else None}
    S.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(S.RESULTS_DIR / 'tess_transfer.csv', index=False)
    (S.RESULTS_DIR / 'tess_transfer.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(f'{summary} -> {C.rel(S.RESULTS_DIR / "tess_transfer.json")}')


if __name__ == '__main__':
    main()
