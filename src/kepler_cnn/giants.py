"""Star Gazer V4: the giant-planet specialist, as registered in docs/V4_PREREGISTRATION.md.

V3 stays the model for small planets. For KOIs of 6 Earth radii and up, a gradient-boosted tree classifier
looks at V3's catalog features, a "was missing" flag for each, and physics features that tell planets from
eclipsing binaries (the density the transit implies vs Gaia's, a grazing geometry, the transit's shape, odd/even
and secondary eclipses, Gaia's binarity hint RUWE). Between 6 and 10 Earth radii the two answers are blended.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.utils.class_weight import compute_sample_weight

from . import config as C
from . import star_gazer as S

MIN_RADIUS, FULL_RADIUS = 6.0, 10.0   # Earth radii: V3 below, V4 above, a linear blend between
RHO_SUN = 1.41                        # g/cm3: koi_srho is in g/cm3, Gaia's log density in solar units
GAIA_FILE = C.RAW_DIR / 'berger2020_gaia_kepler.csv'
RUWE_FILE = C.RAW_DIR / 'gaia_dr3_ruwe.csv'
# Local views span ±2 transit durations in 201 bins: the transit is the middle 50 bins, its central half 25.
TRANSIT = slice(75, 126)
TRANSIT_CORE = slice(88, 113)
PHYSICS = ['log_rho_ratio', 'grazing', 'depth_consistency', 'u_shape', 'odd_even', 'secondary_depth',
           'ruwe', 'n_gaia_within_2as', 'gaia_missing']


def is_giant(prad):
    return np.nan_to_num(np.asarray(prad, dtype=float), nan=0.0) >= MIN_RADIUS


def blend_weight(prad):
    """Weight of V4's answer: 0 below 6 Earth radii (or unknown), 1 above 10, linear in between."""
    r = np.asarray(prad, dtype=float)
    return np.where(np.isnan(r), 0.0, np.clip((r - MIN_RADIUS) / (FULL_RADIUS - MIN_RADIUS), 0.0, 1.0))


def combine(prad, p_v3, p_v4):
    w = blend_weight(prad)
    return (1 - w) * p_v3 + w * np.nan_to_num(p_v4, nan=0.0)


def _safe_log10(x):
    x = np.asarray(x, dtype=float)
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.where(x > 0, np.log10(np.where(x > 0, x, 1.0)), np.nan)


def physics_features(table, local, secondary):
    """The registered physics features, one row per KOI (aligned with `table`)."""
    kepid = table.kepid.to_numpy()
    gaia = pd.read_csv(GAIA_FILE, usecols=['kepid', 'gaia_log_srho']).drop_duplicates('kepid').set_index('kepid')
    ruwe = pd.read_csv(RUWE_FILE).set_index('kepid') if RUWE_FILE.exists() else pd.DataFrame(
        columns=['ruwe', 'n_gaia_within_2as'])
    g_rho = gaia.gaia_log_srho.reindex(kepid).to_numpy()
    lv, odd, even = local[:, :, 0], local[:, :, 1], local[:, :, 2]
    depth_min = lv[:, TRANSIT].min(axis=1)
    with np.errstate(divide='ignore', invalid='ignore'):
        u_shape = np.where(depth_min < 0, lv[:, TRANSIT_CORE].mean(axis=1) / depth_min, np.nan)
    f = pd.DataFrame({
        'log_rho_ratio': _safe_log10(table.koi_srho.to_numpy() / RHO_SUN) - g_rho,
        'grazing': table.koi_impact.to_numpy() + table.koi_ror.to_numpy(),
        'depth_consistency': _safe_log10(table.koi_depth.to_numpy() / 1e6 / table.koi_ror.to_numpy() ** 2),
        'u_shape': u_shape,
        'odd_even': np.abs(odd[:, TRANSIT].min(axis=1) - even[:, TRANSIT].min(axis=1)),
        'secondary_depth': -secondary[:, :, 0].min(axis=1),
        'ruwe': ruwe.ruwe.reindex(kepid).to_numpy(dtype=float),
        'n_gaia_within_2as': ruwe.n_gaia_within_2as.reindex(kepid).to_numpy(dtype=float),
    })
    f['gaia_missing'] = (np.isnan(g_rho) | f.ruwe.isna().to_numpy()).astype(float)
    return f[PHYSICS]


def feature_frame(ds, idx, physics=True):
    """G1's inputs (physics=True) or G2's (V3's features and missing flags only) for rows `idx` of a dataset."""
    table = ds['table'].iloc[idx].reset_index(drop=True)
    X = table[S.FEATURES].astype(float)
    parts = [X, X.isna().astype(float).add_suffix('_missing')]
    if physics:
        parts.append(physics_features(table, ds['local'][idx], ds['secondary'][idx]))
    return pd.concat(parts, axis=1)


def make_model(seed):
    return HistGradientBoostingClassifier(learning_rate=0.05, max_iter=400, max_leaf_nodes=15, min_samples_leaf=20,
                                          l2_regularization=1.0, early_stopping=True, validation_fraction=0.15,
                                          n_iter_no_change=30, random_state=seed)


def fit(X, y, seed):
    model = make_model(seed)
    model.fit(X, y, sample_weight=compute_sample_weight('balanced', y))
    return model
