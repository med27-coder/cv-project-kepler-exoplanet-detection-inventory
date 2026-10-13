"""Tests for scripts/export_starmap.py (the data behind the web/ pixel star map)."""

import importlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'


@pytest.fixture
def export(monkeypatch):
    monkeypatch.syspath_prepend(str(SCRIPTS))
    return importlib.import_module('export_starmap')


def koi(kepid, name, disposition, kepler_name=None, period=10.0, sma=0.1):
    return {'kepid': kepid, 'kepoi_name': name, 'kepler_name': kepler_name,
            'koi_disposition': disposition, 'ra': 290.0, 'dec': 44.0, 'koi_kepmag': 14.0,
            'koi_period': period, 'koi_sma': sma, 'koi_smass': 1.0, 'koi_prad': 2.0,
            'koi_teq': 500.0, 'koi_steff': 5700.0, 'koi_srad': 1.0}


@pytest.fixture
def catalog():
    return pd.DataFrame([
        koi(1, 'K00351.01', 'CONFIRMED', 'Kepler-90 h', period=331.6),
        koi(1, 'K00351.06', 'CONFIRMED', 'Kepler-90 b', period=7.0, sma=np.nan),
        koi(1, 'K00351.09', 'FALSE POSITIVE'),
        koi(2, 'K07621.01', 'CANDIDATE'),
        koi(3, 'K09999.01', 'FALSE POSITIVE'),
    ])


@pytest.fixture
def planets():
    """A pscomppars-style table. NASA calls the host "KOI-351" (not Kepler-90), so planets are
    matched by host position and orbital period, as for the real Kepler-90."""
    row = {'hostname': 'KOI-351', 'ra': 290.0002, 'dec': 44.0002, 'disc_year': 2013, 'sy_dist': 840.0,
           'pl_orbsmax': np.nan, 'pl_rade': np.nan, 'pl_eqt': np.nan}
    return pd.DataFrame([
        {**row, 'pl_name': 'KOI-351 h', 'discoverymethod': 'Transit', 'pl_bmasse': 200.0,
         'pl_bmassprov': 'M-R relationship', 'pl_orbper': 331.62},
        {**row, 'pl_name': 'Kepler-90 z', 'discoverymethod': 'Radial Velocity', 'pl_bmasse': 30.0,
         'pl_bmassprov': 'Msini', 'pl_orbper': 50.0, 'disc_year': 2024},
        {**row, 'hostname': 'Far away', 'ra': 295.0, 'dec': 40.0, 'pl_name': 'Far away b',
         'discoverymethod': 'Transit', 'pl_bmasse': 1.0, 'pl_bmassprov': 'Mass', 'pl_orbper': 3.0},
    ])


def column(data, name):
    i = data['columns'].index(name)
    return [s[i] for s in data['stars']]


def test_names(export, catalog):
    assert export.koi_host('K00351.06') == 351
    assert export.koi_host('not a koi') is None
    assert export.system_name(catalog[catalog.kepid == 1]) == 'Kepler-90'
    assert export.system_name(catalog[catalog.kepid == 2]) == 'KOI-7621'


def test_build_skips_false_positive_only_stars(export, catalog):
    data, missing = export.build(catalog, spotlight=['Kepler-90', 'Kepler-16'])
    assert column(data, 'name') == ['Kepler-90', 'KOI-7621']   # star 3 has only a false positive
    assert missing == ['Kepler-16']
    assert data['spotlight'] == ['Kepler-90']
    assert column(data, 'kois') == [2, 1]                       # the false positive is not counted


def test_confirmed_systems_are_drawn_candidates_wait_for_scores(export, catalog):
    data, _ = export.build(catalog, spotlight=[])
    assert column(data, 'drawn') == [1, 0]
    assert list(data['systems']) == ['Kepler-90']
    assert column(data, 'sg') == [None, None]

    data, _ = export.build(catalog, spotlight=[], scores={'K07621.01': (0.87, True)})
    assert column(data, 'drawn') == [1, 1]
    assert column(data, 'sg') == [None, 0.87]
    cand = data['systems']['KOI-7621']['planets'][0]
    assert (cand['status'], cand['sg'], cand['sg_planet']) == ('candidate', 0.87, True)


def test_system_detail(export, catalog):
    data, _ = export.build(catalog, spotlight=[])
    planets = data['systems']['Kepler-90']['planets']
    assert [p['name'] for p in planets] == ['Kepler-90 b', 'Kepler-90 h']   # sorted by period
    # Missing semi-major axis -> Kepler's third law: 7 days around 1 Msun is (7/365.25)^(2/3) AU.
    assert planets[0]['sma'] == pytest.approx((7 / 365.25) ** (2 / 3), abs=1e-4)
    assert {p['status'] for p in planets} == {'confirmed'}


def test_planet_table_adds_mass_distance_and_other_methods(export, catalog, planets):
    data, _ = export.build(catalog, spotlight=[], planets=planets)
    system = data['systems']['Kepler-90']
    assert system['dist_pc'] == 840.0
    by_name = {p['name']: p for p in system['planets']}
    assert (by_name['Kepler-90 h']['mass'], by_name['Kepler-90 h']['mass_kind']) == (200.0, 'estimated')
    other = by_name['Kepler-90 z']
    assert (other['status'], other['method'], other['mass_kind'], other['year']) == \
        ('other', 'radial velocity', 'measured', 2024)
    assert [p['name'] for p in system['planets']] == ['Kepler-90 b', 'Kepler-90 z', 'Kepler-90 h']
    assert 'mass' not in by_name['Kepler-90 b']           # no NASA row with that period
    assert 'dist_pc' not in data['systems'].get('KOI-7621', {})   # the far-away host matched nothing


def test_tess_and_gaia_extras(export, catalog, planets):
    planets['pl_orbeccen'] = [0.3, 0.0, np.nan]
    planets['sy_snum'] = [2, 2, 1]
    planets['st_spectype'] = ['G0 V', 'G0 V', np.nan]
    tois = pd.DataFrame([   # TESS saw Kepler-90 h again, and a false alarm on the same star
        {'toi': 1234.01, 'tid': 99, 'ra': 290.0001, 'dec': 44.0001, 'pl_orbper': 331.5, 'tfopwg_disp': 'KP'},
        {'toi': 1234.02, 'tid': 99, 'ra': 290.0001, 'dec': 44.0001, 'pl_orbper': 7.0, 'tfopwg_disp': 'FA'},
    ])
    gaia = {1: pd.Series({'gaia_smass': 1.2, 'gaia_age': 3.14, 'gaia_smet': -0.2, 'gaia_slogg': 4.4,
                          'gaia_dist_pc': 900.0})}
    data, _ = export.build(catalog, spotlight=[], planets=planets, tois=tois, gaia=gaia)
    system = data['systems']['Kepler-90']
    by_name = {p['name']: p for p in system['planets']}
    assert by_name['Kepler-90 h']['toi'] == 'TOI-1234.01' and by_name['Kepler-90 h']['ecc'] == 0.3
    assert 'toi' not in by_name['Kepler-90 b']             # only TESS false alarm at that period
    assert 'ecc' not in by_name['Kepler-90 z']             # circular orbits aren't exported
    assert (system['nstars'], system['spectype'], system['host']) == (2, 'G0 V', 'KOI-351')
    # KOI table first (smass 1.0), Gaia fills gaps; NASA's distance beats Gaia's
    assert (system['smass'], system['age'], system['met'], system['dist_pc']) == (1.0, 3.1, -0.2, 840.0)


def test_cached_table_redownloads_when_columns_are_missing(export, tmp_path, monkeypatch):
    path = tmp_path / 'table.csv'
    pd.DataFrame({'a': [1]}).to_csv(path, index=False)
    monkeypatch.setattr(export.pd, 'read_csv',
                        lambda src, **kw: pd.DataFrame({'a': [1], 'b': [2]}) if src == 'URL' else
                        pd.io.parsers.readers.read_csv(src, **kw))
    assert list(export._cached_table(path, 'URL', 'test', download=False, columns={'b'}).columns) == ['a']
    assert list(export._cached_table(path, 'URL', 'test', columns={'b'}).columns) == ['a', 'b']


def test_load_scores(export, tmp_path):
    assert export.load_scores(tmp_path / 'missing.csv') == {}
    path = tmp_path / 'candidates.csv'
    pd.DataFrame({'kepoi_name': ['K07621.01'], 'star_gazer_prob': [0.2],
                  'above_threshold': [False]}).to_csv(path, index=False)
    assert export.load_scores(path) == {'K07621.01': (0.2, False)}


def test_to_js_is_loadable_json(export, catalog):
    data, _ = export.build(catalog, spotlight=['Kepler-90'])
    js = export.to_js(data)
    assert js.startswith('//') and 'window.STARMAP = ' in js
    assert json.loads(js[js.index('{'):js.rindex('}') + 1]) == json.loads(json.dumps(data))
