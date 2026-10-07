"""V3 "Star Gazer": AstroNet / ExoMiner-style multi-view CNN + NASA catalog features.

Inputs per KOI (all built from the raw Kepler light curves by views.py, all quarters)
  * global view       whole phase-folded orbit (2001 bins)
  * local views       transit zoom (201 bins) as 4 aligned channels:
                      full transit, odd transits, even transits, centroid shift
  * secondary view    zoom on the deepest dip away from the transit (eclipsing binaries)
  * physical parameters from the NASA Exoplanet Archive cumulative table (FEATURES)

Columns that encode NASA's own vetting decision are never used as inputs:
dispositions, koi_score, koi_fpflag_*, kepler_name, koi_comment, provenance/date columns.
The optional DIAGNOSTIC_FEATURES (NASA's centroid offsets, odd/even depth statistics)
are the values NASA's Robovetter uses to *assign* the false-positive label, so they are
only used in an ablation. Star Gazer computes its own versions from the light curves.
"""

import json
import warnings

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

from . import config as C
from . import views

# Transit-fit and stellar parameters (physical properties of the signal and star).
FEATURES = [
    'koi_period', 'koi_duration', 'koi_depth', 'koi_impact', 'koi_ror', 'koi_dor', 'koi_incl',
    'koi_prad', 'koi_teq', 'koi_insol', 'koi_model_snr', 'koi_num_transits',
    'koi_max_sngle_ev', 'koi_max_mult_ev', 'koi_count',
    'koi_steff', 'koi_slogg', 'koi_smet', 'koi_srad', 'koi_smass', 'koi_srho', 'koi_kepmag',
]
DIAGNOSTIC_FEATURES = ['koi_bin_oedp_sig', 'koi_fwm_stat_sig', 'koi_dikco_msky',
                       'koi_dicco_msky', 'koi_fwm_srao', 'koi_fwm_sdeco']
# Heavy-tailed positive quantities are log-scaled before standardising.
LOG_FEATURES = {'koi_period', 'koi_duration', 'koi_depth', 'koi_ror', 'koi_dor', 'koi_prad',
                'koi_teq', 'koi_insol', 'koi_model_snr', 'koi_num_transits', 'koi_max_sngle_ev',
                'koi_max_mult_ev', 'koi_srad', 'koi_smass', 'koi_srho', 'koi_dikco_msky',
                'koi_dicco_msky', 'koi_fwm_stat_sig', 'koi_bin_oedp_sig'}
FEATURE_CLIP = 10.0   # standardised features are clipped to ±10 (a few catalog fits are wild)

# Local-view channels, all centred on the transit (see views.py).
LOCAL_CHANNELS = ('local_view', 'odd_view', 'even_view', 'centroid_view')

FULL_CATALOG = C.RAW_DIR / 'koi_cumulative_full.csv'
MODEL_DIR = C.MODELS_DIR / 'v3'
MODEL_FILE = MODEL_DIR / 'star_gazer.keras'          # ensemble members: star_gazer_1.keras, ...
PREPROCESSOR_FILE = MODEL_DIR / 'feature_preprocessor.json'
HISTORY_FILE = MODEL_DIR / 'training_history.json'
THRESHOLD_FILE = MODEL_DIR / 'threshold.json'
RESULTS_DIR = C.PROJECT_ROOT / 'results' / 'v3'


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load_catalog():
    return pd.read_csv(FULL_CATALOG)


def load_dataset(catalog=None, progress=True):
    """All labelled KOIs that have current-version cached views. Returns a dict of aligned arrays."""
    cat = catalog if catalog is not None else load_catalog()
    lab = cat[cat.koi_disposition.isin(['CONFIRMED', 'FALSE POSITIVE'])].set_index('kepoi_name')
    V, names = views.load_views(lab.index, progress=progress)
    rows = lab.loc[names]
    return {
        'global': V['global_view'][..., None],
        'local': np.stack([V[k] for k in LOCAL_CHANNELS], axis=-1),
        'secondary': V['secondary_view'][..., None],
        'table': rows.reset_index(),
        'y': (rows.koi_disposition == 'CONFIRMED').astype(int).to_numpy(),
        'groups': rows.kepid.to_numpy(),
        'names': np.array(names),
    }


def row_views(ds, i):
    """Views dict (as from views_for_koi) for row `i` of a dataset from load_dataset()."""
    v = {k: ds['local'][i, :, j] for j, k in enumerate(LOCAL_CHANNELS)}
    v['global_view'] = ds['global'][i, :, 0]
    v['secondary_view'] = ds['secondary'][i, :, 0]
    return v


def split_by_star(y, groups, seed=C.SEED):
    """Train / val / test indices (~64 / 16 / 20) with every star in exactly one split."""
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    trainval, test = next(outer.split(np.zeros(len(y)), y, groups))
    inner = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    tr, va = next(inner.split(np.zeros(len(trainval)), y[trainval], groups[trainval]))
    return trainval[tr], trainval[va], test


class FeaturePreprocessor:
    """log-scale + median-impute + standardise (+ clip), fitted on the training split only."""

    def __init__(self, columns=None):
        self.columns = list(columns or FEATURES)
        self.median = self.mean = self.std = None

    def _raw(self, table):
        X = table.reindex(columns=self.columns).astype(float).to_numpy()
        for j, c in enumerate(self.columns):
            if c in LOG_FEATURES:
                X[:, j] = np.log10(np.clip(X[:, j], 0, None) + 1e-3)
        return X

    def fit(self, table):
        X = self._raw(table)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)               # all-empty column
            self.median = np.nan_to_num(np.nanmedian(X, axis=0))
        X = np.where(np.isnan(X), self.median, X)
        self.mean, self.std = X.mean(axis=0), X.std(axis=0) + 1e-6
        return self

    def transform(self, table):
        X = self._raw(table)
        X = np.where(np.isnan(X), self.median, X)
        return np.clip((X - self.mean) / self.std, -FEATURE_CLIP, FEATURE_CLIP).astype(np.float32)

    def save(self, path=None):
        path = path or PREPROCESSOR_FILE
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'columns': self.columns, 'median': self.median.tolist(),
                                    'mean': self.mean.tolist(), 'std': self.std.tolist()}, indent=1))

    @classmethod
    def load(cls, path=None):
        d = json.loads((path or PREPROCESSOR_FILE).read_text())
        p = cls(d['columns'])
        p.median, p.mean, p.std = (np.array(d[k]) for k in ('median', 'mean', 'std'))
        return p


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
def _conv_tower(x, blocks, pool_size, name):
    from tensorflow.keras import layers
    for i, (filters, n_conv) in enumerate(blocks):
        for j in range(n_conv):
            x = layers.Conv1D(filters, 5, padding='same', activation='relu',
                              name=f'{name}_conv{i}_{j}')(x)
        x = layers.MaxPooling1D(pool_size, strides=2, name=f'{name}_pool{i}')(x)
    return layers.Flatten(name=f'{name}_flat')(x)


def build_model(n_features=len(FEATURES), use_global=True, use_local=True, use_secondary=True,
                use_features=True, local_channels=len(LOCAL_CHANNELS), compile=True):
    """AstroNet towers (Shallue & Vanderburg 2018), an ExoMiner-style secondary-eclipse
    tower, and an MLP for catalog features, merged by a fully connected head."""
    from tensorflow import keras
    from tensorflow.keras import layers

    inputs, branches = [], []
    if use_global:
        g = keras.Input((views.GLOBAL_BINS, 1), name='global_view')
        inputs.append(g)
        branches.append(_conv_tower(g, [(16, 2), (32, 2), (64, 2), (128, 2), (256, 2)], 5, 'global'))
    if use_local:
        lo = keras.Input((views.LOCAL_BINS, local_channels), name='local_view')
        inputs.append(lo)
        branches.append(_conv_tower(lo, [(16, 2), (32, 2)], 7, 'local'))
    if use_secondary:
        s = keras.Input((views.LOCAL_BINS, 1), name='secondary_view')
        inputs.append(s)
        branches.append(_conv_tower(s, [(8, 1), (16, 1)], 7, 'secondary'))
    if use_features:
        f = keras.Input((n_features,), name='features')
        inputs.append(f)
        h = layers.Dense(64, activation='relu', name='feat_dense0')(f)
        branches.append(layers.Dense(64, activation='relu', name='feat_dense1')(h))

    x = branches[0] if len(branches) == 1 else layers.Concatenate(name='merge')(branches)
    for i, units in enumerate((512, 256, 128)):
        x = layers.Dense(units, activation='relu', name=f'head{i}')(x)
        x = layers.Dropout(0.3, name=f'head_drop{i}')(x)
    out = layers.Dense(1, activation='sigmoid', name='planet_prob')(x)

    model = keras.Model(inputs, out, name='star_gazer')
    if not compile:
        return model
    model.compile(optimizer=keras.optimizers.Adam(1e-4), loss='binary_crossentropy',
                  metrics=['accuracy', keras.metrics.AUC(name='auc'),
                           keras.metrics.Precision(name='precision'),
                           keras.metrics.Recall(name='recall')])
    return model


def architecture(model):
    """build_model() keyword arguments that reproduce `model`'s inputs."""
    shapes = {i.name: i.shape for i in model.inputs}
    return {'n_features': shapes['features'][-1] if 'features' in shapes else len(FEATURES),
            'use_global': 'global_view' in shapes, 'use_local': 'local_view' in shapes,
            'use_secondary': 'secondary_view' in shapes, 'use_features': 'features' in shapes,
            'local_channels': shapes['local_view'][-1] if 'local_view' in shapes else len(LOCAL_CHANNELS)}


def save_model(model, path=None):
    """Save architecture + weights without optimizer state (~3x smaller); loads for prediction."""
    path = path or MODEL_FILE
    export = build_model(**architecture(model), compile=False)
    export.set_weights(model.get_weights())
    path.parent.mkdir(parents=True, exist_ok=True)
    export.save(path)


def _inputs(model, available):
    """Pick the arrays `model` expects (by input name), trimming local channels if needed."""
    out = {}
    for i in model.inputs:
        x = available[i.name]
        out[i.name] = x[..., :i.shape[-1]] if i.name == 'local_view' else x
    return out


def model_inputs(model, ds, idx, features):
    available = {'global_view': ds['global'][idx], 'local_view': ds['local'][idx],
                 'secondary_view': ds['secondary'][idx],
                 'features': features[idx] if features is not None else None}
    return _inputs(model, available)


def class_weights(y):
    n, pos = len(y), y.sum()
    return {0: n / (2 * (n - pos)), 1: n / (2 * pos)}


def _batches(x, y, weights, batch_size, seed, flip):
    """Shuffled training batches with sample weights; randomly time-reverses the views
    (a transit looks the same played backwards), as in AstroNet."""
    from tensorflow import keras

    class Batches(keras.utils.PyDataset):
        def __init__(self):
            super().__init__()
            self.rng = np.random.default_rng(seed)
            self.order = self.rng.permutation(len(y))

        def __len__(self):
            return int(np.ceil(len(y) / batch_size))

        def __getitem__(self, i):
            idx = np.sort(self.order[i * batch_size:(i + 1) * batch_size])
            xb = {k: v[idx].copy() for k, v in x.items()}
            if flip:
                rev = self.rng.random(len(idx)) < 0.5
                for k, v in xb.items():
                    if k != 'features':
                        v[rev] = v[rev, ::-1]
            return xb, y[idx], weights[idx]

        def on_epoch_end(self):
            self.order = self.rng.permutation(len(y))

    return Batches()


def train(model, ds, features, tr, va, epochs=50, batch_size=64, verbose=2, augment=True, seed=C.SEED):
    from tensorflow import keras
    callbacks = [
        keras.callbacks.EarlyStopping(monitor='val_auc', mode='max', patience=8,
                                      restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=4),
    ]
    y_tr = ds['y'][tr]
    cw = class_weights(y_tr)
    weights = np.where(y_tr == 1, cw[1], cw[0]).astype(np.float32)
    data = _batches(model_inputs(model, ds, tr, features), y_tr, weights, batch_size, seed, augment)
    h = model.fit(data, validation_data=(model_inputs(model, ds, va, features), ds['y'][va]),
                  epochs=epochs, callbacks=callbacks, verbose=verbose)
    return {k: [float(v) for v in vals] for k, vals in h.history.items()}


def predict(models, inputs_by_model):
    """Mean planet probability over one model or an ensemble."""
    models = models if isinstance(models, (list, tuple)) else [models]
    return np.mean([m.predict(inputs_by_model(m), verbose=0).ravel() for m in models], axis=0)


def best_threshold(y_true, y_prob):
    """Threshold that maximises accuracy on the given (validation) split."""
    grid = np.linspace(0.05, 0.95, 91)
    accs = [((y_prob >= t) == y_true).mean() for t in grid]
    return float(grid[int(np.argmax(accs))])


def metrics(y, prob, threshold=0.5):
    from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
    pred = (prob >= threshold).astype(int)
    return {'accuracy': float(accuracy_score(y, pred)), 'auc': float(roc_auc_score(y, prob)),
            'precision': float(precision_score(y, pred, zero_division=0)),
            'recall': float(recall_score(y, pred)), 'threshold': float(threshold), 'n': int(len(y))}


def evaluate(models, ds, features, idx, threshold=0.5):
    """(metrics dict, probabilities) for one model or an ensemble on the rows `idx`."""
    prob = predict(models, lambda m: model_inputs(m, ds, idx, features))
    return metrics(ds['y'][idx], prob, threshold), prob


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------
def model_files():
    """star_gazer.keras plus any ensemble members (star_gazer_1.keras, ...)."""
    members = [p for p in MODEL_DIR.glob(f'{MODEL_FILE.stem}_*.keras') if p.stem.split('_')[-1].isdigit()]
    members.sort(key=lambda p: int(p.stem.split('_')[-1]))
    return ([MODEL_FILE] if MODEL_FILE.exists() else []) + members


def save_trained(models, pre, history, threshold):
    """Save the final model(s), feature preprocessor, history and threshold into models/v3/."""
    models = models if isinstance(models, (list, tuple)) else [models]
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for old in model_files():
        old.unlink()   # don't mix members from an earlier run into the ensemble
    for i, m in enumerate(models):
        save_model(m, MODEL_FILE if i == 0 else MODEL_DIR / f'{MODEL_FILE.stem}_{i}.keras')
    pre.save()
    HISTORY_FILE.write_text(json.dumps(history), encoding='utf-8')
    THRESHOLD_FILE.write_text(json.dumps({'threshold': float(threshold)}), encoding='utf-8')


def load_trained():
    """(models, preprocessor, threshold) saved by scripts/train_star_gazer.py.

    `models` is a list (one entry, or several for an ensemble); predict() averages them.
    """
    from tensorflow import keras
    files = model_files()
    if not files:
        raise FileNotFoundError(f'No Star Gazer model in {C.rel(MODEL_DIR)}; run scripts/train_star_gazer.py')
    models = [keras.models.load_model(p) for p in files]
    pre = FeaturePreprocessor.load()
    threshold = json.loads(THRESHOLD_FILE.read_text())['threshold'] if THRESHOLD_FILE.exists() else 0.5
    return models, pre, threshold


def views_for_koi(catalog, kepoi_name):
    """Cached views for a KOI (dict of arrays), or build them from MAST (all quarters)."""
    from .terms import ensure_accepted
    p = views.view_path(kepoi_name)
    if views.is_current(kepoi_name):
        with np.load(p) as z:
            return {k: z[k] for k in views.VIEW_KEYS}
    ensure_accepted()
    row = catalog[catalog.kepoi_name == kepoi_name].iloc[0]
    star = catalog[catalog.kepid == row.kepid].dropna(subset=['koi_period', 'koi_time0bk', 'koi_duration'])
    transits = [(float(r.koi_period), float(r.koi_time0bk), float(r.koi_duration)) for r in star.itertuples()]
    if not transits:
        raise RuntimeError(f'{kepoi_name} has no period / epoch / duration in the catalog')
    koi = [(kepoi_name, row.koi_period, row.koi_time0bk, row.koi_duration)]
    _, result, skipped, err = views.process_star(int(row.kepid), koi, transits)
    if err or kepoi_name not in result:
        raise RuntimeError(f'Could not build views for {kepoi_name}: '
                           f'{err or skipped.get(kepoi_name, "not enough data")}')
    views.save_views(result)
    return result[kepoi_name]


def predict_koi(models, pre, catalog, kepoi_name, threshold=0.5):
    """Planet probability for one KOI by name. Returns (prob, verdict, views dict, catalog row)."""
    match = catalog[catalog.kepoi_name == kepoi_name]
    if match.empty:
        raise KeyError(f'{kepoi_name} not found in the KOI catalog')
    v = views_for_koi(catalog, kepoi_name)
    available = {'global_view': v['global_view'][None, :, None],
                 'local_view': np.stack([v[k] for k in LOCAL_CHANNELS], axis=-1)[None],
                 'secondary_view': v['secondary_view'][None, :, None],
                 'features': pre.transform(match)}
    prob = float(predict(models, lambda m: _inputs(m, available))[0])
    return prob, ('PLANET' if prob >= threshold else 'FALSE POSITIVE'), v, match.iloc[0]
