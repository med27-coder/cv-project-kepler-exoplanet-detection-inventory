"""Star Gazer V4, Colossus (giant-planet specialist): the registered cross-validation and analysis.

    .venv\\Scripts\\python scripts\\pipeline\\v4_giants_cv.py

Follows docs/V4_PREREGISTRATION.md exactly: V3's own CV folds; G1 (registered) and G2 (ablation) trained on the
giant KOIs of each fold's training stars; out-of-fold predictions saved to results/v4/cv_oof_giants.npz. When V3's
out-of-fold predictions exist (cross_validate.py --variants hybrid --save-oof), it also computes the registered
endpoints and writes results/v4/analysis.json.
"""

import json
import sys

import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold

from kepler_cnn import config as C
from kepler_cnn import giants as G
from kepler_cnn import star_gazer as S

OUT_DIR = C.PROJECT_ROOT / 'results' / 'v4'
V3_OOF = S.RESULTS_DIR / 'cv_oof.npz'
N_BOOT = 2000


def threshold_at_fpr(p, y, fpr):
    """The lowest threshold whose false-positive rate on (p, y) is at most `fpr` (predict planet when p > t)."""
    neg = np.sort(p[y == 0])[::-1]
    k = int(np.floor(fpr * len(neg)))
    return neg[k] if k < len(neg) else -np.inf


def recalls(p3, p4, y):
    """V3's recall at 0.5, and V4's at V3's false-positive rate."""
    pos = y == 1
    fpr3 = np.mean(p3[y == 0] >= 0.5)
    t4 = threshold_at_fpr(p4, y, fpr3)
    return np.mean(p3[pos] >= 0.5), np.mean(p4[pos] > t4), fpr3, t4


def analyse(names, y, prad, groups, p_g1, p_g2):
    z = np.load(V3_OOF, allow_pickle=False)
    assert list(z['names']) == list(names), 'V3 out-of-fold predictions are for a different KOI list'
    p3_all = z['p_hybrid']
    g = G.is_giant(prad)
    y_g, p3, p1, p2, grp = y[g], p3_all[g], p_g1[g], p_g2[g], groups[g]
    r3, r1, fpr3, t1 = recalls(p3, p1, y_g)
    _, r2, _, _ = recalls(p3, p2, y_g)
    rng = np.random.default_rng(C.SEED)
    stars = np.unique(grp)
    rows_of = {s: np.flatnonzero(grp == s) for s in stars}
    diffs = []
    for _ in range(N_BOOT):   # paired bootstrap over stars
        idx = np.concatenate([rows_of[s] for s in rng.choice(stars, len(stars), replace=True)])
        if y_g[idx].sum() == 0 or (y_g[idx] == 0).sum() == 0:
            continue
        a, b, _, _ = recalls(p3[idx], p1[idx], y_g[idx])
        diffs.append(b - a)
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    big = prad[g] >= 15
    comb = G.combine(prad, p3_all, p_g1)
    acc3, accc = np.mean((p3_all >= 0.5) == y), np.mean((comb >= 0.5) == y)
    result = {
        'n_giants': int(g.sum()), 'n_giant_planets': int(y_g.sum()),
        'primary': {'v3_recall': r3, 'v4_recall_at_v3_fpr': r1, 'difference': r1 - r3,
                    'ci95': [float(lo), float(hi)], 'v3_fpr': fpr3, 'v4_threshold': float(t1),
                    'success': bool(lo > 0), 'bootstrap_resamples': len(diffs)},
        'secondary': {
            'auc_giants': {'v3': roc_auc_score(y_g, p3), 'g1': roc_auc_score(y_g, p1), 'g2': roc_auc_score(y_g, p2)},
            'recall_15plus': {'n_planets': int(y_g[big].sum()),
                              'v3': float(np.mean(p3[big & (y_g == 1)] >= 0.5)) if y_g[big].sum() else None,
                              'g1': float(np.mean(p1[big & (y_g == 1)] > t1)) if y_g[big].sum() else None},
            'brier_giants': {'v3': brier_score_loss(y_g, p3), 'g1': brier_score_loss(y_g, p1)},
            'g2_recall_at_v3_fpr': r2,
            'combined_accuracy_all': accc, 'v3_accuracy_all': acc3,
            'non_inferior': bool(accc >= acc3 - 0.002),
        },
    }
    return json.loads(json.dumps(result, default=float))


def main():
    ds = S.load_dataset()
    y, groups, table = ds['y'], ds['groups'], ds['table']
    prad = table.koi_prad.to_numpy(dtype=float)
    giant = G.is_giant(prad)
    print(f'{len(y)} labelled KOIs; giant set: {giant.sum()} KOIs, {y[giant].sum()} confirmed planets')
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=C.SEED)   # V3's CV folds
    p_g1, p_g2 = np.full(len(y), np.nan), np.full(len(y), np.nan)
    fold_of = np.full(len(y), -1)
    for k, (trainval, te) in enumerate(outer.split(np.zeros(len(y)), y, groups)):
        fold_of[te] = k
        tr, te_g = trainval[giant[trainval]], te[giant[te]]
        assert not set(groups[te]) & set(groups[trainval])
        for physics, out in [(True, p_g1), (False, p_g2)]:
            model = G.fit(G.feature_frame(ds, tr, physics), y[tr], C.SEED + k)
            out[te_g] = model.predict_proba(G.feature_frame(ds, te_g, physics))[:, 1]
        print(f'fold {k + 1}/5: train {len(tr)} giants ({y[tr].sum()} planets), test {len(te_g)} giants', flush=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(OUT_DIR / 'cv_oof_giants.npz', names=ds['names'], y=y, prad=prad, fold=fold_of, p_g1=p_g1, p_g2=p_g2)
    print(f'Saved {C.rel(OUT_DIR / "cv_oof_giants.npz")}')
    if not V3_OOF.exists():
        print('V3 out-of-fold predictions not found yet (cross_validate.py --variants hybrid --save-oof); '
              'analysis skipped.')
        return 0
    result = analyse(ds['names'], y, prad, groups, p_g1, p_g2)
    (OUT_DIR / 'analysis.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
