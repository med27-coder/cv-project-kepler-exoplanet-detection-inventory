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
    xb, _yb, _wb = batches[0]
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


def test_recall_at_precision():
    y = np.array([1, 1, 1, 0, 0, 1])
    p = np.array([0.9, 0.8, 0.7, 0.6, 0.2, 0.1])
    assert S.recall_at_precision(y, p, 0.99) == 0.75
    assert S.recall_at_precision(np.array([0, 1]), np.array([0.9, 0.1]), 0.99) == 0.0


def test_saliency_shapes_and_sign(keras):
    from kepler_cnn import saliency
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    model = S.build_model(n_features=feats.shape[1], compile=False)
    available = saliency.available_for_row(ds, feats, 0)
    sal = saliency.explain([model, model], available)
    assert sal['global_view'].shape == (views.GLOBAL_BINS,)
    assert sal['local_view'].shape == (views.LOCAL_BINS, len(S.LOCAL_CHANNELS))
    assert sal['secondary_view'].shape == (views.LOCAL_BINS,)
    assert sal['features'].shape == (feats.shape[1],)
    # explain() credits each region with the drop in P(planet) when it is hidden
    p0 = float(S.predict([model], lambda m: S._inputs(m, available))[0])
    assert abs(sal['prob'] - p0) < 1e-5
    hidden = {k: v.copy() for k, v in available.items()}
    hidden['features'][0, 3] = 0
    p_hidden = float(S.predict([model], lambda m: S._inputs(m, hidden))[0])
    assert abs(sal['features'][3] - (p0 - p_hidden)) < 1e-5


def test_saliency_skips_unused_inputs(keras):
    from kepler_cnn import saliency
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    basic = S.build_model(use_secondary=False, use_features=False, local_channels=1, compile=False)
    sal = saliency.explain(basic, saliency.available_for_row(ds, feats, 1))
    assert set(sal) == {'prob', 'global_view', 'local_view'}
    assert sal['local_view'].shape == (views.LOCAL_BINS, 1)


def test_split_by_star_matches_original_protocol():
    from sklearn.model_selection import StratifiedGroupKFold
    rng = np.random.default_rng(1)
    y, groups = rng.integers(0, 2, 300), rng.integers(0, 120, 300)
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    trainval, test = next(outer.split(np.zeros(len(y)), y, groups))
    inner = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    tr, va = next(inner.split(np.zeros(len(trainval)), y[trainval], groups[trainval]))
    for got, want in zip(S.split_by_star(y, groups, seed=42), (trainval[tr], trainval[va], test)):
        np.testing.assert_array_equal(got, want)


def test_agreement_with_nasa_handles_missing_scores():
    assert S.agreement_with_nasa([0.9, 0.1], [np.nan, np.nan], 0.5) is None
    assert S.agreement_with_nasa([0.9, 0.1], [0.8, np.nan], 0.5) is None
    agree, r, n = S.agreement_with_nasa([0.9, 0.1, 0.8, 0.2], [0.95, 0.05, 0.1, np.nan], 0.5)
    assert n == 3 and abs(agree - 2 / 3) < 1e-9 and -1 <= r <= 1


def test_stale_model_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(S, 'MODEL_DIR', tmp_path)
    monkeypatch.setattr(S, 'THRESHOLD_FILE', tmp_path / 'threshold.json')
    (tmp_path / 'threshold.json').write_text(f'{{"threshold": 0.4, "view_version": {views.VIEW_VERSION}}}')
    S.check_view_version()
    (tmp_path / 'threshold.json').write_text(f'{{"threshold": 0.4, "view_version": {views.VIEW_VERSION - 1}}}')
    with pytest.raises(S.StaleModelError):
        S.check_view_version()
    (tmp_path / 'threshold.json').write_text('{"threshold": 0.4}')   # saved before versions were recorded
    with pytest.raises(S.StaleModelError):
        S.check_view_version()


def test_explain_many_matches_explain(keras, monkeypatch):
    from kepler_cnn import saliency
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    model = S.build_model(n_features=feats.shape[1], compile=False)
    items = [saliency.available_for_row(ds, feats, i) for i in range(3)]
    monkeypatch.setattr(saliency, 'MAX_ROWS', 300)        # force several predict groups
    many = saliency.explain_many(model, items)
    for one, item in zip(many, items):
        single = saliency.explain(model, item)
        for k in single:
            np.testing.assert_allclose(one[k], single[k], atol=1e-6)


def test_hf_space_refuses_stale_or_old_bundle(tmp_path, monkeypatch):
    import os
    from pathlib import Path
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / 'scripts' / 'tools'))
    import make_hf_space
    monkeypatch.setattr(S, 'MODEL_DIR', tmp_path)
    monkeypatch.setattr(S, 'MODEL_FILE', tmp_path / 'star_gazer.keras')
    monkeypatch.setattr(S, 'THRESHOLD_FILE', tmp_path / 'threshold.json')
    bundle = tmp_path / 'bundle.enc'
    bundle.write_bytes(b'x')
    with pytest.raises(SystemExit, match='No local model'):
        make_hf_space.check_bundle(bundle)
    S.MODEL_FILE.write_bytes(b'model')
    S.THRESHOLD_FILE.write_text(f'{{"threshold": 0.5, "view_version": {views.VIEW_VERSION - 1}}}')
    with pytest.raises(SystemExit, match='crash on start-up'):
        make_hf_space.check_bundle(bundle)
    S.THRESHOLD_FILE.write_text(f'{{"threshold": 0.5, "view_version": {views.VIEW_VERSION}}}')
    os.utime(bundle, (0, 0))                                    # bundle older than the model
    with pytest.raises(SystemExit, match='older than the model'):
        make_hf_space.check_bundle(bundle)
    os.utime(bundle, None)
    for p in (S.MODEL_FILE, S.THRESHOLD_FILE):
        os.utime(p, (1, 1))
    make_hf_space.check_bundle(bundle)                          # current and fresh: no exit


def test_explain_many_mixed_channel_ensemble(keras):
    from kepler_cnn import saliency
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    one_ch = S.build_model(n_features=feats.shape[1], local_channels=1, compile=False)
    four_ch = S.build_model(n_features=feats.shape[1], compile=False)
    sal = saliency.explain([one_ch, four_ch], saliency.available_for_row(ds, feats, 0))
    assert sal['local_view'].shape[-1] == len(S.LOCAL_CHANNELS)   # every channel some member reads


def test_saliency_average_plot_with_basic_model(keras, tmp_path):
    import matplotlib
    matplotlib.use('Agg')
    from kepler_cnn import plots, saliency
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    basic = S.build_model(use_secondary=False, use_features=False, local_channels=1, compile=False)
    sals = saliency.explain_many(basic, [saliency.available_for_row(ds, feats, i) for i in range(4)])
    plots.v3_saliency_average(sals, ds['y'][:4], S.FEATURES, tmp_path / 'avg.png')
    assert (tmp_path / 'avg.png').exists()


def test_saliency_figures_skip_missing_class(keras, tmp_path, monkeypatch):
    from pathlib import Path

    import matplotlib
    matplotlib.use('Agg')
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / 'scripts' / 'pipeline'))   # undone after the test
    import train_star_gazer
    monkeypatch.setattr(S, 'RESULTS_DIR', tmp_path)
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    model = S.build_model(n_features=feats.shape[1], compile=False)
    te = np.flatnonzero(ds['y'] == 1)[:4]                  # planets only
    train_star_gazer.save_saliency_figures([model], ds, feats, S.FEATURES, te, np.full(len(te), 0.7),
                                           n_average=4)
    assert (tmp_path / 'saliency_planet.png').exists()
    assert not (tmp_path / 'saliency_false_positive.png').exists()


def test_training_resumes_from_checkpoints(keras, tmp_path, monkeypatch):
    """A finished network is checkpointed; a rerun of the same setup reloads it instead of
    training again, and a different setup (fingerprint) never reuses it."""
    from kepler_cnn import training as T
    monkeypatch.setattr(T, 'CHECKPOINTS', tmp_path)
    ds = fake_dataset()
    feats = S.FeaturePreprocessor().fit(ds['table']).transform(ds['table'])
    tr, va = np.arange(30), np.arange(30, 40)
    fp = T.run_fingerprint(ds, tr, va, 1, S.FEATURES)
    calls = []
    real_train = S.train
    monkeypatch.setattr(S, 'train', lambda *a, **k: calls.append(1) or real_train(*a, **{**k, 'verbose': 0}))
    model, hist = T.fit_one('features', ds, feats, tr, va, 1, 7, fp)
    assert calls == [1] and (tmp_path / f'features_seed7_{fp}.json').exists()
    again, hist2 = T.fit_one('features', ds, feats, tr, va, 1, 7, fp)
    assert calls == [1] and hist2 == hist                       # reloaded, not retrained
    x = S.model_inputs(again, ds, va, feats)
    np.testing.assert_allclose(again.predict(x, verbose=0), model.predict(x, verbose=0), atol=1e-5)
    assert T.run_fingerprint(ds, tr, va, 2, S.FEATURES) != fp   # other settings: other checkpoints
