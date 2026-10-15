"""The star map in a real browser (headless Chromium via Playwright).

Serves web/ on a local port and drives the actual page, with its Content Security Policy in force.
Skipped when Playwright or its Chromium isn't installed:

    pip install playwright && python -m playwright install chromium
"""

import functools
import http.server
import json
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
    # A fixed afternoon, so time-of-day achievements (NIGHT SHIFT after midnight, anniversaries) don't depend on
    # when the tests run (a CI run crossing midnight UTC once earned an extra one).
    page.clock.set_system_time('2026-10-14T15:00:00')
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
    names = page.locator('#info tbody tr td:nth-child(2)').all_inner_texts()
    assert 'Voyager 1' in names and 'James Webb Space Telescope' in names
    assert page.locator('#sys-title').inner_text() == 'SPACECRAFT'
    assert not page.locator('#sys-tools').is_hidden()        # zoom / FIT work on the frozen Solar System
    page.click('#sys-fit')
    assert page.locator('canvas.craft-icon').count() >= 19         # pixel art for every spacecraft
    page.goto(site + '#jwst')                                      # one spacecraft: highlighted
    page.wait_for_function("document.getElementById('sys-title').textContent === 'JAMES WEBB SPACE TELESCOPE'")
    page.wait_for_selector('#info tr.focus')
    assert 'James Webb' in page.locator('#info tr.focus').inner_text()
    page.goto(site + '#ISS')
    page.wait_for_timeout(200)
    page.evaluate("document.getElementById('query').value = 'space station';"
                  "document.getElementById('search').requestSubmit()")
    assert page.locator('#sys-title').inner_text() == 'INTERNATIONAL SPACE STATION'
    assert page.locator('#sys-tools').is_hidden()             # nothing to zoom on the ISS card
    page.wait_for_timeout(300)                                 # a few animation frames: no errors
    assert not errors, errors


def test_kepler_telescope_and_pluto(browser, site):
    """The Kepler easter egg opens from search and from its sprite on the map; Pluto joins the Sun's table."""
    errors = []
    page = open_page(browser, site + '#Kepler', errors)
    page.wait_for_function("document.getElementById('sys-title').textContent === 'THE KEPLER SPACE TELESCOPE'")
    assert 'Goodnight Kepler' in page.locator('#info').inner_text()
    assert page.locator('#sys-tools').is_hidden()
    page.goto(site + '#Kepler-90')
    page.wait_for_function("document.getElementById('sys-title').textContent === 'KEPLER-90'")
    box = page.locator('#map').bounding_box()
    scale = box['width'] / 192                                  # the sprite sits at map pixel (5, 7), 22 x 10
    page.mouse.click(box['x'] + 15 * scale, box['y'] + 11 * scale)
    page.wait_for_function("location.hash === '#Kepler'")
    page.goto(site + '#Sun')
    page.wait_for_selector('#info table')
    assert 'Pluto' in page.locator('#info tbody').inner_text()
    assert 'dwarf planet' in page.locator('#info tbody').inner_text()
    page.wait_for_timeout(300)
    assert not errors, errors


def test_galleria_game(browser, site):
    """The Galleria: silhouettes until found; a search unlocks one (pop-up, saved in this browser);
    achievements; reset."""
    errors = []
    page = open_page(browser, site, errors)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.click('#open-gallery')
    assert page.locator('.egg-card').count() == 24
    assert page.locator('.egg-card.found').count() == 0
    page.click('#gallery-close')
    page.fill('#query', 'lucy')
    page.press('#query', 'Enter')
    page.wait_for_selector('.toast.egg')
    assert 'TROJAN TOUR' in page.locator('.toast.egg').inner_text()
    assert 'lucy' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    page.click('#open-gallery')
    assert page.locator('.egg-card.found').count() == 1
    page.click('.egg-card[data-egg="lucy"]')
    page.wait_for_selector('.morph canvas')                        # the real photo, with the pixelation slider
    assert 'Lucy' in page.locator('#pane-eggs').inner_text()
    page.click('#gallery-close')
    page.fill('#query', 'Kepler-90')                                # a famous world
    page.press('#query', 'Enter')
    page.wait_for_function("(localStorage.getItem('starmap.progress.v1') || '').includes('eight-worlds')")
    page.click('#open-gallery')
    page.click('#tab-ach')
    earned = page.locator('.ach-list li.on').all_inner_texts()
    assert any('CURIOUS MIND' in a for a in earned) and any('EIGHT WORLDS' in a for a in earned)
    page.reload()                                                   # survives a reload (and so a site update)
    page.click('#open-gallery')
    assert page.locator('.egg-card.found').count() == 1
    page.click('#tab-set')
    assert 'Saved in this browser' in page.locator('#set-storage').inner_text()
    with page.expect_download() as dl:                              # backup file
        page.click('#set-export')
    backup = Path(dl.value.path()).read_text(encoding='utf-8')
    assert '"lucy"' in backup and '"eight-worlds"' in backup
    page.click('#set-reset')
    page.click('#set-reset')                                        # asks twice
    page.click('#tab-eggs')
    assert page.locator('.egg-card.found').count() == 0
    page.click('#tab-set')
    page.set_input_files('#set-import-file', files=[{'name': 'p.json', 'mimeType': 'application/json',
                                                     'buffer': backup.encode()}])
    page.wait_for_function("(document.getElementById('set-reset-note').textContent || '').includes('loaded')")
    page.click('#tab-eggs')
    assert page.locator('.egg-card.found').count() == 1               # restored from the file
    assert not errors, errors


def test_rank_header_badges_and_podium(browser, site):
    """The rank (a star's life) and earned badges show in the page header; next planets draws a podium."""
    errors = []
    page = open_page(browser, site, errors)
    ids = ['first-light', 'star-hopper', 'dice', 'ghost', 'oracle', 'link', 'first-rock', 'eight-worlds', 'cousin',
           'eden', 'puff', 'tiny']
    page.evaluate("ids => localStorage.setItem('starmap.progress.v1', JSON.stringify({eggs: {}, systems: [],"
                  " ach: Object.fromEntries(ids.map(i => [i, '2026-10-14']))}))", ids)
    page.reload()
    page.wait_for_function("document.getElementById('rank-name').textContent === 'RED GIANT'")   # 12 achievements
    assert page.locator('#rank-badges canvas').count() == 1                                     # famous worlds done
    assert page.locator('#rank-count').inner_text() == '12/55'
    page.click('#rank')                                                                           # opens the tab
    assert page.locator('#pane-ach .rank-panel').is_visible()
    assert page.locator('.badge-shelf li.on').count() == 1
    assert page.locator('.ach-list canvas[data-trophy="lock"]').count() > 0                      # space locks
    page.click('#gallery-close')
    page.click('button.chip:has-text("next planets")')
    page.wait_for_timeout(300)
    lit = page.evaluate("""() => { const c = document.getElementById('system'), d = c.getContext('2d')
        .getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 300) n++; return n; }""")
    assert lit > 500                                                                              # the podium, not a blank
    assert page.locator('#sys-hint').inner_text() == ''                                          # no stale hint
    assert not errors, errors


def test_final_mission(browser, site):
    """TRUE STAR GAZER: open the last unseen system -> achievement, black hole; a reset afterwards -> white hole."""
    text = (Path(__file__).resolve().parents[1] / 'web' / 'data' / 'systems.js').read_text(encoding='utf-8')
    data = json.loads(text[text.index('{'):text.rindex('}') + 1])
    col = {c: i for i, c in enumerate(data['columns'])}
    seen = ','.join(_base36(s[col['kepid']]) for s in data['stars'] if s[col['name']] != 'Kepler-90')
    errors = []
    page = open_page(browser, site, errors)
    page.evaluate("seen => localStorage.setItem('starmap.progress.v1', JSON.stringify({eggs: {}, ach: {}, systems: [], seen}))", seen)
    page.clock.set_system_time('2026-10-15T00:30:00')   # after midnight: NIGHT SHIFT is earned at the same moment,
    page.reload()                                        # and the TRUE STAR GAZER pop-up must still show
    page.wait_for_selector('#highlights .chip.unseen')                                            # revealed: UNSEEN chip
    page.fill('#query', 'Kepler-90')
    page.press('#query', 'Enter')
    page.wait_for_selector('.toast.legend')
    assert 'true Star Gazers' in page.locator('.toast.legend').inner_text()
    page.wait_for_function("document.getElementById('rank-name').textContent.startsWith('BLACK HOLE')")
    page.click('#open-gallery')
    page.click('#tab-set')
    assert page.locator('#set-final').is_visible()                                                # white dwarf option
    page.click('#set-reset')
    page.click('#set-reset')
    page.wait_for_function("document.getElementById('rank-name').textContent === 'WHITE HOLE'")   # new game +
    assert not errors, errors


def _base36(n):
    digits, n, out = '0123456789abcdefghijklmnopqrstuvwxyz', int(n), ''
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out or '0'


def test_tatooine(browser, site):
    """Searching "tatooine" opens Kepler-16: two stars drawn, the two-suns note, the TATOOINE achievement."""
    errors = []
    page = open_page(browser, site, errors)
    page.fill('#query', 'tatooine')
    page.press('#query', 'Enter')
    page.wait_for_function("document.getElementById('sys-title').textContent === 'KEPLER-16'")
    page.wait_for_selector('.toast.badge')
    assert 'Two suns' in page.locator('#info').inner_text()
    page.wait_for_function("(localStorage.getItem('starmap.progress.v1') || '').includes('tatooine')")
    assert page.locator('#highlights .chip:has-text("two suns")').count() == 1
    page.wait_for_timeout(300)
    assert not errors, errors


def test_predictions(browser, site):
    """Call a candidate; when NASA rules after the call, it is scored (PROPHET) and shown in the tab."""
    errors = []
    page = open_page(browser, site, errors)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.fill('#query', 'KOI-3444')
    page.press('#query', 'Enter')
    page.wait_for_selector('.call[data-koi="K03444.01"]')
    page.click('.call[data-koi="K03444.01"] button[data-call="planet"]')
    page.wait_for_function("(localStorage.getItem('starmap.progress.v1') || '').includes('K03444.01')")
    assert 'first-call' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    ruling = ('window.STARMAP_RESOLUTIONS = {"since": "2026-10-14", '
              '"resolved": {"K03444.01": ["confirmed", "2099-01-01"]}};')   # NASA confirms it, after the call
    page.route('**/data/resolutions.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=ruling))
    page.reload()
    page.wait_for_selector('.toast:has-text("NASA RULED")')
    assert 'you called it' in page.locator('.toast:has-text("NASA RULED")').inner_text()
    page.wait_for_function("(localStorage.getItem('starmap.progress.v1') || '').includes('prophet')")
    page.click('#open-gallery')
    page.click('#tab-pred')
    assert '1RIGHT' in ''.join(page.locator('#pane-pred .gallery-progress').inner_text().split())
    assert not errors, errors


def test_view_links_kepler_view_and_pinch(browser, site):
    """A shared link restores zoom, true scale and Kepler's view; pinching zooms; the URL follows."""
    errors = []
    page = open_page(browser, site + '#Kepler-90?view=true&zoom=4&edge=1', errors)
    page.wait_for_selector('#info table')
    assert page.get_attribute('#sys-scale', 'aria-pressed') == 'true'
    assert page.get_attribute('#sys-edge', 'aria-pressed') == 'true'
    assert page.locator('#sys-level').inner_text() == '4×'
    page.click('#sys-in')
    page.wait_for_timeout(600)                                  # the URL update is debounced
    assert 'zoom=6' in page.evaluate('location.hash') and 'edge=1' in page.evaluate('location.hash')
    page.evaluate("""() => {
      const c = document.getElementById('system'), r = c.getBoundingClientRect();
      const ev = (type, id, x) => c.dispatchEvent(new PointerEvent(type, {pointerId: id, bubbles: true,
        clientX: r.left + x, clientY: r.top + r.height / 3}));
      ev('pointerdown', 11, 200); ev('pointerdown', 12, 300);      // two fingers...
      ev('pointermove', 12, 400);                                   // ...spread apart: zoom in
      ev('pointerup', 11, 200); ev('pointerup', 12, 400);
    }""")
    assert float(page.locator('#sys-level').inner_text().rstrip('×')) > 6
    page.select_option('#fps', '0')                             # animation off: still draws, no errors
    page.wait_for_timeout(200)
    assert not errors, errors


def test_depth_view_and_ccd_toggle(browser, site):
    errors = []
    page = open_page(browser, site, errors)
    page.click('#depth')
    assert page.locator('#map').locator('xpath=ancestor::section').locator('h2').inner_text() == 'SIDE VIEW FROM EARTH'
    assert page.locator('#zoom-in').is_disabled()
    box = page.locator('#map').bounding_box()
    page.mouse.click(box['x'] + box['width'] * 0.4, box['y'] + box['height'] / 2)   # stars are clickable in depth too
    page.click('#depth')
    page.click('#ccd')
    assert page.get_attribute('#ccd', 'aria-pressed') == 'false'
    assert not page.locator('#zoom-in').is_disabled()
    assert not errors, errors


def test_spotlight_sky_photos_are_local(browser, site):
    """Featured systems use the photos stored with the site: no request to CDS."""
    errors, outside = [], []
    page = open_page(browser, site, errors)
    page.on('request', lambda r: outside.append(r.url) if 'alasky' in r.url else None)
    page.evaluate("document.getElementById('query').value = 'Kepler-90';"
                  "document.getElementById('search').requestSubmit()")
    page.wait_for_selector('#info .sky img')
    page.wait_for_timeout(300)
    assert page.get_attribute('#info .sky img', 'src') == 'sky/kepler-90_dss2.jpg'
    page.click('#info .surveys button[data-k="2"]')
    assert page.get_attribute('#info .sky img', 'src') == 'sky/kepler-90_2mass.jpg'
    assert not outside, outside
    assert not errors, errors
