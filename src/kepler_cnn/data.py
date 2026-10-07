"""Catalog loading, light-curve download/folding, and dataset building."""

import concurrent.futures
import contextlib
import io
import re
import socket
import threading
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm.auto import tqdm

from . import config as C
from .terms import ensure_accepted

LABEL_NAMES = {1: 'CONFIRMED', 0: 'FALSE POSITIVE'}

# Keep a hung MAST request from blocking a worker thread forever.
NETWORK_TIMEOUT_S = 60
socket.setdefaulttimeout(NETWORK_TIMEOUT_S)


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------
def load_catalog(refresh=False):
    """Load the KOI cumulative table, downloading it once into data/raw/."""
    C.ensure_dirs()
    if C.CATALOG_FILE.exists() and not refresh:
        print(f'Loading cached catalog: {C.rel(C.CATALOG_FILE)}')
        return pd.read_csv(C.CATALOG_FILE, comment='#')

    ensure_accepted()
    last_error = None
    for url in C.CATALOG_URLS:
        try:
            print(f'Downloading NASA KOI catalog from {url.split("?")[0]} ...')
            df = pd.read_csv(url, comment='#')
            break
        except Exception as e:  # network / HTTP errors: try the next endpoint
            last_error = e
            print(f'  failed: {e}')
    else:
        raise RuntimeError(f'Could not download the KOI catalog: {last_error}')

    df.to_csv(C.CATALOG_FILE, index=False)
    print(f'Saved catalog to {C.rel(C.CATALOG_FILE)}')
    return df


def select_balanced(df_koi, n_per_class=None, seed=C.SEED):
    """Balanced CONFIRMED (1) vs FALSE POSITIVE (0) sample (n per class from the active dataset)."""
    n_per_class = n_per_class or C.N_PER_CLASS
    df_confirmed = df_koi[df_koi['koi_disposition'] == 'CONFIRMED'].copy()
    df_fp        = df_koi[df_koi['koi_disposition'] == 'FALSE POSITIVE'].copy()
    n = min(n_per_class, len(df_confirmed), len(df_fp))

    df_pos = df_confirmed.sample(n=n, random_state=seed)
    df_neg = df_fp.sample(n=n, random_state=seed)
    df_pos['label'] = 1
    df_neg['label'] = 0
    return pd.concat([df_pos, df_neg]).reset_index(drop=True)


def get_koi(df_koi, kepoi_name):
    """Look up one KOI row (period, epoch, disposition) by its KOI name, e.g. 'K00351.02'."""
    match = df_koi[df_koi['kepoi_name'] == kepoi_name]
    if match.empty:
        raise KeyError(f'{kepoi_name} not found in the KOI catalog')
    return match.iloc[0]


# ---------------------------------------------------------------------------
# Light curves
# ---------------------------------------------------------------------------
# Several KOIs share a star (Kepler-90 has 7); serialise downloads per star so
# threads don't write the same FITS file into the lightkurve cache at once.
_star_locks: defaultdict[int, threading.Lock] = defaultdict(threading.Lock)
_star_locks_guard = threading.Lock()


def _star_lock(kepler_id):
    with _star_locks_guard:
        return _star_locks[int(kepler_id)]


def _download_first(search):
    """search[0].download(), deleting a corrupt cached FITS file and retrying once."""
    try:
        return search[0].download()
    except Exception as e:
        if 'may be corrupt' not in str(e):
            raise
        for match in re.findall(r'(\S+\.fits)\b', str(e)):
            path = Path(match)
            if path.exists():
                path.unlink()
        return search[0].download()


def download_and_fold(kepler_id, period, t0, bins=C.BINS):
    """Download a Kepler light curve, flatten, phase-fold, bin and normalise.

    Returns a (bins,) float array, or None if anything fails. May contain NaNs;
    `apply_quality_filters` decides whether the curve is usable.
    """
    ensure_accepted()
    import lightkurve as lk  # slow import, keep it lazy

    try:
        # DATA SOURCE 2: NASA MAST archive via lightkurve (https://mast.stsci.edu/)
        with _star_lock(kepler_id):
            search = lk.search_lightcurve(f'KIC {int(kepler_id)}', mission='Kepler', cadence='long')
            if len(search) == 0:
                return None
            lc = _download_first(search)
        if lc is None:
            return None
        lc_fold = lc.flatten(window_length=101).fold(period=period, epoch_time=t0)
        flux = lc_fold.bin(bins=bins).flux.value
        flux = (flux - np.nanmedian(flux)) / (np.nanstd(flux) + 1e-8)
        if len(flux) < bins:
            flux = np.pad(flux, (0, bins - len(flux)), constant_values=0)
        return np.asarray(flux[:bins], dtype=np.float64)
    except Exception:
        return None


def apply_quality_filters(flux, max_nan_fraction=0.1, min_std=1e-4):
    """V1.5 filters 2–4. Returns a clean array, or None if the curve is rejected."""
    if flux is None:
        return None
    if np.isnan(flux).mean() > max_nan_fraction:
        return None
    if np.nanstd(flux) < min_std:
        return None
    return np.nan_to_num(flux, nan=0.0, posinf=0.0, neginf=0.0)


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
def _cache_path(kepoi_name):
    return C.FLUX_CACHE_DIR / f'{kepoi_name}.npy'


def _read_failed():
    if not C.FAILED_FILE.exists():
        return set()
    return set(C.FAILED_FILE.read_text(encoding='utf-8').split())


def download_lightcurves(df_dataset, workers=8, retry_failed=False):
    """Download every KOI in df_dataset into data/interim/flux/ (one .npy each).

    Already-cached KOIs are skipped, so an interrupted run resumes where it
    stopped. KOIs that failed before are skipped unless retry_failed=True.
    """
    ensure_accepted()
    C.ensure_dirs()
    failed = set() if retry_failed else _read_failed()
    todo = df_dataset[[not _cache_path(n).exists() and n not in failed
                       for n in df_dataset['kepoi_name']]]
    print(f'{len(df_dataset) - len(todo)} cached, {len(todo)} to download '
          f'({len(failed)} previously failed, skipped)')
    if todo.empty:
        return

    newly_failed = []
    # astroquery prints a progress line per FITS file to sys.stdout. From worker
    # threads that can break the real stdout mid-download, leaving truncated
    # files in the lightkurve cache, so send it to a throwaway buffer instead
    # (tqdm writes to stderr and is unaffected).
    with contextlib.redirect_stdout(io.StringIO()), \
            concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(download_and_fold, r.kepid, r.koi_period, r.koi_time0bk): r.kepoi_name
            for r in todo.itertuples()
        }
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures),
                           desc='Downloading light curves'):
            name = futures[future]
            flux = future.result()
            if flux is None:
                newly_failed.append(name)
            else:
                np.save(_cache_path(name), flux)

    if newly_failed:
        with open(C.FAILED_FILE, 'a', encoding='utf-8') as f:
            f.write('\n'.join(newly_failed) + '\n')
    print(f'Downloaded {len(todo) - len(newly_failed)}, failed {len(newly_failed)}')


def assemble_dataset(df_dataset):
    """Stack cached curves that pass the quality filters into X, y and an index table."""
    X_list, y_list, rows = [], [], []
    missing = rejected = 0
    for r in df_dataset.itertuples():
        path = _cache_path(r.kepoi_name)
        if not path.exists():
            missing += 1
            continue
        flux = apply_quality_filters(np.load(path))
        if flux is None:
            rejected += 1
            continue
        X_list.append(flux)
        y_list.append(r.label)
        rows.append({'kepoi_name': r.kepoi_name, 'kepid': r.kepid, 'label': r.label})

    X = np.array(X_list).reshape(-1, C.BINS)
    y = np.array(y_list, dtype=np.int64)
    X, y, keep = dedupe(X, y)
    rows = [rows[i] for i in keep]
    print(f'Usable light curves : {len(X)}')
    print(f'Missing / failed    : {missing}')
    print(f'Rejected (bad data) : {rejected}')
    return X, y, pd.DataFrame(rows)


def dedupe(X, y, decimals=5):
    """Drop repeated light curves (keeps first occurrence). Duplicates would let
    the same curve land in both train and test and inflate test scores."""
    _, keep = np.unique(np.round(X, decimals), axis=0, return_index=True)
    keep = np.sort(keep)
    return X[keep], y[keep], keep


def save_dataset(X, y, index_df=None):
    C.ensure_dirs()
    np.save(C.X_FILE, X)
    np.save(C.Y_FILE, y)
    if index_df is not None:
        index_df.to_csv(C.INDEX_FILE, index=False)
    print(f'Saved dataset to {C.rel(C.X_FILE.parent)}')


def load_dataset():
    """Load X, y (and the KOI index if present) from data/processed/, or None."""
    if not (C.X_FILE.exists() and C.Y_FILE.exists()):
        return None
    X = np.load(C.X_FILE)
    y = np.load(C.Y_FILE).astype(np.int64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0).reshape(len(X), -1)
    index_df = pd.read_csv(C.INDEX_FILE) if C.INDEX_FILE.exists() else None
    if X.shape[1] != C.BINS:
        raise ValueError(f'{C.X_FILE.name} has {X.shape[1]} bins, expected {C.BINS}')
    print(f'Loaded cached dataset "{C.DATASET}": {len(X)} light curves'
          + ('' if index_df is not None else ' (no KOI index; arrays from Colab)'))
    return X, y, index_df


def get_dataset(df_dataset, rebuild=False, workers=8, retry_failed=False):
    """Use data/processed/ if present, otherwise download + assemble + save."""
    if not rebuild:
        cached = load_dataset()
        if cached is not None:
            return cached
    download_lightcurves(df_dataset, workers=workers, retry_failed=retry_failed)
    X, y, index_df = assemble_dataset(df_dataset)
    save_dataset(X, y, index_df)
    return X, y, index_df
