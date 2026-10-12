"""Checks on the committed star map (web/): the data file the live page loads, and its assets.

A bad export would otherwise only show up as a broken page after deployment.
"""

import json
import re
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parents[1] / 'web'
MAX_BYTES = 1_500_000   # same budget as scripts/export_starmap.py
COLUMNS = ['name', 'kepid', 'koi', 'ra', 'dec', 'kepmag', 'spot', 'drawn', 'kois', 'sg']
STATUSES = {'confirmed', 'candidate', 'other'}


@pytest.fixture(scope='module')
def data():
    text = (WEB / 'data' / 'systems.js').read_text(encoding='utf-8')
    assert text.startswith('//') and 'window.STARMAP = ' in text
    return json.loads(text[text.index('{'):text.rindex('}') + 1])


def test_size_budget():
    assert (WEB / 'data' / 'systems.js').stat().st_size < MAX_BYTES


def test_structure(data):
    assert data['columns'] == COLUMNS
    assert len(data['stars']) > 1000
    assert all(len(s) == len(COLUMNS) for s in data['stars'])
    col = {c: i for i, c in enumerate(COLUMNS)}
    names = [s[col['name']] for s in data['stars']]
    assert len(names) == len(set(names)), 'duplicate system names'
    assert set(data['spotlight']) <= set(names)
    for s in data['stars']:
        assert 279 < s[col['ra']] < 303 and 35 < s[col['dec']] < 54, s[col['name']]   # Kepler field
        assert (s[col['name']] in data['systems']) == bool(s[col['drawn']]), s[col['name']]


def test_systems(data):
    for name, system in data['systems'].items():
        assert system['planets'], name
        for p in system['planets']:
            assert p['status'] in STATUSES, (name, p)
            assert p['sma'] > 0 and (p['period'] is None or p['period'] > 0), (name, p)
            if p['status'] == 'other':
                assert p['method'], (name, p)


def test_page_security_policy():
    """The page keeps a strict Content Security Policy and nothing that would need loosening it."""
    html = (WEB / 'index.html').read_text(encoding='utf-8')
    csp = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    assert csp, 'Content-Security-Policy meta tag missing'
    policy = dict(part.strip().split(' ', 1) for part in csp.group(1).split(';') if part.strip())
    assert policy['default-src'] == "'none'"
    assert policy['script-src'] == "'self'" and policy['style-src'] == "'self'"
    assert "'unsafe-inline'" not in csp.group(1) and "'unsafe-eval'" not in csp.group(1)
    assert policy['object-src'] == "'none'" and policy['base-uri'] == "'none'"
    # nothing inline: no <script> bodies, style attributes or on*= handlers, in the page or the JS templates
    assert not re.search(r'<script(?![^>]*\bsrc=)[^>]*>', html)
    js = (WEB / 'starmap.js').read_text(encoding='utf-8')
    for text in (html, js):
        assert not re.search(r'\sstyle="', text)
        assert not re.search(r'\son[a-z]+="', text)
    # every script and stylesheet is local
    assert not re.search(r'<script[^>]+src="https?:', html)
    assert not re.search(r'<link[^>]+rel="stylesheet"[^>]+href="https?:', html)


def test_page_assets_exist():
    html = (WEB / 'index.html').read_text(encoding='utf-8')
    for ref in re.findall(r'(?:src|href)="([^":#]+)"', html):   # relative links only
        assert (WEB / ref).exists(), ref
    assert (WEB / 'og.png').exists()
