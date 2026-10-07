"""Train and evaluate V3 "Star Gazer" on the all-quarter views + NASA catalog features.

    .venv\\Scripts\\python scripts\\train_star_gazer.py                  # ablations + final hybrid model
    .venv\\Scripts\\python scripts\\train_star_gazer.py --ensemble 5     # final model = 5 averaged networks
    .venv\\Scripts\\python scripts\\train_star_gazer.py --variants hybrid --quick   # fast plumbing test

Trains these variants on the same star-grouped split so they can be compared fairly:
  cnn_basic  global + local transit view only (AstroNet baseline)
  cnn        all light-curve views: + odd/even, centroid, secondary eclipse
  features   NASA catalog parameters only
  hybrid     all views + catalog parameters (the Star Gazer model; saved to models/v3/)
--diagnostics adds a hybrid that also sees NASA's Robovetter diagnostics (ablation only).
The decision threshold is chosen on the validation split, then applied to the test split.
Results go to results/v3/metrics.json. Runs at below-normal CPU priority.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

VARIANTS = {
    'cnn_basic': dict(use_global=True, use_local=True, use_secondary=False, use_features=False,
                      local_channels=1),
    'cnn': dict(use_global=True, use_local=True, use_secondary=True, use_features=False),
    'features': dict(use_global=False, use_local=False, use_secondary=False, use_features=True),
    'hybrid': dict(use_global=True, use_local=True, use_secondary=True, use_features=True),
}


def fit_one(name, ds, feats, tr, va, epochs, seed):
    from tensorflow import keras
    keras.utils.set_random_seed(seed)
    model = S.build_model(n_features=feats.shape[1], **VARIANTS[name])
    start = time.time()
    hist = S.train(model, ds, feats, tr, va, epochs=epochs, seed=seed)
    print(f'  {name} (seed {seed}): {len(hist["loss"])} epochs in {(time.time() - start) / 60:.1f} min',
          flush=True)
    return model, hist


def score(label, models, ds, feats, va, te):
    """Pick the threshold on validation, report test metrics at 0.5 and at that threshold."""
    _, p_val = S.evaluate(models, ds, feats, va)
    thr = S.best_threshold(ds['y'][va], p_val)
    test_05, p_test = S.evaluate(models, ds, feats, te, threshold=0.5)
    test_thr = S.metrics(ds['y'][te], p_test, thr)
    print(f'{label:20s} test @0.5: acc {test_05["accuracy"]:.4f} auc {test_05["auc"]:.4f} | '
          f'@val-thr {thr:.2f}: acc {test_thr["accuracy"]:.4f}', flush=True)
    return {'threshold_0.5': test_05, 'threshold_val': test_thr}, p_test


ABLATION_LABELS = {'cnn_basic': 'Global + local\n(AstroNet)', 'cnn': 'All light-curve\nviews',
                   'features': 'Catalog\nfeatures only', 'hybrid': 'Star Gazer\n(views + features)',
                   'hybrid+diagnostics': '+ NASA diagnostics\n(partly circular)'}


def save_figures(ds, te, p_test, threshold, results, hist):
    """Write the V3 result figures into results/v3/."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    from kepler_cnn import plots
    out = S.RESULTS_DIR
    y_te, table_te = ds['y'][te], ds['table'].iloc[te].reset_index(drop=True)
    figures = [
        lambda: plots.v3_dataset_overview(ds['table'], ds['y'], out / 'dataset_overview.png'),
        lambda: plots.v3_training_history(hist, out / 'training_history.png'),
        lambda: plots.v3_ablation(results, out / 'ablation.png', ABLATION_LABELS),
        lambda: plots.v3_evaluation(y_te, p_test, threshold, out / 'evaluation.png'),
        lambda: plots.v3_breakdown(table_te, y_te, p_test, threshold, out / 'breakdown.png'),
        lambda: plots.v3_mistakes(lambda i: S.row_views(ds, te[i]), ds['names'][te], y_te, p_test,
                                  path=out / 'mistakes.png'),
    ]
    for make in figures:
        plt.close(make())
    print(f'Saved {len(figures)} figures to {C.rel(out)}')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--quick', action='store_true', help='5 epochs, for testing the pipeline')
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--variants', nargs='+', choices=list(VARIANTS), default=list(VARIANTS))
    parser.add_argument('--ensemble', type=int, default=1, help='number of hybrid networks to average')
    parser.add_argument('--diagnostics', action='store_true',
                        help='also train a hybrid with NASA vetting diagnostics (ablation only)')
    parser.add_argument('--threads', type=int, default=None, help='TensorFlow CPU threads')
    args = parser.parse_args()
    epochs = 5 if args.quick else args.epochs

    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))
    low_priority()
    print(f'TensorFlow threads: {limit_tf_threads(args.threads)}', flush=True)

    ds = S.load_dataset()
    y, groups = ds['y'], ds['groups']
    if len(y) == 0:
        sys.exit('No current-version views found; run scripts/build_full_dataset.py first.')
    print(f'{len(y)} KOIs with views ({y.sum()} confirmed, {(y == 0).sum()} false positives) '
          f'on {len(set(groups))} stars', flush=True)
    tr, va, te = S.split_by_star(y, groups)
    print(f'split by star: train {len(tr)}  val {len(va)}  test {len(te)}', flush=True)

    pre = S.FeaturePreprocessor().fit(ds['table'].iloc[tr])
    feats = pre.transform(ds['table'])

    results, hists, hybrid = {}, {}, None
    for name in args.variants:
        n_models = args.ensemble if name == 'hybrid' else 1
        fitted = [fit_one(name, ds, feats, tr, va, epochs, C.SEED + i) for i in range(n_models)]
        models = [m for m, _ in fitted]
        hists[name] = fitted[0][1]
        label = name if n_models == 1 else f'{name} x{n_models}'
        results[name], p_test = score(label, models, ds, feats, va, te)
        if n_models > 1:
            results[name]['members'] = [score(f'  member {i}', [m], ds, feats, va, te)[0]
                                        for i, m in enumerate(models)]
        if name == 'hybrid':
            hybrid = (models, p_test)

    if args.diagnostics:
        pre_d = S.FeaturePreprocessor(S.FEATURES + S.DIAGNOSTIC_FEATURES).fit(ds['table'].iloc[tr])
        feats_d = pre_d.transform(ds['table'])
        model, _ = fit_one('hybrid', ds, feats_d, tr, va, epochs, C.SEED)
        results['hybrid+diagnostics'], _ = score('hybrid+diagnostics', [model], ds, feats_d, va, te)

    S.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    summary = {'n_kois': int(len(y)), 'n_stars': int(len(set(groups))),
               'split': {'train': int(len(tr)), 'val': int(len(va)), 'test': int(len(te))},
               'epochs_max': epochs, 'ensemble': args.ensemble, 'results': results}
    (S.RESULTS_DIR / 'metrics.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    (S.RESULTS_DIR / 'histories.json').write_text(json.dumps(hists), encoding='utf-8')

    if hybrid is not None:
        models, p_test = hybrid
        S.save_trained(models, pre, hists['hybrid'], results['hybrid']['threshold_val']['threshold'])
        np.savez(S.RESULTS_DIR / 'test_predictions.npz', idx=te, prob=p_test, y=y[te], names=ds['names'][te])
        print(f'Saved {len(models)} model file(s) to {C.rel(S.MODEL_DIR)}')
        threshold = results['hybrid']['threshold_val']['threshold']
        save_figures(ds, te, p_test, threshold, results, hists['hybrid'])
    print(f'Saved {C.rel(S.RESULTS_DIR / "metrics.json")}')


if __name__ == '__main__':
    main()
