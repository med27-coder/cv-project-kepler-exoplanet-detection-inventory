"""Score the unlabelled CANDIDATE KOIs with Colossus 2, for the star map's EXPERIMENTAL model switch.

    .venv\\Scripts\\python scripts\\pipeline\\colossus_score_candidates.py           # hours on a laptop CPU
    .venv\\Scripts\\python scripts\\pipeline\\colossus_score_candidates.py --quick   # 1 epoch, a plumbing check

Colossus 2 was registered and tested in docs/star-gazer/V4B_PREREGISTRATION.md and was NOT adopted (it found more
giants than V3 but its probabilities run high: docs/star-gazer/V4B_RESULTS.md). This script changes nothing about
it and measures nothing: it repeats the registered recipe once on every labelled KOI (V3's inner train/validation
split, Stage A for 60 epochs, Stage B fine-tuned on the giants at 1e-5 for 30) and scores the candidates. Between 6
and 10 Earth radii its answer is blended with V3's, as registered; below 6 the answer is V3's own.

Writes results/v4/colossus2_candidates.csv (git-ignored) and the public copy the star map reads,
results/v3_public/colossus_scores.csv (giant candidates only: the rest are V3's scores already published).
These are model outputs for education, not discoveries or classifications (Terms of Use §2).
"""

import json
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from kepler_cnn import config as C
from kepler_cnn import giants as G
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

FINE_TUNE_LR, FINE_TUNE_EPOCHS = 1e-5, 30   # as registered (scripts/pipeline/v4b_colossus2_cv.py)
OUT = C.PROJECT_ROOT / 'results' / 'v4' / 'colossus2_candidates.csv'
PUBLIC = C.PROJECT_ROOT / 'results' / 'v3_public' / 'colossus_scores.csv'
V3_SCORES = C.PROJECT_ROOT / 'results' / 'v3_public' / 'candidate_scores.csv'


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
    giant = G.is_giant(table.koi_prad.to_numpy(dtype=float))
    tr, va = S.split_train_val(y, groups, np.arange(len(y)), seed=C.SEED)   # V3's inner split, on everything
    physics = G.physics_features(table, ds['local'], ds['secondary'])
    pre = S.FeaturePreprocessor().fit(table.iloc[tr])
    scaler = G.PhysicsScaler().fit(physics.iloc[tr])
    feats = np.hstack([pre.transform(table), scaler.transform(physics)])
    keras.utils.set_random_seed(C.SEED)
    model = S.build_model(n_features=feats.shape[1])
    S.train(model, ds, feats, tr, va, epochs=1 if quick else 60, seed=C.SEED)                       # Stage A
    model.compile(optimizer=keras.optimizers.Adam(FINE_TUNE_LR), loss='binary_crossentropy',
                  metrics=['accuracy', keras.metrics.AUC(name='auc')])
    S.train(model, ds, feats, tr[giant[tr]], va[giant[va]], epochs=1 if quick else FINE_TUNE_EPOCHS, seed=C.SEED)   # Stage B

    cand = S.load_dataset(dispositions=['CANDIDATE'])
    if len(cand['names']) == 0:
        sys.exit('No candidate views found; run scripts/pipeline/build_full_dataset.py --candidates first.')
    ctable = cand['table']
    cfeats = np.hstack([pre.transform(ctable), scaler.transform(G.physics_features(ctable, cand['local'], cand['secondary']))])
    idx = np.arange(len(cand['names']))
    p_c2 = S.predict(model, lambda m: S.model_inputs(m, cand, idx, cfeats))
    prad = ctable.koi_prad.to_numpy(dtype=float)
    v3 = pd.read_csv(V3_SCORES).set_index('kepoi_name').star_gazer_prob.reindex(cand['names']).to_numpy()
    out = pd.DataFrame({'kepoi_name': cand['names'], 'koi_prad': prad, 'star_gazer_prob': v3,
                        'colossus2_raw': p_c2.round(4), 'colossus_prob': G.combine(prad, v3, p_c2).round(4)})
    if quick:
        print(out.head().to_string(index=False))
        print('quick check done (nothing saved)')
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False)
    public = out[G.is_giant(prad) & out.star_gazer_prob.notna()][['kepoi_name', 'colossus_prob']]
    public.sort_values('colossus_prob', ascending=False).to_csv(PUBLIC, index=False)
    PUBLIC.with_suffix('.json').write_text(json.dumps({
        'scored': datetime.now(timezone.utc).date().isoformat(), 'model': 'Colossus 2 (V4b), not adopted: EXPERIMENTAL',
        'registration': 'docs/star-gazer/V4B_PREREGISTRATION.md', 'results': 'docs/star-gazer/V4B_RESULTS.md',
        'threshold': 0.5, 'n': len(public)}, indent=2) + '\n', encoding='utf-8')
    g = public.colossus_prob.to_numpy()
    print(f'{len(out)} candidates, {len(public)} giants scored; Colossus calls {(g >= 0.5).mean():.1%} of the giants '
          f'planets (V3 at its threshold: {(out[G.is_giant(prad)].star_gazer_prob >= 0.7).mean():.1%})')
    print(f'Saved {C.rel(OUT)} and {C.rel(PUBLIC)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
