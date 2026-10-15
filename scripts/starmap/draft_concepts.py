"""Concept art (animated GIFs) for the next round of easter eggs: pixel-art/concepts/.

    .venv\\Scripts\\python scripts\\starmap\\draft_concepts.py

Drafts for docs/plans/ACHIEVEMENTS_V2.md, not used by the site yet:
    draft_aliens.gif      "What the alien doing": two green aliens in a flying saucer, one driving, one
                          throwing a peace sign
    draft_comet.gif       a comet streaking past (ion tail and dust tail)
    draft_asteroid.gif    an asteroid tumbling by
    draft_hail_mary.gif   a Project Hail Mary nod: Tau Ceti, a ship, and a five-legged friend talking in chords
All original pixel art (no film images). Comet and asteroid references: pixel-art/references/concepts/.
"""

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'pixel-art' / 'concepts'
BG = (7, 11, 26)


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Frame:
    def __init__(self, w, h, seed=0):
        self.img = Image.new('RGB', (w, h), BG)
        self.w, self.h = w, h
        for k in range(w * h // 60):   # background stars
            x, y = (k * 37 + seed) % w, (k * 53 + seed * 7) % h
            self.put(x, y, '#1e2550' if k % 5 else '#4a5590')

    def put(self, x, y, c):
        x, y = round(x), round(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((x, y), hexc(c) if isinstance(c, str) else c)

    def disc(self, cx, cy, r, colour):
        for y in range(math.floor(cy - r), math.ceil(cy + r) + 1):
            for x in range(math.floor(cx - r), math.ceil(cx + r) + 1):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if d <= r:
                    c = colour(x + 0.5 - cx, y + 0.5 - cy, d / r)
                    if c:
                        self.put(x, y, c)

    def grid(self, rows, x0, y0, ink):
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch != '.':
                    self.put(x0 + c, y0 + r, ink[ch])


def save_gif(frames, name, scale=6, ms=110):
    imgs = [f.img.resize((f.w * scale, f.h * scale), Image.NEAREST) for f in frames]
    imgs[0].save(OUT / name, save_all=True, append_images=imgs[1:], duration=ms, loop=0)
    print(f'{(OUT / name).relative_to(ROOT)}  {len(frames)} frames')


# ---- "What the alien doing"
ALIEN_INK = {'g': '#4fd17a', 'G': '#2f8a4a', 'k': '#000000', 'w': '#ffffff', 'b': '#7a5a3a'}
DRIVER = ['.ggg.', 'gkgkg', 'ggggg', '.ggg.', '..g..']            # big black eyes
WAVER = ['.ggg.', 'gkgkg', 'ggggg', '.ggg.', '..g..']
PEACE = [['g.g', 'g.g', '.g.', '.g.'], ['g..g', 'g..g', '.gg.', '.g..']]   # V sign, wiggling


def aliens(t):
    f = Frame(56, 38, seed=3)
    bob = round(math.sin(t * 2 * math.pi) * 1.5)
    cx, cy = 28, 22 + bob
    if t % 0.5 < 0.25:   # tractor beam, now and then
        for y in range(cy + 4, 38):
            half = 3 + (y - cy) * 0.35
            for x in range(round(cx - half), round(cx + half) + 1):
                if (x + y) % 3 == 0:
                    f.put(x, y, '#3a6a5a')
    f.disc(cx, cy - 3, 10, lambda dx, dy, q: None if dy > 1 else ('#9fd8ff' if q > 0.88 else '#163a52'))   # glass dome
    f.grid(DRIVER, cx - 7, cy - 9, ALIEN_INK)                                           # driver
    for x in range(cx - 8, cx - 2):
        f.put(x, cy - 3, '#7a5a3a')                                                     # steering wheel
    f.put(cx - 5, cy - 4, '#7a5a3a')
    f.grid(WAVER, cx + 2, cy - 9, ALIEN_INK)                                            # passenger
    f.grid(PEACE[int(t * 8) % 2], cx + 7, cy - 14 + (int(t * 8) % 2), ALIEN_INK)       # ✌ above the dome
    f.put(cx + 7, cy - 10, '#4fd17a'); f.put(cx + 7, cy - 9, '#4fd17a')                # arm
    for x in range(cx - 18, cx + 19):                                                  # saucer body
        e = abs(x - cx) / 18
        for y in range(cy - 1, cy + 4):
            if (y - cy - 1.5) ** 2 / 6 + e ** 2 <= 1:
                f.put(x, y, '#d6dae2' if y < cy + 1 else '#7d8596')
    lights = ['#ffd34d', '#ff6b5a', '#9fd8ff', '#4fd17a', '#b56cff']
    for k in range(7):   # rim lights chase round
        f.put(cx - 15 + k * 5, cy + 1, lights[(k + int(t * 10)) % len(lights)])
    return f


# ---- comet and asteroid
def comet(t):
    f = Frame(64, 28, seed=5)
    hx, hy = -6 + t * 76, 6 + t * 16
    for k in range(1, 26):   # ion tail (blue, straight) and dust tail (yellow, curved)
        f.put(hx - k, hy - k * 0.42, '#4a7fd6' if k > 14 else '#9fd8ff')
        if k % 2 == 0:
            f.put(hx - k, hy - k * 0.25 + (k / 12) ** 2, '#8a6d1f' if k > 12 else '#e6d3a8')
    f.disc(hx, hy, 1.8, lambda dx, dy, q: '#ffffff' if q < 0.6 else '#9fd8ff')
    return f


ROCK = [(math.cos(a) * r, math.sin(a) * r) for a, r in zip([k * math.pi / 5 for k in range(10)],
                                                         [6, 5, 6.5, 4.5, 6, 5.5, 4, 6, 5, 6.2])]


def asteroid(t):
    f = Frame(40, 40, seed=9)
    cx, cy, rot = 6 + t * 28, 30 - t * 20, t * 2 * math.pi
    pts = [(x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)) for x, y in ROCK]
    for y in range(-8, 9):
        for x in range(-8, 9):
            ang = math.atan2(y, x) - rot
            k = int(((ang % (2 * math.pi)) / (2 * math.pi)) * len(ROCK))
            r = math.hypot(*ROCK[k])
            if math.hypot(x, y) <= r:
                lit = (x + y) < -2
                crater = ((round(x * math.cos(-rot) - y * math.sin(-rot)) % 4 == 0) and (round(x * math.sin(-rot) + y * math.cos(-rot)) % 5 == 0))
                f.put(cx + x, cy + y, '#5d5a55' if crater else '#b8b0a4' if lit else '#8a8278')
    del pts
    return f


# ---- Project Hail Mary nod (original art)
SHIP = ['....mmmm.......', '..mmsssssmmmmm.', 'mmsswwwwssssssy', '..mmsssssmmmmm.', '....mmmm.......']
SHIP_INK = {'m': '#7d8596', 's': '#d6dae2', 'w': '#9fd8ff', 'y': '#ffd34d'}
FRIEND = ['..bbb..', '.bBbBb.', 'bbbbbbb', '.b.b.b.', 'b..b..b']   # a five-legged, rocky body
FRIEND_INK = {'b': '#8a7d70', 'B': '#5d5246'}


def hail_mary(t):
    f = Frame(96, 48, seed=11)
    f.disc(14, 24, 9, lambda dx, dy, q: '#fff1b0' if q < 0.5 else '#ffd34d' if q < 0.85 else '#ff9a3c')   # Tau Ceti (a G8 star)
    f.grid(SHIP, 40 + round(math.sin(t * 2 * math.pi)), 10, SHIP_INK)
    f.put(55, 12 + (int(t * 8) % 2), '#ff9a3c')                                     # engine glow
    f.grid(FRIEND, 66, 30 + (int(t * 4) % 2), FRIEND_INK)
    for k in range(3):   # chords: little notes floating up
        p = (t * 2 + k / 3) % 1
        x, y = 74 + k * 4, round(30 - p * 18)
        f.put(x, y, '#9fd8ff'); f.put(x, y - 1, '#9fd8ff'); f.put(x + 1, y - 2, '#9fd8ff')
    return f


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    save_gif([aliens(k / 16) for k in range(16)], 'draft_aliens.gif')
    save_gif([comet(k / 20) for k in range(20)], 'draft_comet.gif', ms=80)
    save_gif([asteroid(k / 20) for k in range(20)], 'draft_asteroid.gif', ms=90)
    save_gif([hail_mary(k / 16) for k in range(16)], 'draft_hail_mary.gif', scale=5)


if __name__ == '__main__':
    main()
