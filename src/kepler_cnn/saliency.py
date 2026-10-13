"""Occlusion saliency for Star Gazer: which parts of the views (and which catalog
features) push a KOI towards "planet" or "false positive".

A window of one view is replaced by 0 (the views' out-of-transit baseline; for the
odd/even/secondary/centroid channels 0 means "no signal"), the model is re-run, and
the drop in P(planet) is credited to every bin in that window. One catalog feature
at a time is set to 0 (the training mean after standardisation). Positive values
mean the region supports "planet"; negative values support "false positive".
Works for one model or an ensemble (probabilities are averaged, as in predict()).
"""

import numpy as np

from . import star_gazer as S

# (window, stride) in bins for each view
WINDOWS = {'global_view': (60, 30), 'local_view': (12, 6), 'secondary_view': (12, 6)}


def _windows(n, width, stride):
    starts = list(range(0, max(1, n - width + 1), stride))
    if starts[-1] + width < n:
        starts.append(n - width)
    return [(s, min(n, s + width)) for s in starts]


def _spread(n, wins, deltas):
    """Average each bin's credit over the windows that covered it."""
    total, count = np.zeros(n), np.zeros(n)
    for (a, b), d in zip(wins, deltas):
        total[a:b] += d
        count[a:b] += 1
    return total / np.maximum(count, 1)


MAX_ROWS = 4000   # occluded copies per predict call; bounds memory when explaining many KOIs


def explain(models, available):
    """Saliency for one KOI.

    `available` maps input name -> array with a leading batch axis of 1 (as built in
    star_gazer.predict_koi). Returns {'prob', 'global_view' (n,), 'local_view' (n, channels),
    'secondary_view' (n,), 'features' (n_features,)}; entries the model doesn't use are omitted.
    """
    return explain_many(models, [available])[0]


def explain_many(models, available_list):
    """explain() for many KOIs, batching their occluded copies into few predict calls.

    Occluded batches are built one KOI at a time and flushed every MAX_ROWS rows, so
    memory stays bounded however many KOIs are explained.
    """
    models = models if isinstance(models, (list, tuple)) else [models]
    used = {i.name for m in models for i in m.inputs}
    # Occlude every local channel any member reads; each member trims to its own count
    # (S._inputs), so channels it doesn't use just get zero credit from it.
    n_ch = (max(i.shape[-1] for m in models for i in m.inputs if i.name == 'local_view')
            if 'local_view' in used else None)

    results, group, rows = [], [], 0

    def flush():
        stacked = {k: np.concatenate([b[k] for _, _, b, _ in group]) for k in group[0][2]}
        prob = S.predict(models, lambda m: S._inputs(m, stacked))
        start = 0
        for available, plans, _, n in group:
            results.append(_assemble(available, used, plans, prob[start:start + n]))
            start += n

    for available in available_list:
        if n_ch is not None:
            available = dict(available, local_view=available['local_view'][..., :n_ch])
        plans, batch = _occlusions(available, used)
        n = len(plans) + 1                 # row 0 is the original
        if group and rows + n > MAX_ROWS:
            flush()
            group, rows = [], 0
        group.append((available, plans, batch, n))
        rows += n
    if group:
        flush()
    return results


def _occlusions(available, used):
    """(plans, batch): the original inputs (row 0) followed by one occluded copy per plan."""
    plans = []                        # (key, channel or None, (a, b) or feature index)
    batch = {k: [v[0]] for k, v in available.items() if k in used}
    for key in ('global_view', 'local_view', 'secondary_view'):
        if key not in used:
            continue
        x = available[key][0]
        channels = range(x.shape[-1]) if key == 'local_view' else [None]
        for ch in channels:
            for a, b in _windows(x.shape[0], *WINDOWS[key]):
                plans.append((key, ch, (a, b)))
                for k, rows in batch.items():
                    v = available[k][0].copy()
                    if k == key:
                        if ch is None:
                            v[a:b] = 0
                        else:
                            v[a:b, ch] = 0
                    rows.append(v)
    if 'features' in used:
        for j in range(available['features'].shape[-1]):
            plans.append(('features', None, j))
            for k, rows in batch.items():
                v = available[k][0].copy()
                if k == 'features':
                    v[j] = 0
                rows.append(v)
    return plans, {k: np.stack(v) for k, v in batch.items()}


def _assemble(available, used, plans, prob):
    """Turn the probabilities for one KOI's batch (row 0 = original) into saliency arrays."""
    base, deltas = float(prob[0]), base_minus(prob)
    out = {'prob': base}
    for key in ('global_view', 'local_view', 'secondary_view'):
        if key not in used:
            continue
        x = available[key][0]
        idx = [i for i, p in enumerate(plans) if p[0] == key]
        if key == 'local_view':
            out[key] = np.stack([_spread(x.shape[0], [plans[i][2] for i in idx if plans[i][1] == ch],
                                         [deltas[i] for i in idx if plans[i][1] == ch])
                                 for ch in range(x.shape[-1])], axis=-1)
        else:
            out[key] = _spread(x.shape[0], [plans[i][2] for i in idx], [deltas[i] for i in idx])
    if 'features' in used:
        out['features'] = np.array([deltas[i] for i, p in enumerate(plans) if p[0] == 'features'])
    return out


def base_minus(prob):
    """Drop in P(planet) for every occluded copy (rows 1..) relative to the original (row 0)."""
    return prob[0] - prob[1:]


def available_for_row(ds, features, i):
    """Model inputs (batch of 1) for row `i` of a dataset from star_gazer.load_dataset()."""
    return S.dataset_inputs(ds, slice(i, i + 1), features)
