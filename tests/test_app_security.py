"""Input checks in the Gradio demo (app.py) that keep bad values away from downloads and file paths."""

import math

import pytest

app = pytest.importorskip('app')


@pytest.mark.parametrize('kepler_id, period, t0', [
    (11442793, 7.0, 131.5),
    (757450, 0.1, None),          # epoch optional
    (1, 2000, -10_000),
])
def test_manual_inputs_accepted(kepler_id, period, t0):
    assert app.check_manual_inputs(kepler_id, period, t0) is None


@pytest.mark.parametrize('kepler_id, period, t0', [
    (math.nan, 7.0, 0),
    (11442793, math.inf, 0),
    (11442793, 7.0, -math.inf),
    (-5, 7.0, 0),
    (1.5, 7.0, 0),                # Kepler IDs are whole numbers
    (10**12, 7.0, 0),
    (11442793, 0.0, 0),
    (11442793, 1e9, 0),
    (11442793, 7.0, 1e12),
    ('11442793', 7.0, 0),         # only numbers, never strings
])
def test_manual_inputs_rejected(kepler_id, period, t0):
    assert app.check_manual_inputs(kepler_id, period, t0)
