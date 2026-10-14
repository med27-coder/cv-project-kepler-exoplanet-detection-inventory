"""Checks on the committed star map (web/): the data file the live page loads, and its assets.

A bad export would otherwise only show up as a broken page after deployment.
"""

import json
import re
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parents[1] / 'web'
MAX_BYTES = 400_000   # same budget as scripts/starmap/export_starmap.py (the index loaded up front)
COLUMNS = ['name', 'kepid', 'koi', 'ra', 'dec', 'kepmag', 'spot', 'drawn', 'kois', 'sg',
           'np', 'nconf', 'tags', 'chunk', 'dist']
CHUNK_MAX_BYTES = 150_000
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
        assert 0 <= s[col['chunk']] < data['chunks'] and s[col['np']] >= 1, s[col['name']]


@pytest.fixture(scope='module')
def details(data):
    out = {}
    for f in sorted((WEB / 'data' / 'details').glob('*.js')):
        assert f.stat().st_size < CHUNK_MAX_BYTES, f.name
        text = f.read_text(encoding='utf-8')
        out.update(json.loads(text[text.index('{'):text.rindex('}') + 1]))
    return out


def test_every_star_has_details(data, details):
    col = {c: i for i, c in enumerate(COLUMNS)}
    assert len(list((WEB / 'data' / 'details').glob('*.js'))) == data['chunks']
    for s in data['stars']:
        d = details[s[col['name']]]
        assert len(d['planets']) == s[col['np']], s[col['name']]


def test_systems(details):
    for name, system in details.items():
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
    # clickjacking guard (Pages can't send frame-ancestors): framed pages show only a link out
    assert 'window.top !== window.self' in js and "target = '_top'" in js
    # every script and stylesheet is local
    assert not re.search(r'<script[^>]+src="https?:', html)
    assert not re.search(r'<link[^>]+rel="stylesheet"[^>]+href="https?:', html)


def test_page_assets_exist():
    html = (WEB / 'index.html').read_text(encoding='utf-8')
    for ref in re.findall(r'(?:src|href)="([^":#]+)"', html):   # relative links only
        assert (WEB / ref).exists(), ref
    assert (WEB / 'og.png').exists()


def test_sky_backdrop():
    """web/sky.png (scripts/starmap/make_sky_backdrop.py) covers the 192-px map, one pixel per map pixel
    and stays small; starmap.js loads it from the site itself (no third-party request)."""
    png = (WEB / 'sky.png').read_bytes()
    assert png[:8] == bytes.fromhex('89504e470d0a1a0a') and len(png) < 100_000
    width, height = int.from_bytes(png[16:20], 'big'), int.from_bytes(png[20:24], 'big')
    assert (width, height) == (192, 192)
    assert "sky.src = 'sky.png'" in (WEB / 'starmap.js').read_text(encoding='utf-8')


def test_starmap_js_is_built_from_src():
    """web/starmap.js is generated from web/src/*.js by scripts/starmap/build_web.py; they must agree."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('build_web', WEB.parent / 'scripts' / 'starmap' / 'build_web.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert (WEB / 'starmap.js').read_text(encoding='utf-8') == mod.build(), 'run scripts/starmap/build_web.py'


def test_spacecraft_snapshot():
    """data/spacecraft.js (scripts/starmap/fetch_spacecraft.py): spacecraft beyond Earth orbit only."""
    text = (WEB / 'data' / 'spacecraft.js').read_text(encoding='utf-8')
    data = json.loads(text[text.index('{'):text.rindex('}') + 1])
    assert set(data['planets']) == {'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'}
    assert 0.98 < data['planets']['Earth']['r_au'] < 1.02
    for c in data['spacecraft']:
        assert c['earth_au'] > 0.005, c['name']               # nothing in Earth orbit (L1/L2 are ~0.01 AU)
        assert c['url'].startswith('https://') and 1950 < c['launched'] <= 2030
    assert {r['name'] for r in data['rovers']} >= {'Curiosity', 'Perseverance'}


def test_ccd_footprint():
    text = (WEB / 'data' / 'ccd.js').read_text(encoding='utf-8')
    modules = json.loads(text[text.index('['):text.rindex(']') + 1])
    assert len(modules) == 21                                   # Kepler's science CCD modules
    for poly in modules:
        assert len(poly) >= 4 and all(279 < ra < 303 and 35 < dec < 54 for ra, dec in poly)


def sprites(js, table):
    """{name: rows} for a JS object of pixel-art string arrays (e.g. CRAFT_ART in 46-craft-art.js)."""
    body = js[js.index(f'const {table} = {{'):]
    body = body[:body.index('\n};')]
    return {m.group(1): re.findall(r"'([^']*)'", m.group(2))
            for m in re.finditer(r"^  (\w+): \[[^\n]*\n(.*?)^  \],", body, re.DOTALL | re.MULTILINE)}


def test_pixel_art_sprites():
    """Every spacecraft has a sprite; sprites are rectangles drawn only in palette colours."""
    js = (WEB / 'src' / '46-craft-art.js').read_text(encoding='utf-8')
    ink = set(re.findall(r"(\w): '#[0-9a-f]{6}'", js[js.index('const CRAFT_INK'):js.index('const CRAFT_ART')]))
    art = sprites(js, 'CRAFT_ART')
    assert len(art) >= 20
    for name, rows in art.items():
        assert rows and len({len(r) for r in rows}) == 1, f'{name}: rows of different lengths'
        assert set(''.join(rows)) <= ink | {'.'}, f'{name}: colour not in CRAFT_INK'
    mapped = dict(re.findall(r"'?([A-Za-z][\w -]*?)'?: '(\w+)'", js[js.index('const CRAFT_SPRITE'):js.index('const spriteSize')]))
    assert set(mapped.values()) <= set(art)
    text = (WEB / 'data' / 'spacecraft.js').read_text(encoding='utf-8')
    data = json.loads(text[text.index('{'):text.rindex('}') + 1])
    for c in data['spacecraft'] + data['rovers']:
        assert c['name'] in mapped, f"{c['name']} has no sprite"
    kepler = (WEB / 'src' / '47-kepler.js').read_text(encoding='utf-8')
    rows = re.findall(r"'([^']*)'", kepler[kepler.index('const KEPLER_ART'):kepler.index('];')])
    assert len({len(r) for r in rows}) == 1


def test_earth_map():
    """data/earth.js (scripts/starmap/make_earth_map.py): NASA Blue Marble as a 128 x 64 surface map."""
    text = (WEB / 'data' / 'earth.js').read_text(encoding='utf-8')
    earth = json.loads(text[text.index('{'):text.rindex('}') + 1])
    rows = earth['rows']
    assert len(rows) == earth['height'] == 64 and {len(r) for r in rows} == {128}
    assert set(''.join(rows)) <= set(earth['colors'])
    assert set(rows[-1]) == {'i'}                                   # Antarctica
    water = sum(r.count('o') + r.count('s') for r in rows) / (128 * 64)
    assert 0.55 < water < 0.8                                       # ~70% of Earth is ocean
    assert len(text) < 15_000


def test_gallery_photos():
    """web/gallery/ + data/gallery.js (fetch_references.py): every listed photo exists, has a credit,
    and nothing credited to ESA is copied (ESA's own licence: linked only)."""
    text = (WEB / 'data' / 'gallery.js').read_text(encoding='utf-8')
    gallery = json.loads(text[text.index('{'):text.rindex('}') + 1])
    for name, g in gallery.items():
        assert g['credit'] and g['link'].startswith('https://images.nasa.gov/details/'), name
        if 'ESA' in g['credit']:
            assert g['img'] is None and not (WEB / 'gallery' / f'{name}.jpg').exists(), name
        else:
            assert (WEB / g['img']).is_file(), name
    egg_refs = re.findall(r"ref: '([\w-]+)'", (WEB / 'src' / '48-gallery.js').read_text(encoding='utf-8'))
    assert set(egg_refs) <= set(gallery), set(egg_refs) - set(gallery)
    assert sum(f.stat().st_size for f in (WEB / 'gallery').iterdir()) < 600_000


# Every achievement and easter-egg id ever published. Visitors' saved progress refers to these, so they must
# never be renamed or removed (add new ones here when they ship).
SHIPPED_IDS = {
    'eggs': {'sun', 'pluto', 'kepler', 'iss', 'voyager', 'newHorizons', 'jwst', 'euclid', 'soho', 'parker',
             'solarOrbiter', 'bepi', 'juno', 'clipper', 'juice', 'lucy', 'psyche', 'apex', 'mro', 'odyssey', 'mex',
             'tgo', 'curiosity', 'perseverance'},
    'ach': {'first-light', 'star-hopper', 'census', 'dice', 'ghost', 'oracle', 'link', 'first-rock', 'eight-worlds',
            'cousin', 'eden', 'puff', 'tiny', 'goldilocks', 'double', 'lava', 'ancient', 'flare', 'transit', 'scale',
            'believer', 'skeptic', 'coin', 'depth', 'chips', 'eagle', 'cartographer', 'highlighter', 'sky', 'eco',
            'curious', 'mission-control', 'red-fleet', 'jupiter-crew', 'sun-chasers', 'l2', 'interstellar',
            'photo-finish', 'curator', 'grand-tour', 'patient', 'night', 'hollow', 'speedrun', 'goodnight',
            'launch-day', 'star-gazer'},
}


def test_progress_ids_are_stable():
    """A site update must not orphan anyone's saved progress: the storage key and every shipped id stay."""
    js = (WEB / 'src' / '48-gallery.js').read_text(encoding='utf-8')
    assert "const PROGRESS_KEY = 'starmap.progress.v1';" in js
    eggs = js[js.index('const EGGS = ['):js.index('const EGG = new Map')]
    ach = js[js.index('const ACHIEVEMENTS = ['):js.index('const ACH = new Map')]
    assert SHIPPED_IDS['eggs'] <= set(re.findall(r"\bid: '([\w-]+)'", eggs))
    assert SHIPPED_IDS['ach'] <= set(re.findall(r"\bid: '([\w-]+)'", ach))
