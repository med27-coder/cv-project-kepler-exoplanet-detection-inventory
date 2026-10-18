"""Build web/starmap.js from the readable parts in web/src/.

    .venv\\Scripts\\python scripts\\starmap\\build_web.py            # write web/starmap.js
    .venv\\Scripts\\python scripts\\starmap\\build_web.py --check    # exit 1 if web/starmap.js is out of date (CI)

The page loads one classic script so it also works opened straight from disk (file://), where
ES modules are blocked. The parts are plain top-level JavaScript, joined in file-name order inside
one function scope (shared variables, nothing leaks to the page), behind the clickjacking guard.
Edit web/src/*.js, then run this script; tests fail if the two drift apart. It also stamps the version
(VERSION in web/src/00-version.js) on index.html's script and stylesheet links (starmap.js?v=1.0.0), so browsers
fetch fresh files after a release instead of an old cached copy.
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'web' / 'src'
OUT = ROOT / 'web' / 'starmap.js'
INDEX = ROOT / 'web' / 'index.html'

HEADER = """// Kepler Star Map: pixel map of the Kepler field + pixel-art star systems.
// Data comes from data/systems.js (scripts/starmap/export_starmap.py). Everything is drawn
// procedurally on two small canvases, so a system costs a few numbers, not an image.
// Built by scripts/starmap/build_web.py from web/src/*.js: edit those, not this file.
(function () {
  'use strict';

  // Clickjacking guard. GitHub Pages can't send frame-ancestors / X-Frame-Options headers, and
  // browsers block a framed page from navigating the top window without a click. So inside another
  // site's frame, replace the page with a single link that opens the real one, and stop here.
  if (window.top !== window.self) {
    const link = document.createElement('a');
    link.href = window.location.href;
    link.target = '_top';
    link.rel = 'noopener';
    link.textContent = 'Open the Kepler Star Map ↗';
    document.body.replaceChildren(link);
    return;
  }
"""
FOOTER = '})();\n'


def indent(text):
    return ''.join(('  ' + line if line.strip() else line) for line in text.splitlines(keepends=True))


def build():
    parts = sorted(SRC.glob('*.js'))
    if not parts:
        sys.exit(f'No parts in {SRC}')
    body = '\n'.join(indent(p.read_text(encoding='utf-8').rstrip('\n') + '\n') for p in parts)
    return HEADER + '\n' + body + FOOTER


def version():
    m = re.search(r"^const VERSION = '(\d+\.\d+\.\d+)';", (SRC / '00-version.js').read_text(encoding='utf-8'), re.MULTILINE)
    if not m:
        sys.exit('No VERSION in web/src/00-version.js')
    return m[1]


def stamp(html, v):
    """index.html with the version on its own script and stylesheet links."""
    return re.sub(r'((?:src|href)="(?:starmap\.js|style\.css))(?:\?v=[\d.]+)?"', rf'\1?v={v}"', html)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help='fail if web/starmap.js is out of date')
    args = parser.parse_args()
    js = build()
    if args.check:
        if OUT.read_text(encoding='utf-8') != js:
            sys.exit('web/starmap.js is out of date: run scripts/starmap/build_web.py')
        html = INDEX.read_bytes().decode('utf-8')
        if stamp(html, version()) != html:
            sys.exit('web/index.html links are not stamped with the version: run scripts/starmap/build_web.py')
        print('web/starmap.js is up to date')
        return
    OUT.write_text(js, encoding='utf-8', newline='\n')
    html = INDEX.read_bytes().decode('utf-8')   # bytes: keep the file's own line endings
    INDEX.write_bytes(stamp(html, version()).encode('utf-8'))
    print(f'Built {OUT.relative_to(ROOT)} from {len(list(SRC.glob("*.js")))} parts ({len(js) / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
