"""Star Gazer V4, Colossus (giant specialist): the registered hand-off and the matched false-positive threshold."""

import sys
from pathlib import Path

import numpy as np

from kepler_cnn import giants as G

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'pipeline'))
import v4_giants_cv as V


def test_blend_weight_follows_the_registration():
    r = np.array([np.nan, 1.0, 5.99, 6.0, 8.0, 10.0, 30.0])
    assert np.allclose(G.blend_weight(r), [0, 0, 0, 0, 0.5, 1, 1])
    assert list(G.is_giant(r)) == [False, False, False, True, True, True, True]
    assert np.allclose(G.combine(r, np.full(7, 0.2), np.full(7, 0.8)), [0.2, 0.2, 0.2, 0.2, 0.5, 0.8, 0.8])


def test_threshold_matches_the_false_positive_rate():
    y = np.array([0] * 10 + [1] * 5)
    p = np.array([0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.85, 0.75, 0.65, 0.3])
    t = V.threshold_at_fpr(p, y, 0.2)        # at most 2 of 10 false alarms
    assert np.mean(p[y == 0] > t) <= 0.2
    assert np.mean(p[y == 1] > t) == 0.6     # t = 0.7: 0.95, 0.85 and 0.75 clear it, 0.65 and 0.3 do not
