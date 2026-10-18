"""Star Gazer V3.1: the registered cross-validation (docs/star-gazer/V3_1_PREREGISTRATION.md).

    .venv\\Scripts\\python scripts\\pipeline\\v3_1_cv.py            # hours on a laptop CPU; resumes if stopped
    .venv\\Scripts\\python scripts\\pipeline\\v3_1_cv.py --quick    # 1 epoch, first fold, nothing saved

On new star-grouped folds (seed 2026), V3 and V3.1 (V3's hybrid network with the 9 physics features added to its
catalog input) are both trained in every fold with the same inner split and seed, so they are compared KOI by KOI.
Out-of-fold predictions go to results/v3_1/cv_oof.npz and the registered endpoints to results/v3_1/analysis.json.
"""

import json
import sys

import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold

from kepler_cnn import config as C
from kepler_cnn import giants as G
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority
from kepler_cnn.training import fit_one, run_fingerprint

FOLD_SEED = 2026          # registered: never used before
N_BOOT = 2000
MARGIN = 0.002            # non-inferiority: overall accuracy no more than 0.2 points below V3
OUT_DIR = C.PROJECT_ROOT / 'results' / 'v3_1'
EPOCHS = 60               # V3's


def threshold_at_fpr(p, y, fpr):
    """The lowest threshold whose false-positive rate on (p, y) is at most `fpr` (planet when p > t)."""
    neg = np.sort(p[y == 0])[::-1]
    k = int(np.floor(fpr * len(neg)))
    return neg[k] if k < len(neg) else -np.inf


def giant_recalls(p3, p31, y):
    """V3's recall at 0.5 on the giant set, and V3.1's at V3's false-positive rate there."""
    pos = y == 1
    fpr3 = np.mean(p3[y == 0] >= 0.5)
    t = threshold_at_fpr(p31, y, fpr3)
    return float(np.mean(p3[pos] >= 0.5)), float(np.mean(p31[pos] > t)), float(fpr3), float(t)


def accuracy(p, y):
    return float(np.mean((p >= 0.5) == y))


def analyse(y, prad, groups, p3, p31):
    giant = G.is_giant(prad)
    small = prad < 6
    r3, r31, fpr3, t31 = giant_recalls(p3[giant], p31[giant], y[giant])
    acc_diff = accuracy(p31, y) - accuracy(p3, y)
    rng = np.random.default_rng(FOLD_SEED)
    stars = np.unique(groups)
    rows_of = {s: np.flatnonzero(groups == s) for s in stars}
    d_giant, d_acc = [], []
    for _ in range(N_BOOT):   # paired bootstrap over stars, both endpoints from the same resample
        idx = np.concatenate([rows_of[s] for s in rng.choice(stars, len(stars), replace=True)])
        d_acc.append(accuracy(p31[idx], y[idx]) - accuracy(p3[idx], y[idx]))
        g = idx[giant[idx]]
        if y[g].sum() and (y[g] == 0).sum():
            a, b, _, _ = giant_recalls(p3[g], p31[g], y[g])
            d_giant.append(b - a)
    g_lo, g_hi = np.percentile(d_giant, [2.5, 97.5])
    a_lo, a_hi = np.percentile(d_acc, [2.5, 97.5])
    big = prad >= 15
    yg = y[giant]
    result = {
        'fold_seed': FOLD_SEED, 'n_kois': len(y), 'n_giants': int(giant.sum()), 'n_giant_planets': int(yg.sum()),
        'primary': {
            'giants': {'v3_recall': r3, 'v31_recall_at_v3_fpr': r31, 'difference': r31 - r3,
                       'ci95': [float(g_lo), float(g_hi)], 'v3_fpr': fpr3, 'v31_threshold': t31,
                       'pass': bool(g_lo > 0), 'bootstrap_resamples': len(d_giant)},
            'non_inferiority': {'v3_accuracy': accuracy(p3, y), 'v31_accuracy': accuracy(p31, y),
                                'difference': acc_diff, 'ci95': [float(a_lo), float(a_hi)], 'margin': -MARGIN,
                                'pass': bool(a_lo > -MARGIN)},
        },
        'secondary': {
            'overall_superiority': bool(a_lo > 0),
            'accuracy_under_6_re': {'v3': accuracy(p3[small], y[small]), 'v31': accuracy(p31[small], y[small])},
            'auc_all': {'v3': roc_auc_score(y, p3), 'v31': roc_auc_score(y, p31)},
            'brier_all': {'v3': brier_score_loss(y, p3), 'v31': brier_score_loss(y, p31)},
            'recall_15plus': {'n_planets': int(y[big].sum()),
                              'v3': float(np.mean(p3[big & (y == 1)] >= 0.5)),
                              'v31_at_v3_fpr': float(np.mean(p31[big & (y == 1)] > t31))},
            'giant_fpr_at_05': {'v3': fpr3, 'v31': float(np.mean(p31[giant & (y == 0)] >= 0.5))},
        },
    }
    result['primary']['pass'] = result['primary']['giants']['pass'] and result['primary']['non_inferiority']['pass']
    return json.loads(json.dumps(result, default=float))


def main():
    quick = '--quick' in sys.argv
    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))
    low_priority()
    print(f'TensorFlow threads: {limit_tf_threads(None)}', flush=True)
    from tensorflow import keras

    ds = S.load_dataset()
    y, groups, table = ds['y'], ds['groups'], ds['table']
    prad = table.koi_prad.to_numpy(dtype=float)
    physics = G.physics_features(table, ds['local'], ds['secondary'])
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=FOLD_SEED)
    p3, p31 = np.full(len(y), np.nan), np.full(len(y), np.nan)
    fold_of = np.full(len(y), -1)
    epochs = 1 if quick else EPOCHS
    for k, (trainval, te) in enumerate(outer.split(np.zeros(len(y)), y, groups)):
        fold_of[te] = k
        seed = FOLD_SEED + k
        tr, va = S.split_train_val(y, groups, trainval, seed=seed)
        assert not set(groups[te]) & set(groups[trainval]), 'a star is in both train and test'
        print(f'fold {k + 1}/5: train {len(tr)}  val {len(va)}  test {len(te)}', flush=True)
        pre = S.FeaturePreprocessor().fit(table.iloc[tr])
        base = pre.transform(table)
        wide = np.hstack([base, G.PhysicsScaler().fit(physics.iloc[tr]).transform(physics)])
        for tag, feats, cols, out in [('v31cv_v3', base, S.FEATURES, p3),
                                      ('v31cv_v31', wide, S.FEATURES + list(G.PHYSICS), p31)]:
            fp = None if quick else run_fingerprint(ds, tr, va, epochs, cols)
            model, _ = fit_one('hybrid', ds, feats, tr, va, epochs, seed, fingerprint=fp, tag=tag)
            _, p = S.evaluate([model], ds, feats, te)
            out[te] = p
            del model
            keras.backend.clear_session()
        if quick:
            print('quick check done (nothing saved)')
            return 0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(OUT_DIR / 'cv_oof.npz', names=ds['names'], y=y, prad=prad, fold=fold_of, p_v3=p3, p_v31=p31)
    result = analyse(y, prad, groups, p3, p31)
    text = json.dumps(result, indent=2)
    (OUT_DIR / 'analysis.json').write_text(text, encoding='utf-8')
    print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
