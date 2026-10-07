"""AstroNet / ExoMiner-style inputs built from *all* Kepler quarters of a star.

For every KOI we produce (Shallue & Vanderburg 2018; Valizadegan et al. 2022):
  * global view     the whole phase-folded orbit, GLOBAL_BINS bins
  * local view      a zoom on the transit (±LOCAL_HALF_WIDTH durations), LOCAL_BINS bins
  * odd / even      the local view built from odd-numbered / even-numbered transits only
                    (an eclipsing binary at twice the period shows alternating depths)
  * secondary       a local view centred on the deepest dip away from the transit
                    (an eclipsing binary often shows a secondary eclipse)
  * centroid        how far the star's image centroid moves during the transit
                    (a background eclipsing binary pulls the centroid off target)
Global and local views are normalised to median 0 and minimum -1. Odd, even and
secondary views are scaled by the *primary* transit depth so relative depths are kept.
All of these are computed here from the raw light curves; none of NASA's vetting
flags or diagnostics are used.

Each star is downloaded once (all quarters), every known transit on it is masked
before detrending, all of its KOIs are folded, and the raw FITS files are deleted.
Only the small per-KOI views are kept in data/interim/views/.
"""

import concurrent.futures
import shutil
import tempfile
import warnings
from pathlib import Path

import numpy as np

from . import config as C

VIEW_VERSION = 2            # bump when the view recipe changes; older files get rebuilt
GLOBAL_BINS = 2001
LOCAL_BINS = 201
LOCAL_HALF_WIDTH = 2.0      # local view spans ±2 transit durations
LOCAL_BIN_WIDTH = 0.16      # local bins are 0.16 durations wide and overlap (AstroNet)
LONG_CADENCE_DAYS = 0.02043  # 29.4 min
MIN_GLOBAL_FILL = 0.1       # fraction of global bins that must contain data
MIN_LOCAL_FILL = 0.5        # same for the local view
CENTROID_MAX_PX = 10.0      # centroid view is clipped to this source offset (pixels)
VIEW_KEYS = ('global_view', 'local_view', 'odd_view', 'even_view', 'secondary_view', 'centroid_view')
VIEWS_DIR = C.DATA_DIR / 'interim' / 'views'
VIEWS_FAILED = VIEWS_DIR / '_failed.txt'     # stars that could not be downloaded / read
VIEWS_SKIPPED = VIEWS_DIR / '_skipped.txt'   # KOIs whose light curve could not be folded


def _odd(n):
    n = int(n)
    return n if n % 2 else n + 1


def _values(col):
    """Plain float array from an astropy column / quantity / masked array."""
    v = getattr(col, 'value', col)
    if np.ma.isMaskedArray(v):
        v = v.filled(np.nan)
    return np.asarray(v, dtype=float)


# ---------------------------------------------------------------------------
# Binning
# ---------------------------------------------------------------------------
def _bin_median(t, values, half, bins, width, min_fill):
    """Median of each array in `values` in `bins` bins centred on [-half, half].

    `t` must be sorted. Bins are `width` wide, so they overlap when width is larger
    than the spacing. Empty bins are interpolated. Returns a list (one array per
    input) or None if fewer than `min_fill` of the bins contain data.
    """
    centres = np.linspace(-half, half, bins)
    lo = np.searchsorted(t, centres - width / 2)
    hi = np.searchsorted(t, centres + width / 2, side='right')
    filled = hi > lo
    if filled.sum() < max(3, min_fill * bins):
        return None
    x = np.arange(bins)
    out = []
    for v in values:
        stat = np.full(bins, np.nan)
        for i in np.flatnonzero(filled):
            seg = v[lo[i]:hi[i]]
            seg = seg[np.isfinite(seg)]
            if len(seg):
                stat[i] = np.median(seg)
        good = np.isfinite(stat)
        out.append(np.interp(x, x[good], stat[good]) if good.sum() >= 2 else None)
    return out


def _local(t, values, dur, centre=0.0, period=None, min_fill=MIN_LOCAL_FILL):
    """Local-view binning of `values` around phase `centre` (days)."""
    if centre:
        t = (t - centre + period / 2) % period - period / 2
        order = np.argsort(t)
        t, values = t[order], [v[order] for v in values]
    half = min(LOCAL_HALF_WIDTH * dur, period / 2) if period else LOCAL_HALF_WIDTH * dur
    width = max(LOCAL_BIN_WIDTH * dur, 2 * half / LOCAL_BINS)
    return _bin_median(t, values, half, LOCAL_BINS, width, min_fill)


def _normalise(view):
    view = view - np.median(view)
    depth = -view.min()
    if not np.isfinite(depth) or depth <= 0:
        return None
    return view / depth


def _secondary_phase(g_raw, period, dur):
    """Phase (days) of the deepest duration-wide dip in the global view, away from the transit."""
    phase = np.linspace(-period / 2, period / 2, len(g_raw))
    k = max(1, int(round(dur / (period / len(g_raw)))))
    smooth = np.convolve(g_raw, np.ones(k) / k, mode='same')
    smooth[np.abs(phase) < 1.5 * dur] = np.inf
    if not np.isfinite(smooth).any():
        return None
    return float(phase[int(np.argmin(smooth))])


# ---------------------------------------------------------------------------
# Views for one star
# ---------------------------------------------------------------------------
def _detrend(time, values, mask, window):
    """Divide out a Savitzky-Golay trend (lightkurve.flatten), ignoring masked transits."""
    import lightkurve as lk
    lc = lk.LightCurve(time=time, flux=values)
    return _values(lc.flatten(window_length=window, mask=mask).flux)


def prepare_lightcurve(quarters, all_transits):
    """Stitch, detrend and clean a star's quarters.

    quarters:     list of (time, flux, centroid_col, centroid_row) arrays, one per quarter
    all_transits: (period, t0, duration_h) of every KOI on the star; masked when detrending
    Returns (time, flux, cen_col, cen_row), time-sorted, with flux ≈ 1 out of transit and
    centroid offsets in pixels (≈ 0 out of transit).
    """
    import lightkurve as lk
    durs = [d / 24 for _, _, d in all_transits]
    window = _odd(max(1.0, 3 * max(durs)) / LONG_CADENCE_DAYS)

    T, F, CC, CR = [], [], [], []
    for t, f, cc, cr in quarters:
        ok = np.isfinite(t) & np.isfinite(f)
        if ok.sum() < window:
            continue
        t, f, cc, cr = t[ok], f[ok] / np.median(f[ok]), cc[ok], cr[ok]
        mask = _values(lk.LightCurve(time=t, flux=f).create_transit_mask(
            period=[p for p, _, _ in all_transits], transit_time=[t0 for _, t0, _ in all_transits],
            duration=[1.5 * d for d in durs])).astype(bool)
        F.append(_detrend(t, f, mask, window))
        for raw, out in ((cc, CC), (cr, CR)):
            good = np.isfinite(raw)
            res = np.full(len(t), np.nan)
            if good.sum() >= window:
                # offsets are tiny next to the absolute pixel position, so detrend
                # (offset + 100 px) and convert the ratio back to pixels
                off = raw[good] - np.median(raw[good]) + 100.0
                res[good] = (_detrend(t[good], off, mask[good], window) - 1) * 100.0
            out.append(res)
        T.append(t)
    if not T:
        return None
    t, f, cc, cr = (np.concatenate(a) for a in (T, F, CC, CR))
    # drop upward outliers (cosmic rays, flares); transits only go down
    med = np.median(f)
    sigma = 1.4826 * np.median(np.abs(f - med))
    keep = np.isfinite(f) & (f <= med + 3 * sigma)
    order = np.argsort(t[keep])
    return tuple(a[keep][order] for a in (t, f, cc, cr))


def views_for_lightcurve(lc, kois):
    """Build {kepoi_name: {view_key: array}} and {kepoi_name: reason} for skipped KOIs.

    lc:   (time, flux, cen_col, cen_row) from prepare_lightcurve
    kois: (kepoi_name, period [d], t0 [BKJD], duration [h]) tuples to fold
    """
    time, flux, cc, cr = lc
    out, skipped = {}, {}
    for name, period, t0, dur in kois:
        period, t0, dur = float(period), float(t0), float(dur) / 24
        if not (np.isfinite(period) and np.isfinite(t0) and np.isfinite(dur)) or period <= 0 or dur <= 0:
            skipped[name] = 'missing period / epoch / duration'
            continue
        n = np.floor((time - t0) / period + 0.5)
        t = time - t0 - n * period              # phase in days, transit at 0
        order = np.argsort(t)
        t, f, c1, c2, n = t[order], flux[order], cc[order], cr[order], n[order]

        g = _bin_median(t, [f], period / 2, GLOBAL_BINS, period / GLOBAL_BINS, MIN_GLOBAL_FILL)
        loc = _local(t, [f, c1, c2], dur, period=period)
        if g is None or loc is None or loc[0] is None:
            skipped[name] = 'too few points in the folded light curve'
            continue
        g_raw, (l_raw, c1_raw, c2_raw) = g[0], loc
        g_view, l_view = _normalise(g_raw), _normalise(l_raw)
        if g_view is None or l_view is None:
            skipped[name] = 'no transit dip in the folded light curve'
            continue
        base = np.median(l_raw)
        depth = base - l_raw.min()

        def scaled(view, depth=depth):
            return (view - np.median(view)) / depth

        views = {'global_view': g_view, 'local_view': l_view}
        for key, parity in (('even_view', 0), ('odd_view', 1)):
            sel = (n % 2) == parity
            part = _local(t[sel], [f[sel]], dur, period=period) if sel.sum() else None
            views[key] = scaled(part[0]) if part else l_view     # single transit: no odd/even info
        phase = _secondary_phase(g_raw, period, dur)
        sec = _local(t, [f], dur, centre=phase, period=period) if phase is not None else None
        views['secondary_view'] = scaled(sec[0]) if sec else np.zeros(LOCAL_BINS)
        if c1_raw is not None and c2_raw is not None:
            # centroid shift divided by the fractional depth ~ distance (pixels) from the target
            # to the source of the dip: ~0 for a planet on the target, >1 for a background binary
            shift = np.hypot(c1_raw - np.median(c1_raw), c2_raw - np.median(c2_raw))
            views['centroid_view'] = ((shift - np.median(shift)) / depth).clip(0, CENTROID_MAX_PX)
        else:
            views['centroid_view'] = np.zeros(LOCAL_BINS)
        out[name] = {k: v.astype(np.float32) for k, v in views.items()}
    return out, skipped


def read_quarters(paths):
    """(time, flux, centroid_col, centroid_row) per Kepler long-cadence FITS file.

    Same data as lightkurve.read(path, quality_bitmask='default') (PDCSAP flux,
    MOM_CENTR1/2 centroids, flagged cadences removed), read straight from the FITS
    table because building lightkurve objects was ~60% of the per-star time.
    """
    from astropy.io import fits
    from lightkurve.utils import KeplerQualityFlags
    quarters = []
    for p in paths:
        with fits.open(p, memmap=False) as hdul:
            d = hdul[1].data
            good = KeplerQualityFlags.create_quality_mask(d['SAP_QUALITY'], bitmask='default')
            if not good.any():
                continue
            cols = d.columns.names
            nan = np.full(int(good.sum()), np.nan)
            quarters.append((
                np.asarray(d['TIME'][good], dtype=float),
                np.asarray(d['PDCSAP_FLUX'][good], dtype=float),
                np.asarray(d['MOM_CENTR1'][good], dtype=float) if 'MOM_CENTR1' in cols else nan,
                np.asarray(d['MOM_CENTR2'][good], dtype=float) if 'MOM_CENTR2' in cols else nan.copy(),
            ))
    return quarters


def process_star(kepid, kois, all_transits, tmp_root=None):
    """Download all quarters for one star, build views for its KOIs, delete the FITS files.

    Returns (kepid, {kepoi_name: views}, {kepoi_name: skip reason}, error-or-None).
    Runs in a worker process.
    """
    warnings.filterwarnings('ignore')
    tmp = Path(tempfile.mkdtemp(prefix=f'kic{kepid}_', dir=tmp_root))
    try:
        paths = download_quarters(kepid, tmp)
        if not paths:
            return kepid, {}, {}, 'no light curves'
        lc = prepare_lightcurve(read_quarters(paths), all_transits)
        if lc is None:
            return kepid, {}, {}, 'no usable quarters'
        result, skipped = views_for_lightcurve(lc, kois)
        return kepid, result, skipped, None
    except Exception as e:
        return kepid, {}, {}, f'{type(e).__name__}: {e}'[:200]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# MAST download
# ---------------------------------------------------------------------------
# Kepler long-cadence files share one timestamp per quarter across all stars
# (same table as AstroNet's kepler_io.py), so URLs can be built directly instead
# of going through the slow MAST search API. Quarters a star wasn't observed in return 404.
QUARTER_STAMPS = [
    '2009131105131', '2009166043257', '2009259160929', '2009350155506', '2010078095331',
    '2010009091648', '2010174085026', '2010265121752', '2010355172524', '2011073133259',
    '2011177032512', '2011271113734', '2012004120508', '2012088054726', '2012179063303',
    '2012277125453', '2013011073258', '2013098041711', '2013131215648',
]
MAST_DOWNLOAD = 'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:KEPLER/url/missions/kepler/lightcurves/'


class DownloadError(RuntimeError):
    """MAST was unreachable or throttling (as opposed to the star having no data)."""


def download_quarters(kepid, dest, threads=4, attempts=4):
    """Fetch every long-cadence quarter for one star into `dest`; returns the saved paths.

    404 means the star wasn't observed that quarter. Throttling (429 / 5xx) and network
    errors are retried with exponential backoff; if a quarter still fails, DownloadError
    is raised so the star is logged as retryable instead of "no light curves".
    """
    import time

    import requests
    kic = f'{int(kepid):09d}'
    session = requests.Session()

    def fetch(stamp):
        name = f'kplr{kic}-{stamp}_llc.fits'
        for attempt in range(attempts):
            try:
                r = session.get(f'{MAST_DOWNLOAD}{kic[:4]}/{kic}/{name}', timeout=120)
                if r.status_code == 404:
                    return None
                if r.ok and r.content[:6] == b'SIMPLE':
                    path = Path(dest) / name
                    path.write_bytes(r.content)
                    return path
            except requests.RequestException:
                pass
            time.sleep(2 ** attempt * 2)   # 2, 4, 8, 16 s
        raise DownloadError(f'quarter {stamp} unavailable after {attempts} attempts')

    with concurrent.futures.ThreadPoolExecutor(threads) as ex:
        return [p for p in ex.map(fetch, QUARTER_STAMPS) if p is not None]


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
def view_path(kepoi_name):
    return VIEWS_DIR / f'{kepoi_name}.npz'


def is_current(kepoi_name):
    """True if a view file exists and was built with the current VIEW_VERSION."""
    p = view_path(kepoi_name)
    if not p.exists():
        return False
    try:
        with np.load(p) as z:
            return 'version' in z.files and int(z['version']) >= VIEW_VERSION
    except (OSError, ValueError):
        return False


def save_views(views):
    VIEWS_DIR.mkdir(parents=True, exist_ok=True)
    for name, v in views.items():
        np.savez(view_path(name), version=VIEW_VERSION, **v)


def load_views(names, keys=VIEW_KEYS, progress=True):
    """Stack current-version cached views for the given KOI names.

    Returns ({key: array (n, bins)}, kept_names).
    """
    from tqdm.auto import tqdm
    stacks, kept = {k: [] for k in keys}, []
    for n in tqdm(list(names), desc='Loading views', unit='KOI', disable=not progress):
        p = view_path(n)
        if not p.exists():
            continue
        with np.load(p) as z:
            if 'version' not in z.files or int(z['version']) < VIEW_VERSION:
                continue
            for k in keys:
                stacks[k].append(z[k])
        kept.append(n)
    sizes = {'global_view': GLOBAL_BINS}
    return ({k: np.stack(v) if v else np.empty((0, sizes.get(k, LOCAL_BINS)), np.float32)
             for k, v in stacks.items()}, kept)
