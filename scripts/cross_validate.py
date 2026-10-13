"""Grouped k-fold cross-validation for Star Gazer: mean ± std test metrics instead of one split.

    .venv\\Scripts\\python scripts\\cross_validate.py                         # hybrid + cnn_basic, 5 folds
    .venv\\Scripts\\python scripts\\cross_validate.py --variants hybrid --folds 3 --quick

Every star is in exactly one test fold. Inside each fold, a star-grouped validation split
(for early stopping and the threshold) is taken from the remaining stars, so no test star
is ever seen during training. Results go to results/v3/cv_metrics.json and cross_validation.png.
"""

import argparse
import json
import sys

import numpy as np
from sklearn.model_selection import StratifiedGroupKFold
from train_star_gazer import VARIANTS, fit_one

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

SUMMARY_KEYS = ('accuracy', 'auc', 'precision', 'recall', 'brier', 'accuracy_val_threshold')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--folds', type=int, default=5)
    parser.add_argument('--variants', nargs='+', choices=list(VARIANTS), default=['cnn_basic', 'hybrid'])
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--quick', action='store_true', help='5 epochs, for testing the pipeline')
    parser.add_argument('--threads', type=int, default=None, help='TensorFlow CPU threads')
    args = parser.parse_args()
    epochs = 5 if args.quick else args.epochs

    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))
    low_priority()
    print(f'TensorFlow threads: {limit_tf_threads(args.threads)}', flush=True)

    from tensorflow import keras
    ds = S.load_dataset()
    y, groups = ds['y'], ds['groups']
    if len(y) == 0:
        sys.exit('No current-version views found; run scripts/build_full_dataset.py first.')
    outer = StratifiedGroupKFold(n_splits=args.folds, shuffle=True, random_state=C.SEED)
    folds = {name: [] for name in args.variants}
    for k, (trainval, te) in enumerate(outer.split(np.zeros(len(y)), y, groups)):
        tr, va = S.split_train_val(y, groups, trainval, seed=C.SEED + k)
        assert not set(groups[te]) & set(groups[trainval]), 'a star is in both train and test'
        print(f'fold {k + 1}/{args.folds}: train {len(tr)}  val {len(va)}  test {len(te)}', flush=True)
        pre = S.FeaturePreprocessor().fit(ds['table'].iloc[tr])
        feats = pre.transform(ds['table'])
        for name in args.variants:
            model, _ = fit_one(name, ds, feats, tr, va, epochs, C.SEED + k)
            _, p_val = S.evaluate([model], ds, feats, va)
            thr = S.best_threshold(y[va], p_val)
            m05, p_te = S.evaluate([model], ds, feats, te, threshold=0.5)
            m05['accuracy_val_threshold'] = S.metrics(y[te], p_te, thr)['accuracy']
            m05['val_threshold'] = thr
            folds[name].append(m05)
            print(f'  {name:10s} acc {m05["accuracy"]:.4f}  auc {m05["auc"]:.4f}', flush=True)
            del model
            keras.backend.clear_session()   # free the graph so memory doesn't grow fold after fold

    summary = {}
    for name, rows in folds.items():
        summary[name] = {key: {'mean': float(np.mean([r[key] for r in rows])),
                               'std': float(np.std([r[key] for r in rows], ddof=1)) if len(rows) > 1 else 0.0}
                         for key in SUMMARY_KEYS}
        a, u = summary[name]['accuracy'], summary[name]['auc']
        print(f'{name:10s} accuracy {a["mean"]:.4f} ± {a["std"]:.4f}   AUC {u["mean"]:.4f} ± {u["std"]:.4f}')

    S.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = S.RESULTS_DIR / 'cv_metrics.json'
    out.write_text(json.dumps({'folds': args.folds, 'epochs_max': epochs, 'n_kois': len(y),
                               'summary': summary, 'per_fold': folds}, indent=2), encoding='utf-8')
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    from kepler_cnn import plots
    plt.close(plots.v3_cross_validation(folds, S.RESULTS_DIR / 'cross_validation.png'))
    print(f'Saved {C.rel(out)} and cross_validation.png')


if __name__ == '__main__':
    main()
