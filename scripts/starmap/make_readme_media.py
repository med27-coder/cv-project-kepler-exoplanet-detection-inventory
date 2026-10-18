"""Capture the README's pictures from the star map itself (docs/media/), so they never go stale.

    .venv\\Scripts\\python scripts\\starmap\\make_readme_media.py

Serves web/ locally, drives it with Playwright (Chromium) and writes:
  banner.gif    the header: the title in the site's pixel font next to Kepler-90's planets orbiting
  social-preview.png   the repository's link preview (1280 x 640; upload it under Settings > General)
  ../../web/og.png     the star map's link preview (1200 x 630)
  map.png       the Kepler field map
  system.gif    a system animating, with its light curve
  galleria.png  a Galleria card, photo half-way to pixel art
  universe.gif  the UNIVERSE view stepping through its sectors
Re-run it after a visible change to the site.
"""

import functools
import http.server
import io
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'web'
OUT = ROOT / 'docs' / 'media'
PROGRESS = ("localStorage.setItem('starmap.progress.v1', JSON.stringify({toured: true, toasts: false, systems: [], ach: {},"
            " eggs: {jwst: '2026-10-14', kepler: '2026-10-14', voyager: '2026-10-14'}}))")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def png(data):
    return Image.open(io.BytesIO(data)).convert('RGB')


def save_gif(frames, path, ms):
    """One shared palette for every frame (no flicker), no dithering (pixel art stays crisp)."""
    sheet = Image.new('RGB', (frames[0].width, frames[0].height * len(frames)))
    for k, f in enumerate(frames):
        sheet.paste(f, (0, k * f.height))
    palette = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms, loop=0, optimize=True, disposal=1)
    print(f'{path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB')


def save_png(img, path):
    img.save(path, optimize=True)
    print(f'{path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB')


# One composer for the README banner and both link previews: the night sky behind, the title in the site's pixel
# font, a few lines in VT323, and Kepler-90's planets orbiting (copied live from the system view).
COMPOSE_JS = """o => {
  const box = document.createElement('div'), sys = document.getElementById('system');
  Object.assign(box.style, { position: 'fixed', left: '0', top: '0', width: o.w + 'px', height: o.h + 'px', zIndex: 99999,
    display: 'flex', alignItems: 'center', gap: o.gap + 'px', padding: '0 ' + o.pad + 'px', boxSizing: 'border-box',
    background: 'rgba(7, 11, 26, 0.55)', borderBottom: o.rule ? '4px solid #ffd34d' : 'none' });
  box.id = 'banner';
  for (const el of document.querySelectorAll('body > *:not(#backdrop)')) el.style.visibility = 'hidden';   // only the night sky behind
  const text = document.createElement('div');
  Object.assign(text.style, { flex: '1', minWidth: '0' });
  const h = document.createElement('div');
  h.textContent = o.title;
  Object.assign(h.style, { font: o.titleSize + 'px "Press Start 2P", monospace', color: '#ffd34d',
    textShadow: Math.round(o.titleSize / 10) + 'px ' + Math.round(o.titleSize / 10) + 'px 0 #a8620e', lineHeight: '1.35' });
  text.append(h);
  for (const [line, colour] of o.lines) {
    const d = document.createElement('div');
    d.textContent = line;
    Object.assign(d.style, { font: o.lineSize + 'px VT323, monospace', color: colour, marginTop: Math.round(o.lineSize / 3) + 'px' });
    text.append(d);
  }
  const c = document.createElement('canvas');
  c.width = sys.width; c.height = sys.height;
  Object.assign(c.style, { width: (sys.width * o.scale) + 'px', height: (sys.height * o.scale) + 'px', imageRendering: 'pixelated',
    border: '2px solid #2b3a6e', background: '#070b1a', flex: 'none' });
  box.append(text, c);
  box.style.visibility = 'visible';
  document.body.append(box);
  const copy = () => { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(sys, 0, 0); requestAnimationFrame(copy); };
  copy();
}"""
UNCOMPOSE_JS = ("() => { document.getElementById('banner').remove();"
                " for (const el of document.querySelectorAll('body > *')) el.style.visibility = ''; }")
SUB = [["Every planet system NASA's Kepler found, as pixel art", '#c8d0ff'],
       ['and Star Gazer, a deep-learning exoplanet vetter', '#c8d0ff']]
BANNER = {'w': 960, 'h': 240, 'pad': 28, 'gap': 28, 'rule': True, 'title': 'KEPLER STAR MAP', 'titleSize': 30,
          'lines': SUB, 'lineSize': 26, 'scale': 1.25}
PREVIEW = {'pad': 56, 'gap': 40, 'rule': True, 'titleSize': 34, 'lineSize': 34, 'scale': 2.0}
SITE_PREVIEW = {**PREVIEW, 'w': 1200, 'h': 630, 'title': 'KEPLER STAR MAP',
                'lines': [['3,600+ planet systems from NASA\'s Kepler mission', '#c8d0ff'],
                          ['Search one and watch its planets orbit', '#c8d0ff'],
                          ['24 easter eggs to find, 60 achievements', '#9aa6d6'],
                          ['med27-coder.github.io', '#ffd34d']]}
REPO_PREVIEW = {**PREVIEW, 'w': 1280, 'h': 640, 'title': 'STAR GAZER',
                'lines': [['Finding exoplanets in NASA Kepler data', '#c8d0ff'],
                          ['with deep learning, and a pixel map', '#c8d0ff'],
                          ['of every Kepler planet system', '#c8d0ff'],
                          ['github.com/med27-coder', '#ffd34d']]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(WEB)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_address[1]}/index.html'
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        page.goto(url)
        page.evaluate(PROGRESS)
        page.reload()
        page.evaluate('document.fonts.ready.then(() => true)')
        page.fill('#query', 'Kepler-90')
        page.press('#query', 'Enter')
        page.wait_for_timeout(1500)

        # banner: 24 frames, 120 ms apart
        page.evaluate(COMPOSE_JS, BANNER)
        page.wait_for_timeout(300)
        frames = []
        for _ in range(24):
            frames.append(png(page.locator('#banner').screenshot()))
            page.wait_for_timeout(120)
        save_gif(frames, OUT / 'banner.gif', 120)
        page.evaluate(UNCOMPOSE_JS)

        # the link previews: the star map's (web/og.png) and the repository's (uploaded by hand on GitHub)
        page.set_viewport_size({'width': 1300, 'height': 900})
        for spec, path in [(SITE_PREVIEW, WEB / 'og.png'), (REPO_PREVIEW, OUT / 'social-preview.png')]:
            page.evaluate(COMPOSE_JS, spec)
            page.wait_for_timeout(400)
            save_png(png(page.locator('#banner').screenshot()), path)
            page.evaluate(UNCOMPOSE_JS)
        page.set_viewport_size({'width': 1280, 'height': 900})

        # the map panel, and the system (canvas at 2x, crisp)
        top = page.locator('main .panel').first.bounding_box()
        end = page.locator('#highlights').bounding_box()
        clip = {'x': top['x'], 'y': top['y'], 'width': top['width'], 'height': end['y'] + end['height'] + 12 - top['y']}
        save_png(png(page.screenshot(clip=clip, full_page=True)), OUT / 'map.png')
        frames = []
        for _ in range(30):
            data = page.evaluate("document.getElementById('system').toDataURL('image/png')")
            img = png(__import__('base64').b64decode(data.split(',', 1)[1]))
            frames.append(img.resize((img.width * 2, img.height * 2), Image.NEAREST))
            page.wait_for_timeout(100)
        save_gif(frames, OUT / 'system.gif', 100)

        # a Galleria card, the slider half-way from the photo to the pixel art
        page.click('#open-gallery')
        page.click('.egg-card[data-egg="jwst"]')
        page.wait_for_function("document.querySelector('.morph canvas') && document.querySelector('.morph canvas').width >= 480")
        page.fill('.morph input', '45')
        page.evaluate('document.activeElement.blur()')
        page.wait_for_timeout(300)
        boxes = [page.locator('.egg-detail figure').nth(k).bounding_box() for k in range(2)]
        x0, y0 = min(b['x'] for b in boxes), min(b['y'] for b in boxes)
        x1, y1 = max(b['x'] + b['width'] for b in boxes), max(b['y'] + b['height'] for b in boxes)
        save_png(png(page.screenshot(clip={'x': x0 - 4, 'y': y0 - 4, 'width': x1 - x0 + 8, 'height': y1 - y0 + 8})), OUT / 'galleria.png')
        page.click('#gallery-close')

        # the UNIVERSE view, sector by sector
        page.click('#universe')
        frames = []
        for k in range(5):
            page.wait_for_timeout(400)
            data = page.evaluate("document.getElementById('universe-view').toDataURL('image/png')")
            img = png(__import__('base64').b64decode(data.split(',', 1)[1]))
            frames.append(img.resize((img.width * 2, img.height * 2), Image.NEAREST))
            if k < 4:
                page.click('#uni-out')
        save_gif(frames, OUT / 'universe.gif', 1400)
        browser.close()
    server.shutdown()


if __name__ == '__main__':
    main()
