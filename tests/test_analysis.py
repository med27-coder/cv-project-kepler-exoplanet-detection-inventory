"""Tests for scripts/experiments/analyze_results.py (slice statistics and intervals)."""

import importlib
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts' / 'experiments'


@pytest.fixture
def analysis(monkeypatch):
    monkeypatch.syspath_prepend(str(SCRIPTS))
    return importlib.import_module('analyze_results')


def test_wilson_interval(analysis):
    lo, hi = analysis.wilson(1, 7)            # the giant-planet slice: 1 of 7 found
    assert 0.02 < lo < 0.03 and 0.5 < hi < 0.52
    assert all(np.isnan(v) for v in analysis.wilson(0, 0))   # empty slice: no interval, no crash
    lo, hi = analysis.wilson(50, 50)
    assert hi == 1.0 and lo > 0.9


def test_slice_stats(analysis):
    y = np.array([1, 1, 1, 0, 0, 0, 0])
    pred = np.array([1, 1, 0, 0, 0, 1, 0])
    s = analysis.slice_stats(y, pred)
    assert (s['n'], s['planets']) == (7, 3)
    assert s['accuracy'] == round(5 / 7, 4) and s['recall'] == round(2 / 3, 4)
    assert s['false_positive_rate'] == 0.25


def test_breakdown_bins_are_right_closed(analysis):
    table = pd.DataFrame({'koi_prad': [1.0, 20.0], 'koi_model_snr': [5.0, 300.0], 'koi_period': [1.0, 200.0],
                          'koi_kepmag': [12.0, 15.5], 'koi_count': [1, 2]})
    out = analysis.breakdown(table, np.array([1, 0]), np.array([1, 0]))
    counts = out['KOIs on the star']
    assert counts['1']['n'] == 1 and counts['2']['n'] == 1     # a star with 1 KOI lands in "1"
    assert out['planet radius (Earths)']['> 15']['n'] == 1
