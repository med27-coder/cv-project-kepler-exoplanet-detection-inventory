"""The star map in a real browser (headless Chromium via Playwright).

Serves web/ on a local port and drives the actual page, with its Content Security Policy in force.
Skipped when Playwright or its Chromium isn't installed:

    pip install playwright && python -m playwright install chromium
"""

import functools
import http.server
import threading
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parents[1] / 'web'
HARNESS = Path(__file__).resolve().parent / 'browser' / 'harness.js'
sync_api = pytest.importorskip('playwright.sync_api')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope='module')
def site():
    handler = functools.partial(QuietHandler, directory=str(WEB))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{server.server_address[1]}/index.html'
    server.shutdown()


@pytest.fixture(scope='module')
def browser():
    with sync_api.sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:   # noqa: BLE001 - Chromium not downloaded: skip, don't fail
            pytest.skip(f'Chromium not available: {e}')
        yield b
        b.close()


PIXEL_PNG = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
                          '1f15c4890000000d49444154789c6360000000000500010d0a2db40000000049454e44ae426082')


def blank_image(route):
    route.fulfill(status=200, content_type='image/png', body=PIXEL_PNG)


def open_page(browser, url, errors, init_script=None):
    page = browser.new_page(viewport={'width': 1280, 'height': 1000})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.route('**/alasky.cds.unistra.fr/**', blank_image)   # no third-party calls in tests
    if init_script:
        page.add_init_script(init_script)
    page.goto(url)
    page.wait_for_load_state('load')
    return page


def test_page_checks(browser, site):
    """The full in-page check list (search, zoom, highlights, system view, easter egg, case files...)."""
    errors = []
    page = open_page(browser, site, errors)
    chunks = page.evaluate('window.STARMAP.chunks')
    for k in range(chunks):   # all details loaded up front, so the checks can run step by step
        page.add_script_tag(url=f'data/details/{k:02d}.js')
    # evaluate() runs through the DevTools protocol, so the page's CSP (no inline scripts) stays on
    page.evaluate(HARNESS.read_text(encoding='utf-8'))
    lines = page.locator('#results').inner_text().splitlines()
    failures = [line for line in lines if line.startswith(('FAIL', 'EXCEPTION'))]
    assert not failures, '\n'.join(failures)
    assert sum(line.startswith('PASS') for line in lines) >= 40
    assert not errors, errors


def test_details_load_on_demand(browser, site):
    """Opening a link loads only that system's details chunk, then draws it."""
    errors, requested = [], []
    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requested.append(r.url) if '/data/details/' in r.url else None)
    page.route('**/alasky.cds.unistra.fr/**', blank_image)
    page.goto(site + '#Kepler-90')
    page.wait_for_selector('#info table')
    assert page.locator('#sys-title').inner_text() == 'KEPLER-90'
    assert len(requested) == 1, requested
    assert not errors, errors


def test_no_trails_after_canvas_discard(browser, site):
    """Browsers may wipe off-screen canvases in background tabs; frames must not smear afterwards."""
    errors = []
    capture = """
      window.CANVASES = [];
      const make = document.createElement.bind(document);
      document.createElement = (tag, ...a) => {
        const el = make(tag, ...a);
        if (String(tag).toLowerCase() === 'canvas') window.CANVASES.push(el);
        return el;
      };"""
    page = open_page(browser, site + '#Kepler-90', errors, init_script=capture)
    page.wait_for_selector('#info table')
    page.wait_for_timeout(300)
    corner = page.evaluate("""() => {
      for (const c of window.CANVASES) c.getContext('2d').clearRect(0, 0, c.width, c.height);
      const ctx = document.getElementById('system').getContext('2d');
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 256, 160);   // a stale frame that must not survive
      return new Promise(r => setTimeout(() => r([...ctx.getImageData(2, 2, 1, 1).data]), 300));
    }""")
    assert corner[0] < 40 and corner[2] < 60, corner
    assert not errors, errors


def test_framed_page_shows_only_a_link(browser, site):
    """Clickjacking guard: inside another site's frame the page is replaced by a link out."""
    page = browser.new_page()
    page.set_content(f'<iframe src="{site}" width="800" height="600"></iframe>')
    frame = page.frames[1]
    frame.wait_for_load_state('load')
    assert frame.locator('a[target="_top"]').count() == 1
    assert frame.locator('#map').count() == 0


def test_spacecraft_and_iss_easter_eggs(browser, site):
    errors = []
    page = open_page(browser, site + '#Spacecraft', errors)
    page.wait_for_selector('#info table')
    names = page.locator('#info tbody tr td:first-child').all_inner_texts()
    assert 'Voyager 1' in names and 'James Webb Space Telescope' in names
    assert page.locator('#sys-title').inner_text() == 'SPACECRAFT'
    assert not page.locator('#sys-tools').is_hidden()        # zoom / FIT work on the frozen Solar System
    page.click('#sys-fit')
    page.goto(site + '#ISS')
    page.wait_for_timeout(200)
    page.evaluate("document.getElementById('query').value = 'space station';"
                  "document.getElementById('search').requestSubmit()")
    assert page.locator('#sys-title').inner_text() == 'INTERNATIONAL SPACE STATION'
    assert page.locator('#sys-tools').is_hidden()             # nothing to zoom on the ISS card
    page.wait_for_timeout(300)                                 # a few animation frames: no errors
    assert not errors, errors
