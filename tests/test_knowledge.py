"""The knowledge framework (knowledge/, scripts/knowledge/enrich.py): computed fields only, reviewed text untouched."""

import importlib
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def enrich(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / 'scripts' / 'knowledge'))
    return importlib.import_module('enrich')


def planet(name, radius, insol, period, **kw):
    return {'name': name, 'status': 'confirmed', 'radius': radius, 'insol': insol, 'period': period, **kw}


SUN_LIKE = {'teff': 5772.0, 'srad': 1.0}   # a habitable zone of about 0.95 to 1.67 AU


def test_size_classes_follow_keplers_bins(enrich):
    assert [enrich.size_class(r) for r in (1.0, 1.25, 1.9, 2.0, 5.9, 6.0, 14.9, 15.0, 22)] == [
        'Earth-size', 'super-Earth', 'super-Earth', 'Neptune-size', 'Neptune-size', 'Jupiter-size', 'Jupiter-size',
        'larger than Jupiter', 'larger than Jupiter']


def test_similar_worlds_are_the_nearest_and_never_itself(enrich):
    me = planet('A b', 1.0, 1.0, 365)
    others = [me, planet('Near b', 1.1, 0.9, 340), planet('Far b', 11, 400, 3), planet('Mid b', 2, 3, 100),
              {'name': 'No data b', 'status': 'confirmed', 'radius': 1.0}]
    names = [o['name'] for o in enrich.similar(me, others, n=2)]
    assert names == ['Near b', 'Mid b']


def test_the_generated_block(enrich):
    systems = {'Sunny': {**SUN_LIKE, 'planets': [planet('Sunny b', 1.0, 1.0, 365.25, sma=1.0, teq=255.0, year=2015),
                                                 {**planet('Sunny c', 3, 1.5, 200), 'status': 'candidate'}]},
               'Other': {**SUN_LIKE, 'planets': [planet('Other b', 0.5, 1.2, 300), planet('Other c', 4, 0.8, 400)]}}
    every = enrich.worlds(systems)
    assert {w['name'] for w in every} == {'Sunny b', 'Other b', 'Other c'}   # confirmed only
    block = enrich.generated_block(next(w for w in every if w['name'] == 'Sunny b'), every)
    assert block.startswith(enrich.START) and block.endswith(enrich.END)
    assert "1 x Earth's radius: Earth-size" in block and '1.00 Earth years' in block
    assert 'inside the map\'s habitable zone' in block and 'does not make a world habitable' in block
    assert '| Discovered | 2015 |' in block
    assert 'larger than 50% of the 2 confirmed worlds' in block              # Other b smaller, Other c larger
    assert '- Other b' in block and 'Sunny c' not in block


def test_writing_a_world_keeps_the_reviewed_text(enrich, tmp_path):
    every = enrich.worlds({'Sunny': {**SUN_LIKE, 'planets': [planet('Sunny b', 1.0, 1.0, 365.25, sma=1.0)]}})
    path = enrich.write_world(every[0], every, folder=tmp_path, template=enrich.TEMPLATE)
    assert path.name == 'sunny-b.md'
    text = path.read_text(encoding='utf-8')
    assert text.startswith('# Sunny b') and 'Earth-size' in text and '{{' not in text
    path.write_text(text.replace('(One or two sentences', 'A reviewed summary. (One or two sentences'), encoding='utf-8')
    every[0]['radius'] = 1.6                                                 # NASA revises the radius
    text = enrich.write_world(every[0], every, folder=tmp_path, template=enrich.TEMPLATE).read_text(encoding='utf-8')
    assert 'A reviewed summary.' in text and 'super-Earth' in text and 'Earth-size (' not in text
    assert text.count(enrich.START) == 1


def test_it_reads_the_maps_detail_files(enrich, tmp_path):
    chunk = {'Sunny': {**SUN_LIKE, 'planets': [planet('Sunny b', 1.0, 1.0, 365.25)]}}
    (tmp_path / '00.js').write_text('// Generated\nwindow.STARMAP_DETAILS(0,' + json.dumps(chunk) + ');\n',
                                    encoding='utf-8')
    assert enrich.load_systems(tmp_path) == chunk
    assert any(w['name'] == 'Kepler-22 b' for w in enrich.worlds(enrich.load_systems()))   # the real data too


@pytest.fixture
def report(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / 'scripts' / 'knowledge'))
    return importlib.import_module('knowledge_report')


def test_the_knowledge_report_finds_what_changed(report):
    before = ({'Sunny': {'planets': [planet('Sunny b', 1.0, 1.0, 365),
                                     {**planet('KOI-7 c', 2, 3, 30), 'status': 'candidate', 'koi': 'K00007.02',
                                      'sg_planet': True},
                                     {**planet('KOI-7 d', 2, 3, 40), 'status': 'candidate', 'koi': 'K00007.03',
                                      'sg_planet': True}]},
               'Gone': {'planets': [planet('Gone b', 1, 1, 10)]}},
              {})
    after = ({'Sunny': {'planets': [planet('Sunny b', 1.2, 1.0, 365),                  # radius +20%
                                    {**planet('Kepler-99 c', 2, 3, 30), 'koi': 'K00007.02'}]},
              'New': {'planets': [planet('New b', 1, 1, 10)]}},
             {'K00007.02': ['confirmed', '2026-12-03'], 'K00007.03': ['false positive', '2026-12-03']})
    diff = report.compare(before, after)
    assert [r['sg_right'] for r in diff['rulings']] == [True, False]
    assert diff['confirmed'] == ['Kepler-99 c', 'New b']
    assert diff['new_systems'] == ['New'] and diff['gone_systems'] == ['Gone']
    assert diff['gone_planets'] == ['KOI-7 d']     # dropped: flagged for a person (KOI-7 c was renamed, same KOI)
    assert diff['changed'] == [{'planet': 'Sunny b', 'what': "radius (Earth's)", 'before': 1.0, 'after': 1.2}]
    text = report.render(diff)
    assert 'NASA ruled on 2 candidate(s)' in text and 'Star Gazer had called 1 of 2 right' in text
    assert 'Sunny b: radius' in text and 'No longer in the data' in text


def test_the_knowledge_report_reads_the_repository(report):
    same = report.load('HEAD')
    assert same[0] and report.render(report.compare(same, same)).count('No changes') == 1
    text = 'window.STARMAP_RESOLUTIONS = {"since":"2026-10-14","resolved":{"K00001.01":["confirmed","2026-11-03"]}};'
    assert report.parse_js_json(text, 'resolutions')['resolved']['K00001.01'][0] == 'confirmed'
