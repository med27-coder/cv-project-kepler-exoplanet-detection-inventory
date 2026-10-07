"""View building on synthetic Kepler-like light curves (no network)."""

import numpy as np
import pytest

from kepler_cnn import views

CADENCE = views.LONG_CADENCE_DAYS
PERIOD, T0, DUR_H = 10.0, 5.0, 3.0


def make_quarters(period=PERIOD, t0=T0, dur_h=DUR_H, depth=1e-3, n_quarters=4, odd_depth=None,
                  secondary_depth=0.0, centroid_offset_px=0.0, seed=0):
    """Box-shaped transits on white noise, split into ~90-day quarters with gaps."""
    rng = np.random.default_rng(seed)
    quarters = []
    for q in range(n_quarters):
        t = np.arange(q * 93.0, q * 93.0 + 90.0, CADENCE)
        phase = (t - t0 + period / 2) % period - period / 2
        n = np.floor((t - t0) / period + 0.5)
        in_transit = np.abs(phase) < dur_h / 48
        d = np.where((n % 2 == 1) & (odd_depth is not None), odd_depth or 0, depth)
        dip = np.where(in_transit, d, 0.0)
        sec_phase = (t - t0) % period - period / 2
        dip = dip + np.where(np.abs(sec_phase) < dur_h / 48, secondary_depth, 0.0)
        flux = 1000.0 * (1 - dip + rng.normal(0, 1e-4, len(t)))
        # a background binary pulls the centroid towards itself in proportion to the dip
        col = 500.0 + centroid_offset_px * dip + rng.normal(0, 2e-6, len(t))
        row = 300.0 + rng.normal(0, 2e-6, len(t))
        quarters.append((t, flux, col, row))
    return quarters


def build(quarters, period=PERIOD, t0=T0, dur_h=DUR_H):
    lc = views.prepare_lightcurve(quarters, [(period, t0, dur_h)])
    out, skipped = views.views_for_lightcurve(lc, [('K1', period, t0, dur_h)])
    assert not skipped, skipped
    return out['K1']


@pytest.fixture(scope='module')
def planet():
    return build(make_quarters())


def centre(view):
    return view[views.LOCAL_BINS // 2 - 5: views.LOCAL_BINS // 2 + 6].mean()


def test_view_shapes_and_normalisation(planet):
    assert set(planet) == set(views.VIEW_KEYS)
    assert planet['global_view'].shape == (views.GLOBAL_BINS,)
    for k in views.VIEW_KEYS[1:]:
        assert planet[k].shape == (views.LOCAL_BINS,)
    for v in planet.values():
        assert np.isfinite(v).all()
    assert planet['global_view'].min() == pytest.approx(-1)
    assert planet['local_view'].min() == pytest.approx(-1)
    assert abs(int(np.argmin(planet["global_view"])) - views.GLOBAL_BINS // 2) <= 15   # flat-bottomed box
    assert abs(int(np.argmin(planet['local_view'])) - views.LOCAL_BINS // 2) <= 25


def test_planet_has_no_eb_signatures(planet):
    assert abs(centre(planet['odd_view']) - centre(planet['even_view'])) < 0.1
    assert planet['secondary_view'].min() > -0.1
    assert centre(planet['centroid_view']) < 0.5


def test_odd_even_difference():
    v = build(make_quarters(odd_depth=2e-3))
    assert abs(centre(v['odd_view']) - centre(v['even_view'])) > 0.4


def test_secondary_eclipse():
    v = build(make_quarters(secondary_depth=4e-4))
    assert v['secondary_view'].min() < -0.2


def test_background_binary_centroid():
    v = build(make_quarters(centroid_offset_px=3.0))
    assert centre(v['centroid_view']) > 1.5


def test_long_period_few_transits_still_builds():
    """Regression: long-period KOIs with 2-3 transits used to be dropped silently."""
    v = build(make_quarters(period=150.0, t0=40.0, dur_h=6.0, depth=2e-3), period=150.0, t0=40.0, dur_h=6.0)
    assert v['local_view'].min() == pytest.approx(-1)


def test_bad_parameters_are_skipped_not_crashing():
    lc = views.prepare_lightcurve(make_quarters(n_quarters=1), [(PERIOD, T0, DUR_H)])
    kois = [('K1', float('nan'), T0, DUR_H), ('K2', PERIOD, T0, DUR_H)]
    out, skipped = views.views_for_lightcurve(lc, kois)
    assert 'K1' in skipped and 'K2' in out


def test_save_load_and_version(tmp_path, monkeypatch, planet):
    monkeypatch.setattr(views, 'VIEWS_DIR', tmp_path)
    views.save_views({'K1': planet})
    assert views.is_current('K1') and not views.is_current('K2')
    V, kept = views.load_views(['K2', 'K1'], progress=False)
    assert kept == ['K1']
    assert V['local_view'].shape == (1, views.LOCAL_BINS)
    # a view file from an older recipe (no version) is ignored and rebuilt
    np.savez(tmp_path / 'K3.npz', global_view=planet['global_view'], local_view=planet['local_view'])
    assert not views.is_current('K3')
    assert views.load_views(['K3'], progress=False)[1] == []
