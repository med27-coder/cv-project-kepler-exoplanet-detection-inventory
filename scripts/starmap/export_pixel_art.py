"""Export the star map's pixel art as enlarged PNGs into pixel-art/ (a sprite reference and drafting board).

    .venv\\Scripts\\python scripts\\starmap\\export_pixel_art.py

Draws each sprite with the page's own code (web/starmap.js, in headless Chromium through Playwright),
so the images always match what the site shows, then enlarges them with nearest-neighbour scaling.
The site's code stays private inside its closure; only this tool's browser gets a copy of starmap.js
that also hands the drawing functions to window.__art.

    pixel-art/solar-system/<body>.png        each planet (and Pluto) drawn large, without moons
    pixel-art/solar-system/<body>_scene.png  at the size it has on the map, with its moons
    pixel-art/solar-system/sheet.png         all of them side by side, labelled
    pixel-art/spacecraft/kepler.png          the Kepler telescope (map sprite)
    pixel-art/spacecraft/iss.png             the International Space Station
    pixel-art/spacecraft/marker.png          the cross that marks spacecraft in the Solar System view

Hand-made drafts go next to these as draft_*.png; this script never touches them. Re-run it after
changing sprite code in web/src/ (and build_web.py).
"""

import base64
import functools
import http.server
import io
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'pixel-art'
BODIES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
SCENE_SIZE = {'mercury': 2, 'venus': 2, 'earth': 3, 'mars': 2, 'jupiter': 6, 'saturn': 5,
              'uranus': 4, 'neptune': 4, 'pluto': 2}   # sprite radius on the map (SOLAR in 40-home.js)

EXPOSE = ('solarPlanet', 'keplerSprite', 'issSprite', 'pixelText', 'textWidth', 'CRAFT_SPOT')

# Runs in the page: draw on a fresh canvas and return it as a PNG data URL. `draw` is the body of a
# function of (ctx, w, h) that can call the page's drawing functions.
RENDER = """([w, h, draw]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#070b1a';
  ctx.fillRect(0, 0, w, h);
  new Function('ctx', 'w', 'h', `const { ${Object.keys(window.__art).join(', ')} } = window.__art; ${draw}`)(ctx, w, h);
  return c.toDataURL('image/png');
}"""


def save(page, path, w, h, draw, scale):
    url = page.evaluate(RENDER, [w, h, draw])
    img = Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1])))
    img = img.resize((w * scale, h * scale), Image.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f'{path.relative_to(ROOT)}  {img.width}x{img.height}')


def exposed_script():
    js = (ROOT / 'web' / 'starmap.js').read_text(encoding='utf-8').rstrip()
    assert js.endswith('})();'), 'starmap.js should end with its closure'
    return js[:-len('})();')] + f'  window.__art = {{ {", ".join(EXPOSE)} }};\n}})();\n'


def main():
    quiet = type('Quiet', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *a: None})
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(quiet, directory=ROOT / 'web'))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(bypass_csp=True)   # local tool: the page's CSP rightly forbids eval
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/starmap.js', lambda route: route.fulfill(body=exposed_script(), content_type='text/javascript'))
        page.goto(f'http://127.0.0.1:{server.server_address[1]}/index.html')
        page.wait_for_function('window.__art !== undefined')

        solar = OUT / 'solar-system'
        light = '-0.8, -0.6'   # lit from the upper left
        for body in BODIES:
            save(page, solar / f'{body}.png', 48, 40,
                 f"solarPlanet(ctx, 24, 20, {{ art: '{body}', size: 12, noMoon: true }}, {light}, 1.5);", 6)
            save(page, solar / f'{body}_scene.png', 40, 34,
                 f"solarPlanet(ctx, 20, 17, {{ art: '{body}', size: {SCENE_SIZE[body]} }}, {light}, 1.5);", 8)
        cells = ''.join(
            f"solarPlanet(ctx, {16 + 34 * i}, 16, {{ art: '{b}', size: 10, noMoon: true }}, {light}, 1.5);"
            f"pixelText(ctx, '{b.upper()}', {16 + 34 * i} - textWidth('{b.upper()}') / 2 | 0, 34, '#9fd8ff');"
            for i, b in enumerate(BODIES))
        save(page, solar / 'sheet.png', 34 * len(BODIES), 42, cells, 4)

        craft = OUT / 'spacecraft'
        save(page, craft / 'kepler.png', 26, 14, 'keplerSprite(ctx, 2, 2, 1, null);', 12)
        save(page, craft / 'iss.png', 13, 7, 'issSprite(ctx, 6, 3);', 16)
        save(page, craft / 'marker.png', 7, 7,
             "ctx.fillStyle = CRAFT_SPOT; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) "
             "ctx.fillRect(3 + dx, 3 + dy, 1, 1);", 16)
        browser.close()
    server.shutdown()
    if errors:
        raise SystemExit(f'page errors: {errors}')


if __name__ == '__main__':
    main()
