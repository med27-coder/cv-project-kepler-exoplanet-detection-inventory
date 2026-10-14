"""Colour-vision check of the star map's meaningful colours (colour-blind safety).

Simulates protanopia, deuteranopia and tritanopia (Machado et al. 2009, full severity) and requires
every pair of colours that carries meaning to stay distinguishable: OKLab distance x100 >= 8 for
normal vision and >= 8 under each simulation (the dataviz rule of thumb). If a colour changes in
web/src or style.css, change it here too.
"""

import itertools

import numpy as np
import pytest

# colours whose difference means something to the reader
GROUPS = {
    'map: Star Gazer verdict': {'likely planet': '#6cb4ff', 'likely false positive': '#ff8c42'},
    'map: star kinds': {'spotlight': '#ffd34d', 'drawn': '#c8d6ff', 'highlight': '#b56cff'},
    'planet temperature': {'molten': '#e8402a', 'scorching': '#ff9a3c', 'hot': '#f7e7a1',
                           'temperate': '#3a8f5c', 'icy': '#8fd3ff'},
    'case file': {'for': '#6fe39a', 'against': '#ff7a59'},
}
# Only neighbouring temperature bands are compared (they are an ordered scale, also labelled in text).
ORDERED = {'planet temperature'}
MACHADO = {
    'protanopia': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deuteranopia': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritanopia': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
MIN_DE = 8.0


def _linear(hex_color):
    rgb = np.array([int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]) / 255
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def _oklab(lin):
    lms = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                    [0.0883024619, 0.2817188376, 0.6299787005]]) @ np.clip(lin, 0, 1)
    return np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
                     [0.0259040371, 0.7827717662, -0.8086757660]]) @ np.cbrt(lms)


def delta_e(a, b, vision=None):
    la, lb = _linear(a), _linear(b)
    if vision:
        m = np.array(MACHADO[vision])
        la, lb = m @ la, m @ lb
    return float(np.linalg.norm(_oklab(la) - _oklab(lb)) * 100)


def pairs():
    for group, colours in GROUPS.items():
        items = list(colours.items())
        combos = zip(items, items[1:]) if group in ORDERED else itertools.combinations(items, 2)
        for (n1, c1), (n2, c2) in combos:
            yield pytest.param(c1, c2, id=f'{group}: {n1} vs {n2}')


@pytest.mark.parametrize('c1, c2', list(pairs()))
def test_meaningful_colours_stay_distinguishable(c1, c2):
    for vision in (None, *MACHADO):
        assert delta_e(c1, c2, vision) >= MIN_DE, (vision or 'normal vision', c1, c2, round(delta_e(c1, c2, vision), 1))
