"""Feature ablations for Star Gazer (run after training): what changes if inputs are added or removed?

    .venv\\Scripts\\python scripts\\ablation_features.py gaia            [--threads 10]
    .venv\\Scripts\\python scripts\\ablation_features.py no-koi-count    [--threads 10]

gaia:          adds Berger et al. 2020's Gaia-based stellar properties (radius, mass, density,
               luminosity, temperature, gravity, metallicity, age, distance).
no-koi-count:  drops koi_count (number of KOIs on the star). The independent audit
               (docs/AUDIT_V3.md) flagged it as partly reflecting how NASA confirmed planets
               (multi-planet systems were validated in bulk), so this measures how much the model
               leans on it.

Each trains one hybrid network on exactly the same star-grouped split and seed as the first
ensemble member of the last training run, and compares the two on the same test stars. Writes
results/v3/ablation_<variant>.json. Single networks on one split differ by about +/-0.4 points of
accuracy from seed to seed (the ensemble members range 96.5-97.4%), so small differences are noise;
confirm anything that matters with cross-validation.
"""

import argparse
import json
import sys

import pandas as pd

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

GAIA_FILE = C.RAW_DIR / 'berger2020_gaia_kepler.csv'
GAIA_FEATURES = ['gaia_srad', 'gaia_smass', 'gaia_log_srho', 'gaia_log_lum', 'gaia_steff', 'gaia_slogg',
                 'gaia_smet', 'gaia_age', 'gaia_dist_pc']
NOISE = 0.004   # rough single-network seed-to-seed spread in test accuracy / AUC differences


def add_gaia(table, gaia):
    """The table with Gaia columns joined on kepid (NaN where a star has no Gaia match)."""
    g = gaia.drop_duplicates('kepid').set_index('kepid')[GAIA_FEATURES]
    return table.join(g, on='kepid')


def variant_columns(variant, ds):
    """(feature columns, a note) for the variant; may add columns to ds['table']."""
    if variant == 'gaia':
        if not GAIA_FILE.exists():
            sys.exit('Gaia table missing: run scripts/fetch_extra_data.py gaia_stars')
        ds['table'] = add_gaia(ds['table'], pd.read_csv(GAIA_FILE))
        coverage = float(ds['table'][GAIA_FEATURES[0]].notna().mean())
        return S.FEATURES + GAIA_FEATURES, f'Gaia matched for {coverage:.0%} of KOIs'
    return [c for c in S.FEATURES if c != 'koi_count'], 'koi_count removed'


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('variant', choices=['gaia', 'no-koi-count'])
    parser.add_argument('--threads', type=int, default=None)
    parser.add_argument('--epochs', type=int, default=60)
    args = parser.parse_args()
    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))
    metrics_file = S.RESULTS_DIR / 'metrics.json'
    if not metrics_file.exists():
        sys.exit('Needs results/v3/metrics.json: train first.')
    low_priority()
    limit_tf_threads(args.threads)
    import train_star_gazer as T  # same folder; reuses fit_one (checkpointed) and score

    ds = S.load_dataset()
    columns, note = variant_columns(args.variant, ds)
    tr, va, te = S.split_by_star(ds['y'], ds['groups'])
    pre = S.FeaturePreprocessor(columns).fit(ds['table'].iloc[tr])
    feats = pre.transform(ds['table'])
    fp = T.run_fingerprint(ds, tr, va, args.epochs, pre.columns)
    model, _ = T.fit_one('hybrid', ds, feats, tr, va, args.epochs, C.SEED, fp, tag=f'hybrid-{args.variant}')
    variant, _ = T.score(f'hybrid {args.variant}', [model], ds, feats, va, te)

    baseline = json.loads(metrics_file.read_text())['results']['hybrid']
    members = baseline.get('members', [baseline])   # single networks with the standard features
    base = members[0]                                # same seed as the variant
    d_auc = variant['threshold_0.5']['auc'] - base['threshold_0.5']['auc']
    d_acc = variant['threshold_0.5']['accuracy'] - base['threshold_0.5']['accuracy']
    # Judge against the spread of all the standard networks, not one seed: a variant only counts
    # as different when it lands outside that range (and even then, confirm with cross-validation).
    accs = [m['threshold_0.5']['accuracy'] for m in members]
    aucs = [m['threshold_0.5']['auc'] for m in members]
    acc, auc = variant['threshold_0.5']['accuracy'], variant['threshold_0.5']['auc']
    if acc > max(accs) + NOISE / 2 and auc >= max(aucs):
        verdict = 'better than every standard network'
    elif acc < min(accs) - NOISE / 2 or auc < min(aucs) - NOISE / 2:
        verdict = 'worse than every standard network'
    else:
        verdict = 'within the range of the standard networks (no clear difference)'
    out = {'variant': args.variant, 'note': note, 'features': columns,
           'baseline_same_seed': base, 'variant_result': variant,
           'standard_range': {'accuracy': [round(min(accs), 4), round(max(accs), 4)],
                              'auc': [round(min(aucs), 4), round(max(aucs), 4)]},
           'delta_auc': round(d_auc, 4), 'delta_accuracy': round(d_acc, 4), 'verdict': verdict}
    path = S.RESULTS_DIR / f'ablation_{args.variant.replace("-", "_")}.json'
    path.write_text(json.dumps(out, indent=2), encoding='utf-8')
    print(f'{args.variant} ({note}): accuracy {base["threshold_0.5"]["accuracy"]:.4f} -> '
          f'{variant["threshold_0.5"]["accuracy"]:.4f} ({d_acc:+.4f}), AUC {d_auc:+.4f}: {verdict}. '
          f'Saved {C.rel(path)}')


if __name__ == '__main__':
    main()
