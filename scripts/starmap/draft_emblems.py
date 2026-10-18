"""Concept art for the rank emblems: a star's life, from stardust to a black hole (pixel-art/emblems/).

    .venv\\Scripts\\python scripts\\starmap\\draft_emblems.py

Drafts for docs/star-map/STAR_GAZER_MISSION.md, not used by the site yet. Each emblem is 16 x 16 pixels (the size it
would have in the page header), drawn from simple shapes so the look is easy to tune, and saved enlarged
10x as draft_<stage>.png, plus a labelled ladder (draft_ladder.png), a mock-up of the header with the
achievements bar (draft_header.png) and short animated GIFs of the moving ones. References for each stage
are in pixel-art/references/stars/ (sources in pixel-art/references/SOURCES.md).
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'pixel-art' / 'emblems'
N, SCALE = 16, 10
BG = (7, 11, 26)
C = {   # the site's palette plus a few star colours
    'dust1': (43, 47, 94), 'dust2': (74, 63, 122), 'dust3': (138, 94, 168), 'dust4': (200, 127, 160),
    'white': (255, 255, 255), 'pale': (255, 241, 176), 'yellow': (255, 211, 77), 'orange': (255, 154, 60),
    'deep': (224, 96, 42), 'red': (196, 60, 42), 'dark': (122, 31, 26), 'ice': (159, 216, 255),
    'blue': (74, 127, 214), 'violet': (181, 108, 255), 'deepviolet': (106, 63, 176), 'black': (0, 0, 0),
}


def hash01(*args):
    """Deterministic 0..1 noise (same pixels every run)."""
    x = math.sin(sum((i + 1) * 12.9898 * a for i, a in enumerate(args)) + 78.233) * 43758.5453
    return x - math.floor(x)


def canvas():
    return [[None] * N for _ in range(N)]


def put(g, x, y, col):
    if 0 <= x < N and 0 <= y < N:
        g[y][x] = C[col] if isinstance(col, str) else col


def disc(g, cx, cy, r, shade):
    """Filled disc; shade(dx, dy, dist) -> colour name."""
    for y in range(N):
        for x in range(N):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d <= r:
                put(g, x, y, shade(dx, dy, d / r))


def ring(g, cx, cy, rx, ry, col, step=0.05, keep=lambda a: True):
    a = 0.0
    while a < 2 * math.pi:
        if keep(a):
            put(g, round(cx - 0.5 + rx * math.cos(a)), round(cy - 0.5 + ry * math.sin(a)), col)
        a += step


# ---- the stages (t = animation phase 0..1 for the GIFs)
def stardust(t=0):
    g = canvas()
    for y in range(N):
        for x in range(N):
            d = math.hypot(x - 7.5, (y - 7.5) * 1.3)
            n = hash01(x // 2, y // 2) * 0.6 + hash01(x, y) * 0.4 - d / 18
            if n > 0.3: put(g, x, y, 'dust4' if n > 0.62 else 'dust3' if n > 0.5 else 'dust2' if n > 0.4 else 'dust1')
    put(g, 3, 4, 'white'); put(g, 12, 11, 'ice')
    return g


def protostar(t=0):
    g = canvas()
    disc(g, 8, 8, 3.2, lambda dx, dy, f: 'white' if f < 0.35 else 'pale' if f < 0.65 else 'orange')
    for x in range(1, 15):   # the dusty disk seen edge-on, dark across the middle
        put(g, x, 8, 'dark' if 4 <= x <= 11 else 'dust2')
        if x in (2, 3, 12, 13):
            put(g, x, 7, 'dust1')
            put(g, x, 9, 'dust1')
    for y in (0, 1, 2, 13, 14, 15):   # jets
        put(g, 8, y, 'ice' if y in (2, 13) else 'blue')
    return g


def main_sequence(t=0):
    g = canvas()
    disc(g, 8, 8, 4.5, lambda dx, dy, f: 'white' if (dx < -1 and dy < -1 and f < 0.6) else 'pale' if f < 0.55 else 'yellow')
    rays = 2 if math.sin(t * 2 * math.pi) > 0 else 1
    for k in range(1, rays + 2):
        for x, y in ((8 - 1, 8 - 5 - k), (8 - 1, 8 + 4 + k), (8 - 5 - k, 8 - 1), (8 + 4 + k, 8 - 1)):
            put(g, x, y, 'yellow')
    return g


def red_giant(t=0):
    g = canvas()
    disc(g, 8, 8, 6.4, lambda dx, dy, f: 'dark' if f > 0.92 else 'red' if f > 0.75 or hash01(dx // 2, dy // 2) < 0.22
         else 'deep' if hash01(dx, dy) < 0.5 else 'orange')
    return g


def supergiant(t=0):
    g = canvas()
    r = 7.4 + 0.4 * math.sin(t * 2 * math.pi)   # it pulses
    disc(g, 8, 8, r, lambda dx, dy, f: 'dark' if f > 0.9 else 'red' if hash01(dx // 3, dy // 3) < 0.35 else 'deep')
    for k in range(10):   # shed dust around it
        a = k * 0.63 + t
        put(g, round(7.5 + 7.8 * math.cos(a)), round(7.5 + 7.8 * math.sin(a)), 'dust3')
    return g


def supernova(t=0):
    g = canvas()
    shell = 3 + 4 * t
    ring(g, 8, 8, shell, shell, 'orange' if t < 0.6 else 'red', step=0.03, keep=lambda a: hash01(round(a * 9)) > 0.25)
    for k in range(8):
        a = k * math.pi / 4
        for s in range(1, 1 + round(2 + 4 * (1 - abs(0.5 - t)))):
            put(g, round(7.5 + s * math.cos(a)), round(7.5 + s * math.sin(a)), 'pale' if s < 3 else 'yellow')
    disc(g, 8, 8, 1.6, lambda *_: 'white')
    return g


def neutron_star(t=0):
    g = canvas()
    a = t * 2 * math.pi
    for sign in (1, -1):   # two beams sweeping round
        for s in range(2, 9):
            for w in (-0.2, -0.1, 0, 0.1, 0.2):   # a cone: wider further out
                if abs(w) > 0.05 * s: continue
                put(g, round(7.5 + sign * s * math.cos(a + w)), round(7.5 + sign * s * math.sin(a + w)),
                    'ice' if s < 4 else 'violet' if s < 6 else 'deepviolet')
    disc(g, 8, 8, 1.7, lambda dx, dy, f: 'white' if f < 0.6 else 'ice')
    return g


def black_hole(t=0):
    g = canvas()
    def disk_colour(a):
        n = hash01(round((a / (2 * math.pi) + t) * 24) % 24)
        return 'white' if n > 0.85 else 'pale' if n > 0.6 else 'yellow' if n > 0.3 else 'orange'
    a = 0.0
    while a < 2 * math.pi:   # far half of the disk, behind the hole
        if math.sin(a) < 0:
            put(g, round(7.5 + 7.2 * math.cos(a)), round(7.5 + 2.2 * math.sin(a)), disk_colour(a))
        a += 0.04
    ring(g, 8, 8, 5.4, 5.0, 'orange', step=0.04, keep=lambda a: math.sin(a) < -0.1)    # lensed light over the top
    ring(g, 8, 8, 4.4, 4.2, 'deep', step=0.05, keep=lambda a: math.sin(a) > 0.55)      # ...and under the bottom
    disc(g, 8, 8, 3.3, lambda dx, dy, f: 'pale' if f > 0.86 else 'black')                # photon ring + shadow
    a = 0.0
    while a < 2 * math.pi:   # near half of the disk, in front
        if math.sin(a) >= 0:
            put(g, round(7.5 + 7.2 * math.cos(a)), round(7.5 + 2.2 * math.sin(a)), disk_colour(a))
            put(g, round(7.5 + 6.2 * math.cos(a)), round(7.5 + 1.6 * math.sin(a)), 'deep')
        a += 0.04
    return g


def white_dwarf(t=0):
    g = canvas()
    ring(g, 8, 8, 6, 6, 'blue', step=0.09)
    ring(g, 8, 8, 5, 5, 'ice', step=0.16, keep=lambda a: math.cos(a * 3) > 0)
    disc(g, 8, 8, 1.8, lambda dx, dy, f: 'white' if f < 0.7 else 'ice')
    return g


def white_hole(t=0):
    g = canvas()
    for k in range(12):   # everything comes out
        a = k * math.pi / 6 + 0.2
        s = 3 + ((t * 6 + k) % 6)
        put(g, round(7.5 + s * math.cos(a)), round(7.5 + s * math.sin(a)), 'violet' if s > 6 else 'ice')
    ring(g, 8, 8, 3.6, 3.6, 'violet', step=0.08)
    disc(g, 8, 8, 2.8, lambda dx, dy, f: 'white')
    return g


LADDER = [   # stage file name, title, how it is reached (docs/star-map/STAR_GAZER_MISSION.md)
    ('0-stardust', stardust, 'STARDUST', 'start'),
    ('1-protostar', protostar, 'PROTOSTAR', '1 achievement'),
    ('2-main-sequence', main_sequence, 'YOUNG STAR', '5'),
    ('3-red-giant', red_giant, 'RED GIANT', '10'),
    ('4-supergiant', supergiant, 'SUPERGIANT', '18'),
    ('5-supernova', supernova, 'SUPERNOVA', '28'),
    ('6-neutron-star', neutron_star, 'PULSAR', '40'),
    ('7-black-hole', black_hole, 'BLACK HOLE', 'STAR GAZER'),
]
ALTERNATES = [
    ('alt-white-dwarf', white_dwarf, 'WHITE DWARF', "Sun's real fate"),
    ('alt-white-hole', white_hole, 'WHITE HOLE', 'new game +'),
]
STILL = {'5-supernova': 0.45, '6-neutron-star': 0.1}   # the best frame for the still pictures
ANIMATED = {'4-supergiant', '5-supernova', '6-neutron-star', '7-black-hole', 'alt-white-hole', '2-main-sequence'}


def render(g, scale=SCALE, bg=BG):
    img = Image.new('RGB', (N, N), bg)
    for y, row in enumerate(g):
        for x, col in enumerate(row):
            if col: img.putpixel((x, y), col)
    return img.resize((N * scale, N * scale), Image.NEAREST)


def font(size):
    for name in ('consola.ttf', 'DejaVuSansMono.ttf', 'cour.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn, _, _ in LADDER + ALTERNATES:
        render(fn(STILL.get(name, 0.25))).save(OUT / f'draft_{name}.png')
        if name in ANIMATED:
            frames = [render(fn(k / 12), 6) for k in range(12)]
            frames[0].save(OUT / f'draft_{name}.gif', save_all=True, append_images=frames[1:], duration=110, loop=0)
    # the ladder, labelled
    cell, f = 130, font(13)
    rows = [LADDER, ALTERNATES]
    sheet = Image.new('RGB', (cell * len(LADDER), cell * 2 + 30), BG)
    d = ImageDraw.Draw(sheet)
    for r, stages in enumerate(rows):
        for i, (name, fn, title, how) in enumerate(stages):
            x, y = i * cell, r * (cell + 30)
            sheet.paste(render(fn(STILL.get(name, 0.25)), 6), (x + (cell - 96) // 2, y + 4))
            d.text((x + cell // 2, y + 104), title, fill=(255, 211, 77), font=f, anchor='mm')
            d.text((x + cell // 2, y + 120), how, fill=(154, 166, 214), font=f, anchor='mm')
            if r == 0 and i < len(stages) - 1:
                d.text((x + cell - 4, y + 52), '›', fill=(74, 85, 144), font=font(22), anchor='mm')
    d.text((8, cell + 8), 'alternative ends:', fill=(154, 166, 214), font=f)
    sheet.save(OUT / 'draft_ladder.png')
    # header mock-up: emblem, rank, achievements bar, gear
    s = 3
    head = Image.new('RGB', (380 * s, 34 * s), BG)
    d = ImageDraw.Draw(head)
    d.text((6 * s, 17 * s), 'KEPLER STAR MAP', fill=(255, 211, 77), font=font(15 * s), anchor='lm')
    head.paste(render(red_giant(0.25), 2 * s), (206 * s, 1 * s))
    d.text((242 * s, 9 * s), 'RED GIANT', fill=(255, 211, 77), font=font(8 * s), anchor='lm')
    d.rectangle((242 * s, 17 * s, 330 * s, 25 * s), outline=(42, 53, 102), width=s)
    d.rectangle((243 * s, 18 * s, (243 + int(86 * 11 / 46)) * s, 24 * s), fill=(255, 211, 77))
    d.text((334 * s, 21 * s), '11/46', fill=(154, 166, 214), font=font(8 * s), anchor='lm')
    d.rectangle((356 * s, 6 * s, 376 * s, 28 * s), outline=(42, 53, 102), width=s)
    gear = Image.new('RGB', (N, N), BG)   # a pixel gear for the button
    gd = canvas()
    ring(gd, 8, 8, 4.5, 4.5, 'white', step=0.05)
    for k in range(8):
        put(gd, round(7.5 + 6 * math.cos(k * math.pi / 4)), round(7.5 + 6 * math.sin(k * math.pi / 4)), 'white')
    head.paste(render(gd, s).resize((18 * s, 18 * s), Image.NEAREST), (357 * s, 8 * s))
    del gear
    head.save(OUT / 'draft_header.png')
    print(f'Saved drafts in {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
