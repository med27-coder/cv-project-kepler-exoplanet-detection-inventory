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
KEY = (255, 0, 255)   # transparent in the background-free drafts


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


def save_gif(frames, name, scale=6, ms=110, transparent=False):
    imgs = [f.img.resize((f.w * scale, f.h * scale), Image.NEAREST) for f in frames]
    if transparent:   # the KEY colour becomes transparent in every frame
        pal = [im.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
        out = []
        for im in pal:
            idx = next((i for i, c in enumerate(im.getpalette()[:765:3]) if tuple(im.getpalette()[i * 3:i * 3 + 3]) == KEY), 0)
            im.info['transparency'] = idx
            out.append(im)
        out[0].save(OUT / name, save_all=True, append_images=out[1:], duration=ms, loop=0, disposal=2,
                    transparency=out[0].info['transparency'])
    else:
        imgs[0].save(OUT / name, save_all=True, append_images=imgs[1:], duration=ms, loop=0)
    print(f'{(OUT / name).relative_to(ROOT)}  {len(frames)} frames')


# ---- "What the alien doing"
ALIEN_INK = {'g': '#4fd17a', 'G': '#2f8a4a', 'k': '#000000', 'w': '#ffffff', 'b': '#7a5a3a'}
DRIVER = ['.ggg.', 'gkgkg', 'ggggg', '.ggg.', '..g..']            # big black eyes
WAVER = ['.ggg.', 'gkgkg', 'ggggg', '.ggg.', '..g..']
PEACE = [['g.g', 'g.g', '.g.', '.g.'], ['g..g', 'g..g', '.gg.', '.g..']]   # V sign, wiggling


def aliens(t, sky=True, space=False, rare=False):
    """Two green aliens in a silver flying saucer under a glass dome, one at the controls, one flashing a peace
    sign (after the user's reference, redrawn as pixel art; the reference itself is not committed)."""
    W, H = 96, 64
    f = Frame(W, H, seed=3)
    if not sky:   # draft 2: no sky, a key colour that becomes transparent (to fly over the site's night sky)
        f.img.paste(KEY, (0, 0, W, H))
    if space:   # travelling through space: a steady starfield drifting past (no twinkling, nothing flashing)
        sky = False
        f.img.paste(BG, (0, 0, W, H))
        starfield(f, t, W, H)
        if rare:   # the rare version: an asteroid tumbles past behind the saucer (WHAT WAS THAT?)
            rock(f, W + 14 - t * (W + 28), 20 + 10 * t, 8, t * 2 * math.pi * 0.75)
    for y in range(H if sky else 0):   # a daytime sky, lighter towards the bottom
        c = '#3f86d6' if y < 20 else '#5a9be0' if y < 42 else '#79b2ea'
        for x in range(W):
            f.put(x, y, c)
    for cx0, cy0, r0 in ([(10, 50, 9), (20, 54, 7), (84, 46, 8), (92, 50, 7), (74, 10, 5), (82, 9, 4), (14, 12, 4)] if sky else []):
        f.disc(cx0, cy0, r0, lambda dx, dy, q: '#ffffff' if dy < 1 or q < 0.6 else '#dce9f7')   # puffy clouds
    bob = round(math.sin(t * 2 * math.pi) * 1.5)
    cx, cy = 48, 36 + bob
    # the lower hull: a dark ring with vents and glowing pods underneath
    for x in range(cx - 30, cx + 31):
        e = (x - cx) / 30
        for y in range(cy + 3, cy + 9):
            if ((y - cy - 3) / 6) ** 2 + e ** 2 <= 1:
                f.put(x, y, '#5d6878' if (x + y) % 5 else '#454b5e')
    for k, col in enumerate(['#ff6ec7', '#4fd17a', '#9fd8ff']):
        f.disc(cx - 10 + k * 10, cy + 9, 1.6, lambda dx, dy, q, c=col: c)
    # the main saucer: silver with an iridescent sheen and panel lines
    sheen = ['#eef2f8', '#d6dae2', '#e9d5ff', '#c9f0ee', '#d6dae2', '#b8c0cc']
    for x in range(cx - 36, cx + 37):
        e = (x - cx) / 36
        for y in range(cy - 4, cy + 5):
            if ((y - cy) / 4.5) ** 2 + e ** 2 <= 1:
                band = sheen[int((x - cx + 36) / 12 + t * 2) % len(sheen)]
                c = '#9aa6b8' if y >= cy + 2 else band
                if (x - cx) % 11 == 0 and y < cy + 2:
                    c = '#7d8596'   # panel seams
                f.put(x, y, c)
    lights = ['#4fd17a', '#ff6ec7', '#ffd34d', '#9fd8ff', '#ff9a3c']
    for k in range(9):   # rim lights blink in a chase
        x = cx - 32 + k * 8
        on = (k + int(t * 12)) % 3 != 0
        f.put(x, cy, lights[k % len(lights)] if on else '#7d8596')
        f.put(x + 1, cy, lights[k % len(lights)] if on else '#7d8596')
    # the aliens: big black eyes, green skin, silver suits
    def alien(ax, ay, antennae, wave):
        for y in range(ay + 7, ay + 12):   # shoulders in a silver suit
            for x in range(ax - 4, ax + 5):
                f.put(x, y, '#c9d2de' if abs(x - ax) < 4 else '#9aa6b8')
        f.put(ax, ay + 8, '#4fd17a')   # suit badge
        f.disc(ax, ay + 2, 5.2, lambda dx, dy, q: '#3fae4a' if dx > 2.5 else '#5fd06a')   # head
        for ex in (-2.5, 2.5):   # the eyes: big black ovals with a glint
            for y in range(ay + 1, ay + 4):
                for x in range(round(ax + ex - 1), round(ax + ex + 1) + 1):
                    f.put(x, y, '#0a0a12')
            f.put(round(ax + ex - 1), ay + 1, '#ffffff')
        f.put(ax - 1, ay + 5, '#2a6a30'); f.put(ax, ay + 6, '#2a6a30'); f.put(ax + 1, ay + 5, '#2a6a30')   # a smile
        if antennae:
            for k in range(3):
                f.put(ax - 3 - k // 2, ay - 3 - k, '#5fd06a'); f.put(ax + 3 + k // 2, ay - 3 - k, '#5fd06a')
            f.put(ax - 5, ay - 6, '#5fd06a'); f.put(ax + 5, ay - 6, '#5fd06a')
        if wave is not None:   # the peace sign: an arm up, a palm, two fingers in a V that wiggles
            hx, hy = ax + 9, ay - 1 + wave
            for y in range(hy + 5, ay + 9):
                f.put(ax + 5, y, '#c9d2de'); f.put(ax + 6, y, '#c9d2de')   # sleeve
            for y in range(hy + 3, hy + 6):
                for x in range(hx - 2, hx + 1):
                    f.put(x, y, '#5fd06a')   # palm
            f.put(hx + 1, hy + 4, '#5fd06a')   # thumb
            for k in range(3):
                f.put(hx - 2 - (k == 0), hy + 2 - k, '#5fd06a')   # index finger, leaning left
                f.put(hx + (k == 0), hy + 2 - k, '#5fd06a')       # middle finger, leaning right
            f.put(hx - 1, hy + 3, '#3fae4a')   # folded fingers
    for y in range(cy - 23, cy - 3):   # the dome's glass, a faint tint behind the aliens
        for x in range(cx - 19, cx + 20):
            if math.hypot(x - cx, (y - cy + 4)) < 18.5 and (x + y) % 2 == 0:
                f.put(x, y, '#a9d2f2')
    wiggle = int(t * 8) % 2
    alien(cx - 8, cy - 15, False, None)
    for x in range(cx - 13, cx - 5):   # control stick and console glow
        f.put(x, cy - 5, '#454b5e')
    f.put(cx - 10, cy - 6, '#ff6ec7'); f.put(cx - 7, cy - 6, '#4fd17a')
    alien(cx + 7, cy - 15, True, wiggle)
    # the glass dome over both, with a bright highlight
    for a in range(0, 181, 3):
        r = math.radians(a)
        x, y = round(cx + 19 * math.cos(r)), round(cy - 4 - 19 * math.sin(r))
        f.put(x, y, '#ffffff' if 110 < a < 150 else '#cfe8ff')
    # motion swirls around the hull
    for k in range(16):
        a = k / 16 * 2 * math.pi + t * 2 * math.pi
        if math.sin(a) > 0.2:
            continue
        f.put(round(cx + 42 * math.cos(a)), round(cy + 2 + 9 * math.sin(a)), '#e8f4ff')
    return f



# ---- drafts 2: space travel, asteroids, comets and meteors drawn the way they really look
def starfield(f, t, W, H):
    """Stars drifting left at three speeds (parallax), so the scene reads as travelling; they never blink."""
    for k in range(90):
        speed = (1, 2, 3)[k % 3]
        x = round(((k * 37) % W) - t * W * speed / 3) % W
        y = (k * 53 + k // 7) % H
        f.put(x, y, ('#2a3360', '#5a6a9a', '#c8d0ff')[k % 3])


def rock(f, cx, cy, r, rot, light=(-0.8, -0.6)):
    """A lumpy, cratered rock lit from one side, turning by `rot`: an asteroid as it really looks (no glow, no
    tail: in empty space nothing burns)."""
    for y in range(math.floor(cy - r * 1.4), math.ceil(cy + r * 1.4) + 1):
        for x in range(math.floor(cx - r * 1.4), math.ceil(cx + r * 1.4) + 1):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            a, d = math.atan2(dy, dx), math.hypot(dx, dy)
            edge = r * (1 + 0.22 * math.sin(2 * a + rot) + 0.12 * math.sin(5 * a - rot * 1.3))
            if d > edge:
                continue
            lit = (dx * light[0] + dy * light[1]) / max(edge, 1)
            c = '#b0a698' if lit > 0.35 else '#8a8176' if lit > -0.15 else '#5d564e' if lit > -0.55 else '#3a352f'
            u = (a + rot) % (2 * math.pi)
            if math.hypot(u - 2.0, d / edge - 0.45) < 0.22 or math.hypot(u - 4.4, d / edge - 0.3) < 0.18:
                c = '#4a443e'   # craters, turning with the rock
            f.put(x, y, c)


def asteroid_v2(t):
    """An asteroid as it really is: a dark, cratered, lumpy rock tumbling slowly, lit on one side, with a little
    moon like Ida's Dactyl."""
    f = Frame(64, 40, seed=9)
    rot = t * 2 * math.pi
    a = rot * 1.5
    mx, my = 32 + 20 * math.cos(a), 20 + 6 * math.sin(a)
    moon = lambda: f.disc(mx, my, 1.6, lambda dx, dy, q: '#8a8176' if dx < 0 else '#5d564e')
    if math.sin(a) < 0:
        moon()
    rock(f, 32, 20, 9, rot)
    if math.sin(a) >= 0:
        moon()
    return f


def comet_v2(t):
    """A comet as it really is: a small dark nucleus in a glowing coma, a straight bluish ion tail and a broad,
    curved, whiter dust tail, both pointing away from the Sun (off to the left), not behind the comet's motion."""
    W, H = 96, 48
    f = Frame(W, H, seed=11)
    for x in range(10):   # the Sun's glow fading in from the left edge
        c = ['#fff1b0', '#ffe28a', '#ffd34d', '#c9a23a', '#8a6d1f', '#5a4a2a', '#3a3020', '#241e16', '#16131a', '#0d0d1c'][x]
        for y in range(H):
            if x < 4 or (x + y) % (x - 2) == 0:
                f.put(x, y, c)
    hx, hy = 66 - t * 26, 12 + t * 18   # heading down and left, towards the Sun
    for k in range(2, 44):   # the dust tail: a fan that widens and curves, fading with distance
        half = 0.6 + k * 0.16
        for w10 in range(int(-half * 10), int(half * 10) + 1, 5):
            w = w10 / 10
            x, y = hx + k, hy + w + (k / 16) ** 2 * 3
            fade = k / 44 + abs(w) / (half * 3)
            if fade > 0.95 or (fade > 0.6 and (round(x) + round(y)) % 2):
                continue
            f.put(x, y, '#f4ecd6' if fade < 0.3 else '#d8c8a0' if fade < 0.55 else '#8a7a5a')
    for k in range(2, 46):   # the ion tail: thin, straight, blue, pointing exactly away from the Sun
        if k < 30 or k % 2 == 0:
            f.put(hx + k, hy - 1, '#9fd8ff' if k < 18 else '#4a7fd6')
    f.disc(hx, hy, 3.4, lambda dx, dy, q: '#ffffff' if q < 0.35 else '#cfeaff' if q < 0.7 else '#6aa8d6')   # the coma
    f.put(hx, hy, '#4a443e')   # the nucleus: dark ice and dust, a few kilometres across
    return f

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]   # ordered dither, as the night sky uses


def comet_v3(t):
    """A comet after real photos (Comet Lovejoy from the space station, 2011; NEOWISE, 2020): a tiny, very bright
    head with a soft glow; a long dust tail, bright near the head, widening and fading into a gently curved plume;
    and a faint, thin, bluish ion tail beside it, barely there. Both point away from the Sun (to the left)."""
    W, H = 96, 48
    f = Frame(W, H, seed=11)
    hx, hy = 30 - t * 6, 32 - t * 4          # drifting slowly; the Sun is off to the left
    ax, ay = 0.92, -0.39                      # the tail's direction (away from the Sun), unit length
    L = 64                                    # tail length in pixels
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - hx, y + 0.5 - hy
            u = dx * ax + dy * ay              # distance along the tail
            if u <= 0 or u > L:
                continue
            v = -dx * ay + dx * 0 + dy * ax    # distance across it (positive: below the axis)
            v -= (u / L) ** 2 * 6              # the dust tail curves gently
            half = 1.0 + u * 0.19   # the plume widens like Lovejoy's
            threshold = (BAYER[y % 4][x % 4] + 0.5) / 16
            dust = (1 - u / L) ** 1.3 * max(0.0, 1 - (v / half) ** 2)
            if dust > threshold:
                f.put(x, y, '#ffffff' if dust > 0.75 else '#f4ecd6' if dust > 0.45 else '#c9bfa4' if dust > 0.22 else '#7a735f')
                continue
            vi = -dx * ay + dy * ax + 1.6 + u * 0.04   # the ion tail: straight, just off the dust tail
            ion = 0.42 * (1 - u / L) * max(0.0, 1 - (vi / 0.9) ** 2)
            if ion > threshold:
                f.put(x, y, '#9fc8f0' if u < 24 else '#4a78b8')
    f.disc(hx, hy, 2.8, lambda dx, dy, q: '#dfefff' if BAYER[round(dy) % 4][round(dx) % 4] < 16 * (1 - q) else None)   # coma
    f.disc(hx, hy, 1.3, lambda dx, dy, q: '#ffffff')   # the bright head
    return f

def meteor_v2(t):
    """A meteor: a small rock burning up in a planet's air (80 to 120 km up), seen from orbit over the planet's
    edge. Fire only happens in an atmosphere (after the user's meteor photos, redrawn)."""
    W, H = 96, 48
    f = Frame(W, H, seed=13)
    for x in range(W):   # the planet's curved edge and its thin glowing air
        limb = 32 + round(((x - 48) / 56) ** 2 * 18)   # the horizon arcs down at the sides
        for y in range(limb, H):
            f.put(x, y, '#2a4a7a' if y < limb + 3 else '#1a2a4a')
        f.put(x, limb - 1, '#9fd8ff')
        f.put(x, limb - 2, '#4a7fd6')
    hx, hy = 78 - t * 52, 22 + t * 14
    for k in range(1, 26):   # the burning trail fades behind the head
        x, y = hx + k * 1.2, hy - k * 0.32
        c = '#fff1b0' if k < 4 else '#ffd34d' if k < 9 else '#ff9a3c' if k < 16 else '#a8552e'
        f.put(x, y, c)
        if k < 10 and k % 2:
            f.put(x, y + 1, '#ff9a3c')
    f.disc(hx, hy, 1.6, lambda dx, dy, q: '#ffffff')
    for k in range(4):   # sparks breaking off
        f.put(hx + 4 + k * 3 + (t * 37 % 3), hy + 1 + (k % 2), '#ffd34d')
    return f


def hash01(x, y):
    """A steady pseudo-random number in 0..1 for a pixel (scattered, but the same every frame)."""
    v = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return v - math.floor(v)


# Meteor colours come from what burns: green-blue (magnesium, nickel), yellow-orange (sodium), red (the air itself).
METEOR_INK = ['#ffffff', '#d8ffe8', '#9ff0b8', '#ffe28a', '#ff9a3c', '#c44a3a']


def meteor_streak(f, x0, y0, x1, y1, phase):
    """One meteor's life over phase 0..1: it appears, streaks along a thin straight line (head white-green, the
    trail cooling to yellow, orange, red), flares near the end, then leaves a faint glowing trail that fades."""
    length = math.hypot(x1 - x0, y1 - y0)
    if phase <= 0 or phase >= 1:
        return
    travel = min(1.0, phase / 0.6)                     # 60% of its life moving, then the fade
    hx, hy = x0 + (x1 - x0) * travel, y0 + (y1 - y0) * travel
    trail = length * 0.6
    if phase < 0.6:
        for k in range(int(trail)):   # a thin trail behind the head, cooling and thinning
            q = k / trail
            if q > 0.55 and k % 2:
                continue
            x, y = hx - (x1 - x0) / length * k, hy - (y1 - y0) / length * k
            if math.hypot(x - x0, y - y0) > length * travel:
                break
            f.put(x, y, METEOR_INK[min(5, 1 + int(q * 5))])
            if q < 0.25:
                f.put(x, y + 1, METEOR_INK[2])   # thicker, brighter near the head
        flare = 2.0 if travel > 0.8 else 1.3           # it flares as it breaks up
        f.disc(hx, hy, flare, lambda dx, dy, q: '#ffffff' if q < 0.6 else '#d8ffe8')
    else:   # the persistent train: a faint green line that fades away
        fade = (phase - 0.6) / 0.4
        for k in range(int(length)):
            if (k + int(fade * 7)) % 3 or (k / length) < fade * 0.8:
                continue
            f.put(x0 + (x1 - x0) / length * k, y0 + (y1 - y0) / length * k, '#3f8a5a' if fade < 0.5 else '#244a3a')


def meteor_v3a(t):
    """From orbit, over the night side: city lights below, the thin green airglow layer (about 90 to 100 km up)
    along the horizon, and a meteor burning through it, at the same height, 70 to 120 km."""
    W, H = 96, 48
    f = Frame(W, H, seed=13)
    for x in range(W):
        limb = 30 + round(((x - 48) / 56) ** 2 * 18)   # the horizon arcs down at the sides
        for y in range(limb, H):
            f.put(x, y, '#0d1428')
            if hash01(x, y) < 0.025 and y > limb + 3:
                f.put(x, y, '#ffd34d' if hash01(y, x) < 0.6 else '#ff9a3c')   # city lights, scattered
        f.put(x, limb - 1, '#1f6a4a')   # the airglow band
        f.put(x, limb - 2, '#3fae6a')
        if x % 3:
            f.put(x, limb - 3, '#1f4a3a')
    meteor_streak(f, 82, 22, 30, 27, (t - 0.15) / 0.8)   # through the airglow, at its height
    return f


def meteor_v3b(t):
    """From the ground, as in photos of the Perseids: a dark sky with the faint Milky Way, a tree line, and a thin
    straight streak that flashes across and fades."""
    W, H = 96, 48
    f = Frame(W, H, seed=21)
    for y in range(H):   # a faint glow low on the horizon (towns far away), as in the Perseid photos
        for x in range(W):
            if y > 26 and hash01(x, y) < (y - 26) / 30:
                f.put(x, y, '#1a2238' if y < 34 else '#2a2a30')
    for y in range(H):   # the Milky Way: a soft diagonal band of faint glow and extra stars
        for x in range(W):
            d = abs(y - (6 + x * 0.3))
            if d < 6 and hash01(x, y) < 0.18 * (1 - d / 6):
                f.put(x, y, '#2a3360' if hash01(y, x) < 0.8 else '#5a6a9a')
    for x in range(W):   # the tree line
        top = 40 - round(5 * abs(math.sin(x * 0.7)) + 3 * abs(math.sin(x * 0.23)))
        for y in range(top, H):
            f.put(x, y, '#03050b')
    meteor_streak(f, 84, 4, 34, 22, (t - 0.2) / 0.7)
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


# ---- page background: a pixel night sky (docs/plans/BACKGROUND.md)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
SKY_BANDS = ['#070b1a', '#0a1230', '#0d1d40', '#10294f', '#12385e', '#14506e', '#17707f', '#1fa0a8']


def noise1(x, seed):
    v = math.sin(x * 12.9898 + seed * 78.233) * 43758.5453
    return v - math.floor(v)


def background(t, w=320, h=180):
    f = Frame(w, h, seed=0)
    horizon = h - 34
    for y in range(h):   # gradient, dithered between bands (no smooth blends: pixel art)
        pos = min(1, y / horizon) * (len(SKY_BANDS) - 1)
        lo = int(pos)
        frac = pos - lo
        for x in range(w):
            k = lo + (1 if frac * 16 > BAYER[y % 4][x % 4] else 0)
            f.put(x, y, SKY_BANDS[min(k, len(SKY_BANDS) - 1)])
    colours = ['#ffffff', '#fff1b0', '#9fd8ff', '#ffd34d', '#ff9a3c', '#7ff0e0']
    for k in range(260):   # stars, thinning toward the horizon, twinkling
        x, y = int(noise1(k, 1) * w), int(noise1(k, 2) ** 1.6 * horizon)
        c = colours[k % len(colours)]
        if math.sin(t * 2 * math.pi * (1 + k % 3) + k) < -0.6:
            continue
        f.put(x, y, c)
        if k % 17 == 0:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                f.put(x + dx, y + dy, c)
    f.disc(64, 44, 4, lambda dx, dy, q: '#e8f4ff' if q < 0.4 else '#4a8fd6' if q < 0.75 else None)   # a bright blue star
    for dx, dy in ((5, 0), (-5, 0), (0, 5), (0, -5), (6, 0), (-6, 0)):
        f.put(64 + dx, 44 + dy, '#9fd8ff')
    p = (t * 1.6) % 1   # a shooting star now and then
    if p < 0.45:
        sx, sy = 150 + p * 120, 20 + p * 50
        for k in range(14):
            f.put(sx - k, sy - k * 0.42, '#ffffff' if k < 3 else '#9fd8ff' if k < 8 else '#2b5a8a')
    for band, (y0, col, rim, n) in enumerate([(92, '#0e2340', '#24507a', 4), (114, '#123a58', '#2f8098', 5), (132, '#16566a', '#46b8c0', 6)]):
        drift = t * (6 + band * 4)
        for c in range(n):   # puffy clouds: overlapping round lumps on a flat base, drifting slowly
            cx = (noise1(c, band + 3) * (w + 80) + drift) % (w + 80) - 40
            size = 7 + band * 2 + noise1(c, band + 8) * 5
            lumps = [(cx + (j - 2) * size * 0.8, y0 - noise1(c * 7 + j, band) * size * 0.6, size * (0.6 + noise1(j, c + band) * 0.5))
                     for j in range(5)]
            for (lx, ly, r) in lumps:
                for y in range(int(ly - r), y0 + 4):
                    for x in range(int(lx - r), int(lx + r) + 1):
                        d = math.hypot(x - lx, y - ly)
                        if d <= r or (y >= ly and abs(x - lx) <= r):
                            top_edge = d > r - 1.2 and y < ly and (x - lx) < r * 0.4
                            f.put(x, y, rim if top_edge else col)
    for x in range(w):   # tree line, two layers
        back = horizon + 6 - 9 * noise1(x // 3, 7) - 4 * math.sin(x / 17)
        front = horizon + 14 - 7 * noise1(x // 2, 9) - 5 * math.sin(x / 11 + 2)
        for y in range(int(back), h):
            f.put(x, y, '#0f2a3f')
        for y in range(int(front), h):
            f.put(x, y, '#081626')
    return f


# ---- loading screen: a rock with moons (like asteroid Ida and its moon Dactyl), and "lost in orbit"
def loading(t, w=96, h=54):
    f = Frame(w, h, seed=13)
    cx, cy = 48, 24
    rot = t * 2 * math.pi
    for y in range(-7, 8):   # a lumpy potato-shaped rock, slowly turning
        for x in range(-11, 12):
            if (x / 11) ** 2 + (y / 7) ** 2 > 1 + 0.18 * math.sin(3 * math.atan2(y, x) + rot):
                continue
            crater = (round(x + rot * 3) % 6 == 0 and y % 4 == 1)
            f.put(cx + x, cy + y, '#5d5a55' if crater else '#b8b0a4' if x + y < -3 else '#8a8278')
    for k, (r, ry, speed, col) in enumerate([(17, 6, 1, '#d6dae2'), (24, 8, -0.6, '#c9a86a'), (30, 10, 0.4, '#9fd8ff')]):
        a = rot * speed + k * 2
        behind = math.sin(a) < 0
        x, y = cx + r * math.cos(a), cy + ry * math.sin(a)
        if behind and abs(x - cx) < 11 and abs(y - cy) < 7:
            continue
        f.disc(x, y, 1.6 if k == 1 else 1.2, lambda dx, dy, q, c=col: c)
    for k in range(int(t * 4) % 4):   # LOADING dots
        f.put(60 + k * 3, 46, '#ffd34d')
    for i, ch in enumerate('LOADING'):   # simple 3x5 letters (concept only)
        f.put(30 + i * 4, 46, '#ffd34d')
    return f


def lost_in_orbit(t, w=96, h=54):
    f = Frame(w, h, seed=17)
    cx, cy = 48 + 6 * math.sin(t * 2 * math.pi), 26 + 3 * math.cos(t * 2 * math.pi)
    spin = t * 2 * math.pi
    suit = ['.www.', 'wooow', 'wooow', '.www.', 'wwwww', 'wwwww', '.w.w.', '.w.w.']   # helmet with an orange visor, body, legs
    ink = {'w': '#e6ecff', 'o': '#ff9a3c'}
    for r, row in enumerate(suit):
        for c, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = c - 2, r - 4
            rx, ry = x * math.cos(spin) - y * math.sin(spin), x * math.sin(spin) + y * math.cos(spin)
            f.put(cx + rx, cy + ry, ink[ch])
    for k in range(18):   # a loose tether drifting off
        f.put(cx + 4 + k * 1.6, cy + 2 + math.sin(k / 3 + t * 6) * 2, '#4a5590')
    return f


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Drafts not used any more live in pixel-art/archive/ (the code that drew them stays above, for history).
    save_gif([lost_in_orbit(k / 20) for k in range(20)], 'draft_lost_in_orbit.gif', scale=5)
    save_gif([background(k / 12) for k in range(12)], 'draft_background.gif', scale=3, ms=140)
    save_gif([aliens(k / 16, sky=False) for k in range(16)], 'draft_aliens_2.gif', scale=5, transparent=True)
    save_gif([aliens(k / 24, space=True) for k in range(24)], 'draft_ufo_space_a.gif', scale=5)
    save_gif([aliens(k / 24, space=True, rare=True) for k in range(24)], 'draft_ufo_space_b.gif', scale=5)
    save_gif([asteroid_v2(k / 24) for k in range(24)], 'draft_asteroid_v2.gif', ms=110)
    save_gif([comet_v3(k / 24) for k in range(24)], 'draft_comet_v3.gif', scale=5, ms=100)
    save_gif([meteor_v3a(k / 24) for k in range(24)], 'draft_meteor_v3a.gif', scale=5, ms=80)
    save_gif([meteor_v3b(k / 24) for k in range(24)], 'draft_meteor_v3b.gif', scale=5, ms=80)
    save_gif([hail_mary(k / 16) for k in range(16)], 'draft_hail_mary.gif', scale=5)


if __name__ == '__main__':
    main()
