"""Score the unlabelled CANDIDATE KOIs with the trained Star Gazer model.

    .venv\\Scripts\\python scripts\\pipeline\\build_full_dataset.py --candidates   # once: views for the candidates
    .venv\\Scripts\\python scripts\\pipeline\\score_candidates.py

Writes results/v3/candidates.csv (every candidate, most planet-like first), candidates.png
(score distribution and agreement with NASA's Robovetter koi_score, which is NOT a model
input) and saliency figures for the top candidates. These are model outputs for education,
not discoveries or classifications (Terms of Use §2).
"""

import argparse
import sys

import numpy as np

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

COLUMNS = ['kepoi_name', 'kepid', 'koi_period', 'koi_prad', 'koi_teq', 'koi_model_snr', 'koi_score']


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--explain', type=int, default=3, help='saliency figures for the top N candidates')
    parser.add_argument('--allow-stale', action='store_true',
                        help='use a model trained on an older view recipe (scores may be unreliable)')
    args = parser.parse_args()
    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))
    low_priority()
    limit_tf_threads()

    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    from kepler_cnn import plots, saliency

    try:
        models, pre, threshold = S.load_trained(allow_stale=args.allow_stale)
    except S.StaleModelError as e:
        sys.exit(f'{e}\n(Pass --allow-stale to score with it anyway.)')
    except FileNotFoundError as e:
        sys.exit(str(e))
    ds = S.load_dataset(dispositions=['CANDIDATE'])
    if len(ds['names']) == 0:
        sys.exit('No candidate views found; run scripts/pipeline/build_full_dataset.py --candidates first.')
    feats = pre.transform(ds['table'])
    idx = np.arange(len(ds['names']))
    prob = S.predict(models, lambda m: S.model_inputs(m, ds, idx, feats))

    table = ds['table'][COLUMNS].copy()
    table['star_gazer_prob'] = prob.round(4)
    table['above_threshold'] = prob >= threshold
    table = table.sort_values('star_gazer_prob', ascending=False).reset_index(drop=True)
    S.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = S.RESULTS_DIR / 'candidates.csv'
    table.to_csv(out, index=False)

    plt.close(plots.v3_candidates(prob, ds['table'].koi_score, threshold, S.RESULTS_DIR / 'candidates.png'))
    for name in table.kepoi_name[:args.explain]:
        i = int(np.flatnonzero(ds['names'] == name)[0])
        sal = saliency.explain(models, saliency.available_for_row(ds, feats, i))
        fig = plots.v3_saliency(S.row_views(ds, i), sal, pre.columns,
                                f'{name} (CANDIDATE): P(planet) = {sal["prob"]:.1%}', C.PLANET_COLOR,
                                path=S.RESULTS_DIR / f'candidate_saliency_{name}.png')
        plt.close(fig)

    nasa = S.agreement_with_nasa(prob, ds['table'].koi_score, threshold)
    comparison = ('no NASA koi_score to compare with' if nasa is None else
                  f'agreement with koi_score >= 0.5: {nasa[0]:.1%} of {nasa[2]} (r = {nasa[1]:.2f})')
    print(f'{len(prob)} candidates scored; {(prob >= threshold).mean():.1%} above the threshold '
          f'{threshold:.2f}; {comparison}')
    print(table.head(10).to_string(index=False))
    print(f'Saved {C.rel(out)}, candidates.png and {args.explain} saliency figures')


if __name__ == '__main__':
    main()
