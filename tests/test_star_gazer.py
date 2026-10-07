"""Star Gazer data handling and model plumbing (small synthetic data, no network)."""

import numpy as np
import pandas as pd
import pytest

from kepler_cnn import star_gazer as S
from kepler_cnn import views


def fake_dataset(n=40, seed=0):
    rng = np.random.default_rng(seed)
    table = pd.DataFrame({c: rng.lognormal(size=n) for c in S.FEATURES})
    table.loc[::7, 'koi_impact'] = np.nan
    return {
        'global': rng.normal(size=(n, views.GLOBAL_BINS, 1)).astype(np.float32),
        'local': rng.normal(size=(n, views.LOCAL_BINS, len(S.LOCAL_CHANNELS))).astype(np.float32),
        'secondary': rng.normal(size=(n, views.LOCAL_BINS, 1)).astype(np.float32),
        'table': table,
        'y': np.tile([0, 1], n // 2),
        'groups': np.repeat(np.arange(n // 2), 2),
        'names': np.array([f'K{i:05d}.01' for i in range(n)]),
    }


def test_split_by_star_keeps_stars_together():
    y = np.random.default_rng(0).integers(0, 2, 500)
    groups = np.random.default_rng(1).integers(0, 300, 500)
    tr, va, te = S.split_by_star(y, groups)
    assert len(tr) + len(va) + len(te) == 500
    sets = [set(groups[i]) for i in (tr, va, te)]
    assert not (sets[0] & sets[1] or sets[0] & sets[2] or sets[1] & sets[2])


def test_feature_preprocessor_roundtrip(tmp_path):
    table = fake_dataset()['table']
    table['koi_srho'] = np.nan                       # an all-empty column must not produce NaNs
    table.loc[0, 'koi_impact'] = 1e9                 # wild values are clipped
    pre = S.FeaturePreprocessor().fit(table)
    X = pre.transform(table)
    assert X.shape == (len(table), len(S.FEATURES)) and np.isfinite(X).all()
    assert np.abs(X).max() <= S.FEATURE_CLIP
    pre.save(tmp_path / 'pre.json')
    np.testing.assert_allclose(S.FeaturePreprocessor.load(tmp_path / 'pre.json').transform(table), X)


def test_best_threshold():
    y = np.array([0, 0, 1, 1])
    assert 0.3 < S.best_threshold(y, np.array([0.1, 0.3, 0.4, 0.9])) <= 0.4


def test_class_weights_balance():
    w = S.class_weights(np.array([0, 0, 0, 1]))
    assert w[1] * 1 == pytest.approx(w[0] * 3)


@pytest.fixture(scope='module')
def keras():
    return pytest.importorskip('tensorflow').keras


def test_augmentation_flips_views_not_features(keras):
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    model = S.build_model(compile=False)
    x = S.model_inputs(model, ds, np.arange(40), feats)
    batches = S._batches(x, ds['y'], np.ones(40, np.float32), batch_size=40, seed=0, flip=True)
    xb, yb, wb = batches[0]
    np.testing.assert_array_equal(xb['features'], x['features'])
    flipped = [not np.array_equal(xb['local_view'][i], x['local_view'][i]) for i in range(40)]
    assert 0 < sum(flipped) < 40
    i = flipped.index(True)
    np.testing.assert_array_equal(xb['global_view'][i], x['global_view'][i, ::-1])
    np.testing.assert_array_equal(xb['secondary_view'][i], x['secondary_view'][i, ::-1])


def test_model_variants_and_save_roundtrip(keras, tmp_path):
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    idx = np.arange(8)
    basic = S.build_model(use_secondary=False, use_features=False, local_channels=1)
    assert basic.get_layer('local_view').output.shape[-1] == 1
    assert S.model_inputs(basic, ds, idx, feats)['local_view'].shape == (8, views.LOCAL_BINS, 1)

    model = S.build_model(n_features=feats.shape[1])
    path = tmp_path / 'm.keras'
    S.save_model(model, path)
    loaded = keras.models.load_model(path)
    assert S.architecture(loaded) == S.architecture(model)
    np.testing.assert_allclose(S.predict(loaded, lambda m: S.model_inputs(m, ds, idx, feats)),
                               S.predict(model, lambda m: S.model_inputs(m, ds, idx, feats)), atol=1e-6)


def test_model_files_orders_ensemble_members(tmp_path, monkeypatch):
    monkeypatch.setattr(S, 'MODEL_DIR', tmp_path)
    monkeypatch.setattr(S, 'MODEL_FILE', tmp_path / 'star_gazer.keras')
    for name in ('star_gazer.keras', 'star_gazer_10.keras', 'star_gazer_2.keras', 'star_gazer_old.keras'):
        (tmp_path / name).touch()
    expected = ['star_gazer.keras', 'star_gazer_2.keras', 'star_gazer_10.keras']
    assert [p.name for p in S.model_files()] == expected
