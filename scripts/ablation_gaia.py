"""Does adding Gaia stellar properties help Star Gazer? (an ablation, run after training)

    .venv\\Scripts\\python scripts\\ablation_gaia.py [--threads 10]

Trains one hybrid network with the catalog features PLUS Berger et al. 2020's Gaia-based stellar
properties (radius, mass, density, luminosity, temperature, gravity, metallicity, age, distance),
on exactly the same star-grouped split and seed as the first ensemble member of the last training
run, and compares the two on the same test stars. Writes results/v3/ablation_gaia.json. Keep the
change only if it helps (and confirm with cross-validation before relying on it).
"""

import argparse
import json
import sys

import numpy as np
import pandas as pd

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

GAIA_FILE = C.RAW_DIR / 'berger2020_gaia_kepler.csv'
GAIA_FEATURES = ['gaia_srad', 'gaia_smass', 'gaia_log_srho', 'gaia_log_lum', 'gaia_steff', 'gaia_slogg',
                 'gaia_smet', 'gaia_age', 'gaia_dist_pc']


def add_gaia(table, gaia):
    """The table with Gaia columns joined on kepid (NaN where a star has no Gaia match)."""
    g = gaia.drop_duplicates('kepid').set_index('kepid')[GAIA_FEATURES]
    return table.join(g, on='kepid')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--threads', type=int, default=None)
    parser.add_argument('--epochs', type=int, default=60)
    args = parser.parse_args()
    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))
    metrics_file = S.RESULTS_DIR / 'metrics.json'
    if not metrics_file.exists() or not GAIA_FILE.exists():
        sys.exit('Needs results/v3/metrics.json (train first) and the Gaia table (fetch_extra_data.py gaia_stars).')
    low_priority()
    limit_tf_threads(args.threads)
    import train_star_gazer as T  # same folder; reuses fit_one (checkpointed) and score

    ds = S.load_dataset()
    ds['table'] = add_gaia(ds['table'], pd.read_csv(GAIA_FILE))
    coverage = float(ds['table'][GAIA_FEATURES[0]].notna().mean())
    tr, va, te = S.split_by_star(ds['y'], ds['groups'])
    pre = S.FeaturePreprocessor(S.FEATURES + GAIA_FEATURES).fit(ds['table'].iloc[tr])
    feats = pre.transform(ds['table'])
    fp = T.run_fingerprint(ds, tr, va, args.epochs, pre.columns)
    model, _ = T.fit_one('hybrid', ds, feats, tr, va, args.epochs, C.SEED, fp, tag='hybrid+gaia')
    with_gaia, _ = T.score('hybrid+gaia', [model], ds, feats, va, te)

    baseline = json.loads(metrics_file.read_text())['results']['hybrid']
    base = baseline['members'][0] if 'members' in baseline else baseline   # same seed, no Gaia
    out = {'gaia_coverage': round(coverage, 3), 'features_added': GAIA_FEATURES,
           'baseline_same_seed': base, 'with_gaia': with_gaia,
           'delta_auc': round(with_gaia['threshold_0.5']['auc'] - base['threshold_0.5']['auc'], 4),
           'delta_accuracy': round(with_gaia['threshold_0.5']['accuracy'] - base['threshold_0.5']['accuracy'], 4)}
    (S.RESULTS_DIR / 'ablation_gaia.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
    verdict = 'helps' if out['delta_auc'] > 0.002 else 'makes no clear difference' if out['delta_auc'] > -0.002 else 'hurts'
    print(f'Gaia features ({coverage:.0%} of KOIs matched): AUC {np.round(base["threshold_0.5"]["auc"], 4)} -> '
          f'{np.round(with_gaia["threshold_0.5"]["auc"], 4)} ({out["delta_auc"]:+.4f}): {verdict}. '
          f'Saved {C.rel(S.RESULTS_DIR / "ablation_gaia.json")}')


if __name__ == '__main__':
    main()
