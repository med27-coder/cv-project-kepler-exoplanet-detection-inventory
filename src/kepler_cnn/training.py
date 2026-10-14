"""Training helpers shared by the training, cross-validation and ablation scripts.

VARIANTS (which inputs each model sees), checkpointed fit_one (a stopped run resumes where it left
off), run_fingerprint (when a checkpoint may be reused) and score (threshold on validation, metrics
on test).
"""

import hashlib
import json
import time

import numpy as np

from . import config as C
from . import star_gazer as S

VARIANTS = {
    'cnn_basic': {'use_global': True, 'use_local': True, 'use_secondary': False, 'use_features': False,
                      'local_channels': 1},
    'cnn': {'use_global': True, 'use_local': True, 'use_secondary': True, 'use_features': False},
    'features': {'use_global': False, 'use_local': False, 'use_secondary': False, 'use_features': True},
    'hybrid': {'use_global': True, 'use_local': True, 'use_secondary': True, 'use_features': True},
}


CHECKPOINTS = C.DATA_DIR / 'interim' / 'train_checkpoints'   # outside models/v3: never encrypted or shipped


def run_fingerprint(ds, tr, va, epochs, columns):
    """Hash of everything a trained network depends on. Checkpoints are reused only when it matches,
    so a resumed run can't mix networks trained on different data, splits or settings."""
    from kepler_cnn import views
    h = hashlib.sha256()
    for part in (views.VIEW_VERSION, epochs, list(columns), list(map(str, ds['names'])),
                 np.asarray(tr).tolist(), np.asarray(va).tolist(), C.SEED):
        h.update(json.dumps(part).encode())
    return h.hexdigest()[:16]


def fit_one(name, ds, feats, tr, va, epochs, seed, fingerprint=None, tag=None):
    """Train one network, or reload it from a checkpoint of the same run (see run_fingerprint).
    Each finished network is checkpointed, so a stopped run resumes where it left off."""
    from tensorflow import keras
    tag = tag or name
    ckpt = CHECKPOINTS / f'{tag}_seed{seed}_{fingerprint}.keras' if fingerprint else None
    hist_file = ckpt.with_suffix('.json') if ckpt else None
    if ckpt and ckpt.exists() and hist_file.exists():   # history is written last: marks a complete checkpoint
        print(f'  {tag} (seed {seed}): resumed from checkpoint', flush=True)
        return keras.models.load_model(ckpt, safe_mode=True), json.loads(hist_file.read_text())
    keras.utils.set_random_seed(seed)
    model = S.build_model(n_features=feats.shape[1], **VARIANTS[name])
    start = time.time()
    hist = S.train(model, ds, feats, tr, va, epochs=epochs, seed=seed)
    print(f'  {tag} (seed {seed}): {len(hist["loss"])} epochs in {(time.time() - start) / 60:.1f} min',
          flush=True)
    if ckpt:
        S.save_model(model, ckpt)
        hist_file.write_text(json.dumps(hist), encoding='utf-8')
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
