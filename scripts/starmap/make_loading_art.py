"""The loading screen's pixel art: a rock with little moons, after asteroid Ida and its moon Dactyl.

    .venv\\Scripts\\python scripts\\starmap\\make_loading_art.py

Writes web/loading.gif (animated, 16 frames) and web/loading-still.png (for reduced motion), 4 screen pixels per
art pixel. The rock and moons come from the approved concept (draft_concepts.py, docs/plans/WORLDS_MOONS_AND_SCREENS.md);
the words are HTML, so they stay sharp and readable.
"""

import math
from pathlib import Path

import draft_concepts as D
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'web'
W, H, SCALE, FRAMES = 72, 32, 4, 16


def frame(t):
    f = D.Frame(W, H, seed=13)
    cx, cy = W // 2, H // 2
    rot = t * 2 * math.pi
    for y in range(-7, 8):   # a lumpy, slowly turning rock
        for x in range(-11, 12):
            if (x / 11) ** 2 + (y / 7) ** 2 > 1 + 0.18 * math.sin(3 * math.atan2(y, x) + rot):
                continue
            crater = round(x + rot * 3) % 6 == 0 and y % 4 == 1
            f.put(cx + x, cy + y, '#5d5a55' if crater else '#b8b0a4' if x + y < -3 else '#8a8278')
    for k, (r, ry, speed, col) in enumerate([(17, 6, 1, '#d6dae2'), (24, 8, -0.6, '#c9a86a'), (31, 11, 0.4, '#9fd8ff')]):
        a = rot * speed + k * 2
        x, y = cx + r * math.cos(a), cy + ry * math.sin(a)
        if math.sin(a) < 0 and abs(x - cx) < 11 and abs(y - cy) < 7:
            continue   # behind the rock
        f.disc(x, y, 1.6 if k == 1 else 1.2, lambda dx, dy, q, c=col: c)
    return f.img.resize((W * SCALE, H * SCALE), Image.NEAREST)


def main():
    frames = [frame(k / FRAMES) for k in range(FRAMES)]
    frames[0].save(WEB / 'loading.gif', save_all=True, append_images=frames[1:], duration=120, loop=0, optimize=True)
    frames[0].save(WEB / 'loading-still.png', optimize=True)
    for name in ('loading.gif', 'loading-still.png'):
        print(f'web/{name}  {(WEB / name).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
