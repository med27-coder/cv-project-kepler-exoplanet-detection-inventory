"""The loading screen's pixel art: Kepler's own rocket, a Delta II, climbing.

    .venv\\Scripts\\python scripts\\starmap\\make_loading_art.py

Kepler launched on a Delta II (the 7925-10L version: nine strap-on solid boosters) from Cape Canaveral on
7 March 2009. The rocket stays centred while stars stream past and the flame flickers, so the loop is seamless.
Writes web/loading.gif (16 frames) and web/loading-still.png (for reduced motion), 4 screen pixels per art
pixel; the words are HTML. The first design, a rock with moons, is kept as concept art
(pixel-art/concepts/draft_loading_rock.gif).
"""

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'web'
W, H, SCALE, FRAMES = 40, 44, 4, 16
BG = (7, 11, 26)


def hexc(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def frame(t):
    img = Image.new('RGB', (W, H), BG)
    put = lambda x, y, c: img.putpixel((x, y), hexc(c)) if 0 <= x < W and 0 <= y < H else None
    for k in range(34):   # stars streaming down past the climbing rocket (one full screen per loop)
        x = (k * 37 + 5) % W
        y = int(((k * 53) % H) + t * H * (1 + k % 3)) % H
        put(x, y, '#4a5590' if k % 4 else '#c8d0ff')
        if k % 3 == 2:
            put(x, (y - 1) % H, '#1e2550')   # faster stars leave a short streak
    cx, top = W // 2, 6
    body = '#eef2f8'
    for y in range(top, top + 4):   # the payload fairing (Kepler inside), tapering to the nose
        half = (y - top) // 2
        for x in range(cx - half, cx + half + 1):
            put(x, y, body)
    for y in range(top + 4, top + 22):   # the first stage: white body, a dark interstage band, a shadowed side
        for x in range(cx - 2, cx + 3):
            put(x, y, '#2b3566' if y in (top + 8, top + 9) else '#c9d2de' if x == cx + 2 else body)
    for dx in (-4, -3, 3, 4):   # strap-on solid boosters, nine in all (drawn as the ones facing us)
        for y in range(top + 14, top + 22):
            put(cx + dx, y, '#9aa6b8' if abs(dx) == 4 else '#d6dae2')
        if abs(dx) == 3:
            put(cx + dx, top + 13, '#d6dae2')   # the inner boosters' rounded tops
    flick = [0, 2, 1, 3, 1, 2, 0, 3][int(t * FRAMES) % 8]   # the flame flickers
    for k in range(6 + flick):
        y = top + 22 + k
        w = max(0, 2 - k // 3)
        for x in range(cx - w, cx + w + 1):
            put(x, y, '#fff1b0' if k < 2 else '#ffd34d' if k < 4 else '#ff9a3c')
    for dx in (-4, 4):   # the boosters' smaller flames
        for k in range(2 + flick // 2):
            put(cx + dx, top + 22 + k, '#ffd34d' if k == 0 else '#ff9a3c')
    for k in range(10):   # smoke puffs falling away behind
        s = (t + k / 10) % 1
        x = cx + round(math.sin(k * 2.3) * (2 + s * 6))
        y = top + 28 + round(s * 12)
        put(x, y, '#5d6878' if s < 0.5 else '#3a4258')
        put(x + 1, y, '#5d6878' if s < 0.3 else '#3a4258')
    return img.resize((W * SCALE, H * SCALE), Image.NEAREST)


def main():
    frames = [frame(k / FRAMES) for k in range(FRAMES)]
    frames[0].save(WEB / 'loading.gif', save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True)
    frames[0].save(WEB / 'loading-still.png', optimize=True)
    for name in ('loading.gif', 'loading-still.png'):
        print(f'web/{name}  {(WEB / name).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
