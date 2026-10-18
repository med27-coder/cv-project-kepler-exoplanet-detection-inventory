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


def test_galleria_photos_fit_and_slider_stays(browser, site):
    """Galleria photos: sharp copies (480 wide), tall ones shrink to fit, the planet strip shows whole planets, and
    earning PHOTO FINISH (which redraws the Galleria) leaves the slider on the pixel art."""
    errors = []
    page = open_page(browser, site, errors)
    page.evaluate("localStorage.setItem('starmap.progress.v1', JSON.stringify({eggs: {kepler: '2026-10-14', sun: '2026-10-14'},"
                  " ach: {}, systems: [], toured: true}))")
    page.reload()
    page.click('#open-gallery')
    page.click('.egg-card[data-egg="kepler"]')
    page.wait_for_function("() => document.querySelector('.morph canvas').width >= 480")
    box = page.locator('.morph canvas').bounding_box()
    assert box['height'] <= 284 and box['width'] <= 244                                       # tall photo shrinks
    page.fill('.morph input', '100')
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('photo-finish')")
    assert page.input_value('.morph input') == '100'
    page.click('#gallery-close')
    page.click('#open-gallery')
    page.click('.egg-card[data-egg="sun"]')
    assert page.eval_on_selector('.planet-strip img', "i => getComputedStyle(i).objectFit") == 'contain'
    assert not errors, errors


def test_universe_sectors_and_lost_astronaut(browser, site):
    """UNIVERSE swaps the map for the zoom-out ladder; ◀ ▶ and the arrow keys step through six sectors (COSMIC
    ZOOM); a flare drifts by (forced with ?astronaut) and catching it is LOST IN ORBIT."""
    errors = []
    page = open_page(browser, site + '?astronaut', errors)
    page.click('#universe')
    assert page.locator('#uni-title').inner_text().startswith('SECTOR 2 / 6')
    assert page.locator('#map').is_hidden() and page.locator('#universe-view').is_visible()
    lit = "() => { const c = document.getElementById('universe-view'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 200) n++; return n; }"
    page.wait_for_function(f"({lit})() > 100")
    for _ in range(4):
        page.keyboard.press('ArrowRight')                             # focus is on the universe view
    assert page.locator('#uni-title').inner_text().endswith('THE OBSERVABLE UNIVERSE')
    assert page.locator('#uni-out').is_disabled()
    page.click('#uni-in'); page.click('#uni-in'); page.click('#uni-in'); page.click('#uni-in'); page.click('#uni-in')
    assert page.locator('#map').is_visible()                            # sector 1 is the map itself
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('cosmic-zoom')")
    page.click('#uni-out')
    page.wait_for_function("() => { const f = document.getElementById('universe-view').dataset.flare;"
                           " return Boolean(f) && +f.split(',')[0] > 12 && +f.split(',')[0] < 180; }")   # drifted onto the canvas
    x, y = map(int, page.get_attribute('#universe-view', 'data-flare').split(','))
    box = page.locator('#universe-view').bounding_box()
    page.mouse.click(box['x'] + x * box['width'] / 192, box['y'] + y * box['height'] / 192)
    page.wait_for_selector('.toast:has-text("LOST IN ORBIT")')
    assert 'lost-in-orbit' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    page.click('#universe')                                             # and back to the map
    assert page.locator('#map').is_visible() and page.locator('#uni-nav').is_hidden()
    assert not errors, errors


def test_phone_controls_fit_on_screen(browser, site):
    """On a 375-pixel phone every visible button sits inside the screen (the system tools once ran off the edge)."""
    errors = []
    page = browser.new_page(viewport={'width': 375, 'height': 740}, is_mobile=True, has_touch=True)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(site)
    page.fill('#query', 'Kepler-90')
    page.press('#query', 'Enter')
    page.wait_for_selector('#sys-tools:not([hidden])')
    outside = page.evaluate("""() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && !b.closest('dialog'))
        .filter(b => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).map(b => b.id || b.textContent)""")
    assert outside == [], outside
    page.click('#sys-in', timeout=3000)                               # and it can be tapped
    assert not errors, errors


def test_loading_screen_and_lost_in_orbit(browser, site):
    """The loading screen goes once the page is ready; the empty system view is LOST IN ORBIT, with a button that
    jumps to a random system."""
    errors = []
    page = open_page(browser, site, errors)
    page.wait_for_function("() => !document.getElementById('loading')")
    page.wait_for_timeout(300)
    lit = page.evaluate("""() => { const c = document.getElementById('system'), d = c.getContext('2d')
        .getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 120 && d[i + 2] < 120) n++; return n; }""")
    assert lit > 20                                                     # the orange visor and LOST IN ORBIT
    page.click('#info [data-random]')
    page.wait_for_function("() => document.getElementById('sys-title').textContent !== 'PICK A STAR'")
    page.fill('#query', 'nothing-here-at-all')
    page.press('#query', 'Enter')
    assert page.locator('#info [data-random]').count() == 1            # NO SIGNAL offers the jump too
    assert not errors, errors


def test_dwarf_planets_and_dwarf_king(browser, site):
    """Each of the five dwarf planets opens its close-up when named; finding all five earns DWARF KING."""
    errors = []
    page = open_page(browser, site, errors)
    for name in ['Ceres', 'haumea', 'MAKEMAKE', 'the eris', 'Pluto']:
        page.fill('#query', name)
        page.press('#query', 'Enter')
        page.wait_for_function(f"() => document.getElementById('sys-title').textContent === '{name.split()[-1].upper()}'")
        assert 'DWARF PLANET' in page.locator('#info').inner_text()
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('dwarf-king')")
    page.wait_for_timeout(300)                                          # a few frames of the close-up: no errors
    assert not errors, errors


def test_astronaut_wardrobe(browser, site):
    """"astronaut" stays secret until LOST IN ORBIT. Then: the 1st visit brings no outfit, the 2nd always one
    (DRESS-UP DAY); later visits roll at most every 15 minutes (Math.random is scripted here), and the legendary
    cowboy hat earns HOUSTON, WE HAVE A PROBLEM. Owned outfits can be worn from the card."""
    errors = []
    page = open_page(browser, site, errors, init_script="Math.random = () => (window.__rand && window.__rand.length ? window.__rand.shift() : 0.99);")
    page.fill('#query', 'astronaut')
    page.press('#query', 'Enter')
    assert page.locator('#sys-title').inner_text() == 'NO SIGNAL'          # not found yet: no hint
    page.evaluate("localStorage.setItem('starmap.progress.v1', JSON.stringify({eggs: {}, systems: [], toured: true,"
                  " toasts: false, ach: {'lost-in-orbit': '2026-10-14'}}))")
    page.reload()
    visit = lambda: (page.fill('#query', 'astronaut'), page.press('#query', 'Enter'))
    visit()
    assert 'glad to see' in page.locator('#info').inner_text()           # 1st visit: nothing yet
    visit()
    assert 'New in the wardrobe' in page.locator('#info').inner_text()   # 2nd visit: always an outfit
    visit()
    assert 'come back in a little while' in page.locator('#info').inner_text()   # too soon to roll again
    page.clock.set_system_time('2026-10-14T15:20:00')                 # past the 15-minute cooldown (set, not run: deterministic)
    page.evaluate("window.__rand = [0.1, 0.99, 0.0]")                   # drop, legendary tier, the cowboy hat
    visit()
    assert 'Texas cowboy hat' in page.locator('#info').inner_text()
    saved = page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1'))")
    assert {'first-outfit', 'houston'} <= set(saved['ach']) and len(saved['outfits']) == 2
    page.click('.outfit-pick[data-outfit=""]')                         # wear the plain suit
    assert page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1')).outfit") == ''
    assert not errors, errors


def test_the_martian(browser, site):
    """The Martian: the farm opens only from "martian man" (and its #martian-man link), the egg is found, and the Galleria
    card shows the NASA references; a full crop earns SPACE FARMER (time fast-forwarded)."""
    errors = []
    page = open_page(browser, site, errors)
    page.fill('#query', 'the martian')                                  # only "martian man" finds it
    page.press('#query', 'Enter')
    assert page.locator('#sys-title').inner_text() == 'NO SIGNAL'
    page.fill('#query', 'Martian Man')
    page.press('#query', 'Enter')
    assert page.locator('#sys-title').inner_text() == 'MARTIAN MAN'
    assert 'martian' in page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1')).eggs")
    page.clock.run_for(61_000)                                          # a whole crop
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('space-farmer')")
    page.click('#open-gallery')
    page.click('.egg-card[data-egg="martian"]')
    page.wait_for_selector('#pane-eggs .planet-strip img')
    assert page.locator('#pane-eggs .planet-strip li').count() == 4
    page.goto(site + '#martian-man')                                    # a shared link opens it too
    page.wait_for_function("() => document.getElementById('sys-title').textContent === 'MARTIAN MAN'")
    assert not errors, errors


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
    assert all(n == '??? · find it by name' for n in names) and len(names) >= 17   # nothing found yet: all hidden
    assert page.locator('#sys-title').inner_text() == 'SPACECRAFT'
    assert not page.locator('#sys-tools').is_hidden()        # zoom / FIT work on the frozen Solar System
    page.click('#sys-fit')
    assert page.locator('canvas.craft-icon').count() == 0          # no pixel art until found
    page.goto(site + '#jwst')                                      # naming one reveals it
    page.wait_for_function("() => document.getElementById('sys-title').textContent === 'JAMES WEBB SPACE TELESCOPE'")
    page.wait_for_selector('#info tr.focus')
    assert 'James Webb' in page.locator('#info tr.focus').inner_text()
    page.goto(site + '#Spacecraft')                                # ...and it stays revealed
    page.wait_for_selector('#info table')
    names = page.locator('#info tbody tr td:nth-child(2)').all_inner_texts()
    assert 'James Webb Space Telescope' in names and names.count('??? · find it by name') == len(names) - 1
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
    page.wait_for_function("() => document.getElementById('sys-title').textContent === 'THE KEPLER SPACE TELESCOPE'")
    assert 'Goodnight Kepler' in page.locator('#info').inner_text()
    assert page.locator('#sys-tools').is_hidden()
    page.goto(site + '#Kepler-90')
    page.wait_for_function("() => document.getElementById('sys-title').textContent === 'KEPLER-90'")
    box = page.locator('#map').bounding_box()
    scale = box['width'] / 192                                  # the sprite sits at map pixel (5, 7), 22 x 10
    page.mouse.click(box['x'] + 15 * scale, box['y'] + 11 * scale)
    page.wait_for_function("() => location.hash === '#Kepler'")
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
    assert page.locator('.egg-card').count() == 36
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
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('eight-worlds')")
    page.click('#open-gallery')
    page.click('#tab-ach')
    earned = page.locator('.ach-list li.on').all_inner_texts()
    assert any('CURIOUS MIND' in a for a in earned) and any('EIGHT WORLDS' in a for a in earned)
    page.reload()                                                   # survives a reload (and so a site update)
    page.click('#open-gallery')
    assert page.locator('.egg-card.found').count() == 1
    page.click('#tab-set')
    page.wait_for_function("() => document.getElementById('set-storage').textContent.includes('Saved in this browser')")
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
    page.wait_for_function("() => (document.getElementById('set-reset-note').textContent || '').includes('loaded')")
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
    page.wait_for_function("() => document.getElementById('rank-name').textContent === 'RED GIANT'")   # 12 achievements
    assert page.locator('#rank-badges canvas').count() == 1                                     # famous worlds done
    assert page.locator('#rank-count').inner_text() == '12/75'
    page.click('#rank')                                                                           # opens the tab
    assert page.locator('#pane-ach .rank-panel').is_visible()
    assert page.locator('.badge-shelf li.on').count() == 1
    assert page.locator('.ach-list canvas[data-trophy="lock"]').count() > 0                      # space locks
    assert page.locator('canvas.constellation').count() >= 8                                      # a constellation per group
    page.click('li[data-ach="eight-worlds"]')                                                     # the hologram
    assert page.locator('#holo').is_visible() and 'EIGHT WORLDS' in page.locator('#holo-data').inner_text()
    page.click('#holo-pin')                                                                       # pin it to the header
    assert page.locator('#rank-showcase canvas').count() == 1
    page.click('#holo-close')
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
    page.click('#highlights .chip.unseen')
    assert page.locator('#highlights .chip.unseen').inner_text() == 'unseen (1)'
    page.fill('#query', 'Kepler-90')
    page.press('#query', 'Enter')
    page.wait_for_selector('.toast.legend')
    assert 'true Star Gazers' in page.locator('.toast.legend').inner_text()
    assert page.locator('#highlights .chip.unseen').inner_text() == 'unseen (0)'                 # updates as you go
    page.wait_for_function("() => document.getElementById('rank-name').textContent.startsWith('BLACK HOLE')")
    page.click('#open-gallery')
    page.click('#tab-set')
    assert page.locator('#set-final').is_visible()                                                # white dwarf option
    page.click('#set-reset')
    page.click('#set-reset')
    page.wait_for_function("() => document.getElementById('rank-name').textContent === 'WHITE HOLE'")   # new game +
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
    page.wait_for_function("() => document.getElementById('sys-title').textContent === 'KEPLER-16'")
    page.wait_for_selector('.toast.badge')
    assert 'Two suns' in page.locator('#info').inner_text()
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('tatooine')")
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
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('K03444.01')")
    assert 'first-call' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    ruling = ('window.STARMAP_RESOLUTIONS = {"since": "2026-10-14", '
              '"resolved": {"K03444.01": ["confirmed", "2099-01-01"]}};')   # NASA confirms it, after the call
    page.route('**/data/resolutions.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=ruling))
    page.reload()
    page.wait_for_selector('.toast:has-text("NASA RULED")')
    assert 'you called it' in page.locator('.toast:has-text("NASA RULED")').inner_text()
    page.wait_for_function("() => (localStorage.getItem('starmap.progress.v1') || '').includes('prophet')")
    page.click('#open-gallery')
    page.click('#tab-pred')
    assert '1RIGHT' in ''.join(page.locator('#pane-pred .gallery-progress').inner_text().split())
    assert not errors, errors


def test_tour_icons_and_suggestions(browser, site):
    """First-visit tour (forced with ?tour), pixel icons, found eggs and recent systems in the suggestions."""
    errors = []
    page = open_page(browser, site + '?tour', errors)
    page.wait_for_selector('.tour')
    assert 'SEARCH THE SKY' in page.locator('.tour').inner_text()
    for _ in range(3):
        page.click('.tour [data-tour="next"]')
    assert page.locator('.tour').count() == 0
    assert '"toured":true' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    assert page.locator('#random canvas.icon').count() == 1 and page.locator('#open-gallery canvas.icon').count() == 1
    page.fill('#query', 'Kepler-90')
    page.press('#query', 'Enter')
    page.fill('#query', 'lucy')
    page.press('#query', 'Enter')                                     # finds the Lucy easter egg
    page.fill('#query', 'lucy')                                       # searching a found egg again: its view, no pop-up
    page.press('#query', 'Enter')
    page.wait_for_timeout(300)
    assert page.locator('.toast:has-text("TROJAN TOUR")').count() <= 1
    page.fill('#query', 'luc')
    page.wait_for_selector('#suggest li:has-text("easter egg you found")')
    page.fill('#query', '')
    page.locator('#query').blur()
    page.locator('#query').focus()
    page.wait_for_selector('#suggest li:has-text("recently viewed")')
    assert not errors, errors


def test_search_spellings_and_so_close(browser, site):
    """Easter-egg names ignore capitals, "the", hyphens, underscores and dots, and know common nicknames; extra
    or missing spaces fail on purpose. A name a letter or two off says "SO CLOSE!" (and, once found, names it)."""
    errors = []
    page = open_page(browser, site, errors)
    found = ['JWST', '  jwst  ', 'James-Webb', 'james webb telescope', 'Mars-Odyssey', 'Voyager I', 'voyager two',
             'new-horizons', 'OSIRIS_REx', 'osiris rex', 'parker probe', 'space-station', 'solar-system',
             'Europa-Clipper', 'Curiosity rover', 'the perseverance rover', 'ExoMars TGO', 'Kepler space telescope', 'PLUTO']
    for q in found + ['James  Webb', 'NewHorizons', 'europaclipper']:
        page.fill('#query', q)
        page.press('#query', 'Enter')
        title = page.locator('#sys-title').inner_text()
        assert (title != 'NO SIGNAL') == (q in found), (q, title)
    assert not errors, errors
    page = open_page(browser, site, errors)                           # fresh, so pop-ups aren't queued behind 19 eggs
    page.fill('#query', 'jwst')
    page.press('#query', 'Enter')
    page.fill('#query', 'Psychee')                                   # one letter off, not found yet: no name given
    page.press('#query', 'Enter')
    page.wait_for_selector('.toast:has-text("SO CLOSE!")')
    assert 'so-close' in page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1')).ach")
    page.fill('#query', 'Jvst')                                       # found already: it says which one
    page.press('#query', 'Enter')
    page.wait_for_selector('.toast:has-text("James Webb Space Telescope?")')
    page.fill('#query', 'kepler 99999')                               # a catalogue number is not a near miss
    page.press('#query', 'Enter')
    assert page.locator('#sys-title').inner_text() == 'NO SIGNAL'
    assert not errors, errors


def test_daily_mystery_calls_and_card(browser, site):
    """The daily mystery card has clues; calls work from the next-planets list; the star card downloads."""
    errors = []
    page = open_page(browser, site, errors)
    page.click('#open-gallery')
    assert 'MYSTERY STAR OF THE DAY' in page.locator('.daily-card').inner_text()
    assert page.locator('.daily-card li').count() >= 2
    page.click('#tab-ach')
    with page.expect_download() as dl:
        page.click('#share-card')
    assert dl.value.suggested_filename.endswith('.png')
    page.click('#gallery-close')
    page.click('button.chip:has-text("next planets")')
    page.click('#info .call[data-koi] button[data-call="planet"] >> nth=0')
    page.wait_for_function("() => Object.keys(JSON.parse(localStorage.getItem('starmap.progress.v1')).calls).length === 1")
    assert not errors, errors


def test_night_sky_backdrop(browser, site):
    """The pixel night sky draws behind the page, never takes clicks, and can be switched to plain."""
    errors = []
    page = open_page(browser, site, errors)
    page.wait_for_timeout(300)
    info = page.evaluate("""() => { const c = document.getElementById('backdrop'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const colours = new Set(); for (let i = 0; i < d.length; i += 4 * 7) colours.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
        return { w: c.width, colours: colours.size, events: getComputedStyle(c).pointerEvents, z: getComputedStyle(c).zIndex }; }""")
    assert info['w'] >= 200 and info['colours'] > 12 and info['events'] == 'none' and info['z'] == '-1'
    assert page.get_attribute('#sky-toggle', 'aria-pressed') == 'true'
    page.click('#sky-toggle')                                         # the header button pauses the sky
    assert page.get_attribute('#sky-toggle', 'aria-pressed') == 'false'
    assert '"backdrop":"still"' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    page.click('#open-gallery')
    page.click('#tab-set')
    assert page.input_value('#set-backdrop') == 'still'               # and the setting follows
    page.select_option('#set-backdrop', 'plain')
    assert page.locator('#backdrop').is_hidden()
    assert '"backdrop":"plain"' in page.evaluate("localStorage.getItem('starmap.progress.v1')")
    page.click('#gallery-close')
    page.click('#sky-toggle')                                         # from plain, it turns the animated sky back on
    assert page.locator('#backdrop').is_visible() and page.get_attribute('#sky-toggle', 'aria-pressed') == 'true'
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


def test_antenna_opens_the_thank_you_note(browser, site):
    """The dish on the page's edge opens the maker's note (with its P.S. hint); Close and Escape shut it."""
    errors = []
    page = open_page(browser, site, errors)
    assert 'news' in page.get_attribute('#thanks-open', 'class')   # a version this browser hasn't seen: lit up
    page.click('#thanks-open')
    page.wait_for_function('() => document.getElementById("thanks").open')
    assert page.locator('#thanks-news').is_visible()
    assert page.locator('#thanks-news-list li').count() >= 1
    assert 'search up the solar system' in page.locator('#thanks .ps').inner_text().lower()
    assert 'news' not in page.get_attribute('#thanks-open', 'class')
    page.click('#thanks-tab-upd')                         # every version, newest first
    assert page.locator('#thanks-pane-upd').is_visible() and page.locator('#thanks-pane-msg').is_hidden()
    assert page.locator('#thanks-updates > li').count() >= 10
    text = page.locator('#thanks-updates').inner_text().lower()
    assert 'security' not in text and 'v1.0.0' in text
    page.click('#thanks-tab-msg')
    page.click('#thanks-close')
    assert not page.evaluate('() => document.getElementById("thanks").open')
    page.click('#thanks-open')
    page.keyboard.press('Escape')
    assert not page.evaluate('() => document.getElementById("thanks").open')
    page.reload()
    page.wait_for_function('() => !document.getElementById("loading")')
    assert 'news' not in page.get_attribute('#thanks-open', 'class')   # seen: stays quiet until the next version
    page.click('#thanks-open')
    assert page.locator('#thanks-news').is_hidden()
    assert page.locator('#site-version').inner_text().startswith('v')
    assert not errors, errors


def test_sky_events_can_be_caught(browser, site):
    """A comet, an asteroid and the saucer cross the map (summoned at once under automation); clicking one catches
    it, counts it and earns its SKY WATCH achievement; the saucer with its asteroid earns WHAT WAS THAT?"""
    errors = []
    page = open_page(browser, site, errors)
    box = page.locator('#map').bounding_box()

    def catch(kind, rock=False):
        x, y = page.evaluate(f'() => window.__skyEvent("{kind}", {str(rock).lower()})')
        page.wait_for_timeout(400)   # a few map frames
        page.mouse.click(box['x'] + x * box['width'] / 192, box['y'] + y * box['height'] / 192)

    for kind in ('comet', 'asteroid'):
        catch(kind)
    catch('ufo', rock=True)
    page.wait_for_function('() => { const p = JSON.parse(localStorage.getItem("starmap.progress.v1")); '
                           'return p.ach["ufo-spotter"] && p.ach["what-was-that"]; }')
    saved = page.evaluate('() => JSON.parse(localStorage.getItem("starmap.progress.v1"))')
    assert (saved['comets'], saved['asteroids'], saved['ufos']) == (1, 1, 1)
    assert {'comet-catcher', 'rock-hound', 'ufo-spotter', 'what-was-that'} <= set(saved['ach'])
    assert not errors, errors


def test_voyagers_are_found_separately(browser, site):
    """Plain "voyager" names neither twin (a pop-up asks which one); "voyager 1" and "voyager 2" are two eggs,
    and both with New Horizons earn ROAD TO INTERSTELLAR."""
    errors = []
    page = open_page(browser, site, errors)
    saved = lambda: page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1') || '{}')")
    search = lambda q: (page.fill('#query', q), page.press('#query', 'Enter'))
    search('voyager')
    page.wait_for_selector('.toast:has-text("TWO VOYAGERS")')
    assert not saved().get('eggs', {})
    search('voyager 1')
    page.wait_for_function("() => JSON.parse(localStorage.getItem('starmap.progress.v1')).eggs.voyager")
    assert 'voyager2' not in saved()['eggs']
    search('Voyager II')
    search('new horizons')
    page.wait_for_function("() => JSON.parse(localStorage.getItem('starmap.progress.v1')).ach.interstellar")
    assert {'voyager', 'voyager2', 'newHorizons'} <= set(saved()['eggs'])
    assert not errors, errors


def test_fanfare_is_on_by_default_and_can_be_switched_off(browser, site):
    """The unlock fanfare is on from the start (an old saved "off" that was only the default doesn't count);
    switching it off in Settings is remembered."""
    errors = []
    page = open_page(browser, site, errors)
    page.evaluate("localStorage.setItem('starmap.progress.v1', JSON.stringify({eggs: {}, ach: {}, systems: [], toured: true, sound: false}))")
    page.reload()
    page.click('#open-gallery')
    page.click('#tab-set')
    assert page.is_checked('#set-sound')
    page.uncheck('#set-sound')
    page.reload()
    page.click('#open-gallery')
    page.click('#tab-set')
    assert not page.is_checked('#set-sound')
    assert not errors, errors


def test_egg_cards_step_with_edge_arrows_and_keys(browser, site):
    """An open Galleria card has ◀ ▶ on its edges and answers the arrow keys, wrapping round all the cards."""
    errors = []
    page = open_page(browser, site, errors)
    page.click('#open-gallery')
    page.click('.egg-card >> nth=0')
    count = lambda: page.locator('.egg-count').inner_text()
    assert count().startswith('CARD 1 /')
    page.click('.egg-step.next')
    assert count().startswith('CARD 2 /')
    page.keyboard.press('ArrowLeft')
    assert count().startswith('CARD 1 /')
    page.keyboard.press('ArrowLeft')                     # wraps to the last card
    total = count().split('/ ')[1]
    assert count() == f'CARD {total} / {total}'
    page.click('.back')
    assert page.locator('.egg-card').count() == int(total)
    assert not errors, errors


def test_rovers_at_work_on_mars(browser, site):
    """"curiosity" and "percy" open the rovers at work on Mars (their own scenes, found as easter eggs); "mars rovers"
    still shows where everything is; found rovers roll by behind the Martian farm without errors."""
    errors = []
    page = open_page(browser, site, errors)
    search = lambda q: (page.fill('#query', q), page.press('#query', 'Enter'))
    search('curiosity')
    assert page.locator('#sys-title').inner_text() == 'CURIOSITY'
    assert 'GALE CRATER' in page.locator('#info').inner_text()
    search('percy')
    assert page.locator('#sys-title').inner_text() == 'PERSEVERANCE'
    search('mars pathfinder')
    assert page.locator('#sys-title').inner_text() == 'SOJOURNER'
    search('spirit rover')
    assert page.locator('#sys-title').inner_text() == 'SPIRIT'
    search('oppy')
    assert page.locator('#sys-title').inner_text() == 'OPPORTUNITY'
    search('zhurong')
    assert page.locator('#sys-title').inner_text() == 'ZHURONG'
    saved = page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1'))")
    assert {'curiosity', 'perseverance', 'sojourner', 'spirit', 'opportunity'} <= set(saved['eggs'])
    search('martian man')
    page.wait_for_timeout(500)
    search('mars rovers')
    page.wait_for_selector('#info table')                      # the spacecraft table (loaded on demand)
    assert not errors, errors


def test_found_dwarf_planets_join_the_solar_system(browser, site):
    """Ceres, Haumea, Makemake and Eris appear in the Solar System's drawing and table only once found."""
    errors = []
    page = open_page(browser, site, errors)
    rows = lambda: page.locator('#info table tbody tr').count()
    page.fill('#query', 'solar system')
    page.press('#query', 'Enter')
    assert rows() == 9                                    # eight planets and Pluto
    page.fill('#query', 'eris')
    page.press('#query', 'Enter')
    page.fill('#query', 'solar system')
    page.press('#query', 'Enter')
    assert rows() == 10 and 'Eris' in page.locator('#info table').inner_text()
    assert not errors, errors


def test_loading_screen_picks_one_of_two_scenes(browser, site):
    """web/loading.js shows the rocket or the astronomer at random (here held on screen by never loading the map)."""
    for rand, gif, title in ((0.1, 'loading.gif', 'LAUNCHING'), (0.9, 'loading-astronomer.gif', 'SCANNING')):
        page = browser.new_page()
        page.add_init_script(f'Math.random = () => {rand};')
        page.route('**/starmap.js*', lambda route: route.abort())
        page.goto(site)
        assert page.get_attribute('#loading img', 'src') == gif
        assert page.locator('.loading-title').inner_text().startswith(title)
        page.close()


def test_search_rejects_emojis(browser, site):
    """Emojis typed or pasted into the search box are dropped, and a search made only of emojis does nothing."""
    errors = []
    page = open_page(browser, site, errors)
    page.fill('#query', 'Kepler-90 🚀🇺🇸⭐️')
    page.dispatch_event('#query', 'input')
    assert page.input_value('#query') == 'Kepler-90 '
    page.press('#query', 'Enter')
    page.wait_for_function("() => document.getElementById('sys-title').textContent.includes('KEPLER-90')")
    page.fill('#query', '👽👨‍🚀')
    page.dispatch_event('#query', 'input')
    assert page.input_value('#query') == ''
    assert not errors, errors


def test_hubble_is_found(browser, site):
    """"hubble space telescope", "hubble telescope", "hubble" and "hst" all find Hubble (user report)."""
    errors = []
    page = open_page(browser, site, errors)
    for q in ('hubble space telescope', 'Hubble telescope', 'HST', 'hubble'):
        page.fill('#query', q)
        page.press('#query', 'Enter')
        assert page.locator('#sys-title').inner_text() == 'HUBBLE SPACE TELESCOPE', q
    assert 'hubble' in page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1')).eggs")
    assert not errors, errors


def test_tau_ceti_and_the_hail_mary(browser, site):
    """"tau ceti" opens the real system (candidates) with the ship hidden as a glint; "hail mary" reveals it."""
    errors = []
    page = open_page(browser, site, errors)
    page.fill('#query', 'tau ceti')
    page.press('#query', 'Enter')
    assert page.locator('#sys-title').inner_text() == 'TAU CETI'
    assert 'glints' in page.locator('#info').inner_text()
    saved = lambda: page.evaluate("JSON.parse(localStorage.getItem('starmap.progress.v1') || '{}').eggs || {}")
    assert 'hailmary' not in saved()
    page.fill('#query', 'project hail mary')
    page.press('#query', 'Enter')
    assert 'HAIL MARY' in page.locator('#info').inner_text().upper()
    assert 'hailmary' in saved()
    assert not errors, errors


def test_orbit_inside_the_star_is_explained(browser, site):
    """KOI-2093's catalog puts two orbits inside its (probably mis-sized) star: the panel says so (user report)."""
    errors = []
    page = open_page(browser, site, errors)
    page.fill('#query', 'KOI-2093')
    page.press('#query', 'Enter')
    page.wait_for_selector('#info .callout:has-text("inside the star")')
    page.fill('#query', 'Kepler-90')
    page.press('#query', 'Enter')
    page.wait_for_function("() => document.getElementById('sys-title').textContent.includes('KEPLER-90')")
    assert page.locator('#info .callout:has-text("inside the star")').count() == 0
    assert not errors, errors


def test_next_planets_list_is_not_replaced_by_a_late_system(browser, site):
    """Opening the next-planets list while a system is still loading keeps the list (no late overwrite)."""
    errors, held = [], []
    page = open_page(browser, site, errors)
    page.route('**/data/details/*.js', lambda route: held.append(route))   # hold the system's data back
    page.fill('#query', 'Kepler-1649')
    page.press('#query', 'Enter')
    page.wait_for_function("() => document.getElementById('info').textContent.includes('Loading')")
    page.click('button.chip:has-text("next planets")')
    assert page.locator('#sys-title').inner_text() == 'NEXT PLANETS'
    for route in held:                                            # now let the late data arrive
        route.continue_()
    page.wait_for_timeout(600)
    assert page.locator('#sys-title').inner_text() == 'NEXT PLANETS'
    assert not errors, errors
