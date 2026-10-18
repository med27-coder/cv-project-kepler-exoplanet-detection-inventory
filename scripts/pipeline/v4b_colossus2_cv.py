"""Star Gazer V4b, Colossus 2: the registered cross-validation (docs/V4B_PREREGISTRATION.md).

    .venv\\Scripts\\python scripts\\pipeline\\v4b_colossus2_cv.py

In each of V3's folds: Stage A, V3's hybrid network with the 9 physics features added to its catalog input,
trained on all the fold's training KOIs; Stage B (Colossus 2), Stage A fine-tuned on the giant KOIs. Out-of-fold
predictions go to results/v4/cv_oof_colossus2.npz and the registered endpoints (against V3's out-of-fold
predictions) to results/v4/analysis_colossus2.json. Hours on a laptop CPU; run it in the background.
"""

import json
import sys

import numpy as np
import v4_giants_cv as V
from sklearn.model_selection import StratifiedGroupKFold

from kepler_cnn import config as C
from kepler_cnn import giants as G
from kepler_cnn import star_gazer as S
from kepler_cnn import terms
from kepler_cnn.runtime import limit_tf_threads, low_priority

FINE_TUNE_LR, FINE_TUNE_EPOCHS = 1e-5, 30


def main():
    quick = '--quick' in sys.argv   # 1 epoch, first fold only, nothing saved: a plumbing check
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
    giant = G.is_giant(prad)
    physics = G.physics_features(table, ds['local'], ds['secondary'])
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=C.SEED)   # V3's CV folds
    p_a, p_b = np.full(len(y), np.nan), np.full(len(y), np.nan)
    for k, (trainval, te) in enumerate(outer.split(np.zeros(len(y)), y, groups)):
        tr, va = S.split_train_val(y, groups, trainval, seed=C.SEED + k)   # V3's inner split
        assert not set(groups[te]) & set(groups[trainval])
        pre = S.FeaturePreprocessor().fit(table.iloc[tr])
        scaler = G.PhysicsScaler().fit(physics.iloc[tr])
        feats = np.hstack([pre.transform(table), scaler.transform(physics)])
        keras.utils.set_random_seed(C.SEED + k)
        model = S.build_model(n_features=feats.shape[1])                    # V3's hybrid, 31 catalog inputs
        S.train(model, ds, feats, tr, va, epochs=1 if quick else 60, seed=C.SEED + k)       # Stage A
        _, pa = S.evaluate([model], ds, feats, te)
        p_a[te] = pa
        tr_g, va_g = tr[giant[tr]], va[giant[va]]
        model.compile(optimizer=keras.optimizers.Adam(FINE_TUNE_LR), loss='binary_crossentropy',
                      metrics=['accuracy', keras.metrics.AUC(name='auc')])
        S.train(model, ds, feats, tr_g, va_g, epochs=1 if quick else FINE_TUNE_EPOCHS, seed=C.SEED + k)   # Stage B
        te_g = te[giant[te]]
        _, pb = S.evaluate([model], ds, feats, te_g)
        p_b[te_g] = pb
        print(f'fold {k + 1}/5 done: stage A on {len(te)} test KOIs, Colossus 2 on {len(te_g)} giants', flush=True)
        del model
        keras.backend.clear_session()
        if quick:
            print('quick check done (nothing saved)')
            return 0
    V.OUT_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(V.OUT_DIR / 'cv_oof_colossus2.npz', names=ds['names'], y=y, prad=prad, p_stage_a=p_a, p_colossus2=p_b)
    result = V.analyse(ds['names'], y, prad, groups, p_b, p_a)   # g1 = Colossus 2, g2 = Stage A (ablation)
    text = json.dumps(result, indent=2).replace('"g1', '"colossus2').replace('"g2', '"stage_a')
    (V.OUT_DIR / 'analysis_colossus2.json').write_text(text, encoding='utf-8')
    print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
