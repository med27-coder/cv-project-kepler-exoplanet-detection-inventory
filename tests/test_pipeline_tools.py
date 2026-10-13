"""Tests for the pipeline helpers: catalog sanity report, prediction scoreboard, pipeline runner."""

import importlib
from pathlib import Path

import pandas as pd
import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'


@pytest.fixture
def scripts(monkeypatch):
    monkeypatch.syspath_prepend(str(SCRIPTS))
    return lambda name: importlib.import_module(name)


def koi(name, disp='CONFIRMED', period=10.0, dur=3.0, **kw):
    return {'kepid': 1, 'kepoi_name': name, 'koi_disposition': disp, 'koi_period': period,
            'koi_time0bk': 130.0, 'koi_duration': dur, 'ra': 290.0, 'dec': 44.0, 'koi_prad': 2.0,
            'koi_steff': 5700.0, 'koi_srad': 1.0, **kw}


def test_catalog_report_flags_the_known_problems(scripts):
    check = scripts('check_catalog')
    cat = pd.DataFrame([
        koi('K00001.01'),
        koi('K06549.01', 'FALSE POSITIVE', period=0.54, dur=13.93),   # transit longer than orbit
        koi('K00002.01', period=None),                                # can't be folded
        koi('K00003.01', 'CANDIDATE', koi_prad=40.0),
        koi('K00004.01', 'NOT DISPOSITIONED', period=None),           # ignored: not used
    ])
    rep = check.report(cat)
    c = rep['checks']
    assert c['transit longer than the orbit']['examples'] == ['K06549.01']
    assert c['missing period, epoch or duration']['count'] == 1 and rep['blocking']
    assert c['radius > 30 Earths (usually an eclipsing binary)']['count'] == 1
    assert rep['n_kois'] == 4
    assert check.report(cat.drop(columns=['koi_period']))['error'].startswith('catalog is missing')


def test_scoreboard_counts_hits(scripts):
    board = scripts('scoreboard')
    snapshot = pd.DataFrame({'kepoi_name': ['A', 'B', 'C', 'D'], 'star_gazer_prob': [0.9, 0.2, 0.8, 0.6],
                             'above_threshold': [True, False, True, True]})
    now = pd.DataFrame({'kepoi_name': ['A', 'B', 'C', 'D'],
                        'koi_disposition': ['CONFIRMED', 'CONFIRMED', 'FALSE POSITIVE', 'CANDIDATE']})
    res = board.evaluate(snapshot, now)
    assert res['confirmed'] == {'n': 2, 'star_gazer_right': 1, 'examples': ['A', 'B']}
    assert res['false_positive']['n'] == 1 and res['false_positive']['star_gazer_right'] == 0
    assert res['still_candidate'] == 1


def test_pipeline_runner_steps_and_stop_on_failure(scripts, tmp_path, monkeypatch):
    run = scripts('run_pipeline')
    assert list(run.STEPS)[:4] == ['check', 'views', 'candidates', 'train']
    for cmd in run.STEPS.values():
        assert (SCRIPTS.parent / cmd[0]).exists(), cmd
    monkeypatch.setattr(run, 'LOGS', tmp_path)
    monkeypatch.setattr(run, 'STEPS', {'ok': ['-c', 'print("fine")'], 'bad': ['-c', 'raise SystemExit(3)'],
                                       'never': ['-c', 'print("not reached")']})
    monkeypatch.setattr('sys.argv', ['run_pipeline.py'])
    with pytest.raises(SystemExit, match='--from bad'):
        run.main()
    assert (tmp_path / 'ok.log').read_text().strip() == 'fine'
    assert not (tmp_path / 'never.log').exists()
