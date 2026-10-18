"""The loading screens' pixel art, one picked at random on each visit (web/loading.js): Kepler's own rocket, a
Delta II, climbing; and an astronomer at a telescope under a sky of twinkling stars.

    .venv\\Scripts\\python scripts\\starmap\\make_loading_art.py

Kepler launched on a Delta II (the 7925-10L version: nine strap-on solid boosters) from Cape Canaveral on
7 March 2009. The rocket stays centred while stars stream past and the flame flickers, so the loop is seamless.
Writes web/loading.gif and web/loading-astronomer.gif (16 frames each) and a still frame of each for reduced
motion, 4 screen pixels per art pixel; the words are HTML. The first design, a rock with moons, is archived
(pixel-art/archive/).
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


# Far-off stars for the astronomer's sky: (x, y, twinkle phase, bright)
SKY = [((k * 29 + 7) % W, (k * 17 + 3) % 30, k * 0.37 % 1, k % 7 == 0) for k in range(36)]


def astronomer(t):
    img = Image.new('RGB', (W, H), BG)
    put = lambda x, y, c: img.putpixel((x, y), hexc(c)) if 0 <= x < W and 0 <= y < H else None
    for y in range(25, H):   # the sky lightens a little towards the horizon (an ordered dither, not stripes)
        for x in range(W):
            if [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y % 4][x % 4] < (y - 24) * 1.2:
                put(x, y, '#0d1734')
    for x in range(W):   # the faint band of the Milky Way, slanting across
        y0 = 4 + x * 0.45
        for y in range(int(y0), int(y0) + 3):
            if (x * 7 + y * 3) % 4 == 0:
                put(x, y, '#1a2350')
    for x, y, phase, bright in SKY:   # stars glimmer, each at its own pace
        glow = (math.sin((t + phase) * 2 * math.pi * (1 + bright)) + 1) / 2
        put(x, y, '#ffffff' if glow > 0.8 else '#9aa6d6' if glow > 0.4 else '#3a4580')
        if bright and glow > 0.75:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(x + dx, y + dy, '#5a6aa0')
    s = (t * 2) % 1   # now and then a shooting star
    if t < 0.5 and s < 0.35:
        for k in range(5):
            put(30 - int(s * 40) + k, 3 + int(s * 12) - k // 2, '#ffffff' if k == 0 else '#6f7dc0')
    for x in range(W):   # a dark hill with a little grass on top
        top = 36 + round(1.5 * math.sin(x / 6))
        for y in range(top, H):
            put(x, y, '#132a36' if y == top else '#0a161f')
    # the telescope: a refractor on a tripod, pointing up into the sky
    for k in range(10):   # tripod legs, from the mount under the tube's middle down to the ground
        put(24 - k // 2, 27 + k, '#7d8596'); put(24 + k // 2, 27 + k, '#7d8596')
        if k > 2:
            put(24, 27 + k, '#5d6878')
    for k in range(14):   # the tube, from the eyepiece (lower left) to the lens (upper right)
        x, y = 18 + k, 29 - round(k * 0.62)
        put(x, y, '#e6ecff' if k > 1 else '#9aa6b8'); put(x, y + 1, '#9aa6b8' if k > 1 else '#5d6878')
    put(31, 20, '#2a3566'); put(32, 20, '#2a3566'); put(31, 21, '#2a3566')   # the dew cap
    put(24, 26, '#5d6878'); put(23, 26, '#5d6878'); put(25, 26, '#5d6878')    # the mount, holding the tube
    # the astronomer, leaning in to the eyepiece; a knit hat, a warm coat, breath fogging now and then
    for y in range(26, 29):
        for x in range(14, 17):
            put(x, y, '#e0b088')
    for x in range(13, 18):
        put(x, 25, '#b04a4a')
    put(15, 24, '#ffd34d')
    put(17, 27, '#e0b088')                       # leaning to the eyepiece
    for y in range(29, 35):
        for x in range(13, 17):
            put(x, y, '#2f4fae' if x < 16 else '#24418c')
    put(17, 30, '#2f4fae'); put(18, 30, '#e0b088')   # an arm on the telescope
    for y in range(35, 38):
        put(13, y, '#2a2a30'); put(15, y, '#2a2a30')
    if 0.3 < (t * 3) % 1 < 0.5:                  # a puff of breath in the cold night air
        put(18, 26, '#5d6878'); put(19, 25, '#3a4258')
    return img.resize((W * SCALE, H * SCALE), Image.NEAREST)


def main():
    for name, draw in (('loading', frame), ('loading-astronomer', astronomer)):
        frames = [draw(k / FRAMES) for k in range(FRAMES)]
        frames[0].save(WEB / f'{name}.gif', save_all=True, append_images=frames[1:], duration=90 if draw is frame else 120,
                       loop=0, optimize=True)
        still = 'loading-still.png' if draw is frame else 'loading-astronomer-still.png'
        frames[0].save(WEB / still, optimize=True)
        for f in (f'{name}.gif', still):
            print(f'web/{f}  {(WEB / f).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
